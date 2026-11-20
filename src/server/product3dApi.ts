import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fal } from '@fal-ai/client';
import {
  getProduct3DRecord,
  saveGlbModel,
  upsertProduct3DRecord,
} from '../lib/storage';

const SINGLE_VIEW_ENDPOINT = 'fal-ai/hunyuan3d/v2';
const MULTI_VIEW_ENDPOINT = 'fal-ai/hunyuan3d/v2/multi-view';
const BIREFNET_ENDPOINT = 'fal-ai/birefnet';

export interface ApiJsonResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

function configureFalKey(): string | null {
  const key = process.env.FAL_KEY?.trim();
  if (!key) return null;
  fal.config({ credentials: key });
  return key;
}

function guessMimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Ensures an image input (data URL, local project path, or HTTP URL)
 * is converted into a publicly accessible URL that fal.ai can fetch.
 */
async function ensureFalAccessibleImageUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
    if (!match) {
      throw new Error('Format data URL invalide pour une image produit.');
    }
    const mimeType = match[1] || 'image/png';
    const buffer = Buffer.from(match[2], 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    return await fal.storage.upload(blob);
  }

  // Local path relative to repo root or public/ (e.g. /src/assets/images/foo.jpg)
  const rel = trimmed.replace(/^\/+/, '').replace(/\.\./g, '');
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.resolve(process.cwd(), 'public', rel),
  ];

  for (const candidate of candidates) {
    try {
      const fileBuf = await fs.readFile(candidate);
      const blob = new Blob([fileBuf], { type: guessMimeFromExt(candidate) });
      return await fal.storage.upload(blob);
    } catch {
      // Try next candidate
    }
  }

  throw new Error(`Image locale introuvable : ${trimmed}`);
}

function extractUrlFromResult(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 0) return val;
    if (val && typeof val === 'object' && typeof (val as { url?: unknown }).url === 'string') {
      return (val as { url: string }).url;
    }
  }
  return null;
}

/**
 * POST /api/products/[id]/generate-3d
 */
export async function handleGenerate3DPost(
  productId: string,
  payload?: { images?: string[] }
): Promise<ApiJsonResponse> {
  const falKey = configureFalKey();
  if (!falKey) {
    return {
      statusCode: 400,
      body: { error: 'Clé FAL_KEY manquante' },
    };
  }

  const existing = await getProduct3DRecord(productId);
  const incomingImages = Array.isArray(payload?.images)
    ? payload.images.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];
  const images = incomingImages.length > 0 ? incomingImages : (existing?.images ?? []);

  if (!images[0]) {
    return {
      statusCode: 400,
      body: { error: 'Image principale (images[0]) manquante pour ce produit.' },
    };
  }

  const sourceSlice = images.slice(0, 4);

  try {
    await upsertProduct3DRecord(productId, {
      images: sourceSlice,
      model3dStatus: 'pending',
      model3dError: null,
    });

    // 1. Cut out background of each available image via fal-ai/birefnet
    const cutoutUrls: string[] = [];
    for (const imgUrl of sourceSlice) {
      const publicUrl = await ensureFalAccessibleImageUrl(imgUrl);
      const cutoutRes = await fal.subscribe(BIREFNET_ENDPOINT, {
        input: {
          image_url: publicUrl,
          output_format: 'png',
        },
      });
      const cleanUrl = extractUrlFromResult(cutoutRes.data, ['image']);
      if (!cleanUrl) {
        throw new Error('BiRefNet n’a renvoyé aucune image détourée.');
      }
      cutoutUrls.push(cleanUrl);
    }

    // 2. Submit async 3D reconstruction job via fal.queue.submit
    const useMultiView = cutoutUrls.length > 1;
    const endpoint = useMultiView ? MULTI_VIEW_ENDPOINT : SINGLE_VIEW_ENDPOINT;

    const submitted = useMultiView
      ? await fal.queue.submit(MULTI_VIEW_ENDPOINT, {
          input: {
            front_image_url: cutoutUrls[0],
            back_image_url: cutoutUrls[1] ?? cutoutUrls[0],
            left_image_url: cutoutUrls[2] ?? cutoutUrls[1] ?? cutoutUrls[0],
            textured_mesh: true,
          },
        })
      : await fal.queue.submit(SINGLE_VIEW_ENDPOINT, {
          input: {
            input_image_url: cutoutUrls[0],
            textured_mesh: true,
          },
        });

    const jobId = submitted.request_id;
    await upsertProduct3DRecord(productId, {
      images: sourceSlice,
      model3dJobId: jobId,
      model3dStatus: 'processing',
      model3dError: null,
      model3dEndpoint: endpoint,
    });

    return {
      statusCode: 200,
      body: {
        status: 'processing',
        jobId,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la soumission 3D.';
    await upsertProduct3DRecord(productId, {
      images: sourceSlice,
      model3dStatus: 'failed',
      model3dError: message,
    });
    return {
      statusCode: 500,
      body: {
        status: 'failed',
        error: message,
      },
    };
  }
}

/**
 * GET /api/products/[id]/generate-3d/status
 */
export async function handleGenerate3DStatusGet(productId: string): Promise<ApiJsonResponse> {
  const record = await getProduct3DRecord(productId);
  if (!record) {
    return {
      statusCode: 200,
      body: {
        status: 'none',
        model3dUrl: null,
        error: null,
      },
    };
  }

  if (record.model3dStatus !== 'processing' || !record.model3dJobId) {
    return {
      statusCode: 200,
      body: {
        status: record.model3dStatus,
        model3dUrl: record.model3dUrl,
        error: record.model3dError,
      },
    };
  }

  const falKey = configureFalKey();
  if (!falKey) {
    return {
      statusCode: 400,
      body: { error: 'Clé FAL_KEY manquante' },
    };
  }

  const endpoint = record.model3dEndpoint || SINGLE_VIEW_ENDPOINT;

  try {
    const queueStatus = await fal.queue.status(endpoint, {
      requestId: record.model3dJobId,
      logs: false,
    });

    if (queueStatus.status === 'IN_QUEUE' || queueStatus.status === 'IN_PROGRESS') {
      return {
        statusCode: 200,
        body: { status: 'processing' },
      };
    }

    if (queueStatus.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, {
        requestId: record.model3dJobId,
      });

      const glbRemoteUrl = extractUrlFromResult(result.data, ['model_mesh', 'model_glb', 'mesh']);
      if (!glbRemoteUrl) {
        throw new Error('Aucun fichier .glb (model_mesh.url) trouvé dans la réponse fal.ai.');
      }

      const glbResponse = await fetch(glbRemoteUrl);
      if (!glbResponse.ok) {
        throw new Error(`Téléchargement du .glb échoué (${glbResponse.status}).`);
      }

      const glbBytes = new Uint8Array(await glbResponse.arrayBuffer());
      const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, '');
      const storageKey = `models-3d/${safeId}-${Date.now()}.glb`;
      const persistedUrl = await saveGlbModel(storageKey, glbBytes);

      await upsertProduct3DRecord(productId, {
        model3dUrl: persistedUrl,
        model3dStatus: 'ready',
        model3dError: null,
      });

      return {
        statusCode: 200,
        body: {
          status: 'ready',
          model3dUrl: persistedUrl,
        },
      };
    }

    const unknownErr = `Statut fal.ai inattendu : ${String((queueStatus as { status?: unknown }).status)}`;
    await upsertProduct3DRecord(productId, {
      model3dStatus: 'failed',
      model3dError: unknownErr,
    });
    return {
      statusCode: 200,
      body: {
        status: 'failed',
        error: unknownErr,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors du suivi 3D.';
    await upsertProduct3DRecord(productId, {
      model3dStatus: 'failed',
      model3dError: message,
    });
    return {
      statusCode: 200,
      body: {
        status: 'failed',
        error: message,
      },
    };
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

/**
 * Connect / Vite / Express compatible middleware handling:
 * - POST /api/products/:id/generate-3d
 * - GET  /api/products/:id/generate-3d/status
 */
export function product3dMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void
): void {
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];

  const postMatch = /^\/api\/products\/([^/]+)\/generate-3d\/?$/.exec(pathname);
  if (postMatch && req.method === 'POST') {
    const productId = decodeURIComponent(postMatch[1]);
    void (async () => {
      try {
        const body = await readJsonBody(req);
        const result = await handleGenerate3DPost(productId, {
          images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
        });
        sendJson(res, result.statusCode, result.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur serveur interne';
        sendJson(res, 500, { status: 'failed', error: message });
      }
    })();
    return;
  }

  const statusMatch = /^\/api\/products\/([^/]+)\/generate-3d\/status\/?$/.exec(pathname);
  if (statusMatch && req.method === 'GET') {
    const productId = decodeURIComponent(statusMatch[1]);
    void (async () => {
      try {
        const result = await handleGenerate3DStatusGet(productId);
        sendJson(res, result.statusCode, result.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur serveur interne';
        sendJson(res, 500, { status: 'failed', error: message });
      }
    })();
    return;
  }

  next();
}
