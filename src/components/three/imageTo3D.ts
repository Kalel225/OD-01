import * as THREE from 'three';
import { Custom3DConfig, CustomVolumeMode, UniverseId } from '../../types/od01';
import { normalizeAndCenterGroup } from './disposeUtils';

export interface Turntable360Controller {
  viewCount: number;
  hasNativeMultiView: boolean;
  updateOrbit: (
    yawRad: number,
    pitchRad: number,
    idleSwayY?: number,
    idleSwayX?: number
  ) => void;
}

interface ParsedViewSource {
  cleanUrl: string;
  mirrorX: boolean;
}

function parseViewSource(rawUrl: string): ParsedViewSource {
  if (rawUrl.endsWith('#flipX')) {
    return { cleanUrl: rawUrl.slice(0, -6), mirrorX: true };
  }
  return { cleanUrl: rawUrl, mirrorX: false };
}

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
 * High-precision adaptive background & studio floor-shadow removal:
 * - Preserves existing alpha cleanly if the uploaded PNG already has transparent borders.
 * - Estimates dominant perimeter background color + neutral studio floor shadows.
 * - Runs 4-connected BFS flood-fill from all 4 borders with smooth 2px anti-aliased edge matting.
 * - Cleanly opens large pure-background enclosed interior cutouts (bag strap arches, coiled belts)
 *   without touching white fabrics or metallic hardware.
 */
function removeStudioBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 40
): void {
  let transparentBorderCount = 0;
  let totalBorderCount = 0;
  for (let x = 0; x < width; x += 6) {
    totalBorderCount += 2;
    if (data[x * 4 + 3] < 24) transparentBorderCount++;
    if (data[((height - 1) * width + x) * 4 + 3] < 24) transparentBorderCount++;
  }
  for (let y = 0; y < height; y += 6) {
    totalBorderCount += 2;
    if (data[y * width * 4 + 3] < 24) transparentBorderCount++;
    if (data[(y * width + (width - 1)) * 4 + 3] < 24) transparentBorderCount++;
  }
  if (transparentBorderCount > totalBorderCount * 0.35) {
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4 + 3] < 16) data[i * 4 + 3] = 0;
    }
    return;
  }

  const sampleR: number[] = [];
  const sampleG: number[] = [];
  const sampleB: number[] = [];

  const pushSample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    sampleR.push(data[i]);
    sampleG.push(data[i + 1]);
    sampleB.push(data[i + 2]);
  };

  for (let x = 0; x < width; x += 4) {
    pushSample(x, 0);
    pushSample(x, 2);
    pushSample(x, height - 1);
    pushSample(x, height - 3);
  }
  for (let y = 0; y < height; y += 4) {
    pushSample(0, y);
    pushSample(2, y);
    pushSample(width - 1, y);
    pushSample(width - 3, y);
  }

  const median = (arr: number[]) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 255;
  };

  const bgR = median(sampleR);
  const bgG = median(sampleG);
  const bgB = median(sampleB);
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
  const bgIsBrightStudio = bgLum > 224;

  const hardThreshold = Math.max(14, tolerance * 1.15);
  const softThreshold = hardThreshold + 18;

  const colorDist = (pixelIdx: number): number => {
    const i = pixelIdx * 4;
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.68;
  };

  const isNeutralStudioShadow = (pixelIdx: number): boolean => {
    if (!bgIsBrightStudio || tolerance < 22) return false;
    const i = pixelIdx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const minShadowLum = Math.max(168, 232 - tolerance * 1.15);
    return lum >= minShadowLum && maxC - minC < 16;
  };

  const total = width * height;
  const isBg = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueueIfBg = (idx: number) => {
    if (visited[idx]) return;
    visited[idx] = 1;
    if (colorDist(idx) <= hardThreshold || isNeutralStudioShadow(idx)) {
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueueIfBg(x);
    enqueueIfBg((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueueIfBg(y * width);
    enqueueIfBg(y * width + (width - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) enqueueIfBg(idx - 1);
    if (x < width - 1) enqueueIfBg(idx + 1);
    if (y > 0) enqueueIfBg(idx - width);
    if (y < height - 1) enqueueIfBg(idx + width);
  }

  // Open large pure-background enclosed interior holes (bag handle arches, coiled belt centers)
  if (tolerance >= 20) {
    const tightThreshold = Math.min(20, hardThreshold * 0.48);
    const minHolePixels = Math.floor(total * 0.009);
    const holeVisited = new Uint8Array(total);
    const compBuffer = new Int32Array(total);

    for (let start = 0; start < total; start++) {
      if (isBg[start] || holeVisited[start]) continue;
      if (colorDist(start) > tightThreshold) continue;

      let cHead = 0;
      let cTail = 0;
      holeVisited[start] = 1;
      compBuffer[cTail++] = start;

      while (cHead < cTail) {
        const cur = compBuffer[cHead++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        const tryN = (nIdx: number) => {
          if (isBg[nIdx] || holeVisited[nIdx]) return;
          if (colorDist(nIdx) <= tightThreshold) {
            holeVisited[nIdx] = 1;
            compBuffer[cTail++] = nIdx;
          }
        };
        if (cx > 0) tryN(cur - 1);
        if (cx < width - 1) tryN(cur + 1);
        if (cy > 0) tryN(cur - width);
        if (cy < height - 1) tryN(cur + width);
      }

      if (cTail >= minHolePixels) {
        for (let k = 0; k < cTail; k++) {
          isBg[compBuffer[k]] = 1;
        }
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (isBg[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Smooth 2px anti-aliased edge feathering + fringe suppression around foreground boundary
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (isBg[idx]) continue;

      const touchesBg =
        isBg[idx - 1] ||
        isBg[idx + 1] ||
        isBg[idx - width] ||
        isBg[idx + width] ||
        isBg[idx - width - 1] ||
        isBg[idx - width + 1] ||
        isBg[idx + width - 1] ||
        isBg[idx + width + 1];

      if (!touchesBg) continue;

      const d = colorDist(idx);
      if (d < softThreshold) {
        const factor = Math.max(
          0,
          Math.min(1, (d - hardThreshold * 0.72) / (softThreshold - hardThreshold * 0.72))
        );
        data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * factor);
      } else {
        data[idx * 4 + 3] = Math.min(data[idx * 4 + 3], 232);
      }
    }
  }
}

/**
 * Dilates foreground RGB colors into surrounding transparent pixels so linear
 * texture filtering & mipmaps NEVER bleed white studio fringe onto dark silhouettes.
 */
function dilateEdgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  passes = 6
): void {
  const total = width * height;
  const filled = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] > 28) filled[i] = 1;
  }

  const nextFilled = new Uint8Array(total);
  const copy = new Uint8ClampedArray(data.length);

  for (let pass = 0; pass < passes; pass++) {
    copy.set(data);
    nextFilled.set(filled);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (filled[idx]) continue;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nIdx = (y + oy) * width + (x + ox);
            if (filled[nIdx]) {
              const ni = nIdx * 4;
              rSum += copy[ni];
              gSum += copy[ni + 1];
              bSum += copy[ni + 2];
              count++;
            }
          }
        }

        if (count > 0) {
          const i = idx * 4;
          data[i] = Math.round(rSum / count);
          data[i + 1] = Math.round(gSum / count);
          data[i + 2] = Math.round(bSum / count);
          nextFilled[idx] = 1;
        }
      }
    }
    filled.set(nextFilled);
  }
}

interface CutoutViewDraft {
  rawCanvas: HTMLCanvasElement;
  minX: number;
  minY: number;
  cropW: number;
  cropH: number;
  mirrorX: boolean;
}

function extractCutoutDraft(
  img: HTMLImageElement,
  size: number,
  removeBg: boolean,
  bgTolerance: number,
  mirrorX: boolean
): CutoutViewDraft {
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = size;
  rawCanvas.height = size;
  const rawCtx = rawCanvas.getContext('2d')!;
  rawCtx.clearRect(0, 0, size, size);

  const srcW = img.naturalWidth || img.width || size;
  const srcH = img.naturalHeight || img.height || size;
  const fitScale = Math.min((size * 0.94) / srcW, (size * 0.94) / srcH);
  const fitW = srcW * fitScale;
  const fitH = srcH * fitScale;
  const fitX = (size - fitW) / 2;
  const fitY = (size - fitH) / 2;

  rawCtx.imageSmoothingEnabled = true;
  rawCtx.imageSmoothingQuality = 'high';
  rawCtx.drawImage(img, fitX, fitY, fitW, fitH);

  const rawData = rawCtx.getImageData(0, 0, size, size);
  if (removeBg) {
    removeStudioBackground(rawData.data, size, size, bgTolerance);
    rawCtx.putImageData(rawData, 0, 0);
  }

  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  let foundForeground = false;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rawData.data[(y * size + x) * 4 + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        foundForeground = true;
      }
    }
  }

  if (!foundForeground) {
    minX = Math.floor(fitX);
    minY = Math.floor(fitY);
    maxX = Math.ceil(fitX + fitW);
    maxY = Math.ceil(fitY + fitH);
  } else {
    minX = Math.max(0, minX - 4);
    minY = Math.max(0, minY - 4);
    maxX = Math.min(size - 1, maxX + 4);
    maxY = Math.min(size - 1, maxY + 4);
  }

  return {
    rawCanvas,
    minX,
    minY,
    cropW: Math.max(1, maxX - minX + 1),
    cropH: Math.max(1, maxY - minY + 1),
    mirrorX,
  };
}

/**
 * Harmonizes every angle onto an identical vertical height & floor-sole baseline so the
 * product rotates around its true vertical axis with zero bobbing or scale jumping.
 */
function finalizeViewTexture(
  draft: CutoutViewDraft,
  size: number,
  sharedTargetH: number,
  sharedBaselineY: number,
  maxAnisotropy: number,
  extraMirrorX = false
): THREE.CanvasTexture {
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = size;
  finalCanvas.height = size;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.clearRect(0, 0, size, size);

  const maxSpanW = size * 0.9;
  const heightScale = sharedTargetH / draft.cropH;
  const widthCapScale = maxSpanW / draft.cropW;
  const normScale = Math.min(heightScale, widthCapScale);

  const dstW = draft.cropW * normScale;
  const dstH = draft.cropH * normScale;
  const dstX = (size - dstW) / 2;
  const dstY = Math.max(size * 0.04, sharedBaselineY - dstH);

  const doMirror = draft.mirrorX !== extraMirrorX;

  finalCtx.save();
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  if (doMirror) {
    finalCtx.translate(size, 0);
    finalCtx.scale(-1, 1);
  }
  finalCtx.drawImage(
    draft.rawCanvas,
    draft.minX,
    draft.minY,
    draft.cropW,
    draft.cropH,
    dstX,
    dstY,
    dstW,
    dstH
  );
  finalCtx.restore();

  const finalImgData = finalCtx.getImageData(0, 0, size, size);
  dilateEdgeColors(finalImgData.data, size, size, 6);
  finalCtx.putImageData(finalImgData, 0, 0);

  const tex = new THREE.CanvasTexture(finalCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createStudioCurvedGeometry(
  span: number,
  volumeMode: CustomVolumeMode
): THREE.PlaneGeometry {
  const segs = 32;
  const geo = new THREE.PlaneGeometry(span, span, segs, segs);
  const pos = geo.attributes.position;

  const bulge =
    volumeMode === 'RIGID' ? 0.04 : volumeMode === 'PUFFER' ? 0.19 : 0.11;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (span * 0.5);
    const ny = y / (span * 0.5);
    const r2 = Math.min(1, nx * nx * 0.85 + ny * ny * 0.85);
    const dome = Math.cos(r2 * Math.PI * 0.5);
    pos.setZ(i, Math.max(0, dome) * bulge);
  }

  geo.computeVertexNormals();
  return geo;
}

const ORBITAL_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vec3 transformed = position;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const ORBITAL_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uBlend;
  uniform float uShiftA;
  uniform float uShiftB;
  uniform float uSheenStrength;
  uniform float uRimStrength;
  uniform float uSpecPower;
  uniform float uYawPhase;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  #include <fog_pars_fragment>

  vec4 sampleClamped(sampler2D tex, vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return vec4(0.0);
    }
    return texture2D(tex, uv);
  }

  void main() {
    // Unidirectional optical parallax between consecutive orbital studio angles
    vec2 uvA = vec2(vUv.x + uShiftA, vUv.y);
    vec2 uvB = vec2(vUv.x + uShiftB, vUv.y);

    vec4 colA = sampleClamped(uTexA, uvA);
    vec4 colB = sampleClamped(uTexB, uvB);

    float wA = 1.0 - uBlend;
    float wB = uBlend;

    float outAlpha = colA.a * wA + colB.a * wB;
    if (outAlpha < 0.03) discard;

    // Premultiplied alpha composite prevents dark or white halo bleeding between angles
    vec3 baseColor = (colA.rgb * colA.a * wA + colB.rgb * colB.a * wB) / max(outAlpha, 0.0001);

    // Subtle dynamic studio sheen & grazing rim light tied to orbital rotation
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(0.55 + sin(uYawPhase) * 0.25, 0.72, 0.85));
    vec3 H = normalize(L + V);

    float spec = pow(max(dot(N, H), 0.0), uSpecPower) * uSheenStrength;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8) * uRimStrength;

    // Modulate highlight gently so deep blacks stay rich & whites never blow out
    float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
    float specAtten = mix(1.0, 0.35, smoothstep(0.55, 0.95, luma));
    vec3 litColor = baseColor + vec3(spec * specAtten + fresnel * 0.55);

    gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), smoothstep(0.03, 0.14, outAlpha));
    #include <fog_fragment>
  }
`;

/**
 * Multi-Angle 360° Photorealistic Orbital Turntable Engine:
 * - Renders real multi-view studio packshots (2, 4, 8, or up to 12 angles) with zero texture loss
 *   and zero thin-edge paper collapse.
 * - Harmonizes vertical scale & floor-sole baseline across all angles so articles rotate cleanly
 *   around their own axis.
 * - Single-photo articles seamlessly synthesize a smooth 360° mirrored orbital loop so every
 *   exposed article spins continuously without showing a flat card edge.
 */
export async function create2DTo3DMeshGroup(
  config: Custom3DConfig,
  maxAnisotropy: number
): Promise<THREE.Group> {
  const rawList = (
    config.views360 && config.views360.length >= 2
      ? config.views360
      : [config.imageDataUrl]
  ).filter((u): u is string => Boolean(u && u.trim()));

  const hasNativeMultiView = rawList.length >= 2;
  const textureSize = rawList.length >= 6 ? 768 : 1024;
  const bgTolerance = config.bgTolerance ?? 40;

  // Load all angle sources concurrently
  const parsedSources = rawList.map(parseViewSource);
  const loadedEntries = await Promise.all(
    parsedSources.map(async (src) => {
      try {
        const img = await loadImage(src.cleanUrl);
        return { img, mirrorX: src.mirrorX };
      } catch {
        return null;
      }
    })
  );

  const validEntries = loadedEntries.filter(
    (entry): entry is { img: HTMLImageElement; mirrorX: boolean } => entry !== null
  );

  if (validEntries.length === 0) {
    throw new Error('Impossible de charger les vues produit.');
  }

  // Extract alpha cutouts for every angle
  const drafts = validEntries.map((entry) =>
    extractCutoutDraft(entry.img, textureSize, config.removeBackground, bgTolerance, entry.mirrorX)
  );

  // Shared vertical height & floor-sole baseline anchoring across all views
  const aspectRatios = drafts.map((d) => d.cropW / Math.max(1, d.cropH));
  const maxAspect = Math.max(...aspectRatios, 0.4);
  const sharedTargetH = Math.min(textureSize * 0.88, (textureSize * 0.9) / Math.max(1, maxAspect));
  const sharedBaselineY = textureSize * 0.5 + sharedTargetH * 0.5;

  const textures: THREE.CanvasTexture[] = [];
  if (drafts.length === 1) {
    // 1-photo product: build a clean 2-angle opposite orbital cycle so it never flattens at 90°
    textures.push(
      finalizeViewTexture(drafts[0], textureSize, sharedTargetH, sharedBaselineY, maxAnisotropy, false),
      finalizeViewTexture(drafts[0], textureSize, sharedTargetH, sharedBaselineY, maxAnisotropy, true)
    );
  } else {
    for (const draft of drafts) {
      textures.push(
        finalizeViewTexture(draft, textureSize, sharedTargetH, sharedBaselineY, maxAnisotropy, false)
      );
    }
  }

  const finishTuning =
    config.finish === 'METALLIC'
      ? { sheen: 0.14, rim: 0.12, power: 28.0 }
      : config.finish === 'LEATHER'
        ? { sheen: 0.085, rim: 0.08, power: 22.0 }
        : config.finish === 'SATIN'
          ? { sheen: 0.095, rim: 0.075, power: 20.0 }
          : { sheen: 0.035, rim: 0.04, power: 16.0 };

  const uniforms: Record<string, THREE.IUniform> = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTexA: { value: textures[0] },
    uTexB: { value: textures[1 % textures.length] },
    uBlend: { value: 0 },
    uShiftA: { value: 0 },
    uShiftB: { value: 0 },
    uSheenStrength: { value: finishTuning.sheen },
    uRimStrength: { value: finishTuning.rim },
    uSpecPower: { value: finishTuning.power },
    uYawPhase: { value: 0 },
  };

  const orbitalMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ORBITAL_VERTEX_SHADER,
    fragmentShader: ORBITAL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    fog: true,
  });

  const volumeMode: CustomVolumeMode = config.volumeMode ?? 'SCULPTED';
  const planeSpan = 2.25;
  const geo = createStudioCurvedGeometry(planeSpan, volumeMode);
  const mesh = new THREE.Mesh(geo, orbitalMaterial);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const group = new THREE.Group();
  group.add(mesh);

  normalizeAndCenterGroup(group, 2.25);

  const viewCount = textures.length;
  const twoPi = Math.PI * 2;
  const parallaxSpan = viewCount >= 8 ? 0.022 : viewCount >= 4 ? 0.036 : 0.048;

  const controller: Turntable360Controller = {
    viewCount: rawList.length,
    hasNativeMultiView,
    updateOrbit: (yawRad: number, pitchRad: number, idleSwayY = 0, idleSwayX = 0) => {
      const normYaw = ((yawRad % twoPi) + twoPi) % twoPi;
      const pos = (normYaw / twoPi) * viewCount;
      const idxA = Math.floor(pos) % viewCount;
      const idxB = (idxA + 1) % viewCount;
      const frac = pos - Math.floor(pos);

      // Continuous pause-free hermite interpolation for seamless 360° turntable motion
      let blend: number;
      if (viewCount >= 6) {
        blend = frac * frac * (3 - 2 * frac);
      } else {
        const t = THREE.MathUtils.clamp((frac - 0.06) / 0.88, 0, 1);
        blend = t * t * (3 - 2 * t);
      }

      uniforms.uTexA.value = textures[idxA];
      uniforms.uTexB.value = textures[idxB];
      uniforms.uBlend.value = blend;
      // Unidirectional optical parallax: View A glides right while View B enters from left
      uniforms.uShiftA.value = -blend * parallaxSpan;
      uniforms.uShiftB.value = (1 - blend) * parallaxSpan;
      uniforms.uYawPhase.value = normYaw;

      // Subtle vertical pitch & side-slot framing angle without ever collapsing to an edge
      group.rotation.x = THREE.MathUtils.clamp(pitchRad * 0.42 + idleSwayX, -0.26, 0.28);
      group.rotation.y = THREE.MathUtils.clamp(idleSwayY, -0.22, 0.22);
    },
  };

  controller.updateOrbit(0, 0.02, 0, 0);

  group.userData.turntable360 = controller;
  group.userData.disposeTextures = textures;

  return group;
}

export function generateSample360Views(universe: UniverseId): string[] {
  if (universe === 'CHAUSSURES') {
    return [
      '/src/assets/images/af1_triple_black_1795072570142.jpg',
      '/src/assets/images/af1_black_225_rm_1795094631508.jpg',
      '/src/assets/images/af1_black_back_1795093358506.jpg',
      '/src/assets/images/af1_black_315_rearleft_1795094684737.jpg',
      '/src/assets/images/af1_black_medial_1795093359049.jpg#flipX',
      '/src/assets/images/af1_black_45_fl_1795094631957.jpg',
      '/src/assets/images/af1_black_front_1795093358989.jpg',
      '/src/assets/images/af1_black_135_fm_1795094634799.jpg',
    ];
  }
  if (universe === 'HABITS') {
    return [
      '/src/assets/images/essentials_tee_black_1795072573074.jpg',
      '/src/assets/images/essentials_tee_315_fl_1795094687093.jpg',
      '/src/assets/images/essentials_tee_right_1795093360195.jpg',
      '/src/assets/images/essentials_tee_135_backright_1795094715188.jpg',
      '/src/assets/images/essentials_tee_back_1795093359712.jpg',
      '/src/assets/images/essentials_tee_225_rl_1795094686588.jpg',
      '/src/assets/images/essentials_tee_left_1795093358743.jpg',
      '/src/assets/images/essentials_tee_45_leftfacing_1795094716247.jpg',
    ];
  }
  return [
    '/src/assets/images/prada_renylon_bag_1795072692812.jpg',
    '/src/assets/images/prada_bag_315_fr_1795094717761.jpg',
    '/src/assets/images/prada_bag_right_1795093358204.jpg',
    '/src/assets/images/prada_bag_135_bl_1795094719145.jpg',
    '/src/assets/images/prada_bag_back_1795093359161.jpg',
    '/src/assets/images/prada_bag_225_br_1795094718628.jpg',
    '/src/assets/images/prada_bag_left_1795093358143.jpg#flipX',
    '/src/assets/images/prada_bag_45_clean_1795094736392.jpg',
  ];
}

export function generateSample2DPrototype(universe: UniverseId, _codeLabel: string): string {
  return generateSample360Views(universe)[0];
}
