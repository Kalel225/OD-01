import * as THREE from 'three';
import { Custom3DConfig, UniverseId } from '../../types/od01';
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
 * Flood-fills uniform light/studio borders connected to the image edges
 * so uploaded 2D product photos detach cleanly into 3D cutouts.
 */
function removeEdgeBackground(data: Uint8ClampedArray, width: number, height: number): void {
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  // Sample 4 corners to infer background luminance
  const cornerCoords = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ];
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  for (const idx of cornerCoords) {
    bgR += data[idx * 4];
    bgG += data[idx * 4 + 1];
    bgB += data[idx * 4 + 2];
  }
  bgR /= 4;
  bgG /= 4;
  bgB /= 4;

  const threshold = 48;

  const isBg = (pixelIdx: number): boolean => {
    const i = pixelIdx * 4;
    if (data[i + 3] < 20) return true;
    const dr = Math.abs(data[i] - bgR);
    const dg = Math.abs(data[i + 1] - bgG);
    const db = Math.abs(data[i + 2] - bgB);
    return dr + dg + db < threshold * 2.4;
  };

  for (let x = 0; x < width; x++) {
    stack.push(x);
    stack.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width);
    stack.push(y * width + (width - 1));
  }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!isBg(idx)) continue;

    data[idx * 4 + 3] = 0;

    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0 && !visited[idx - 1]) stack.push(idx - 1);
    if (x < width - 1 && !visited[idx + 1]) stack.push(idx + 1);
    if (y > 0 && !visited[idx - width]) stack.push(idx - width);
    if (y < height - 1 && !visited[idx + width]) stack.push(idx + width);
  }
}

/**
 * Computes a Sobel normal map canvas from luminance values for real 3D lighting response.
 */
function buildSobelNormalCanvas(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  strength = 2.6
): HTMLCanvasElement {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = srcData[i * 4 + 3] / 255;
    const r = srcData[i * 4] / 255;
    const g = srcData[i * 4 + 1] / 255;
    const b = srcData[i * 4 + 2] / 255;
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d')!;
  const outImg = ctx.createImageData(width, height);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return lum[cy * width + cx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;

      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * width + x) * 4;
      dst[idx] = Math.round(((-dx * invLen) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((-dy * invLen) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((dz * invLen) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return outCanvas;
}

/**
 * Converts an uploaded 2D product image into a volumetric 3D extruded relief object
 * with PBR color texture, generated Sobel normal map, and stacked contour depth.
 */
export async function create2DTo3DMeshGroup(
  config: Custom3DConfig,
  maxAnisotropy: number
): Promise<THREE.Group> {
  const img = await loadImage(config.imageDataUrl);
  const size = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Fit image nicely with safe padding
  const scale = Math.min((size * 0.88) / img.width, (size * 0.88) / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const imgData = ctx.getImageData(0, 0, size, size);
  if (config.removeBackground) {
    removeEdgeBackground(imgData.data, size, size);
    ctx.putImageData(imgData, 0, 0);
  }

  // Generate Sobel normal map
  const normalCanvas = buildSobelNormalCanvas(imgData.data, size, size, 2.8);

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.anisotropy = Math.max(1, maxAnisotropy);
  colorTexture.needsUpdate = true;

  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.anisotropy = Math.max(1, maxAnisotropy);
  normalTexture.needsUpdate = true;

  const finishProps =
    config.finish === 'METALLIC'
      ? { roughness: 0.28, metalness: 0.72 }
      : config.finish === 'SATIN'
        ? { roughness: 0.44, metalness: 0.16 }
        : { roughness: 0.82, metalness: 0.04 };

  const group = new THREE.Group();
  const planeW = 1.9;
  const planeH = 1.9;
  const totalDepth = Math.max(0.08, Math.min(0.45, config.depth));

  // Front & Back crisp PBR faces
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: colorTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: finishProps.roughness,
    metalness: finishProps.metalness,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
  });

  const frontGeo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
  const frontMesh = new THREE.Mesh(frontGeo, faceMaterial);
  frontMesh.position.z = totalDepth / 2;
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  group.add(frontMesh);

  const backGeo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
  const backMesh = new THREE.Mesh(backGeo, faceMaterial);
  backMesh.position.z = -totalDepth / 2;
  backMesh.rotation.y = Math.PI;
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  group.add(backMesh);

  // Volumetric interior silhouette slices for genuine 3D solid extrusion look at grazing angles
  const slices = 14;
  const sideMat = new THREE.MeshStandardMaterial({
    map: colorTexture,
    color: 0x2a2a2a,
    roughness: Math.min(0.95, finishProps.roughness + 0.15),
    metalness: finishProps.metalness,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });

  const sliceGeo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
  for (let i = 1; i < slices; i++) {
    const t = i / slices;
    const z = -totalDepth / 2 + t * totalDepth;
    // Slight dome bevel near front/back edges
    const edgeFactor = Math.sin(t * Math.PI);
    const scaleBoost = 0.985 + edgeFactor * 0.025;
    const slice = new THREE.Mesh(sliceGeo, sideMat);
    slice.position.z = z;
    slice.scale.set(scaleBoost, scaleBoost, 1);
    group.add(slice);
  }

  // Subtle architectural base plinth wire indicator beneath custom 3D scans
  const plinthGeo = new THREE.BoxGeometry(1.15, 0.035, Math.max(0.45, totalDepth + 0.22));
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x161616,
    roughness: 0.35,
    metalness: 0.55,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.set(0, -1.02, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  normalizeAndCenterGroup(group, 2.2);
  return group;
}

/**
 * Generates a crisp monochrome studio 2D product prototype image (Data URL)
 * so admins can test the 2D -> 3D converter immediately in one click.
 */
export function generateSample2DPrototype(universe: UniverseId, codeLabel: string): string {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // White studio backdrop (ideal to showcase automatic cutout)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#181818';
  ctx.lineWidth = 6;

  if (universe === 'CHAUSSURES') {
    // High-contrast technical silhouette sneaker
    ctx.beginPath();
    ctx.moveTo(76, 338);
    ctx.lineTo(438, 338);
    ctx.lineTo(448, 290);
    ctx.lineTo(356, 268);
    ctx.lineTo(256, 178);
    ctx.lineTo(188, 186);
    ctx.lineTo(148, 224);
    ctx.lineTo(86, 214);
    ctx.lineTo(76, 338);
    ctx.closePath();
    ctx.fill();

    // Sole contrast block
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(74, 306, 370, 26);
    ctx.strokeRect(74, 306, 370, 26);

    // Technical ribs
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(96 + i * 56, 332, 34, 16);
    }
    // Laces
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(246 + i * 24, 198 + i * 16);
      ctx.lineTo(278 + i * 24, 214 + i * 16);
      ctx.stroke();
    }
  } else if (universe === 'HABITS') {
    // Architectural technical vest / jacket
    ctx.beginPath();
    ctx.moveTo(136, 94);
    ctx.lineTo(206, 94);
    ctx.lineTo(256, 134);
    ctx.lineTo(306, 94);
    ctx.lineTo(376, 94);
    ctx.lineTo(440, 176);
    ctx.lineTo(386, 224);
    ctx.lineTo(366, 194);
    ctx.lineTo(366, 422);
    ctx.lineTo(146, 422);
    ctx.lineTo(146, 194);
    ctx.lineTo(126, 224);
    ctx.lineTo(72, 176);
    ctx.closePath();
    ctx.fill();

    // Zip + technical pockets
    ctx.strokeStyle = '#D4D4D4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(256, 134);
    ctx.lineTo(256, 422);
    ctx.stroke();
    ctx.strokeRect(172, 268, 62, 78);
    ctx.strokeRect(278, 268, 62, 78);
  } else {
    // Architectural rigid tactical pouch / bag
    ctx.fillRect(108, 148, 296, 242);
    ctx.fillStyle = '#2A2A2A';
    ctx.fillRect(104, 144, 304, 118);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.strokeRect(108, 148, 296, 242);
    // Machined buckle
    ctx.fillStyle = '#D9D9D9';
    ctx.fillRect(222, 238, 68, 48);
    ctx.fillStyle = '#000000';
    ctx.fillRect(238, 254, 36, 16);
    // Strap arch
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(256, 152, 128, Math.PI, 0);
    ctx.stroke();
  }

  // Industrial stencil spec mark
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(codeLabel, 256, 292);

  return canvas.toDataURL('image/png');
}
