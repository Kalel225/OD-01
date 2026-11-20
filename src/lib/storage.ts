import fs from 'node:fs/promises';
import path from 'node:path';
import type { Model3dStatus } from '../types/od01';

const LOCAL_MODELS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'models-3d');
const STATE_FILE_PATH = path.join(LOCAL_MODELS_DIR, '.products-3d-state.json');

export interface PersistedProduct3DRecord {
  id: string;
  images: string[];
  model3dUrl: string | null;
  model3dStatus: Model3dStatus;
  model3dJobId: string | null;
  model3dError: string | null;
  model3dEndpoint?: string | null;
  updatedAt: string;
}

/**
 * Saves a binary .glb buffer to Vercel Blob if BLOB_READ_WRITE_TOKEN is configured,
 * otherwise writes it locally to public/uploads/models-3d/<filename>.
 *
 * @param relativeKey e.g. "models-3d/prod-123-1700000000000.glb"
 */
export async function saveGlbModel(relativeKey: string, data: Uint8Array): Promise<string> {
  const sanitizedKey = relativeKey.replace(/^\/+/, '').replace(/\.\./g, '');
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (blobToken) {
    const uploadUrl = `https://blob.vercel-storage.com/${encodeURI(sanitizedKey)}`;
    const bodyCopy = new Uint8Array(data.byteLength);
    bodyCopy.set(data);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${blobToken}`,
        'x-content-type': 'model/gltf-binary',
        'x-add-random-suffix': '0',
      },
      body: new Blob([bodyCopy.buffer], { type: 'model/gltf-binary' }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Vercel Blob upload failed (${response.status}): ${errText}`);
    }

    const payload = (await response.json()) as { url?: string };
    if (!payload.url) {
      throw new Error('Vercel Blob upload returned no URL');
    }
    return payload.url;
  }

  // Local fallback: public/uploads/models-3d/<basename>
  await fs.mkdir(LOCAL_MODELS_DIR, { recursive: true });
  const fileName = path.basename(sanitizedKey);
  const fullPath = path.join(LOCAL_MODELS_DIR, fileName);
  await fs.writeFile(fullPath, data);
  return `/uploads/models-3d/${fileName}`;
}

async function readAllRecords(): Promise<Record<string, PersistedProduct3DRecord>> {
  try {
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, PersistedProduct3DRecord>;
  } catch {
    return {};
  }
}

export async function getProduct3DRecord(id: string): Promise<PersistedProduct3DRecord | null> {
  const records = await readAllRecords();
  return records[id] ?? null;
}

export async function upsertProduct3DRecord(
  id: string,
  patch: Partial<Omit<PersistedProduct3DRecord, 'id' | 'updatedAt'>>
): Promise<PersistedProduct3DRecord> {
  await fs.mkdir(LOCAL_MODELS_DIR, { recursive: true });
  const records = await readAllRecords();
  const prev = records[id];
  const next: PersistedProduct3DRecord = {
    id,
    images: patch.images ?? prev?.images ?? [],
    model3dUrl: patch.model3dUrl !== undefined ? patch.model3dUrl : (prev?.model3dUrl ?? null),
    model3dStatus: patch.model3dStatus ?? prev?.model3dStatus ?? 'none',
    model3dJobId: patch.model3dJobId !== undefined ? patch.model3dJobId : (prev?.model3dJobId ?? null),
    model3dError: patch.model3dError !== undefined ? patch.model3dError : (prev?.model3dError ?? null),
    model3dEndpoint:
      patch.model3dEndpoint !== undefined ? patch.model3dEndpoint : (prev?.model3dEndpoint ?? null),
    updatedAt: new Date().toISOString(),
  };
  records[id] = next;
  await fs.writeFile(STATE_FILE_PATH, JSON.stringify(records, null, 2), 'utf-8');
  return next;
}
