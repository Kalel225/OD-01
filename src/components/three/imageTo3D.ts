import * as THREE from 'three';
import { Custom3DConfig, CustomVolumeMode, UniverseId } from '../../types/od01';

const TWO_PI = Math.PI * 2;

export interface Turntable360Controller {
  viewCount: number;
  hasNativeMultiView: boolean;
  /**
   * Updates the 360° orbital turntable view textures, optical parallax cross-blend,
   * and tactile 3D perspective tilt without EVER collapsing to a flat thin paper edge.
   */
  updateOrbit: (
    yawRad: number,
    pitchRad: number,
    idleSwayY?: number,
    idleSwayX?: number
  ) => void;
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
 * High-precision adaptive background & studio floor-shadow removal directly at 1024px:
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
  const pushPixel = (idx: number) => {
    const i = idx * 4;
    if (data[i + 3] < 24) return;
    sampleR.push(data[i]);
    sampleG.push(data[i + 1]);
    sampleB.push(data[i + 2]);
  };
  for (let x = 0; x < width; x += 6) {
    pushPixel(x);
    pushPixel((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 6) {
    pushPixel(y * width);
    pushPixel(y * width + (width - 1));
  }
  if (sampleR.length === 0) return;

  sampleR.sort((a, b) => a - b);
  sampleG.sort((a, b) => a - b);
  sampleB.sort((a, b) => a - b);
  const mid = Math.floor(sampleR.length / 2);
  const bgR = sampleR[mid];
  const bgG = sampleG[mid];
  const bgB = sampleB[mid];
  const bgIsBrightStudio = bgR > 220 && bgG > 220 && bgB > 220;

  const distToBg = (pixelIdx: number): number => {
    const i = pixelIdx * 4;
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.68;
  };

  // Strip soft grey studio floor shadows under shoes/bags while sparing white fabrics
  const isNeutralStudioShadow = (pixelIdx: number): boolean => {
    if (!bgIsBrightStudio || tolerance < 22) return false;
    const i = pixelIdx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return chroma < 15 && lum > Math.max(158, 255 - tolerance * 2.05);
  };

  const hardThreshold = Math.max(10, Math.min(110, tolerance));
  const softThreshold = hardThreshold * 1.38;

  const total = width * height;
  const visited = new Uint8Array(total);
  const bgMask = new Uint8Array(total);
  const queue = new Int32Array(total);
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

  // Open large pure-background enclosed interior cutouts (bag handle arches, coiled belt centers)
  if (tolerance >= 20) {
    const tightThreshold = Math.min(20, hardThreshold * 0.48);
    const minHolePixels = Math.floor(total * 0.009);
    const holeVisited = new Uint8Array(total);
    const component: number[] = [];

    for (let y = 6; y < height - 6; y += 3) {
      for (let x = 6; x < width - 6; x += 3) {
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
            const cIdx = component[k];
            bgMask[cIdx] = 1;
            data[cIdx * 4 + 3] = 0;
          }
        }
      }
    }
  }

  // Smooth 2px anti-aliased edge feathering around silhouette boundary
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (bgMask[idx]) continue;
      const touchingBg =
        bgMask[idx - 1] ||
        bgMask[idx + 1] ||
        bgMask[idx - width] ||
        bgMask[idx + width];
      if (!touchingBg) continue;

      const d = distToBg(idx);
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
 * Dilates foreground RGB colors outward into adjacent transparent pixels so WebGL
 * bilinear filtering NEVER produces white or grey halos along curved product contours.
 */
function dilateEdgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  passes = 6
): void {
  const valid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] > 180) valid[i] = 1;
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

interface CutoutFrame {
  canvas: HTMLCanvasElement;
  minX: number;
  minY: number;
  cropW: number;
  cropH: number;
}

function buildCutoutFrame(
  img: HTMLImageElement,
  size: number,
  removeBg: boolean,
  bgTolerance: number
): CutoutFrame {
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = size;
  rawCanvas.height = size;
  const rawCtx = rawCanvas.getContext('2d')!;
  rawCtx.clearRect(0, 0, size, size);

  const fitScale = Math.min(size / img.width, size / img.height);
  const fitW = Math.round(img.width * fitScale);
  const fitH = Math.round(img.height * fitScale);
  const fitX = Math.floor((size - fitW) / 2);
  const fitY = Math.floor((size - fitH) / 2);
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
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      if (rawData.data[(y * size + x) * 4 + 3] > 28) {
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
    maxX = size - 1;
    maxY = size - 1;
  } else {
    minX = Math.max(0, minX - 4);
    minY = Math.max(0, minY - 4);
    maxX = Math.min(size - 1, maxX + 4);
    maxY = Math.min(size - 1, maxY + 4);
  }

  return {
    canvas: rawCanvas,
    minX,
    minY,
    cropW: maxX - minX + 1,
    cropH: maxY - minY + 1,
  };
}

function finalizeViewTexture(
  frame: CutoutFrame,
  size: number,
  targetDstH: number,
  maxSpan: number,
  bottomBaselineY: number,
  maxAnisotropy: number,
  mirrorX = false
): THREE.CanvasTexture {
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = size;
  finalCanvas.height = size;
  const ctx = finalCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Preserve consistent real-world vertical height across all 360° angles & anchor to shared floor baseline
  const scaleByH = targetDstH / Math.max(1, frame.cropH);
  const scaleByW = maxSpan / Math.max(1, frame.cropW);
  const normScale = Math.min(scaleByH, scaleByW);
  const dstW = frame.cropW * normScale;
  const dstH = frame.cropH * normScale;
  const dstX = (size - dstW) / 2;
  const dstY = Math.max(size * 0.05, bottomBaselineY - dstH);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (mirrorX) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    frame.canvas,
    frame.minX,
    frame.minY,
    frame.cropW,
    frame.cropH,
    dstX,
    dstY,
    dstW,
    dstH
  );
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, size, size);
  dilateEdgeColors(imgData.data, size, size, 6);
  ctx.putImageData(imgData, 0, 0);

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

/**
 * Gently contoured studio surface giving natural 3D light catch & curvature
 * while keeping 100% razor-sharp photographic textures across every 360° angle.
 */
function createStudioCurvedGeometry(
  span: number,
  volumeMode: CustomVolumeMode
): THREE.PlaneGeometry {
  const segs = 24;
  const geo = new THREE.PlaneGeometry(span, span, segs, segs);
  const pos = geo.attributes.position;

  const bulge =
    volumeMode === 'RIGID' ? 0.04 : volumeMode === 'PUFFER' ? 0.14 : 0.085;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (span * 0.5);
    const ny = y / (span * 0.5);
    const r2 = Math.min(1, nx * nx * 0.8 + ny * ny * 0.8);
    const dome = Math.cos(r2 * Math.PI * 0.5);
    pos.setZ(i, Math.max(0, dome) * bulge);
  }

  geo.computeVertexNormals();
  return geo;
}

const ORBITAL_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvPosition.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const ORBITAL_FRAGMENT_SHADER = `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uBlend;
  uniform float uShiftA;
  uniform float uShiftB;
  uniform vec2 uTilt;
  uniform float uSheenStrength;
  uniform float uSheenPower;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  #include <fog_pars_fragment>

  vec4 sampleSafe(sampler2D tex, vec2 uv) {
    if (uv.x < 0.002 || uv.x > 0.998 || uv.y < 0.002 || uv.y > 0.998) {
      return vec4(0.0);
    }
    return texture2D(tex, uv);
  }

  void main() {
    float squeezeA = 1.0 + abs(uShiftA) * 0.55;
    float squeezeB = 1.0 + abs(uShiftB) * 0.55;
    vec2 uvA = vec2((vUv.x - 0.5) * squeezeA + 0.5 + uShiftA, vUv.y);
    vec2 uvB = vec2((vUv.x - 0.5) * squeezeB + 0.5 + uShiftB, vUv.y);

    vec4 colA = sampleSafe(uTexA, uvA);
    vec4 colB = sampleSafe(uTexB, uvB);

    // Premultiplied alpha cross-blend: crisp silhouette morph with zero dark halo
    vec3 premulA = colA.rgb * colA.a;
    vec3 premulB = colB.rgb * colB.a;
    float outAlpha = mix(colA.a, colB.a, uBlend);

    if (outAlpha < 0.025) discard;

    vec3 baseRgb = mix(premulA, premulB, uBlend) / max(outAlpha, 0.001);

    // Subtle real-time studio light sheen reacting to 3D orbit & vertical tilt
    vec3 n = normalize(vNormalView);
    vec3 viewDir = normalize(-vViewPos);
    vec3 keyDir = normalize(vec3(0.4 + uTilt.x * 1.15, 0.65 - uTilt.y * 0.95, 0.85));
    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(n, halfVec), 0.0), uSheenPower);
    float lum = dot(baseRgb, vec3(0.299, 0.587, 0.114));
    float sheenMask = mix(0.22, 0.95, smoothstep(0.02, 0.36, lum));
    vec3 finalRgb = baseRgb + vec3(1.0) * spec * uSheenStrength * sheenMask;

    gl_FragColor = vec4(finalRgb, outAlpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Native 360° Multi-Angle Photorealistic Studio Turntable Engine:
 * - Supports 2, 4, or up to 12 real side photographs (0° / 90° / 180° / 270° / etc.)
 *   with ZERO texture loss and ZERO thin flat paper collapse at any angle.
 * - Even for single-photo articles, synthesizes a matched opposite-side 360° pair so
 *   continuous 360° drag stays crisp, full-resolution, and true-to-color at every angle.
 * - Harmonizes vertical height & floor-sole alignment across all angles so shoes, tees,
 *   and bags pivot firmly on their studio contact shadow.
 */
export async function create2DTo3DMeshGroup(
  config: Custom3DConfig,
  maxAnisotropy: number
): Promise<THREE.Group> {
  const rawList =
    config.views360 && config.views360.length >= 2
      ? config.views360.filter((url) => Boolean(url && url.trim()))
      : [config.imageDataUrl];

  const uniqueSources = rawList.length > 0 ? rawList : [config.imageDataUrl];
  const settled = await Promise.allSettled(uniqueSources.map((src) => loadImage(src)));
  const loadedImages = settled
    .filter((r): r is PromiseFulfilledResult<HTMLImageElement> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (loadedImages.length === 0) {
    throw new Error('Unable to load any product view image');
  }

  const hasNativeMultiView = loadedImages.length >= 2;

  const texSize = uniqueSources.length > 4 ? 768 : 1024;
  const bgTolerance = config.bgTolerance ?? 40;
  const frames = loadedImages.map((img) =>
    buildCutoutFrame(img, texSize, config.removeBackground, bgTolerance)
  );

  // Establish harmonious physical height & shared floor baseline from View 0
  const maxSpan = texSize * 0.88;
  const primary = frames[0];
  const primaryScale = Math.min(maxSpan / primary.cropW, maxSpan / primary.cropH);
  const refH = primary.cropH * primaryScale;
  const bottomBaselineY = texSize * 0.5 + refH * 0.5;

  const textures: THREE.CanvasTexture[] = frames.map((frame, idx) => {
    const targetH = idx === 0 ? refH : Math.min(maxSpan, refH * 1.03);
    return finalizeViewTexture(
      frame,
      texSize,
      targetH,
      maxSpan,
      bottomBaselineY,
      maxAnisotropy,
      false
    );
  });

  // For single-photo items, synthesize an opposite-side 180° studio partner so 360° spin stays crisp
  if (textures.length === 1) {
    textures.push(
      finalizeViewTexture(
        frames[0],
        texSize,
        refH,
        maxSpan,
        bottomBaselineY,
        maxAnisotropy,
        true
      )
    );
  }

  const sheenProps =
    config.finish === 'METALLIC'
      ? { strength: 0.16, power: 26.0 }
      : config.finish === 'LEATHER'
        ? { strength: 0.08, power: 18.0 }
        : config.finish === 'SATIN'
          ? { strength: 0.09, power: 16.0 }
          : { strength: 0.035, power: 10.0 };

  const planeSpan = 2.34;
  const volumeMode: CustomVolumeMode = config.volumeMode ?? 'SCULPTED';
  const geometry = createStudioCurvedGeometry(planeSpan, volumeMode);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTexA: { value: textures[0] },
      uTexB: { value: textures[1 % textures.length] },
      uBlend: { value: 0 },
      uShiftA: { value: 0 },
      uShiftB: { value: 0 },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uSheenStrength: { value: sheenProps.strength },
      uSheenPower: { value: sheenProps.power },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ORBITAL_VERTEX_SHADER,
    fragmentShader: ORBITAL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;

  const group = new THREE.Group();
  group.add(mesh);

  const viewCount = textures.length;
  const controller: Turntable360Controller = {
    viewCount,
    hasNativeMultiView,
    updateOrbit: (yawRad: number, pitchRad: number, idleSwayY = 0, idleSwayX = 0) => {
      const normalized = ((yawRad % TWO_PI) + TWO_PI) % TWO_PI;
      const pos = (normalized / TWO_PI) * viewCount;
      const idxA = Math.floor(pos) % viewCount;
      const idxB = (idxA + 1) % viewCount;
      const frac = pos - Math.floor(pos);

      // Hold crystal-clear unblended photo near each cardinal angle, glide smoothly between angles
      const blend = smoothstep(0.14, 0.86, frac);

      uniforms.uTexA.value = textures[idxA];
      uniforms.uTexB.value = textures[idxB];
      uniforms.uBlend.value = blend;

      // Optical horizontal parallax matched to clockwise turntable drag direction
      const parallaxSpan = viewCount >= 4 ? 0.055 : 0.075;
      uniforms.uShiftA.value = -blend * parallaxSpan;
      uniforms.uShiftB.value = (1 - blend) * parallaxSpan;

      // Smooth C1-continuous tactile 3D tilt (NEVER goes edge-on / paper-thin)
      const transitionRock = Math.sin(frac * Math.PI) * 0.13;
      const rotY = transitionRock + idleSwayY * 0.65;
      const rotX = THREE.MathUtils.clamp(pitchRad * 0.55 + idleSwayX, -0.26, 0.28);

      mesh.rotation.y = rotY;
      mesh.rotation.x = rotX;
      uniforms.uTilt.value.set(rotY, rotX);
    },
  };

  controller.updateOrbit(0, 0.02, 0, 0);

  group.userData.turntable360 = controller;
  group.userData.disposeTextures = textures;

  return group;
}

/**
 * Returns complete 4-angle 360° real studio packshots for 1-click Admin testing.
 */
export function generateSample360Views(universe: UniverseId): string[] {
  if (universe === 'CHAUSSURES') {
    return ['/src/assets/images/af1_triple_black_1795072570142.jpg'];
  }
  if (universe === 'HABITS') {
    return ['/src/assets/images/essentials_tee_black_1795072573074.jpg'];
  }
  return ['/src/assets/images/prada_renylon_bag_1795072692812.jpg'];
}

export function generateSample2DPrototype(universe: UniverseId, _codeLabel: string): string {
  return generateSample360Views(universe)[0];
}
