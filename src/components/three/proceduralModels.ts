import * as THREE from 'three';
import { ModelPreset } from '../../types/od01';
import { normalizeAndCenterGroup } from './disposeUtils';

interface StudioPalette {
  tumbledLeather: THREE.MeshPhysicalMaterial;
  smoothLeather: THREE.MeshPhysicalMaterial;
  nubuckBlack: THREE.MeshStandardMaterial;
  heavyCotton: THREE.MeshStandardMaterial;
  ribbedKnit: THREE.MeshStandardMaterial;
  goreTexShell: THREE.MeshPhysicalMaterial;
  pradaReNylon: THREE.MeshPhysicalMaterial;
  evaFoam: THREE.MeshStandardMaterial;
  rubberSole: THREE.MeshStandardMaterial;
  chalkWhite: THREE.MeshStandardMaterial;
  softGreyKnit: THREE.MeshStandardMaterial;
  enamelBlack: THREE.MeshPhysicalMaterial;
  chromeMetal: THREE.MeshStandardMaterial;
  gunmetal: THREE.MeshStandardMaterial;
}

// =========================================================================
// Procedural High-Resolution PBR Surface Maps (Self-contained Canvas)
// =========================================================================

function createLeatherGrainTexture(size = 256, intensity = 38): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Tumbled pebble cells
  for (let i = 0; i < 1600; i++) {
    const hash1 = ((i * 73856093) ^ 19349663) & 0xffff;
    const hash2 = ((i * 83492791) ^ 2971215073) & 0xffff;
    const x = (hash1 / 0xffff) * size;
    const y = (hash2 / 0xffff) * size;
    const r = 1.6 + (hash1 % 5) * 0.55;
    const v = 128 + Math.round((((hash2 % 100) / 100) - 0.45) * intensity);

    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine pore creases
  ctx.strokeStyle = 'rgba(60,60,60,0.22)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 220; i++) {
    const x = ((i * 49157) % size);
    const y = ((i * 98317) % size);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 7) - 3) * 4, y + (((i * 3) % 7) - 3) * 4);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}

function createWeaveTexture(
  size = 256,
  step = 4,
  contrast = 28,
  ripstopGrid = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const checker = ((x / step + y / step) % 2 === 0) ? 1 : -1;
      const hash = (((x * 374761393) ^ (y * 668265263)) & 255) / 255 - 0.5;
      const v = Math.max(0, Math.min(255, Math.round(128 + checker * (contrast * 0.35) + hash * contrast)));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, step, step);
    }
  }

  if (ripstopGrid) {
    ctx.strokeStyle = 'rgba(215,215,215,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
}

function createVerticalRibTexture(size = 256, pitch = 6): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  for (let x = 0; x < size; x++) {
    const wave = Math.sin((x / pitch) * Math.PI * 2);
    const v = Math.round(128 + wave * 54);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.needsUpdate = true;
  return tex;
}

function createDecalCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function createStudioMaterials(): StudioPalette {
  const leatherBump = createLeatherGrainTexture(256, 44);
  const nubuckBump = createLeatherGrainTexture(256, 26);
  const cottonBump = createWeaveTexture(256, 2, 24, false);
  const ripstopBump = createWeaveTexture(256, 2, 18, true);
  const ribBump = createVerticalRibTexture(256, 6);
  const rubberBump = createLeatherGrainTexture(128, 52);

  return {
    tumbledLeather: new THREE.MeshPhysicalMaterial({
      color: 0x151515,
      roughness: 0.44,
      metalness: 0.05,
      clearcoat: 0.2,
      clearcoatRoughness: 0.42,
      bumpMap: leatherBump,
      bumpScale: 0.014,
      envMapIntensity: 1.25,
    }),
    smoothLeather: new THREE.MeshPhysicalMaterial({
      color: 0x121212,
      roughness: 0.34,
      metalness: 0.06,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      bumpMap: leatherBump,
      bumpScale: 0.006,
      envMapIntensity: 1.35,
    }),
    nubuckBlack: new THREE.MeshStandardMaterial({
      color: 0x191919,
      roughness: 0.88,
      metalness: 0.02,
      bumpMap: nubuckBump,
      bumpScale: 0.016,
      envMapIntensity: 0.85,
    }),
    heavyCotton: new THREE.MeshStandardMaterial({
      color: 0x161616,
      roughness: 0.92,
      metalness: 0.01,
      bumpMap: cottonBump,
      bumpScale: 0.015,
      envMapIntensity: 0.78,
    }),
    ribbedKnit: new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      roughness: 0.9,
      metalness: 0.02,
      bumpMap: ribBump,
      bumpScale: 0.022,
      envMapIntensity: 0.82,
    }),
    goreTexShell: new THREE.MeshPhysicalMaterial({
      color: 0x141414,
      roughness: 0.38,
      metalness: 0.1,
      clearcoat: 0.26,
      clearcoatRoughness: 0.36,
      bumpMap: ripstopBump,
      bumpScale: 0.012,
      envMapIntensity: 1.35,
    }),
    pradaReNylon: new THREE.MeshPhysicalMaterial({
      color: 0x101010,
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.38,
      clearcoatRoughness: 0.26,
      bumpMap: ripstopBump,
      bumpScale: 0.008,
      envMapIntensity: 1.45,
    }),
    evaFoam: new THREE.MeshStandardMaterial({
      color: 0x1d1d1d,
      roughness: 0.72,
      metalness: 0.02,
      bumpMap: nubuckBump,
      bumpScale: 0.01,
      envMapIntensity: 0.92,
    }),
    rubberSole: new THREE.MeshStandardMaterial({
      color: 0x121212,
      roughness: 0.58,
      metalness: 0.04,
      bumpMap: rubberBump,
      bumpScale: 0.018,
      envMapIntensity: 1.0,
    }),
    chalkWhite: new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.82,
      metalness: 0.01,
      bumpMap: cottonBump,
      bumpScale: 0.012,
      envMapIntensity: 0.85,
    }),
    softGreyKnit: new THREE.MeshStandardMaterial({
      color: 0x353535,
      roughness: 0.86,
      metalness: 0.02,
      bumpMap: cottonBump,
      bumpScale: 0.014,
    }),
    enamelBlack: new THREE.MeshPhysicalMaterial({
      color: 0x080808,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.7,
    }),
    chromeMetal: new THREE.MeshStandardMaterial({
      color: 0xe2e2e2,
      roughness: 0.16,
      metalness: 0.96,
      envMapIntensity: 1.85,
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x454545,
      roughness: 0.24,
      metalness: 0.92,
      envMapIntensity: 1.6,
    }),
  };
}

function addShadows(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createExtrudedShape(
  shape: THREE.Shape,
  depth: number,
  bevelThickness = 0.05,
  bevelSize = 0.04,
  bevelSegments = 4,
  curveSegments = 18
): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Helper: Sculpted 3D Nike Swoosh ExtrudeGeometry
function createSwooshGeometry(scale = 1, thickness = 0.024): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.42 * scale, 0.12 * scale);
  s.bezierCurveTo(
    -0.56 * scale, -0.06 * scale,
    -0.36 * scale, -0.22 * scale,
    -0.06 * scale, -0.11 * scale
  );
  s.bezierCurveTo(
    0.2 * scale, -0.02 * scale,
    0.46 * scale, 0.12 * scale,
    0.66 * scale, 0.24 * scale
  );
  s.bezierCurveTo(
    0.34 * scale, 0.06 * scale,
    0.04 * scale, -0.04 * scale,
    -0.18 * scale, -0.02 * scale
  );
  s.bezierCurveTo(
    -0.34 * scale, 0.0 * scale,
    -0.44 * scale, 0.06 * scale,
    -0.42 * scale, 0.12 * scale
  );
  return createExtrudedShape(s, thickness, 0.008, 0.006, 2, 16);
}

// =========================================================================
// 1. SN-01 : NIKE AIR FORCE 1 '07 TRIPLE BLACK
// =========================================================================
function buildAirForce1(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Iconic Thick Flat AF1 Cupsole
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-1.14, 0.0);
  soleShape.lineTo(1.2, 0.0);
  soleShape.quadraticCurveTo(1.28, 0.04, 1.24, 0.28);
  soleShape.lineTo(0.84, 0.32);
  soleShape.lineTo(-1.08, 0.34);
  soleShape.quadraticCurveTo(-1.18, 0.3, -1.16, 0.06);
  soleShape.closePath();

  const soleGeo = createExtrudedShape(soleShape, 0.78, 0.055, 0.045, 4);
  const sole = new THREE.Mesh(soleGeo, m.rubberSole);
  g.add(sole);

  // Recessed Midsole Channel Stitch Groove
  const stitchChannel = new THREE.Mesh(
    new THREE.BoxGeometry(2.38, 0.025, 0.875),
    m.enamelBlack
  );
  stitchChannel.position.set(0.03, 0.29, 0);
  g.add(stitchChannel);

  // Embossed "AIR" Heel Midsole Badge (Both Sides)
  const airTex = createDecalCanvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(10, 42, 76, 12);
    ctx.fillStyle = '#484848';
    ctx.font = 'bold 48px "Space Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('AIR', 96, h / 2 + 2);
  });
  const airMat = new THREE.MeshStandardMaterial({
    map: airTex,
    roughness: 0.52,
    metalness: 0.08,
  });
  for (const side of [-1, 1]) {
    const airBadge = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.02), airMat);
    airBadge.position.set(-0.68, 0.15, side * 0.44);
    g.add(airBadge);
  }

  // Pivot-Circle Outsole Tread Bars
  for (let i = 0; i < 7; i++) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.82), m.enamelBlack);
    lug.position.set(-0.9 + i * 0.31, -0.02, 0);
    g.add(lug);
  }

  // Sculpted AF1 Low-Top Leather Upper Body
  const upperShape = new THREE.Shape();
  upperShape.moveTo(-1.08, 0.31);
  upperShape.lineTo(1.16, 0.31);
  upperShape.bezierCurveTo(1.24, 0.48, 1.06, 0.62, 0.62, 0.65);
  upperShape.lineTo(0.12, 0.96);
  upperShape.lineTo(-0.26, 0.96);
  upperShape.bezierCurveTo(-0.46, 0.72, -0.78, 0.74, -0.96, 0.88);
  upperShape.lineTo(-1.12, 0.62);
  upperShape.closePath();

  const upperGeo = createExtrudedShape(upperShape, 0.66, 0.075, 0.055, 5);
  const upper = new THREE.Mesh(upperGeo, m.tumbledLeather);
  g.add(upper);

  // Layered Toe Mudguard Overlay
  const mudguard = new THREE.Mesh(
    new THREE.SphereGeometry(0.41, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    m.smoothLeather
  );
  mudguard.scale.set(1.22, 0.72, 1.02);
  mudguard.position.set(0.76, 0.33, 0);
  g.add(mudguard);

  // Perforated AF1 Toe Box Vamp Plate
  const perfTex = createDecalCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#040404';
    const rows = [
      { y: 78, count: 5, span: 96 },
      { y: 112, count: 7, span: 136 },
      { y: 146, count: 7, span: 148 },
      { y: 180, count: 5, span: 112 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const x = w / 2 - row.span / 2 + (row.span / (row.count - 1)) * i;
        ctx.beginPath();
        ctx.arc(x, row.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  const perfMat = new THREE.MeshStandardMaterial({
    map: perfTex,
    roughness: 0.42,
    metalness: 0.06,
  });
  const toeVamp = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.56), perfMat);
  toeVamp.position.set(0.72, 0.62, 0);
  toeVamp.rotation.z = -0.18;
  g.add(toeVamp);

  // Layered Rear Heel Counter & Back Tab with Tonal NIKE AIR Stamp
  const heelOverlay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.41, 0.48, 22, 1, false, Math.PI * 0.55, Math.PI * 0.9),
    m.smoothLeather
  );
  heelOverlay.position.set(-0.76, 0.55, 0);
  g.add(heelOverlay);

  const heelTabTex = createDecalCanvasTexture(192, 128, (ctx, w, h) => {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4a4a4a';
    ctx.font = 'bold 28px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NIKE', w / 2, 50);
    ctx.font = 'bold 24px "Space Mono", monospace';
    ctx.fillText('AIR', w / 2, 92);
  });
  const heelTab = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.24, 0.36),
    new THREE.MeshStandardMaterial({ map: heelTabTex, roughness: 0.38 })
  );
  heelTab.position.set(-1.08, 0.78, 0);
  heelTab.rotation.z = 0.24;
  g.add(heelTab);

  // Iconic Sculpted 3D Swooshes on Both Medial & Lateral Quarters
  const swooshGeo = createSwooshGeometry(0.92, 0.032);
  for (const side of [-1, 1]) {
    const swoosh = new THREE.Mesh(swooshGeo, m.smoothLeather);
    swoosh.position.set(-0.18, 0.57, side * 0.405);
    if (side === -1) {
      swoosh.scale.x = 1;
    }
    swoosh.rotation.z = -0.06;
    g.add(swoosh);
  }

  // Padded Low-Top Collar Opening
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 14, 28), m.heavyCotton);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.36, 1.0, 0.96);
  collar.position.set(-0.56, 0.88, 0);
  g.add(collar);

  // Sculpted Padded Tongue + Woven Label
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.13, 0.44), m.heavyCotton);
  tongue.position.set(0.06, 0.96, 0);
  tongue.rotation.z = -0.46;
  g.add(tongue);

  const tongueTag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.26), m.enamelBlack);
  tongueTag.position.set(-0.08, 1.06, 0);
  tongueTag.rotation.z = -0.46;
  g.add(tongueTag);

  // Eyestay Strip + 6 Flat Triple-Black Laces
  for (const side of [-1, 1]) {
    const eyestay = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.07), m.smoothLeather);
    eyestay.position.set(0.24, 0.82, side * 0.29);
    eyestay.rotation.z = -0.52;
    g.add(eyestay);
  }

  for (let i = 0; i < 6; i++) {
    const lx = -0.02 + i * 0.115;
    const ly = 0.98 - i * 0.062;
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.022, 0.54), m.heavyCotton);
    lace.position.set(lx, ly, 0);
    lace.rotation.z = -0.52;
    g.add(lace);
  }

  // Iconic Brushed Gunmetal "AF-1" Lace Deubré Lock
  const deubreTex = createDecalCanvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#686868';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#c8c8c8';
    ctx.font = 'bold 28px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AF-1', w / 2, h / 2 + 2);
  });
  const deubre = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.036, 0.26),
    new THREE.MeshStandardMaterial({
      map: deubreTex,
      roughness: 0.22,
      metalness: 0.88,
    })
  );
  deubre.position.set(0.56, 0.68, 0);
  deubre.rotation.z = -0.45;
  g.add(deubre);

  g.rotation.y = -0.34;
  return g;
}

// =========================================================================
// 2. SL-01 : ADIDAS YEEZY SLIDE ONYX
// =========================================================================
function buildYeezySlide(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Signature Chunky Contoured EVA Rocker Midsole Profile
  const bedShape = new THREE.Shape();
  bedShape.moveTo(-1.14, 0.14);
  bedShape.bezierCurveTo(-0.5, 0.06, 0.55, 0.04, 1.14, 0.16);
  bedShape.quadraticCurveTo(1.28, 0.24, 1.2, 0.42);
  bedShape.bezierCurveTo(0.8, 0.36, 0.25, 0.32, -0.35, 0.38);
  bedShape.bezierCurveTo(-0.78, 0.43, -1.08, 0.48, -1.2, 0.36);
  bedShape.quadraticCurveTo(-1.26, 0.24, -1.14, 0.14);
  bedShape.closePath();

  const bedGeo = createExtrudedShape(bedShape, 0.78, 0.095, 0.085, 6);
  const bed = new THREE.Mesh(bedGeo, m.evaFoam);
  g.add(bed);

  // Subtle Recessed Contoured Footbed Basin
  const basin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.68), m.rubberSole);
  basin.position.set(-0.04, 0.39, 0);
  basin.rotation.z = -0.04;
  g.add(basin);

  // Iconic Monoblock Seamless Rounded Forefoot Arch Vault (Extruded Cross-Section)
  const archShape = new THREE.Shape();
  // Outer vault arc
  archShape.moveTo(-0.46, 0.22);
  archShape.bezierCurveTo(-0.49, 0.78, -0.3, 1.02, 0.0, 1.02);
  archShape.bezierCurveTo(0.3, 1.02, 0.49, 0.78, 0.46, 0.22);
  // Inner tunnel cutout
  archShape.lineTo(0.31, 0.24);
  archShape.bezierCurveTo(0.32, 0.64, 0.18, 0.81, 0.0, 0.81);
  archShape.bezierCurveTo(-0.18, 0.81, -0.32, 0.64, -0.31, 0.24);
  archShape.closePath();

  const archGeo = createExtrudedShape(archShape, 0.84, 0.075, 0.065, 5);
  archGeo.rotateY(Math.PI / 2);
  const arch = new THREE.Mesh(archGeo, m.evaFoam);
  arch.position.set(0.28, 0.05, 0);
  arch.rotation.z = -0.06;
  g.add(arch);

  // Signature Deep Sawtooth Sharks-Tooth Outsole Lugs (9 Sculpted Teeth)
  const toothShape = new THREE.Shape();
  toothShape.moveTo(-0.11, 0.14);
  toothShape.lineTo(0.0, -0.07);
  toothShape.lineTo(0.11, 0.14);
  toothShape.closePath();
  const toothGeo = createExtrudedShape(toothShape, 0.82, 0.018, 0.016, 2);

  for (let i = 0; i < 9; i++) {
    const tooth = new THREE.Mesh(toothGeo, m.evaFoam);
    const xPos = -0.96 + i * 0.24;
    const rockerLift = Math.pow((i - 4) / 4.5, 2) * 0.07;
    tooth.position.set(xPos, rockerLift, 0);
    g.add(tooth);
  }

  g.rotation.y = -0.42;
  return g;
}

// =========================================================================
// 3. BT-01 : TIMBERLAND 6-INCH PREMIUM BOOT BLACK
// =========================================================================
function buildTimberlandBoot(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Heavy Split-Heel Commando Rubber Outsole
  const foreSole = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.2, 0.86), m.rubberSole);
  foreSole.position.set(0.46, 0.14, 0);
  g.add(foreSole);

  const heelBlock = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.3, 0.88), m.rubberSole);
  heelBlock.position.set(-0.7, 0.11, 0);
  g.add(heelBlock);

  // Signature Perimeter Lug Teeth
  for (let i = 0; i < 5; i++) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.9), m.enamelBlack);
    lug.position.set(0.04 + i * 0.26, 0.02, 0);
    g.add(lug);
  }
  for (let i = 0; i < 3; i++) {
    const hLug = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.9), m.enamelBlack);
    hLug.position.set(-0.96 + i * 0.25, -0.04, 0);
    g.add(hLug);
  }

  // Welt Stitch Rim Platform
  const welt = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.08, 0.92), m.smoothLeather);
  welt.position.set(0.04, 0.26, 0);
  g.add(welt);

  // Sculpted 6-Inch Nubuck Boot Upper & Shaft Silhouette
  const bootShape = new THREE.Shape();
  bootShape.moveTo(-1.04, 0.28);
  bootShape.lineTo(1.12, 0.28);
  bootShape.bezierCurveTo(1.22, 0.56, 1.0, 0.72, 0.58, 0.74);
  bootShape.lineTo(0.14, 1.04);
  bootShape.lineTo(0.04, 1.76);
  bootShape.lineTo(-0.88, 1.74);
  bootShape.lineTo(-1.06, 0.72);
  bootShape.closePath();

  const bootGeo = createExtrudedShape(bootShape, 0.68, 0.085, 0.065, 5);
  const bootUpper = new THREE.Mesh(bootGeo, m.nubuckBlack);
  g.add(bootUpper);

  // Bulbous Rounded Timberland Toe Box
  const toe = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    m.nubuckBlack
  );
  toe.scale.set(1.18, 0.78, 1.0);
  toe.position.set(0.76, 0.34, 0);
  g.add(toe);

  // Quadruple-Row Quarter Seam Accent Trim
  for (const side of [-1, 1]) {
    const seamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.74, 0.36, side * 0.415),
      new THREE.Vector3(-0.34, 0.72, side * 0.415),
      new THREE.Vector3(0.08, 0.92, side * 0.415),
    ]);
    const seamLine = new THREE.Mesh(
      new THREE.TubeGeometry(seamCurve, 18, 0.014, 6, false),
      m.softGreyKnit
    );
    g.add(seamLine);
  }

  // Iconic Double-Padded Roll-Top Leather Collar
  for (let tier = 0; tier < 2; tier++) {
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.115, 16, 28), m.smoothLeather);
    roll.rotation.x = Math.PI / 2;
    roll.scale.set(1.12, 0.92, 1.0);
    roll.position.set(-0.42, 1.66 + tier * 0.16, 0);
    g.add(roll);
  }

  // Front Gusset Tongue + 7 Pairs of Hexagonal Gunmetal Eyelets + Taslan Laces
  const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.18, 0.4), m.nubuckBlack);
  gusset.position.set(0.08, 1.24, 0);
  gusset.rotation.z = -0.1;
  g.add(gusset);

  const hexGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.04, 6);
  hexGeo.rotateX(Math.PI / 2);

  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const ly = 0.76 + t * 0.94;
    const lx = 0.24 - t * 0.16;

    const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 8), m.heavyCotton);
    lace.rotation.x = Math.PI / 2;
    lace.position.set(lx + 0.03, ly, 0);
    g.add(lace);

    for (const side of [-1, 1]) {
      const hex = new THREE.Mesh(hexGeo, m.gunmetal);
      hex.position.set(lx, ly, side * 0.34);
      g.add(hex);
    }
  }

  // Subtle Debossed Timberland Tree Medallion on Outer Heel
  const treeTex = createDecalCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, 92);
    ctx.lineTo(w / 2, 34);
    ctx.moveTo(w / 2, 56);
    ctx.lineTo(42, 42);
    ctx.moveTo(w / 2, 56);
    ctx.lineTo(86, 42);
    ctx.moveTo(w / 2, 70);
    ctx.lineTo(38, 60);
    ctx.moveTo(w / 2, 70);
    ctx.lineTo(90, 60);
    ctx.stroke();
  });
  const medallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20),
    new THREE.MeshStandardMaterial({ map: treeTex, roughness: 0.75 })
  );
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(-0.76, 0.62, 0.42);
  g.add(medallion);

  g.rotation.y = -0.36;
  return g;
}

// =========================================================================
// 4. TS-01 : FEAR OF GOD ESSENTIALS TEE JET BLACK
// =========================================================================
function buildEssentialsTee(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Wide Boxy Oversized Torso Silhouette with Soft Drape
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.74, -0.98);
  bodyShape.lineTo(0.74, -0.98);
  bodyShape.bezierCurveTo(0.76, -0.25, 0.78, 0.35, 0.84, 0.78);
  bodyShape.lineTo(0.32, 0.96);
  bodyShape.quadraticCurveTo(0, 0.74, -0.32, 0.96);
  bodyShape.lineTo(-0.84, 0.78);
  bodyShape.bezierCurveTo(-0.78, 0.35, -0.76, -0.25, -0.74, -0.98);
  bodyShape.closePath();

  const bodyGeo = createExtrudedShape(bodyShape, 0.34, 0.1, 0.07, 5);
  const body = new THREE.Mesh(bodyGeo, m.heavyCotton);
  g.add(body);

  // Dropped Wide Elbow-Length Oversized Sleeves
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.84, 24),
      m.heavyCotton
    );
    sleeve.scale.set(1.0, 1.0, 0.7);
    sleeve.position.set(side * 1.0, 0.38, 0);
    sleeve.rotation.z = side * 0.56;
    g.add(sleeve);

    // Double-Needle Stitched Sleeve Hem
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.305, 0.305, 0.07, 24),
      m.ribbedKnit
    );
    cuff.scale.set(1.0, 1.0, 0.7);
    cuff.position.set(side * 1.22, 0.05, 0);
    cuff.rotation.z = side * 0.56;
    g.add(cuff);
  }

  // Thick Signature Mock-Rib Crew Collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.082, 16, 32), m.ribbedKnit);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.02, 0.78, 1.0);
  collar.position.set(0, 0.93, 0);
  g.add(collar);

  // Subtle Flocked Tonal Chest "ESSENTIALS / FEAR OF GOD" Graphic
  const chestTex = createDecalCanvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#161616';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#383838';
    ctx.font = 'bold 54px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ESSENTIALS', w / 2, 92);
    ctx.fillStyle = '#2e2e2e';
    ctx.font = 'bold 20px "Space Mono", monospace';
    ctx.fillText('FEAR OF GOD', w / 2, 134);
  });
  const chestPrint = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.36),
    new THREE.MeshStandardMaterial({ map: chestTex, roughness: 0.82 })
  );
  chestPrint.position.set(0, 0.32, 0.273);
  g.add(chestPrint);

  // Signature Rubberized Back-Neck Bar Label ("ESSENTIALS")
  const neckPatchTex = createDecalCanvasTexture(256, 72, (ctx, w, h) => {
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5a5a5a';
    ctx.font = 'bold 28px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ESSENTIALS', w / 2, h / 2 + 2);
  });
  const backLabel = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.1, 0.03),
    new THREE.MeshStandardMaterial({ map: neckPatchTex, roughness: 0.45 })
  );
  backLabel.position.set(0, 0.78, -0.275);
  g.add(backLabel);

  // Subtle Bottom Hem Seam
  const hem = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 0.48), m.ribbedKnit);
  hem.position.set(0, -0.97, 0);
  g.add(hem);

  return g;
}

// =========================================================================
// 5. HD-01 : CARHARTT WIP CHASE HOODIE BLACK
// =========================================================================
function buildCarharttHoodie(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Heavyweight Sculpted 440 GSM Torso (Beveled Organic Profile)
  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.7, -0.84);
  torsoShape.lineTo(0.7, -0.84);
  torsoShape.bezierCurveTo(0.76, -0.2, 0.78, 0.32, 0.72, 0.76);
  torsoShape.lineTo(0.34, 0.88);
  torsoShape.lineTo(-0.34, 0.88);
  torsoShape.lineTo(-0.72, 0.76);
  torsoShape.bezierCurveTo(-0.78, 0.32, -0.76, -0.2, -0.7, -0.84);
  torsoShape.closePath();

  const torsoGeo = createExtrudedShape(torsoShape, 0.46, 0.11, 0.08, 5);
  const torso = new THREE.Mesh(torsoGeo, m.heavyCotton);
  g.add(torso);

  // Thick Ribbed Waistband Hem
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.56), m.ribbedKnit);
  waist.position.set(0, -0.95, 0);
  g.add(waist);

  // Sculpted Double-Layer Upright Hood + Inner Shadow Cavity
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.49, 28, 22), m.heavyCotton);
  hood.scale.set(1.06, 1.18, 1.15);
  hood.position.set(0, 1.0, -0.06);
  g.add(hood);

  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 14, 28), m.ribbedKnit);
  hoodRim.position.set(0, 0.96, 0.28);
  g.add(hoodRim);

  const hoodCavity = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 16), m.enamelBlack);
  hoodCavity.position.set(0, 0.96, 0.14);
  g.add(hoodCavity);

  // Articulated Raglan Long Sleeves + Wide Ribbed Cuffs + Left-Cuff Embroidered "C" Mark
  for (const side of [-1, 1]) {
    const sleeveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.66, 0.66, 0),
      new THREE.Vector3(side * 0.96, 0.12, 0.03),
      new THREE.Vector3(side * 1.08, -0.58, 0.05),
    ]);
    const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 22, 0.23, 18, false);
    const sleeve = new THREE.Mesh(sleeveGeo, m.heavyCotton);
    g.add(sleeve);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.175, 0.22, 20),
      m.ribbedKnit
    );
    cuff.position.set(side * 1.1, -0.72, 0.05);
    cuff.rotation.z = side * 0.16;
    g.add(cuff);
  }

  // Iconic Carhartt Chase Embroidered "C" Motif on Left Sleeve Cuff
  const cMark = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.014, 8, 16, Math.PI * 1.55),
    m.chromeMetal
  );
  cMark.position.set(1.24, -0.66, 0.16);
  cMark.rotation.y = 0.7;
  cMark.rotation.z = 0.5;
  g.add(cMark);

  // Sculpted Curved Kangaroo Pouch Pocket
  const pocketShape = new THREE.Shape();
  pocketShape.moveTo(-0.48, -0.24);
  pocketShape.lineTo(0.48, -0.24);
  pocketShape.lineTo(0.42, 0.02);
  pocketShape.lineTo(0.32, 0.22);
  pocketShape.lineTo(-0.32, 0.22);
  pocketShape.lineTo(-0.42, 0.02);
  pocketShape.closePath();
  const pocketGeo = createExtrudedShape(pocketShape, 0.09, 0.025, 0.02, 3);
  const pocket = new THREE.Mesh(pocketGeo, m.heavyCotton);
  pocket.position.set(0, -0.44, 0.34);
  g.add(pocket);

  // Metal Grommets + Flat Hood Drawstrings + Gunmetal Aglets
  for (const side of [-1, 1]) {
    const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.01, 8, 16), m.gunmetal);
    grommet.position.set(side * 0.14, 0.72, 0.34);
    g.add(grommet);

    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.54, 0.014), m.ribbedKnit);
    cord.position.set(side * 0.14, 0.44, 0.355);
    g.add(cord);

    const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), m.chromeMetal);
    aglet.position.set(side * 0.14, 0.15, 0.355);
    g.add(aglet);
  }

  return g;
}

// =========================================================================
// 6. PT-01 : STONE ISLAND CARGO PANTS BLACK
// =========================================================================
function buildStoneIslandCargo(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Contoured Waistband + Belt Loops + Button Fly
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.2, 0.44), m.ribbedKnit);
  waist.position.set(0, 1.04, 0);
  g.add(waist);

  for (const bx of [-0.46, -0.18, 0.18, 0.46]) {
    const loop = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.04), m.heavyCotton);
    loop.position.set(bx, 1.04, 0.23);
    g.add(loop);
  }

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.035, 16), m.gunmetal);
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 1.04, 0.24);
  g.add(button);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.46, 0.46), m.heavyCotton);
  pelvis.position.set(0, 0.72, 0);
  g.add(pelvis);

  // Tapered Articulated Cargo Legs + Knee Darts + Bellowed Thigh Pockets + Ribbed Cuffs
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.24, 0.92, 22),
      m.heavyCotton
    );
    thigh.scale.set(1.02, 1.0, 0.88);
    thigh.position.set(side * 0.32, 0.08, 0);
    thigh.rotation.z = side * -0.025;
    g.add(thigh);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.175, 0.86, 22),
      m.heavyCotton
    );
    shin.scale.set(1.0, 1.0, 0.88);
    shin.position.set(side * 0.34, -0.74, 0);
    shin.rotation.z = side * -0.015;
    g.add(shin);

    // Sculpted Articulated Knee Panel
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.07), m.softGreyKnit);
    knee.position.set(side * 0.33, -0.32, 0.21);
    g.add(knee);

    // 3D Bellowed Cargo Pocket + Snap Flap
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.36), m.heavyCotton);
    pocket.position.set(side * 0.62, 0.08, 0.01);
    g.add(pocket);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.38), m.goreTexShell);
    flap.position.set(side * 0.62, 0.3, 0.01);
    g.add(flap);

    // Elasticized Ankle Cuff
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.14, 20),
      m.ribbedKnit
    );
    cuff.position.set(side * 0.35, -1.16, 0);
    g.add(cuff);
  }

  // Iconic Stone Island Monochrome Compass Rose Button Badge on Left Thigh Pocket
  const compassTex = createDecalCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    // Twin button holes
    ctx.fillStyle = '#606060';
    ctx.beginPath();
    ctx.arc(28, h / 2, 10, 0, Math.PI * 2);
    ctx.arc(w - 28, h / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    // Compass circle + star
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e5e5e5';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 28);
    ctx.lineTo(w / 2 + 8, h / 2 - 8);
    ctx.lineTo(w / 2 + 28, h / 2);
    ctx.lineTo(w / 2 + 8, h / 2 + 8);
    ctx.lineTo(w / 2, h / 2 + 28);
    ctx.lineTo(w / 2 - 8, h / 2 + 8);
    ctx.lineTo(w / 2 - 28, h / 2);
    ctx.lineTo(w / 2 - 8, h / 2 - 8);
    ctx.closePath();
    ctx.fill();
  });

  const siBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.14, 0.28),
    new THREE.MeshStandardMaterial({ map: compassTex, roughness: 0.65 })
  );
  siBadge.position.set(0.71, 0.06, 0.01);
  g.add(siBadge);

  return g;
}

// =========================================================================
// 7. WB-01 : ARC'TERYX BETA LT JACKET BLACK
// =========================================================================
function buildArcteryxJacket(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Sleek Athletic 3-Layer Gore-Tex Shell Torso with Drop Hem
  const shellShape = new THREE.Shape();
  shellShape.moveTo(-0.66, -0.88);
  shellShape.quadraticCurveTo(0, -0.96, 0.66, -0.88);
  shellShape.bezierCurveTo(0.72, -0.2, 0.74, 0.34, 0.68, 0.76);
  shellShape.lineTo(0.3, 0.9);
  shellShape.lineTo(-0.3, 0.9);
  shellShape.lineTo(-0.68, 0.76);
  shellShape.bezierCurveTo(-0.74, 0.34, -0.72, -0.2, -0.66, -0.88);
  shellShape.closePath();

  const shellGeo = createExtrudedShape(shellShape, 0.42, 0.09, 0.065, 5);
  const body = new THREE.Mesh(shellGeo, m.goreTexShell);
  g.add(body);

  // High Laminated Storm Chin-Guard Collar + Articulated StormHood
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.36, 24), m.goreTexShell);
  collar.position.set(0, 0.94, 0.02);
  g.add(collar);

  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.7),
    m.goreTexShell
  );
  hood.scale.set(1.0, 1.12, 1.18);
  hood.position.set(0, 1.08, -0.1);
  g.add(hood);

  // Laminated Brim Peak on StormHood
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.24), m.enamelBlack);
  visor.position.set(0, 1.44, 0.28);
  visor.rotation.x = 0.24;
  g.add(visor);

  // Full-Length Sealed Waterproof AquaGuard Center Zip Rail
  const centerZip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.98, 0.04), m.enamelBlack);
  centerZip.position.set(0, 0.08, 0.29);
  g.add(centerZip);

  const centerPull = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.04), m.chromeMetal);
  centerPull.position.set(0, 1.0, 0.32);
  g.add(centerPull);

  // Signature Twin High Angled Hand/Napoleon Waterproof Sealed Pockets
  for (const side of [-1, 1]) {
    const pocketZip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.035), m.enamelBlack);
    pocketZip.position.set(side * 0.44, -0.22, 0.29);
    pocketZip.rotation.z = side * 0.14;
    g.add(pocketZip);

    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.035), m.gunmetal);
    pull.position.set(side * 0.4, 0.02, 0.315);
    g.add(pull);
  }

  // Subtle Arc'teryx Fossilized Rib Skeleton Emblem on Left Chest
  const birdTex = createDecalCanvasTexture(192, 128, (ctx, w, h) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8b8b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(42, 74);
    ctx.quadraticCurveTo(96, 36, 150, 58);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(64 + i * 20, 54);
      ctx.lineTo(54 + i * 20, 92);
      ctx.stroke();
    }
  });
  const chestLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.16),
    new THREE.MeshStandardMaterial({ map: birdTex, roughness: 0.42 })
  );
  chestLogo.position.set(0.34, 0.46, 0.302);
  g.add(chestLogo);

  // Articulated Technical Raglan Sleeves + Die-Cut Velcro Cuff Straps
  for (const side of [-1, 1]) {
    const sleeveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.62, 0.66, 0),
      new THREE.Vector3(side * 0.94, 0.1, 0.04),
      new THREE.Vector3(side * 1.1, -0.62, 0.08),
    ]);
    const sleeve = new THREE.Mesh(
      new THREE.TubeGeometry(sleeveCurve, 22, 0.19, 18, false),
      m.goreTexShell
    );
    g.add(sleeve);

    const velcroTab = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.32), m.enamelBlack);
    velcroTab.position.set(side * 1.1, -0.62, 0.08);
    velcroTab.rotation.z = side * 0.22;
    g.add(velcroTab);
  }

  // Twin Hem Cohaesive Cord Locks
  for (const side of [-1, 1]) {
    const toggle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.08, 12), m.gunmetal);
    toggle.position.set(side * 0.64, -0.86, 0.16);
    g.add(toggle);
  }

  return g;
}

// =========================================================================
// 8. SP-01 : NIKE TECH FLEECE JOGGERS BLACK
// =========================================================================
function buildNikeTechJoggers(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Smooth Elastic Waistband + Speckled Drawcord
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.22, 0.42), m.ribbedKnit);
  waist.position.set(0, 1.02, 0);
  g.add(waist);

  for (const side of [-1, 1]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 8), m.chalkWhite);
    cord.position.set(side * 0.08, 0.84, 0.23);
    cord.rotation.z = side * -0.14;
    g.add(cord);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), m.enamelBlack);
    tip.position.set(side * 0.1, 0.66, 0.23);
    g.add(tip);
  }

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.44, 0.44), m.heavyCotton);
  pelvis.position.set(0, 0.72, 0);
  g.add(pelvis);

  // Sleek Tapered Tech Fleece Legs + Articulated Knee Seams + Tall Ribbed Cuffs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.155, 1.7, 24),
      m.heavyCotton
    );
    leg.scale.set(1.0, 1.0, 0.9);
    leg.position.set(side * 0.3, -0.32, 0);
    g.add(leg);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.158, 0.142, 0.22, 22),
      m.ribbedKnit
    );
    cuff.position.set(side * 0.3, -1.18, 0);
    g.add(cuff);
  }

  // Iconic Long Vertical Bonded-Tape Tech Pocket on Right Leg (-X viewer left / wearer right)
  const tapeBorder = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.78, 0.04), m.enamelBlack);
  tapeBorder.position.set(-0.54, 0.08, 0.08);
  tapeBorder.rotation.y = -0.32;
  tapeBorder.rotation.z = 0.04;
  g.add(tapeBorder);

  const zipTrack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.68, 0.048), m.gunmetal);
  zipTrack.position.set(-0.54, 0.08, 0.085);
  zipTrack.rotation.y = -0.32;
  zipTrack.rotation.z = 0.04;
  g.add(zipTrack);

  // Subtle Tonal Nike Swoosh on Left Thigh
  const miniSwoosh = new THREE.Mesh(createSwooshGeometry(0.22, 0.014), m.chalkWhite);
  miniSwoosh.position.set(0.32, 0.44, 0.245);
  g.add(miniSwoosh);

  return g;
}

// =========================================================================
// 9. BG-01 : PRADA RE-NYLON MESSENGER BAG
// =========================================================================
function buildPradaMessenger(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Architectural Beveled Re-Nylon Shell Body
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.82, -0.58);
  bodyShape.lineTo(0.82, -0.58);
  bodyShape.lineTo(0.82, 0.56);
  bodyShape.lineTo(-0.82, 0.56);
  bodyShape.closePath();
  const bodyGeo = createExtrudedShape(bodyShape, 0.44, 0.055, 0.04, 4);
  const body = new THREE.Mesh(bodyGeo, m.pradaReNylon);
  body.position.set(0, -0.18, 0);
  g.add(body);

  // Deep Overhanging Re-Nylon Flap with Saffiano Leather Piping Trim
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.84, -0.44);
  flapShape.lineTo(0.84, -0.44);
  flapShape.lineTo(0.84, 0.36);
  flapShape.lineTo(-0.84, 0.36);
  flapShape.closePath();
  const flapGeo = createExtrudedShape(flapShape, 0.48, 0.045, 0.035, 4);
  const flap = new THREE.Mesh(flapGeo, m.pradaReNylon);
  flap.position.set(0, 0.06, 0.04);
  g.add(flap);

  // Twin Vertical Nylon Webbing Straps + Signature Polished Chrome Side-Release Buckles
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 0.04), m.heavyCotton);
    strap.position.set(side * 0.48, -0.12, 0.32);
    g.add(strap);

    const buckleBody = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.07), m.chromeMetal);
    buckleBody.position.set(side * 0.48, -0.34, 0.335);
    g.add(buckleBody);

    const buckleCut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), m.enamelBlack);
    buckleCut.position.set(side * 0.48, -0.34, 0.335);
    g.add(buckleCut);
  }

  // ICONIC PRADA ENAMELED METAL INVERTED TRIANGLE PLAQUE
  const triOuter = new THREE.Shape();
  triOuter.moveTo(-0.22, 0.11);
  triOuter.lineTo(0.22, 0.11);
  triOuter.lineTo(0.0, -0.15);
  triOuter.closePath();
  const triBezelGeo = createExtrudedShape(triOuter, 0.024, 0.008, 0.006, 2);
  const triBezel = new THREE.Mesh(triBezelGeo, m.chromeMetal);
  triBezel.position.set(0, 0.02, 0.335);
  g.add(triBezel);

  const pradaTex = createDecalCanvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e5e5e5';
    ctx.font = 'bold 34px serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRADA', w / 2, 76);
    ctx.font = '18px monospace';
    ctx.fillText('MILANO', w / 2, 108);
  });
  const triInner = new THREE.Shape();
  triInner.moveTo(-0.185, 0.09);
  triInner.lineTo(0.185, 0.09);
  triInner.lineTo(0.0, -0.12);
  triInner.closePath();
  const triInnerGeo = new THREE.ShapeGeometry(triInner);
  // Normalize UVs for triangle face
  const posAttr = triInnerGeo.attributes.position;
  const uvs = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvs[i * 2] = (posAttr.getX(i) + 0.185) / 0.37;
    uvs[i * 2 + 1] = (posAttr.getY(i) + 0.12) / 0.21;
  }
  triInnerGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const triPlate = new THREE.Mesh(
    triInnerGeo,
    new THREE.MeshPhysicalMaterial({
      map: pradaTex,
      roughness: 0.14,
      clearcoat: 0.85,
    })
  );
  triPlate.position.set(0, 0.02, 0.357);
  g.add(triPlate);

  // Wide Woven Crossbody Shoulder Strap + Chrome Carabiners
  const shoulderCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.86, 0.24, 0),
    new THREE.Vector3(-0.8, 0.88, 0),
    new THREE.Vector3(0, 1.14, 0),
    new THREE.Vector3(0.8, 0.88, 0),
    new THREE.Vector3(0.86, 0.24, 0),
  ]);
  const shoulderStrap = new THREE.Mesh(
    new THREE.TubeGeometry(shoulderCurve, 34, 0.048, 10, false),
    m.heavyCotton
  );
  shoulderStrap.scale.set(1.0, 1.0, 2.4);
  g.add(shoulderStrap);

  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 10, 20), m.chromeMetal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.88, 0.2, 0);
    g.add(ring);
  }

  return g;
}

// =========================================================================
// 10. CP-01 : NEW ERA 59FIFTY NY YANKEES BLACK
// =========================================================================
function buildNewEra59Fifty(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // High Structured 59FIFTY 6-Panel Crown (Taller Buckram Front)
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.56),
    m.heavyCotton
  );
  crown.scale.set(1.04, 0.94, 0.96);
  crown.position.set(-0.14, 0.0, 0);
  g.add(crown);

  // Squatchee Top Button
  const topBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.045, 20), m.ribbedKnit);
  topBtn.position.set(-0.14, 0.77, 0);
  g.add(topBtn);

  // 6 Crisp Panel Rib Seams
  for (let i = 0; i < 6; i++) {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.825, 0.01, 6, 22, Math.PI * 0.54),
      m.softGreyKnit
    );
    seam.scale.set(1.04, 0.94, 0.96);
    seam.position.set(-0.14, 0, 0);
    seam.rotation.y = (i * Math.PI) / 3;
    g.add(seam);
  }

  // Iconic Structured Flat 59FIFTY Visor with Multi-Row Stitching Texture
  const visorTex = createDecalCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 2;
    for (let r = 20; r < 240; r += 14) {
      ctx.beginPath();
      ctx.arc(0, h / 2, r, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  });
  const brimShape = new THREE.Shape();
  brimShape.moveTo(0, -0.76);
  brimShape.quadraticCurveTo(1.06, -0.66, 1.12, 0);
  brimShape.quadraticCurveTo(1.06, 0.66, 0, 0.76);
  brimShape.quadraticCurveTo(0.24, 0, 0, -0.76);
  const brimGeo = createExtrudedShape(brimShape, 0.048, 0.012, 0.012, 2);
  brimGeo.rotateX(Math.PI / 2);
  const brim = new THREE.Mesh(
    brimGeo,
    new THREE.MeshStandardMaterial({ map: visorTex, roughness: 0.85 })
  );
  brim.position.set(0.32, 0.03, 0);
  brim.rotation.z = -0.04; // Iconic flat 59FIFTY brim stance
  g.add(brim);

  // Signature Metallic-Monochrome Circular 59FIFTY Visor Sticker
  const sticker = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.008, 24), m.chromeMetal);
  sticker.position.set(0.94, 0.045, 0.24);
  sticker.rotation.z = -0.04;
  g.add(sticker);

  // Raised 3D Tonal Embroidered "NY" Monogram on Front Crown
  const nyTex = createDecalCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d8d8d8';
    ctx.fillStyle = '#d8d8d8';
    ctx.font = 'bold 148px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', w / 2 - 22, h / 2 - 4);
    ctx.fillText('Y', w / 2 + 24, h / 2 + 24);
  });
  const nyPatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.34, 0.3),
    new THREE.MeshStandardMaterial({ map: nyTex, roughness: 0.6 })
  );
  nyPatch.position.set(0.66, 0.34, 0);
  nyPatch.rotation.z = 0.3;
  g.add(nyPatch);

  // Rear Fitted MLB Batterman Woven Patch
  const rearPatch = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.2), m.softGreyKnit);
  rearPatch.position.set(-0.98, 0.22, 0);
  g.add(rearPatch);

  g.rotation.y = -0.54;
  return g;
}

// =========================================================================
// 11. SK-01 : NIKE EVERYDAY PLUS CREW SOCKS (Pair)
// =========================================================================
function buildNikeCrewSocks(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Jacquard Cuff Texture with Crisp Black Nike Swoosh
  const cuffTex = createDecalCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, w, h);
    // Fine vertical knit ribs
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // Draw Nike Swoosh on outer side
    ctx.save();
    ctx.translate(w * 0.5, h * 0.34);
    ctx.scale(1.1, 1.1);
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(-42, 6);
    ctx.bezierCurveTo(-58, -10, -34, -22, -4, -10);
    ctx.bezierCurveTo(22, 0, 48, 12, 68, 22);
    ctx.bezierCurveTo(34, 4, 4, -4, -18, -2);
    ctx.bezierCurveTo(-34, 0, -44, 4, -42, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    map: cuffTex,
    roughness: 0.85,
    bumpMap: createVerticalRibTexture(256, 6),
    bumpScale: 0.02,
  });

  for (const idx of [0, 1]) {
    const sock = new THREE.Group();

    // Ribbed Tall Crew Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 1.32, 26), cuffMat);
    shaft.position.set(0, 0.42, 0);
    shaft.rotation.y = idx === 0 ? 0.3 : -0.3;
    sock.add(shaft);

    // Top Elastic Rib Welt
    const topWelt = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.024, 10, 26), m.chalkWhite);
    topWelt.rotation.x = Math.PI / 2;
    topWelt.position.set(0, 1.07, 0);
    sock.add(topWelt);

    // Sculpted Reinforced Heel Cup
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 14), m.softGreyKnit);
    heel.position.set(-0.04, -0.24, 0);
    sock.add(heel);

    // Contoured Foot Body + Arch Compression Rib Band
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.21, 0.86, 22), m.chalkWhite);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0.36, -0.28, 0);
    sock.add(foot);

    const archBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.24, 22), m.softGreyKnit);
    archBand.rotation.z = Math.PI / 2;
    archBand.position.set(0.38, -0.28, 0);
    sock.add(archBand);

    // Reinforced Toe Box
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), m.softGreyKnit);
    toe.position.set(0.79, -0.28, 0);
    sock.add(toe);

    sock.position.set(idx === 0 ? -0.18 : 0.18, 0, idx === 0 ? -0.32 : 0.32);
    sock.rotation.y = idx === 0 ? -0.18 : 0.14;
    g.add(sock);
  }

  g.rotation.y = -0.35;
  return g;
}

// =========================================================================
// 12. BL-01 : 1017 ALYX 9SM ROLLERCOASTER BELT
// =========================================================================
function buildAlyxBelt(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Heavy Woven Jacquard Nylon Webbing Coils (Double Concentric Architectural Ring)
  const outerCoil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.92, 0.34, 48, 1, true),
    m.heavyCotton
  );
  g.add(outerCoil);

  const innerCoil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.34, 48, 1, true),
    m.ribbedKnit
  );
  g.add(innerCoil);

  for (const ry of [-0.17, 0.17]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.042, 12, 48), m.heavyCotton);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = ry;
    g.add(rim);
  }

  // Secondary Inner Folded Webbing Loop
  const innerWrap = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.036, 10, 40), m.goreTexShell);
  innerWrap.rotation.x = Math.PI / 2;
  innerWrap.scale.set(1, 1, 3.4);
  g.add(innerWrap);

  // ICONIC CNC-MACHINED 1017 ALYX 9SM ROLLERCOASTER BUCKLE
  const buckleTex = createDecalCanvasTexture(320, 192, (ctx, w, h) => {
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#e6e6e6';
    ctx.font = 'bold 28px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1017 ALYX 9SM', w / 2, 74);
    ctx.fillStyle = '#a8a8a8';
    ctx.font = 'bold 18px "Space Mono", monospace';
    ctx.fillText('12KN · ANODIZED', w / 2, 124);
  });

  const bucklePlateMat = new THREE.MeshStandardMaterial({
    map: buckleTex,
    roughness: 0.24,
    metalness: 0.9,
    envMapIntensity: 1.65,
  });

  const buckleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.44, 0.14), m.gunmetal);
  buckleFrame.position.set(0, 0, 0.95);
  g.add(buckleFrame);

  const engravedFront = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), bucklePlateMat);
  engravedFront.position.set(0, 0, 1.024);
  g.add(engravedFront);

  // Machined Chrome Central Pivot Bar + Spring-Loaded Release Ears
  const centralBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.16), m.chromeMetal);
  centralBar.position.set(-0.22, 0, 0.95);
  g.add(centralBar);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.11), m.chromeMetal);
    ear.position.set(0.12, side * 0.25, 0.95);
    g.add(ear);
  }

  // Heavy Leather Tip Keeper Loop
  const keeper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), m.smoothLeather);
  keeper.position.set(0.48, 0, 0.8);
  keeper.rotation.y = 0.52;
  g.add(keeper);

  g.rotation.x = 0.26;
  return g;
}

export function createProceduralModel(preset: Exclude<ModelPreset, 'CUSTOM_2D'>): THREE.Group {
  const materials = createStudioMaterials();
  let model: THREE.Group;

  switch (preset) {
    case 'SN':
      model = buildAirForce1(materials);
      break;
    case 'SL':
      model = buildYeezySlide(materials);
      break;
    case 'BT':
      model = buildTimberlandBoot(materials);
      break;
    case 'TS':
      model = buildEssentialsTee(materials);
      break;
    case 'HD':
      model = buildCarharttHoodie(materials);
      break;
    case 'PT':
      model = buildStoneIslandCargo(materials);
      break;
    case 'WB':
      model = buildArcteryxJacket(materials);
      break;
    case 'SP':
      model = buildNikeTechJoggers(materials);
      break;
    case 'BG':
      model = buildPradaMessenger(materials);
      break;
    case 'CP':
      model = buildNewEra59Fifty(materials);
      break;
    case 'SK':
      model = buildNikeCrewSocks(materials);
      break;
    case 'BL':
      model = buildAlyxBelt(materials);
      break;
  }

  addShadows(model);
  normalizeAndCenterGroup(model, 2.2);
  return model;
}
