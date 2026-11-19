import fs from 'node:fs/promises';
import path from 'node:path';
import type { Model3DStatus } from '../types/od01';

export interface Product3DJobRecord {
  productId: string;
  images: string[];
  model3dUrl: string | null;
  model3dStatus: Model3DStatus;
  model3dJobId: string | null;
  model3dEndpoint: string | null;
  model3dError: string | null;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'products-3d-state.json');
const LOCAL_MODELS_DIR = path.resolve(process.cwd(), 'public', 'models-3d');

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readAllProduct3DRecords(): Promise<Record<string, Product3DJobRecord>> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, Product3DJobRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getProduct3DRecord(productId: string): Promise<Product3DJobRecord | null> {
  const all = await readAllProduct3DRecords();
  return all[productId] ?? null;
}

export async function upsertProduct3DRecord(
  productId: string,
  patch: Partial<Omit<Product3DJobRecord, 'productId' | 'updatedAt'>>
): Promise<Product3DJobRecord> {
  const all = await readAllProduct3DRecords();
  const prev = all[productId];
  const next: Product3DJobRecord = {
    productId,
    images: patch.images ?? prev?.images ?? [],
    model3dUrl: patch.model3dUrl !== undefined ? patch.model3dUrl : (prev?.model3dUrl ?? null),
    model3dStatus: patch.model3dStatus ?? prev?.model3dStatus ?? 'none',
    model3dJobId:
      patch.model3dJobId !== undefined ? patch.model3dJobId : (prev?.model3dJobId ?? null),
    model3dEndpoint:
      patch.model3dEndpoint !== undefined
        ? patch.model3dEndpoint
        : (prev?.model3dEndpoint ?? null),
    model3dError:
      patch.model3dError !== undefined ? patch.model3dError : (prev?.model3dError ?? null),
    updatedAt: new Date().toISOString(),
  };

  all[productId] = next;
  await ensureDir(DATA_DIR);
  await fs.writeFile(STATE_FILE, JSON.stringify(all, null, 2), 'utf8');
  return next;
}

function sanitizeFileSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'product';
}

/**
 * Persists a generated `.glb` binary buffer into `models-3d/`:
 * 1. Vercel Blob (`BLOB_READ_WRITE_TOKEN`) when configured.
 * 2. Supabase Storage (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) when configured.
 * 3. Local persistent `public/models-3d/` directory served at `/models-3d/<file>.glb`.
 */
export async function uploadGlbToStorage(
  productId: string,
  glbBuffer: Buffer
): Promise<string> {
  const safeId = sanitizeFileSegment(productId);
  const fileName = `${safeId}-${Date.now()}.glb`;
  const objectPath = `models-3d/${fileName}`;

  // 1. Vercel Blob Storage (REST PUT API — zero extra SDK required)
  const vercelBlobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (vercelBlobToken) {
    const putUrl = `https://blob.vercel-storage.com/${objectPath}`;
    const res = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${vercelBlobToken}`,
        'Content-Type': 'model/gltf-binary',
        'x-content-type': 'model/gltf-binary',
        'x-add-random-suffix': '0',
      },
      body: new Uint8Array(glbBuffer),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Échec upload Vercel Blob (${res.status}): ${detail}`);
    }
    const payload = (await res.json()) as { url?: string };
    if (payload.url) {
      return payload.url;
    }
  }

  // 2. Supabase Storage Bucket (`models-3d/` path)
  const supabaseUrl = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && supabaseKey) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'models-3d';
    const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`;
    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'model/gltf-binary',
        'x-upsert': 'true',
      },
      body: new Uint8Array(glbBuffer),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Échec upload Supabase Storage (${res.status}): ${detail}`);
    }

    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
  }

  // 3. Persistent local storage bucket in `public/models-3d/`
  await ensureDir(LOCAL_MODELS_DIR);
  const absFile = path.join(LOCAL_MODELS_DIR, fileName);
  await fs.writeFile(absFile, glbBuffer);
  return `/${objectPath}`;
}

export function getLocalModelsDir(): string {
  return LOCAL_MODELS_DIR;
}
