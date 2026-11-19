import * as THREE from 'three';
import { ModelPreset } from '../../types/od01';
import { normalizeAndCenterGroup } from './disposeUtils';

interface StudioPalette {
  matteBlack: THREE.MeshStandardMaterial;
  charcoalFabric: THREE.MeshStandardMaterial;
  slateRubber: THREE.MeshStandardMaterial;
  offWhiteChalk: THREE.MeshStandardMaterial;
  satinTpu: THREE.MeshPhysicalMaterial;
  brushedSteel: THREE.MeshStandardMaterial;
}

function createMicroGrainBumpTexture(contrast = 26, gridStep = 4): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += gridStep) {
      for (let x = 0; x < size; x += gridStep) {
        const hash = ((x * 73856093) ^ (y * 19349663)) & 255;
        const delta = Math.round(((hash / 255) - 0.5) * contrast);
        const v = Math.max(0, Math.min(255, 128 + delta));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, gridStep, gridStep);
      }
    }
    // Subtle ripstop / technical cross-weave lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
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
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

function createStudioMaterials(): StudioPalette {
  const fabricBump = createMicroGrainBumpTexture(30, 2);
  const rubberBump = createMicroGrainBumpTexture(44, 4);

  return {
    matteBlack: new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: fabricBump,
      bumpScale: 0.012,
    }),
    charcoalFabric: new THREE.MeshStandardMaterial({
      color: 0x262626,
      roughness: 0.92,
      metalness: 0.02,
      bumpMap: fabricBump,
      bumpScale: 0.016,
    }),
    slateRubber: new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      roughness: 0.54,
      metalness: 0.08,
      bumpMap: rubberBump,
      bumpScale: 0.02,
    }),
    offWhiteChalk: new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.72,
      metalness: 0.02,
    }),
    satinTpu: new THREE.MeshPhysicalMaterial({
      color: 0x0d0d0d,
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    }),
    brushedSteel: new THREE.MeshStandardMaterial({
      color: 0xc8c8c8,
      roughness: 0.24,
      metalness: 0.92,
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

// =========================================================================
// 1. SN-01 : BASKET MONOLITHE 01 (Chunky Architectural Sneaker)
// =========================================================================
function buildSneaker(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Sculpted Monolith Sole Profile (ExtrudeGeometry)
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-1.12, 0.0);
  soleShape.lineTo(1.18, 0.0);
  soleShape.quadraticCurveTo(1.3, 0.08, 1.24, 0.24);
  soleShape.lineTo(0.86, 0.3);
  soleShape.lineTo(-0.98, 0.34);
  soleShape.quadraticCurveTo(-1.18, 0.3, -1.16, 0.1);
  soleShape.closePath();

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.76,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  soleGeo.translate(0, 0, -0.38);
  const sole = new THREE.Mesh(soleGeo, m.slateRubber);
  g.add(sole);

  // Midsole Architectural Contrast Strip
  const midsoleGeo = new THREE.BoxGeometry(2.26, 0.08, 0.82);
  const midsole = new THREE.Mesh(midsoleGeo, m.offWhiteChalk);
  midsole.position.set(0.03, 0.22, 0);
  g.add(midsole);

  // Under-sole geometric tread ribs (6 ribs)
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.82), m.satinTpu);
    rib.position.set(-0.82 + i * 0.34, -0.02, 0);
    g.add(rib);
  }

  // Upper Main Body (Extruded profile)
  const upperShape = new THREE.Shape();
  upperShape.moveTo(-1.02, 0.28);
  upperShape.lineTo(1.08, 0.28);
  upperShape.quadraticCurveTo(1.15, 0.56, 0.58, 0.66);
  upperShape.lineTo(0.08, 0.94);
  upperShape.lineTo(-0.34, 0.92);
  upperShape.quadraticCurveTo(-0.56, 0.72, -0.92, 0.82);
  upperShape.lineTo(-1.08, 0.56);
  upperShape.closePath();

  const upperGeo = new THREE.ExtrudeGeometry(upperShape, {
    depth: 0.64,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
  });
  upperGeo.translate(0, 0, -0.32);
  const upper = new THREE.Mesh(upperGeo, m.matteBlack);
  g.add(upper);

  // Reinforced Toe Bumper Cap
  const toeGeo = new THREE.SphereGeometry(0.36, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const toe = new THREE.Mesh(toeGeo, m.satinTpu);
  toe.scale.set(1.25, 0.78, 1.0);
  toe.position.set(0.76, 0.3, 0);
  g.add(toe);

  // Heel TPU Counter Cage
  const heelCage = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.78), m.satinTpu);
  heelCage.position.set(-0.92, 0.52, 0);
  g.add(heelCage);

  // Padded Ankle Collar Ring
  const collarGeo = new THREE.TorusGeometry(0.28, 0.09, 12, 24);
  const collar = new THREE.Mesh(collarGeo, m.charcoalFabric);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.35, 1.0, 1.0);
  collar.position.set(-0.56, 0.88, 0);
  g.add(collar);

  // Sculpted Tongue
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.46), m.charcoalFabric);
  tongue.position.set(0.06, 0.92, 0);
  tongue.rotation.z = -0.52;
  g.add(tongue);

  // 4 Crossed Technical Laces + Brushed Steel Eyelets
  for (let i = 0; i < 4; i++) {
    const lx = 0.02 + i * 0.14;
    const ly = 0.94 - i * 0.08;
    const lace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8),
      m.offWhiteChalk
    );
    lace.rotation.x = Math.PI / 2;
    lace.position.set(lx, ly, 0);
    g.add(lace);

    for (const side of [-1, 1]) {
      const eyelet = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.01, 8, 12),
        m.brushedSteel
      );
      eyelet.position.set(lx, ly, side * 0.32);
      g.add(eyelet);
    }
  }

  // Lateral Structural Rib Bar
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.04), m.charcoalFabric);
    bar.position.set(-0.14, 0.58, side * 0.38);
    bar.rotation.z = -0.18;
    g.add(bar);
  }

  g.rotation.y = -0.35;
  return g;
}

// =========================================================================
// 2. SL-01 : MULE MOULÉE 01 (Injected Monoblock Architectural Slide)
// =========================================================================
function buildSlide(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Contoured Footbed Profile
  const bedShape = new THREE.Shape();
  bedShape.moveTo(-1.1, 0.08);
  bedShape.lineTo(1.12, 0.05);
  bedShape.quadraticCurveTo(1.26, 0.14, 1.18, 0.3);
  bedShape.quadraticCurveTo(0.4, 0.24, -0.35, 0.28);
  bedShape.quadraticCurveTo(-1.05, 0.36, -1.16, 0.24);
  bedShape.closePath();

  const bedGeo = new THREE.ExtrudeGeometry(bedShape, {
    depth: 0.78,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 4,
  });
  bedGeo.translate(0, 0, -0.39);
  const bed = new THREE.Mesh(bedGeo, m.matteBlack);
  g.add(bed);

  // Sculpted Arch Bridge Strap
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.15, 0.26, -0.44),
    new THREE.Vector3(0.22, 0.72, -0.28),
    new THREE.Vector3(0.25, 0.84, 0),
    new THREE.Vector3(0.22, 0.72, 0.28),
    new THREE.Vector3(0.15, 0.26, 0.44),
  ]);
  const strapGeo = new THREE.TubeGeometry(strapCurve, 28, 0.18, 12, false);
  const strap = new THREE.Mesh(strapGeo, m.slateRubber);
  strap.scale.set(2.35, 1.0, 1.0);
  g.add(strap);

  // Recessed Rib Grooves along the top of the strap
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.68), m.satinTpu);
    rib.position.set(0.55 + i * 0.14, 0.99, 0);
    g.add(rib);
  }

  // Sole Sawtooth Lugs
  for (let i = 0; i < 8; i++) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.82), m.charcoalFabric);
    lug.position.set(-0.92 + i * 0.27, 0.0, 0);
    g.add(lug);
  }

  // Metallic Archive Plate on heel rim
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.24), m.brushedSteel);
  tag.position.set(-0.85, 0.34, 0);
  g.add(tag);

  g.rotation.y = -0.4;
  return g;
}

// =========================================================================
// 3. BT-01 : BOTTE TACTIQUE 01 (High-Shaft Industrial Boot)
// =========================================================================
function buildBoot(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Heavy Lugged Outsole
  const sole = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.26, 0.84), m.slateRubber);
  sole.position.set(0.08, 0.16, 0);
  g.add(sole);

  // Distinct Heel Block + Front Lugs
  const heelBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.86), m.satinTpu);
  heelBlock.position.set(-0.64, 0.03, 0);
  g.add(heelBlock);

  for (let i = 0; i < 4; i++) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.86), m.satinTpu);
    lug.position.set(0.18 + i * 0.28, 0.02, 0);
    g.add(lug);
  }

  // Vamp / Forefoot Volume
  const vamp = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.44, 0.72), m.matteBlack);
  vamp.position.set(0.32, 0.48, 0);
  g.add(vamp);

  // Armored Toe Dome
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 12), m.satinTpu);
  toe.scale.set(1.2, 0.72, 0.98);
  toe.position.set(0.84, 0.44, 0);
  g.add(toe);

  // High Cylindrical-Tapered Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.43, 1.38, 24), m.matteBlack);
  shaft.scale.set(1.18, 1.0, 0.92);
  shaft.position.set(-0.42, 1.06, 0);
  g.add(shaft);

  // Cordura Padded Collar Cuff
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.4, 0.22, 24), m.charcoalFabric);
  cuff.scale.set(1.18, 1.0, 0.92);
  cuff.position.set(-0.42, 1.72, 0);
  g.add(cuff);

  // Front Lacing Gusset + 5 Speed-Hooks (Brushed Steel)
  const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.34), m.charcoalFabric);
  gusset.position.set(0.02, 1.12, 0);
  gusset.rotation.z = -0.1;
  g.add(gusset);

  for (let i = 0; i < 5; i++) {
    const y = 0.76 + i * 0.21;
    const x = 0.08 - i * 0.02;
    const lace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8),
      m.offWhiteChalk
    );
    lace.rotation.x = Math.PI / 2;
    lace.position.set(x, y, 0);
    g.add(lace);

    for (const side of [-1, 1]) {
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), m.brushedSteel);
      hook.position.set(x - 0.03, y, side * 0.22);
      g.add(hook);
    }
  }

  // Rear Industrial Pull Tab
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.16), m.satinTpu);
  tab.position.set(-0.92, 1.66, 0);
  g.add(tab);

  g.rotation.y = -0.38;
  return g;
}

// =========================================================================
// 4. TS-01 : TEE BOXY HEAVY 01 (Structured Heavyweight Boxy T-Shirt)
// =========================================================================
function buildTee(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Boxy Torso Silhouette (ExtrudeGeometry)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.68, -0.95);
  bodyShape.lineTo(0.68, -0.95);
  bodyShape.lineTo(0.72, 0.48);
  bodyShape.lineTo(0.78, 0.78);
  bodyShape.lineTo(0.28, 0.94);
  bodyShape.quadraticCurveTo(0, 0.76, -0.28, 0.94);
  bodyShape.lineTo(-0.78, 0.78);
  bodyShape.lineTo(-0.72, 0.48);
  bodyShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 4,
  });
  bodyGeo.translate(0, 0, -0.17);
  const body = new THREE.Mesh(bodyGeo, m.matteBlack);
  g.add(body);

  // Dropped Wide Sleeves (Left & Right)
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.27, 0.76, 18),
      m.matteBlack
    );
    sleeve.scale.set(1.0, 1.0, 0.68);
    sleeve.position.set(side * 0.94, 0.44, 0);
    sleeve.rotation.z = side * 0.62;
    g.add(sleeve);

    // Sleeve hem rib
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.275, 0.275, 0.06, 18),
      m.charcoalFabric
    );
    cuff.scale.set(1.0, 1.0, 0.68);
    cuff.position.set(side * 1.15, 0.16, 0);
    cuff.rotation.z = side * 0.62;
    g.add(cuff);
  }

  // Thick Ribbed Crew Collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.065, 12, 28), m.charcoalFabric);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.0, 0.78, 1.0);
  collar.position.set(0, 0.92, 0);
  g.add(collar);

  // Bottom Hem Seam + Woven Archive Spec Label
  const hem = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.46), m.charcoalFabric);
  hem.position.set(0, -0.94, 0);
  g.add(hem);

  const label = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.03), m.offWhiteChalk);
  label.position.set(0.42, -0.78, 0.25);
  g.add(label);

  // Subtle Chest Geometric Seam Bar
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), m.brushedSteel);
  seam.position.set(-0.36, 0.42, 0.255);
  g.add(seam);

  return g;
}

// =========================================================================
// 5. HD-01 : HOODIE ARCHIVE 01 (Heavy 520GSM Boxy Hoodie)
// =========================================================================
function buildHoodie(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Structured Heavyweight Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.56, 0.56), m.matteBlack);
  torso.position.set(0, -0.08, 0);
  g.add(torso);

  // Ribbed Waistband
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.52), m.charcoalFabric);
  waist.position.set(0, -0.92, 0);
  g.add(waist);

  // Structured Double-Layer Hood
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 18), m.charcoalFabric);
  hood.scale.set(1.05, 1.15, 1.12);
  hood.position.set(0, 0.95, -0.08);
  g.add(hood);

  // Hood Inner Opening Frame
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 24), m.matteBlack);
  hoodRim.position.set(0, 0.92, 0.26);
  g.add(hoodRim);

  // Dropped Long Sleeves + Ribbed Cuffs
  for (const side of [-1, 1]) {
    const upperSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.21, 1.24, 18),
      m.matteBlack
    );
    upperSleeve.position.set(side * 0.94, -0.02, 0);
    upperSleeve.rotation.z = side * 0.26;
    g.add(upperSleeve);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.16, 0.2, 16),
      m.charcoalFabric
    );
    cuff.position.set(side * 1.12, -0.68, 0);
    cuff.rotation.z = side * 0.26;
    g.add(cuff);
  }

  // Kangaroo Pocket
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.44, 0.12), m.charcoalFabric);
  pocket.position.set(0, -0.44, 0.3);
  g.add(pocket);

  // Drawstrings + Engraved Brushed Steel Aglets
  for (const side of [-1, 1]) {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8),
      m.offWhiteChalk
    );
    cord.position.set(side * 0.13, 0.44, 0.31);
    g.add(cord);

    const aglet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.09, 10),
      m.brushedSteel
    );
    aglet.position.set(side * 0.13, 0.16, 0.31);
    g.add(aglet);
  }

  return g;
}

// =========================================================================
// 6. PT-01 : PANTALON CARGO 01 (Wide Articulated Ripstop Cargo)
// =========================================================================
function buildCargo(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Structured Waistband + Belt Loops
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.2, 0.44), m.charcoalFabric);
  waist.position.set(0, 1.02, 0);
  g.add(waist);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.46, 0.46), m.matteBlack);
  pelvis.position.set(0, 0.72, 0);
  g.add(pelvis);

  // Metal Snap Button + Front Fly
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), m.brushedSteel);
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 1.02, 0.24);
  g.add(button);

  // Two Wide Articulated Legs + Bellowed 3D Cargo Pockets + Knee Darts
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.66, 0.46), m.matteBlack);
    leg.position.set(side * 0.33, -0.32, 0);
    leg.rotation.z = side * -0.03;
    g.add(leg);

    // 3D Bellowed Cargo Pocket on outer thigh
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.36), m.charcoalFabric);
    pocket.position.set(side * 0.62, 0.05, 0);
    g.add(pocket);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.38), m.satinTpu);
    flap.position.set(side * 0.62, 0.28, 0);
    g.add(flap);

    // Articulated Knee Panel
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.06), m.charcoalFabric);
    knee.position.set(side * 0.33, -0.28, 0.24);
    g.add(knee);

    // Ankle Cinch Band
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.48), m.satinTpu);
    hem.position.set(side * 0.35, -1.14, 0);
    g.add(hem);
  }

  return g;
}

// =========================================================================
// 7. WB-01 : COUPE-VENT TECHNIQUE 01 (3-Layer Technical Shell Jacket)
// =========================================================================
function buildWindbreaker(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Main Shell Torso (Satin technical nylon)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.56, 0.48), m.satinTpu);
  body.position.set(0, -0.08, 0);
  g.add(body);

  // High Storm Collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.36, 20), m.matteBlack);
  collar.position.set(0, 0.86, 0);
  g.add(collar);

  // Sealed Central Waterproof Zip Rail
  const zipRail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.88, 0.05), m.brushedSteel);
  zipRail.position.set(0, 0.08, 0.25);
  g.add(zipRail);

  // Chest Utility Pocket with Sealed Seam
  const chestPocket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.07), m.charcoalFabric);
  chestPocket.position.set(0.34, 0.22, 0.26);
  g.add(chestPocket);

  const pocketZip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.04), m.offWhiteChalk);
  pocketZip.position.set(0.18, 0.22, 0.29);
  g.add(pocketZip);

  // Raglan Articulated Sleeves
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.17, 1.32, 18),
      m.satinTpu
    );
    sleeve.position.set(side * 0.92, -0.02, 0);
    sleeve.rotation.z = side * 0.3;
    g.add(sleeve);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), m.matteBlack);
    strap.position.set(side * 1.12, -0.62, 0);
    strap.rotation.z = side * 0.3;
    g.add(strap);
  }

  // Elastic Hem Toggle Stops
  for (const side of [-1, 1]) {
    const toggle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), m.brushedSteel);
    toggle.position.set(side * 0.68, -0.84, 0.14);
    g.add(toggle);
  }

  return g;
}

// =========================================================================
// 8. SP-01 : SURVÊTEMENT PROTOTYPE 01 (Structured Tapered Track Pants)
// =========================================================================
function buildSweatpants(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Elastic Tubular Waistband
  const waist = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.42), m.charcoalFabric);
  waist.position.set(0, 1.0, 0);
  g.add(waist);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.44, 0.44), m.matteBlack);
  pelvis.position.set(0, 0.7, 0);
  g.add(pelvis);

  // Tapered Cylindrical Legs + Side Technical Piping + Ankle Zip Hardware
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.18, 1.66, 20),
      m.matteBlack
    );
    leg.position.set(side * 0.3, -0.32, 0);
    g.add(leg);

    // Side-seam contrast piping stripe
    const piping = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.88, 0.06), m.offWhiteChalk);
    piping.position.set(side * 0.52, -0.18, 0);
    piping.rotation.z = side * -0.04;
    g.add(piping);

    // Ribbed Ankle Cuff + Concealed Metal Zip Pull
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.165, 0.14, 18),
      m.charcoalFabric
    );
    cuff.position.set(side * 0.3, -1.14, 0);
    g.add(cuff);

    const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.04), m.brushedSteel);
    zipPull.position.set(side * 0.47, -1.02, 0);
    g.add(zipPull);
  }

  return g;
}

// =========================================================================
// 9. BG-01 : SAC MESSENGER 01 (Rigid Ballistic Crossbody Bag)
// =========================================================================
function buildMessengerBag(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Main Rigid Shell Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.12, 0.44), m.matteBlack);
  body.position.set(0, -0.18, 0);
  g.add(body);

  // Overhanging Architectural Flap
  const flap = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.72, 0.48), m.charcoalFabric);
  flap.position.set(0, 0.06, 0.04);
  g.add(flap);

  // Vertical Webbing Strap + Machined Aluminum Quick-Release Buckle
  const strapFront = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.88, 0.06), m.satinTpu);
  strapFront.position.set(0, -0.12, 0.29);
  g.add(strapFront);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.1), m.brushedSteel);
  buckle.position.set(0, -0.26, 0.32);
  g.add(buckle);

  const buckleSlot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.12), m.matteBlack);
  buckleSlot.position.set(0, -0.26, 0.32);
  g.add(buckleSlot);

  // Crossbody Arching Shoulder Strap (TubeGeometry)
  const shoulderCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.84, 0.24, 0),
    new THREE.Vector3(-0.78, 0.86, 0),
    new THREE.Vector3(0, 1.12, 0),
    new THREE.Vector3(0.78, 0.86, 0),
    new THREE.Vector3(0.84, 0.24, 0),
  ]);
  const shoulderStrap = new THREE.Mesh(
    new THREE.TubeGeometry(shoulderCurve, 32, 0.055, 8, false),
    m.satinTpu
  );
  shoulderStrap.scale.set(1.0, 1.0, 2.2);
  g.add(shoulderStrap);

  // Side D-Ring Anchors
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16), m.brushedSteel);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.86, 0.2, 0);
    g.add(ring);
  }

  return g;
}

// =========================================================================
// 10. CP-01 : CASQUETTE 6-PANELS 01 (Unstructured 6-Panel Technical Cap)
// =========================================================================
function buildCap(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Domed 6-Panel Crown
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
    m.matteBlack
  );
  crown.scale.set(1.06, 0.84, 0.96);
  crown.position.set(-0.14, 0.0, 0);
  g.add(crown);

  // Top Button
  const topBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), m.charcoalFabric);
  topBtn.position.set(-0.14, 0.69, 0);
  g.add(topBtn);

  // Panel Rib Seams
  for (let i = 0; i < 6; i++) {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.83, 0.012, 6, 20, Math.PI * 0.52),
      m.charcoalFabric
    );
    seam.scale.set(1.06, 0.84, 0.96);
    seam.position.set(-0.14, 0, 0);
    seam.rotation.y = (i * Math.PI) / 3;
    seam.rotation.z = 0;
    g.add(seam);
  }

  // Curved Sculpted Visor Brim
  const brimShape = new THREE.Shape();
  brimShape.moveTo(0, -0.74);
  brimShape.quadraticCurveTo(1.02, -0.62, 1.06, 0);
  brimShape.quadraticCurveTo(1.02, 0.62, 0, 0.74);
  brimShape.quadraticCurveTo(0.28, 0, 0, -0.74);
  const brimGeo = new THREE.ExtrudeGeometry(brimShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  brimGeo.rotateX(Math.PI / 2);
  const brim = new THREE.Mesh(brimGeo, m.satinTpu);
  brim.position.set(0.32, 0.04, 0);
  brim.rotation.z = -0.14;
  g.add(brim);

  // Rear Adjustment Strap + Brushed Metal Clasp
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.18), m.brushedSteel);
  clasp.position.set(-0.98, 0.12, 0);
  g.add(clasp);

  // Subtle Front Archive Spec Bar
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.24), m.offWhiteChalk);
  mark.position.set(0.68, 0.28, 0);
  g.add(mark);

  g.rotation.y = -0.5;
  return g;
}

// =========================================================================
// 11. SK-01 : CHAUSSETTES RIBBED 01 (Architectural Pair of Crew Socks)
// =========================================================================
function buildSocks(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  for (const idx of [0, 1]) {
    const sock = new THREE.Group();

    // Ribbed Tall Cuff Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 1.3, 20), m.offWhiteChalk);
    shaft.position.set(0, 0.42, 0);
    sock.add(shaft);

    // Jacquard Ribbed Band Rings near top
    for (const ry of [0.88, 0.76]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.246, 0.246, 0.055, 20), m.matteBlack);
      band.position.set(0, ry, 0);
      sock.add(band);
    }

    // Reinforced Heel Gusset
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), m.charcoalFabric);
    heel.position.set(-0.04, -0.24, 0);
    sock.add(heel);

    // Foot Body
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.84, 18), m.offWhiteChalk);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0.36, -0.28, 0);
    sock.add(foot);

    // Reinforced Toe Cap
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 12), m.charcoalFabric);
    toe.position.set(0.78, -0.28, 0);
    sock.add(toe);

    sock.position.set(idx === 0 ? -0.18 : 0.16, 0, idx === 0 ? -0.32 : 0.32);
    sock.rotation.y = idx === 0 ? -0.15 : 0.15;
    g.add(sock);
  }

  g.rotation.y = -0.35;
  return g;
}

// =========================================================================
// 12. BL-01 : CEINTURE TACTIQUE 01 (Coiled Webbing Belt + Cobra Buckle)
// =========================================================================
function buildBelt(m: StudioPalette): THREE.Group {
  const g = new THREE.Group();

  // Coiled Rigid Nylon Webbing Ring
  const outerCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.32, 40, 1, true), m.matteBlack);
  g.add(outerCoil);

  const innerCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.32, 40, 1, true), m.charcoalFabric);
  g.add(innerCoil);

  // Top & Bottom Coil Rim Caps (Torus)
  for (const ry of [-0.16, 0.16]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.042, 10, 40), m.matteBlack);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = ry;
    g.add(rim);
  }

  // Secondary Inner Loop Wrap
  const innerWrap = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 8, 36), m.satinTpu);
  innerWrap.rotation.x = Math.PI / 2;
  innerWrap.scale.set(1, 1, 3.2);
  g.add(innerWrap);

  // CNC Machined Cobra Quick-Release Buckle at Front (+Z)
  const buckleBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.14), m.brushedSteel);
  buckleBody.position.set(0, 0, 0.94);
  g.add(buckleBody);

  const buckleCenter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.16), m.satinTpu);
  buckleCenter.position.set(0, 0, 0.95);
  g.add(buckleCenter);

  // Dual Release Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), m.brushedSteel);
    ear.position.set(side * 0.2, 0.24, 0.94);
    g.add(ear);
  }

  // Elastic Keeper Loop
  const keeper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.14), m.charcoalFabric);
  keeper.position.set(0.46, 0, 0.8);
  keeper.rotation.y = 0.5;
  g.add(keeper);

  g.rotation.x = 0.25;
  return g;
}

export function createProceduralModel(preset: Exclude<ModelPreset, 'CUSTOM_2D'>): THREE.Group {
  const materials = createStudioMaterials();
  let model: THREE.Group;

  switch (preset) {
    case 'SN':
      model = buildSneaker(materials);
      break;
    case 'SL':
      model = buildSlide(materials);
      break;
    case 'BT':
      model = buildBoot(materials);
      break;
    case 'TS':
      model = buildTee(materials);
      break;
    case 'HD':
      model = buildHoodie(materials);
      break;
    case 'PT':
      model = buildCargo(materials);
      break;
    case 'WB':
      model = buildWindbreaker(materials);
      break;
    case 'SP':
      model = buildSweatpants(materials);
      break;
    case 'BG':
      model = buildMessengerBag(materials);
      break;
    case 'CP':
      model = buildCap(materials);
      break;
    case 'SK':
      model = buildSocks(materials);
      break;
    case 'BL':
      model = buildBelt(materials);
      break;
  }

  addShadows(model);
  normalizeAndCenterGroup(model, 2.2);
  return model;
}
