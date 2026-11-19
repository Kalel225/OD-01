import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import {
  getLocalModelsDir,
  getProduct3DRecord,
  readAllProduct3DRecords,
  uploadGlbToStorage,
  upsertProduct3DRecord,
} from './src/server/storage.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getFalKey(): string | null {
  const key = process.env.FAL_KEY?.trim();
  if (!key || key === 'MY_FAL_API_KEY') return null;
  return key;
}

function configureFal(): string {
  const key = getFalKey();
  if (!key) {
    throw new Error(
      'CLÉ FAL_KEY MANQUANTE. CONFIGUREZ FAL_KEY DANS LES VARIABLES D’ENVIRONNEMENT POUR ACTIVER LA RECONSTRUCTION 3D (.GLB).'
    );
  }
  fal.config({ credentials: key });
  return key;
}

/**
 * Converts any image source (data URL, local /src/assets/... file, or external https:// URL)
 * into a fal.ai-accessible HTTPS URL via `fal.storage.upload` when needed.
 */
async function ensureFalAccessibleImageUrl(source: string): Promise<string> {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error('URL IMAGE VIDE.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Base64 Data URL (uploaded from Admin UI)
  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(trimmed);
  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1];
    const buffer = Buffer.from(dataUrlMatch[2], 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    return await fal.storage.upload(blob);
  }

  // Local workspace asset path (e.g. /src/assets/images/af1_triple_black_....jpg)
  const safeRel = trimmed.replace(/^\/+/, '');
  const candidatePaths = [
    path.resolve(process.cwd(), safeRel),
    path.resolve(process.cwd(), 'public', safeRel),
    path.resolve(process.cwd(), 'dist', safeRel),
  ];

  for (const absPath of candidatePaths) {
    try {
      const stat = await fs.stat(absPath);
      if (!stat.isFile()) continue;
      const buffer = await fs.readFile(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';
      const blob = new Blob([buffer], { type: mimeType });
      return await fal.storage.upload(blob);
    } catch {
      // Try next candidate path
    }
  }

  throw new Error(`IMAGE SOURCE INTROUVABLE SUR LE SERVEUR : ${trimmed.slice(0, 64)}`);
}

/**
 * Step A: Removes background via `fal-ai/birefnet` to obtain clean transparent PNGs.
 */
async function cutoutWithBiRefNet(imageUrl: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/birefnet', {
    input: {
      image_url: imageUrl,
      model: 'General Use (Light)',
      operating_resolution: '1024x1024',
      output_format: 'png',
    },
  });

  const data = result.data as { image?: { url?: string } } | undefined;
  const cutoutUrl = data?.image?.url;
  if (!cutoutUrl) {
    throw new Error('DÉTOURAGE BIREFNET ÉCHOUÉ : AUCUNE IMAGE PNG RETOURNÉE.');
  }
  return cutoutUrl;
}

/**
 * Extracts the `.glb` download URL from any fal.ai 3D endpoint response
 * (`fal-ai/hunyuan3d/v2`, `fal-ai/hunyuan3d/v2/multi-view`, or `fal-ai/trellis`).
 */
function extractGlbUrlFromFalResult(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  const directCandidates = [
    (obj.model_mesh as { url?: string } | undefined)?.url,
    (obj.model_glb as { url?: string } | undefined)?.url,
    (obj.mesh as { url?: string } | undefined)?.url,
    (obj.glb as { url?: string } | undefined)?.url,
    typeof obj.model_mesh === 'string' ? obj.model_mesh : undefined,
    typeof obj.model_glb === 'string' ? obj.model_glb : undefined,
  ];

  for (const url of directCandidates) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      return url;
    }
  }
  return null;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Serve locally persisted models-3d/*.glb cleanly with immutable caching & CORS
  const localModelsDir = getLocalModelsDir();
  await fs.mkdir(localModelsDir, { recursive: true });
  app.use(
    '/models-3d',
    express.static(localModelsDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.glb')) {
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  // Sync endpoint: returns all persisted server-side 3D model statuses & URLs
  app.get('/api/products/3d-states', async (_req, res) => {
    try {
      const records = await readAllProduct3DRecords();
      res.json({ records });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erreur lecture états 3D.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 1. POST /api/products/:id/generate-3d
  //    Step A: BiRefNet cutout -> transparent PNGs
  //    Step B: Async fal.queue.submit -> Hunyuan3D v2 (single or multi-view) / Trellis
  //    Returns immediately `{ status: 'processing', jobId }` without timeout.
  // ---------------------------------------------------------------------------
  app.post('/api/products/:id/generate-3d', async (req, res) => {
    const productId = req.params.id;
    const body = req.body as { images?: unknown };
    const incomingImages = Array.isArray(body?.images)
      ? body.images
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 4)
      : [];

    const existing = await getProduct3DRecord(productId);
    const sourceImages = incomingImages.length > 0 ? incomingImages : (existing?.images ?? []);

    if (sourceImages.length === 0) {
      return res.status(400).json({
        status: 'failed',
        error: 'AU MOINS UNE PHOTO PRODUIT (VUE PRINCIPALE) EST REQUISE POUR GÉNÉRER LA 3D.',
      });
    }

    try {
      configureFal();

      await upsertProduct3DRecord(productId, {
        images: sourceImages,
        model3dStatus: 'pending',
        model3dError: null,
      });

      // Step A: Upload local/dataURL images to fal storage & remove backgrounds with BiRefNet
      const uploadedUrls = await Promise.all(
        sourceImages.map((src) => ensureFalAccessibleImageUrl(src))
      );
      const cutoutUrls = await Promise.all(
        uploadedUrls.map((url) => cutoutWithBiRefNet(url))
      );

      // Step B: Submit asynchronous 3D reconstruction job with PBR textures
      // - 3 or 4 views -> fal-ai/hunyuan3d/v2/multi-view (front + left + back)
      // - 2 views      -> fal-ai/trellis/multi (flexible multi-image reconstruction)
      // - 1 view       -> fal-ai/hunyuan3d/v2 (single-image textured PBR mesh)
      let endpoint: string;
      let input: Record<string, unknown>;

      if (cutoutUrls.length >= 3) {
        endpoint = 'fal-ai/hunyuan3d/v2/multi-view';
        input = {
          front_image_url: cutoutUrls[0],
          left_image_url: cutoutUrls[1],
          back_image_url: cutoutUrls[3] ?? cutoutUrls[2],
          textured_mesh: true,
        };
      } else if (cutoutUrls.length === 2) {
        endpoint = 'fal-ai/trellis/multi';
        input = {
          image_urls: cutoutUrls,
          texture_size: 1024,
        };
      } else {
        endpoint = 'fal-ai/hunyuan3d/v2';
        input = {
          input_image_url: cutoutUrls[0],
          textured_mesh: true,
        };
      }

      const queued = await fal.queue.submit(endpoint, { input });
      const jobId = queued.request_id;

      await upsertProduct3DRecord(productId, {
        images: sourceImages,
        model3dJobId: jobId,
        model3dEndpoint: endpoint,
        model3dStatus: 'processing',
        model3dError: null,
      });

      return res.status(202).json({
        status: 'processing',
        jobId,
        endpoint,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'ERREUR INCONNUE LORS DU LANCEMENT DE LA RECONSTRUCTION 3D.';

      await upsertProduct3DRecord(productId, {
        images: sourceImages,
        model3dStatus: 'failed',
        model3dError: message,
      });

      return res.status(500).json({
        status: 'failed',
        error: message,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/products/:id/generate-3d/status
  //    Polls `fal.queue.status(endpoint, { requestId })`.
  //    On COMPLETED: downloads `.glb`, persists to `models-3d/`, sets `ready`.
  // ---------------------------------------------------------------------------
  app.get('/api/products/:id/generate-3d/status', async (req, res) => {
    const productId = req.params.id;
    const record = await getProduct3DRecord(productId);

    const queryJobId =
      typeof req.query.jobId === 'string' && req.query.jobId.trim()
        ? req.query.jobId.trim()
        : null;
    const queryEndpoint =
      typeof req.query.endpoint === 'string' && req.query.endpoint.trim()
        ? req.query.endpoint.trim()
        : null;

    if (record?.model3dStatus === 'ready' && record.model3dUrl && !queryJobId) {
      return res.json({
        status: 'ready',
        model3dUrl: record.model3dUrl,
        jobId: record.model3dJobId,
        error: null,
      });
    }

    const jobId = record?.model3dJobId ?? queryJobId;
    const endpoint = record?.model3dEndpoint ?? queryEndpoint ?? 'fal-ai/hunyuan3d/v2';

    if (!jobId) {
      return res.json({
        status: record?.model3dStatus ?? 'none',
        model3dUrl: record?.model3dUrl ?? null,
        jobId: null,
        error: record?.model3dError ?? null,
      });
    }

    try {
      configureFal();

      const queueStatus = await fal.queue.status(endpoint, {
        requestId: jobId,
        logs: false,
      });

      if (queueStatus.status === 'COMPLETED') {
        const result = await fal.queue.result(endpoint, { requestId: jobId });
        const remoteGlbUrl = extractGlbUrlFromFalResult(result.data);

        if (!remoteGlbUrl) {
          throw new Error('FICHIER .GLB ABSENT DANS LA RÉPONSE FAL.AI.');
        }

        const glbResponse = await fetch(remoteGlbUrl);
        if (!glbResponse.ok) {
          throw new Error(
            `TÉLÉCHARGEMENT DU .GLB IMPOSSIBLE (HTTP ${glbResponse.status}).`
          );
        }

        const arrayBuffer = await glbResponse.arrayBuffer();
        const glbBuffer = Buffer.from(arrayBuffer);
        const storedUrl = await uploadGlbToStorage(productId, glbBuffer);

        await upsertProduct3DRecord(productId, {
          model3dUrl: storedUrl,
          model3dStatus: 'ready',
          model3dJobId: jobId,
          model3dEndpoint: endpoint,
          model3dError: null,
        });

        return res.json({
          status: 'ready',
          model3dUrl: storedUrl,
          jobId,
          error: null,
        });
      }

      // IN_QUEUE or IN_PROGRESS
      const queuePosition =
        'queue_position' in queueStatus && typeof queueStatus.queue_position === 'number'
          ? queueStatus.queue_position
          : undefined;

      return res.json({
        status: 'processing',
        model3dUrl: record?.model3dUrl ?? null,
        jobId,
        queuePosition,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'ERREUR LORS DU SUIVI DE LA RECONSTRUCTION 3D.';

      await upsertProduct3DRecord(productId, {
        model3dStatus: 'failed',
        model3dError: message,
      });

      return res.status(200).json({
        status: 'failed',
        model3dUrl: record?.model3dUrl ?? null,
        jobId,
        error: message,
      });
    }
  });

  // Frontend Vite middleware (dev) or static dist/ (production)
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OD-01 full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Fatal error starting OD-01 server:', err);
  process.exit(1);
});
