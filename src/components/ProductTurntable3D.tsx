import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import type { Model3dStatus } from '../types/od01';

export interface ProductTurntable3DProps {
  model3dUrl?: string | null;
  model3dStatus?: Model3dStatus;
  images?: string[];
  alt?: string;
  className?: string;
}

interface TurntableModelProps {
  url: string;
  isAutoRotating: boolean;
}

const TurntableModel: React.FC<TurntableModelProps> = ({ url, isAutoRotating }) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const { scene } = useGLTF(url);

  const normalized = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 1.8 / maxDim : 1;

    cloned.scale.setScalar(scale);
    cloned.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    );

    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = 0;
    groupRef.current.rotation.z = 0;
    groupRef.current.position.y = 0;

    if (isAutoRotating) {
      groupRef.current.rotation.y -= delta * ((Math.PI * 2) / 11);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <primitive object={normalized} />
    </group>
  );
};

interface TurntableCanvasProps {
  model3dUrl: string;
}

const TurntableCanvas: React.FC<TurntableCanvasProps> = ({ model3dUrl }) => {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const resumeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  const handleOrbitStart = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setIsAutoRotating(false);
  };

  const handleOrbitEnd = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setIsAutoRotating(true);
      resumeTimerRef.current = null;
    }, 1500);
  };

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.15, 3.2], fov: 35 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#FFFFFF' }}
    >
      <color attach="background" args={['#FFFFFF']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-3, 3, -3]} intensity={0.45} />
      <Environment preset="studio" />

      <Suspense fallback={null}>
        <TurntableModel url={model3dUrl} isAutoRotating={isAutoRotating} />
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.35}
        scale={5}
        blur={2.2}
        far={2}
      />

      <OrbitControls
        target={[0, 0.45, 0]}
        enablePan={false}
        enableZoom={true}
        minDistance={2}
        maxDistance={4.8}
        autoRotate={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        onStart={handleOrbitStart}
        onEnd={handleOrbitEnd}
      />
    </Canvas>
  );
};

export const ProductTurntable3D: React.FC<ProductTurntable3DProps> = ({
  model3dUrl,
  model3dStatus,
  images,
  alt = 'Aperçu produit 3D',
  className = 'h-full w-full',
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isReady = Boolean(model3dUrl) && model3dStatus === 'ready';

  if (!isReady || !model3dUrl) {
    const primaryImg = images?.[0];
    return (
      <div className={`flex items-center justify-center bg-white ${className}`}>
        {primaryImg ? (
          <img
            src={primaryImg}
            alt={alt}
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-4"
          />
        ) : (
          <span className="text-[10px] tracking-[0.12em] text-[#7A7A7A]">
            APERÇU INDISPONIBLE
          </span>
        )}
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center bg-white ${className}`}>
        <span className="text-[10px] tracking-[0.12em] text-[#7A7A7A]">
          CHARGEMENT 3D...
        </span>
      </div>
    );
  }

  return (
    <div className={`relative bg-white ${className}`}>
      <TurntableCanvas model3dUrl={model3dUrl} />
    </div>
  );
};

export default ProductTurntable3D;
