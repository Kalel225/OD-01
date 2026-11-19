import * as THREE from 'three';
import { Custom3DConfig, CustomVolumeMode, UniverseId } from '../../types/od01';
import { normalizeAndCenterGroup } from './disposeUtils';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Adaptive studio & real-world photo background cutout:
 * - Preserves existing transparency if the uploaded PNG already has an alpha channel.
 * - Samples the entire image perimeter into dominant background color clusters (handles
 *   uneven walls, studio light gradients, and soft ground shadows beneath shoes).
 * - Runs 4-connected BFS flood-fill from all 4 borders with anti-aliased 1px edge feathering.
 * - Opens large pure-background enclosed interior holes (e.g. crossbody strap arches, coiled belts)
 *   without touching white product details or metallic buckles.
 */
function removeAdaptiveBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 42
): void {
  // 1. Check if image already has native transparent borders (PNG cutout)
  let transparentBorderCount = 0;
  let totalBorderCount = 0;
  for (let x = 0; x < width; x += 4) {
    totalBorderCount += 2;
    if (data[x * 4 + 3] < 24) transparentBorderCount++;
    if (data[((height - 1) * width + x) * 4 + 3] < 24) transparentBorderCount++;
  }
  for (let y = 0; y < height; y += 4) {
    totalBorderCount += 2;
    if (data[y * width * 4 + 3] < 24) transparentBorderCount++;
    if (data[(y * width + (width - 1)) * 4 + 3] < 24) transparentBorderCount++;
  }
  if (transparentBorderCount > totalBorderCount * 0.35) {
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4 + 3] < 20) data[i * 4 + 3] = 0;
    }
    return;
  }

  // 2. Sample perimeter pixels & quantize to find up to 3 dominant background colors
  const borderSamples: [number, number, number][] = [];
  const pushBorderPixel = (idx: number) => {
    const i = idx * 4;
    if (data[i + 3] < 24) return;
    borderSamples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < width; x += 4) {
    pushBorderPixel(x);
    pushBorderPixel((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 4) {
    pushBorderPixel(y * width);
    pushBorderPixel(y * width + (width - 1));
  }
  if (borderSamples.length === 0) return;

  // Compute median primary background color
  const rs = borderSamples.map((s) => s[0]).sort((a, b) => a - b);
  const gs = borderSamples.map((s) => s[1]).sort((a, b) => a - b);
  const bs = borderSamples.map((s) => s[2]).sort((a, b) => a - b);
  const mid = Math.floor(borderSamples.length / 2);
  const bgR = rs[mid];
  const bgG = gs[mid];
  const bgB = bs[mid];
  const bgIsBrightStudio = bgR > 225 && bgG > 225 && bgB > 225;

  // Also capture a secondary darker border cluster if present (e.g. subtle studio vignette/shadow)
  let secR = bgR;
  let secG = bgG;
  let secB = bgB;
  let secCount = 0;
  let secSumR = 0;
  let secSumG = 0;
  let secSumB = 0;
  for (const [r, g, b] of borderSamples) {
    const d = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    if (d > 24 && d < 120) {
      secSumR += r;
      secSumG += g;
      secSumB += b;
      secCount++;
    }
  }
  if (secCount > borderSamples.length * 0.12) {
    secR = secSumR / secCount;
    secG = secSumG / secCount;
    secB = secSumB / secCount;
  }

  const distToBg = (pixelIdx: number): number => {
    const i = pixelIdx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr1 = r - bgR;
    const dg1 = g - bgG;
    const db1 = b - bgB;
    const d1 = Math.sqrt(dr1 * dr1 * 0.3 + dg1 * dg1 * 0.59 + db1 * db1 * 0.11) * 1.68;

    const dr2 = r - secR;
    const dg2 = g - secG;
    const db2 = b - secB;
    const d2 = Math.sqrt(dr2 * dr2 * 0.3 + dg2 * dg2 * 0.59 + db2 * db2 * 0.11) * 1.68;

    return Math.min(d1, d2);
  };

  // Detect soft neutral floor shadow pixels connected to bright studio background
  const isNeutralStudioShadow = (pixelIdx: number): boolean => {
    if (!bgIsBrightStudio || tolerance < 24) return false;
    const i = pixelIdx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Soft neutral grey floor shadow (> 198 brightness, very low chroma)
    return chroma < 14 && lum > 255 - tolerance * 1.45;
  };

  const hardThreshold = Math.max(10, Math.min(110, tolerance));
  const softThreshold = hardThreshold * 1.32;

  const visited = new Uint8Array(width * height);
  const bgMask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    if (
      data[idx * 4 + 3] < 20 ||
      distToBg(idx) <= hardThreshold ||
      isNeutralStudioShadow(idx)
    ) {
      bgMask[idx] = 1;
      data[idx * 4 + 3] = 0;

      const x = idx % width;
      const y = (idx - x) / width;
      if (x > 0) enqueue(idx - 1);
      if (x < width - 1) enqueue(idx + 1);
      if (y > 0) enqueue(idx - width);
      if (y < height - 1) enqueue(idx + width);
    }
  }

  // Smooth 1px anti-aliased edge feathering
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (bgMask[idx]) continue;
      if (
        bgMask[idx - 1] ||
        bgMask[idx + 1] ||
        bgMask[idx - width] ||
        bgMask[idx + width]
      ) {
        const d = distToBg(idx);
        if (d < softThreshold) {
          const factor = Math.max(
            0,
            Math.min(1, (d - hardThreshold * 0.78) / (softThreshold - hardThreshold * 0.78))
          );
          data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * factor);
        }
      }
    }
  }

  // Punch large enclosed pure-background interior holes (bag strap arches, coiled belt centers)
  // Guarded tightly so white socks or metallic logos stay 100% solid.
  if (tolerance >= 20) {
    const tightThreshold = Math.min(20, hardThreshold * 0.48);
    const minHolePixels = Math.floor(width * height * 0.01);
    const holeVisited = new Uint8Array(width * height);
    const component: number[] = [];

    for (let y = 4; y < height - 4; y += 2) {
      for (let x = 4; x < width - 4; x += 2) {
        const startIdx = y * width + x;
        if (bgMask[startIdx] || holeVisited[startIdx] || data[startIdx * 4 + 3] < 20) continue;
        if (distToBg(startIdx) > tightThreshold) continue;

        component.length = 0;
        let qHead = 0;
        let qTail = 0;
        holeVisited[startIdx] = 1;
        queue[qTail++] = startIdx;

        while (qHead < qTail) {
          const cur = queue[qHead++];
          component.push(cur);
          const cx = cur % width;
          const cy = (cur - cx) / width;

          const n0 = cx > 0 ? cur - 1 : -1;
          const n1 = cx < width - 1 ? cur + 1 : -1;
          const n2 = cy > 0 ? cur - width : -1;
          const n3 = cy < height - 1 ? cur + width : -1;

          for (const n of [n0, n1, n2, n3]) {
            if (n < 0 || bgMask[n] || holeVisited[n]) continue;
            if (distToBg(n) <= tightThreshold) {
              holeVisited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }

        if (component.length >= minHolePixels) {
          for (let k = 0; k < component.length; k++) {
            data[component[k] * 4 + 3] = 0;
          }
        }
      }
    }
  }
}

/**
 * Dilates RGB colors outward from opaque silhouette pixels into adjacent transparent pixels
 * so WebGL bilinear sampling never produces white or dark halo fringes along 3D boundaries.
 */
function dilateEdgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  passes = 7
): void {
  const valid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] > 64) valid[i] = 1;
  }

  for (let p = 0; p < passes; p++) {
    const nextValid = new Uint8Array(valid);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (valid[idx]) continue;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = (y + dy) * width + (x + dx);
            if (valid[nIdx]) {
              const ni = nIdx * 4;
              rSum += data[ni];
              gSum += data[ni + 1];
              bSum += data[ni + 2];
              count++;
            }
          }
        }

        if (count > 0) {
          const i = idx * 4;
          data[i] = Math.round(rSum / count);
          data[i + 1] = Math.round(gSum / count);
          data[i + 2] = Math.round(bSum / count);
          nextValid[idx] = 1;
        }
      }
    }
    valid.set(nextValid);
  }
}

/**
 * Computes crisp Sobel normal map and luminance-derived roughness map
 * so studio lighting glides naturally across leather grain, seams, and metal hardware.
 */
function buildPBRMapsFromPhoto(
  srcCanvas: HTMLCanvasElement,
  mapSize: number,
  reliefStrength: number
): { normalCanvas: HTMLCanvasElement; roughnessCanvas: HTMLCanvasElement } {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = mapSize;
  sampleCanvas.height = mapSize;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(srcCanvas, 0, 0, mapSize, mapSize);
  const srcData = sCtx.getImageData(0, 0, mapSize, mapSize).data;

  const lum = new Float32Array(mapSize * mapSize);
  for (let i = 0; i < mapSize * mapSize; i++) {
    const r = srcData[i * 4] / 255;
    const g = srcData[i * 4 + 1] / 255;
    const b = srcData[i * 4 + 2] / 255;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = mapSize;
  normalCanvas.height = mapSize;
  const nCtx = normalCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(mapSize, mapSize);
  const nDst = nImg.data;

  const roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = mapSize;
  roughnessCanvas.height = mapSize;
  const rCtx = roughnessCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(mapSize, mapSize);
  const rDst = rImg.data;

  const sample = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(mapSize - 1, x));
    const cy = Math.max(0, Math.min(mapSize - 1, y));
    return lum[cy * mapSize + cx];
  };

  const strength = 1.1 + reliefStrength * 2.4;

  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const c = sample(x, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;

      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * mapSize + x) * 4;
      nDst[idx] = Math.round(((-dx * invLen) * 0.5 + 0.5) * 255);
      nDst[idx + 1] = Math.round(((-dy * invLen) * 0.5 + 0.5) * 255);
      nDst[idx + 2] = Math.round(((dz * invLen) * 0.5 + 0.5) * 255);
      nDst[idx + 3] = 255;

      const gradMag = Math.min(1, Math.hypot(dx, dy) * 0.4);
      const roughVal = Math.max(
        130,
        Math.min(255, Math.round((0.86 - c * 0.18 + gradMag * 0.14) * 255))
      );
      rDst[idx] = roughVal;
      rDst[idx + 1] = roughVal;
      rDst[idx + 2] = roughVal;
      rDst[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return { normalCanvas, roughnessCanvas };
}

/**
 * Reconstructs a high-resolution watertight sculpted volumetric 3D BufferGeometry
 * (116x116 occupancy & smooth Chamfer distance-field dome) directly from any product photograph.
 */
function buildVolumetricSculptedGeometry(
  maskCanvas: HTMLCanvasElement,
  totalDepth: number,
  volumeMode: CustomVolumeMode,
  reliefStrength: number
): THREE.BufferGeometry {
  const G = 116; // High-density smooth sculpted contour
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = G;
  sampleCanvas.height = G;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(maskCanvas, 0, 0, G, G);
  const gridData = sCtx.getImageData(0, 0, G, G).data;

  const cellCount = G * G;
  const occ = new Uint8Array(cellCount);
  const cellLum = new Float32Array(cellCount);
  let solidCells = 0;

  for (let i = 0; i < cellCount; i++) {
    const a = gridData[i * 4 + 3];
    cellLum[i] =
      (0.299 * gridData[i * 4] + 0.587 * gridData[i * 4 + 1] + 0.114 * gridData[i * 4 + 2]) / 255;
    if (a >= 92) {
      occ[i] = 1;
      solidCells++;
    }
  }

  if (solidCells < 24) {
    return new THREE.BoxGeometry(1.6, 1.6, totalDepth);
  }

  // 1-pass morphological closing to seal microscopic noise pinholes
  const closed = new Uint8Array(occ);
  for (let y = 1; y < G - 1; y++) {
    for (let x = 1; x < G - 1; x++) {
      const idx = y * G + x;
      if (occ[idx]) continue;
      if (occ[idx - 1] + occ[idx + 1] + occ[idx - G] + occ[idx + G] >= 3) {
        closed[idx] = 1;
      }
    }
  }
  occ.set(closed);

  // Vertex grid (G + 1) x (G + 1)
  const V = G + 1;
  const vCount = V * V;
  const vSolid = new Uint8Array(vCount);
  const vLum = new Float32Array(vCount);

  for (let vy = 0; vy < V; vy++) {
    for (let vx = 0; vx < V; vx++) {
      let touching = 0;
      let lumAccum = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const cx = vx + dx;
          const cy = vy + dy;
          if (cx >= 0 && cx < G && cy >= 0 && cy < G) {
            const cIdx = cy * G + cx;
            if (occ[cIdx]) {
              touching++;
              lumAccum += cellLum[cIdx];
            }
          }
        }
      }
      const vIdx = vy * V + vx;
      if (touching > 0) {
        vSolid[vIdx] = 1;
        vLum[vIdx] = lumAccum / touching;
      }
    }
  }

  // 2-Pass Chamfer Distance Transform (Euclidean distance from silhouette edge)
  const INF = 1e6;
  const dist = new Float32Array(vCount);
  for (let vy = 0; vy < V; vy++) {
    for (let vx = 0; vx < V; vx++) {
      const vIdx = vy * V + vx;
      const allInterior =
        vx > 0 &&
        vx < G &&
        vy > 0 &&
        vy < G &&
        occ[(vy - 1) * G + (vx - 1)] &&
        occ[(vy - 1) * G + vx] &&
        occ[vy * G + (vx - 1)] &&
        occ[vy * G + vx];
      dist[vIdx] = allInterior ? INF : 0;
    }
  }

  for (let vy = 1; vy < V - 1; vy++) {
    for (let vx = 1; vx < V - 1; vx++) {
      const i = vy * V + vx;
      if (dist[i] === 0) continue;
      let d = dist[i];
      d = Math.min(d, dist[i - 1] + 1);
      d = Math.min(d, dist[i - V] + 1);
      d = Math.min(d, dist[i - V - 1] + 1.414);
      d = Math.min(d, dist[i - V + 1] + 1.414);
      dist[i] = d;
    }
  }

  let maxDist = 1;
  for (let vy = V - 2; vy >= 1; vy--) {
    for (let vx = V - 2; vx >= 1; vx--) {
      const i = vy * V + vx;
      if (dist[i] === 0) continue;
      let d = dist[i];
      d = Math.min(d, dist[i + 1] + 1);
      d = Math.min(d, dist[i + V] + 1);
      d = Math.min(d, dist[i + V - 1] + 1.414);
      d = Math.min(d, dist[i + V + 1] + 1.414);
      dist[i] = d;
      if (d < INF && d > maxDist) maxDist = d;
    }
  }

  const normField = new Float32Array(vCount);
  for (let i = 0; i < vCount; i++) {
    normField[i] = dist[i] >= INF ? 0 : Math.min(1, dist[i] / maxDist);
  }

  // 4-pass separable Gaussian smoothing for organic, crease-free 3D curvature
  const tempField = new Float32Array(vCount);
  const smoothPasses = volumeMode === 'RIGID' ? 2 : 4;
  for (let p = 0; p < smoothPasses; p++) {
    for (let vy = 1; vy < V - 1; vy++) {
      for (let vx = 1; vx < V - 1; vx++) {
        const i = vy * V + vx;
        if (dist[i] === 0) {
          tempField[i] = 0;
          continue;
        }
        tempField[i] =
          normField[i - 1] * 0.25 + normField[i] * 0.5 + normField[i + 1] * 0.25;
      }
    }
    for (let vy = 1; vy < V - 1; vy++) {
      for (let vx = 1; vx < V - 1; vx++) {
        const i = vy * V + vx;
        if (dist[i] === 0) {
          normField[i] = 0;
          continue;
        }
        normField[i] =
          tempField[i - V] * 0.25 + tempField[i] * 0.5 + tempField[i + V] * 0.25;
      }
    }
  }

  const halfDepth = totalDepth * 0.5;
  const edgeRimHalfZ =
    volumeMode === 'RIGID'
      ? halfDepth * 0.68
      : volumeMode === 'PUFFER'
        ? halfDepth * 0.22
        : halfDepth * 0.14;

  const halfZ = new Float32Array(vCount);
  for (let i = 0; i < vCount; i++) {
    if (!vSolid[i]) continue;
    const t = normField[i];
    let profile: number;

    if (volumeMode === 'RIGID') {
      const b = Math.min(1, t * 5.0);
      profile = b * b * (3 - 2 * b);
    } else if (volumeMode === 'PUFFER') {
      const dome = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      profile = Math.pow(dome, 0.7) * 1.15;
    } else {
      const sineDome = Math.sin(t * Math.PI * 0.5);
      profile = Math.pow(Math.max(0, sineDome), 0.58);
    }

    const microRelief =
      (vLum[i] - 0.45) * reliefStrength * halfDepth * 0.18 * Math.min(1, t * 2.5);
    halfZ[i] = Math.max(0.008, edgeRimHalfZ + (halfDepth - edgeRimHalfZ) * profile + microRelief);
  }

  const frontIndex = new Int32Array(vCount).fill(-1);
  const backIndex = new Int32Array(vCount).fill(-1);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const worldSize = 2.08;

  for (let vy = 0; vy < V; vy++) {
    const wy = (0.5 - vy / G) * worldSize;
    const vCoord = 1 - vy / G;
    for (let vx = 0; vx < V; vx++) {
      const vIdx = vy * V + vx;
      if (!vSolid[vIdx]) continue;
      const wx = (vx / G - 0.5) * worldSize;
      const uCoord = vx / G;
      const hz = halfZ[vIdx];

      frontIndex[vIdx] = positions.length / 3;
      positions.push(wx, wy, hz);
      uvs.push(uCoord, vCoord);

      backIndex[vIdx] = positions.length / 3;
      positions.push(wx, wy, -hz);
      uvs.push(uCoord, vCoord);
    }
  }

  for (let cy = 0; cy < G; cy++) {
    for (let cx = 0; cx < G; cx++) {
      if (!occ[cy * G + cx]) continue;

      const tl = cy * V + cx;
      const tr = cy * V + (cx + 1);
      const bl = (cy + 1) * V + cx;
      const br = (cy + 1) * V + (cx + 1);

      const fTL = frontIndex[tl];
      const fTR = frontIndex[tr];
      const fBL = frontIndex[bl];
      const fBR = frontIndex[br];

      const bTL = backIndex[tl];
      const bTR = backIndex[tr];
      const bBL = backIndex[bl];
      const bBR = backIndex[br];

      // Front shell (+Z)
      indices.push(fTL, fBL, fTR);
      indices.push(fTR, fBL, fBR);

      // Back shell (-Z)
      indices.push(bTL, bTR, bBL);
      indices.push(bTR, bBR, bBL);

      // Watertight welded perimeter side walls
      if (cy === 0 || !occ[(cy - 1) * G + cx]) {
        indices.push(fTL, fTR, bTR);
        indices.push(fTL, bTR, bTL);
      }
      if (cy === G - 1 || !occ[(cy + 1) * G + cx]) {
        indices.push(fBL, bBR, fBR);
        indices.push(fBL, bBL, bBR);
      }
      if (cx === 0 || !occ[cy * G + (cx - 1)]) {
        indices.push(fTL, bBL, fBL);
        indices.push(fTL, bTL, bBL);
      }
      if (cx === G - 1 || !occ[cy * G + (cx + 1)]) {
        indices.push(fTR, fBR, bBR);
        indices.push(fTR, bBR, bTR);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Photorealistic Studio Photo -> Volumetric 3D Engine:
 * Converts ANY product photograph into a razor-sharp 1024px true-color sculpted 3D object
 * preserving authentic leather pores, stitching, fabric folds, and metallic hardware
 * while catching real-time studio lighting and reflections in 3D space.
 */
export async function create2DTo3DMeshGroup(
  config: Custom3DConfig,
  maxAnisotropy: number
): Promise<THREE.Group> {
  const img = await loadImage(config.imageDataUrl);

  // Step 1: Cutout at 512px for speed & crisp edge matting
  const cutoutSize = 512;
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = cutoutSize;
  rawCanvas.height = cutoutSize;
  const rawCtx = rawCanvas.getContext('2d')!;
  rawCtx.clearRect(0, 0, cutoutSize, cutoutSize);

  const fitScale = Math.min(cutoutSize / img.width, cutoutSize / img.height);
  const fitW = Math.round(img.width * fitScale);
  const fitH = Math.round(img.height * fitScale);
  const fitX = Math.floor((cutoutSize - fitW) / 2);
  const fitY = Math.floor((cutoutSize - fitH) / 2);
  rawCtx.drawImage(img, fitX, fitY, fitW, fitH);

  const rawData = rawCtx.getImageData(0, 0, cutoutSize, cutoutSize);
  const bgTolerance = config.bgTolerance ?? 40;

  if (config.removeBackground) {
    removeAdaptiveBackground(rawData.data, cutoutSize, cutoutSize, bgTolerance);
    rawCtx.putImageData(rawData, 0, 0);
  }

  // Step 2: Detect tight non-transparent bounding box in cutout space
  let minX = cutoutSize;
  let minY = cutoutSize;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < cutoutSize; y++) {
    for (let x = 0; x < cutoutSize; x++) {
      if (rawData.data[(y * cutoutSize + x) * 4 + 3] > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0;
    minY = 0;
    maxX = cutoutSize - 1;
    maxY = cutoutSize - 1;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Step 3: Build centered 512px mask canvas for 116x116 volumetric geometry
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = cutoutSize;
  maskCanvas.height = cutoutSize;
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.clearRect(0, 0, cutoutSize, cutoutSize);

  const targetMaskSpan = cutoutSize * 0.9;
  const maskScale = Math.min(targetMaskSpan / cropW, targetMaskSpan / cropH);
  const mDstW = cropW * maskScale;
  const mDstH = cropH * maskScale;
  const mDstX = (cutoutSize - mDstW) / 2;
  const mDstY = (cutoutSize - mDstH) / 2;
  maskCtx.drawImage(rawCanvas, minX, minY, cropW, cropH, mDstX, mDstY, mDstW, mDstH);

  // Step 4: Render ultra-sharp 1024px high-res albedo directly from the original full-res photo!
  const albedoSize = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoSize;
  albedoCanvas.height = albedoSize;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  albedoCtx.clearRect(0, 0, albedoSize, albedoSize);

  // Map crop rectangle back to original image pixels for razor-sharp 1024px sampling
  const srcCropX = Math.max(0, (minX - fitX) / fitScale);
  const srcCropY = Math.max(0, (minY - fitY) / fitScale);
  const srcCropW = Math.min(img.width - srcCropX, cropW / fitScale);
  const srcCropH = Math.min(img.height - srcCropY, cropH / fitScale);

  const aDstX = mDstX * (albedoSize / cutoutSize);
  const aDstY = mDstY * (albedoSize / cutoutSize);
  const aDstW = mDstW * (albedoSize / cutoutSize);
  const aDstH = mDstH * (albedoSize / cutoutSize);

  // Draw crisp alpha mask first, then composite full-res photo inside it
  albedoCtx.drawImage(maskCanvas, 0, 0, albedoSize, albedoSize);
  albedoCtx.globalCompositeOperation = 'source-in';
  albedoCtx.imageSmoothingEnabled = true;
  albedoCtx.imageSmoothingQuality = 'high';
  albedoCtx.drawImage(img, srcCropX, srcCropY, srcCropW, srcCropH, aDstX, aDstY, aDstW, aDstH);
  albedoCtx.globalCompositeOperation = 'source-over';

  // Dilate edge RGB colors into transparent margin so perimeter edges have ZERO white fringe
  const albedoImgData = albedoCtx.getImageData(0, 0, albedoSize, albedoSize);
  dilateEdgeColors(albedoImgData.data, albedoSize, albedoSize, 8);
  albedoCtx.putImageData(albedoImgData, 0, 0);

  // Step 5: Compute Sobel Normal Map & Roughness Map (512px)
  const reliefStrength = config.reliefStrength ?? 0.55;
  const { normalCanvas, roughnessCanvas } = buildPBRMapsFromPhoto(
    albedoCanvas,
    512,
    reliefStrength
  );

  const colorTexture = new THREE.CanvasTexture(albedoCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.anisotropy = Math.max(1, maxAnisotropy);
  colorTexture.generateMipmaps = true;
  colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
  colorTexture.magFilter = THREE.LinearFilter;
  colorTexture.needsUpdate = true;

  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.anisotropy = Math.max(1, maxAnisotropy);
  normalTexture.needsUpdate = true;

  const roughnessTexture = new THREE.CanvasTexture(roughnessCanvas);
  roughnessTexture.anisotropy = Math.max(1, maxAnisotropy);
  roughnessTexture.needsUpdate = true;

  // Step 6: Build Watertight Sculpted 3D Geometry (116x116 smooth dome)
  const totalDepth = Math.max(0.14, Math.min(0.62, config.depth));
  const volumeMode: CustomVolumeMode = config.volumeMode ?? 'SCULPTED';
  const sculptedGeo = buildVolumetricSculptedGeometry(
    maskCanvas,
    totalDepth,
    volumeMode,
    reliefStrength
  );

  // True-Color Photorealistic Studio Material:
  // Preserves 100% of real photography clarity (never crushes dark leather/nubuck into mud)
  // while layering real-time PBR normal highlights, clearcoat sheen, and studio reflections.
  const finishProps =
    config.finish === 'METALLIC'
      ? { roughness: 0.28, metalness: 0.58, clearcoat: 0.42, clearcoatRoughness: 0.18, env: 1.5, emissive: 0.62 }
      : config.finish === 'LEATHER'
        ? { roughness: 0.44, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.34, env: 1.15, emissive: 0.72 }
        : config.finish === 'SATIN'
          ? { roughness: 0.48, metalness: 0.1, clearcoat: 0.24, clearcoatRoughness: 0.36, env: 1.1, emissive: 0.7 }
          : { roughness: 0.84, metalness: 0.02, clearcoat: 0.05, clearcoatRoughness: 0.65, env: 0.85, emissive: 0.72 };

  const material = new THREE.MeshPhysicalMaterial({
    map: colorTexture,
    emissiveMap: colorTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: finishProps.emissive,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.55 + reliefStrength * 0.75, 0.55 + reliefStrength * 0.75),
    roughnessMap: roughnessTexture,
    roughness: finishProps.roughness,
    metalness: finishProps.metalness,
    clearcoat: finishProps.clearcoat,
    clearcoatRoughness: finishProps.clearcoatRoughness,
    envMapIntensity: finishProps.env,
  });

  const mesh = new THREE.Mesh(sculptedGeo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  normalizeAndCenterGroup(group, 2.28);
  return group;
}

/**
 * Returns a real ultra-photorealistic studio packshot URL for 1-click Admin testing
 * of the Photo -> 3D volumetric engine.
 */
export function generateSample2DPrototype(universe: UniverseId, _codeLabel: string): string {
  if (universe === 'CHAUSSURES') {
    return '/src/assets/images/af1_triple_black_1795072570142.jpg';
  }
  if (universe === 'HABITS') {
    return '/src/assets/images/arcteryx_beta_black_1795072642687.jpg';
  }
  return '/src/assets/images/prada_renylon_bag_1795072692812.jpg';
}
