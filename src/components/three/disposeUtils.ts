import * as THREE from 'three';

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'bumpMap',
  'alphaMap',
  'aoMap',
  'emissiveMap',
  'clearcoatNormalMap',
] as const;

export function disposeMaterial(material: THREE.Material): void {
  const matRecord = material as unknown as Record<string, unknown>;
  for (const slot of TEXTURE_SLOTS) {
    const tex = matRecord[slot];
    if (tex instanceof THREE.Texture) {
      tex.dispose();
    }
  }
  if (material instanceof THREE.ShaderMaterial && material.uniforms) {
    for (const key of Object.keys(material.uniforms)) {
      const val = material.uniforms[key]?.value;
      if (val instanceof THREE.Texture) {
        val.dispose();
      }
    }
  }
  material.dispose();
}

export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const extraTextures = new Set<THREE.Texture>();

  root.traverse((node) => {
    const extra = node.userData?.disposeTextures;
    if (Array.isArray(extra)) {
      for (const tex of extra) {
        if (tex instanceof THREE.Texture) {
          extraTextures.add(tex);
        }
      }
    }
    if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points) {
      if (node.geometry) {
        geometries.add(node.geometry);
      }
      if (Array.isArray(node.material)) {
        for (const m of node.material) {
          materials.add(m);
        }
      } else if (node.material) {
        materials.add(node.material);
      }
    }
  });

  for (const tex of extraTextures) {
    tex.dispose();
  }
  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    disposeMaterial(material);
  }
}

export function normalizeAndCenterGroup(group: THREE.Group, targetSize = 2.15): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / maxDim;

  group.scale.multiplyScalar(scale);
  group.position.set(
    -center.x * scale,
    -center.y * scale,
    -center.z * scale
  );
}
