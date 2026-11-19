import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Model3DStatus } from '../types/od01';
import { disposeObject3D } from './three/disposeUtils';

export interface ProductTurntable3DProps {
  /** Product images (index 0 = mandatory primary 2D fallback image) */
  images: string[];
  /** Public URL of the stored `.glb` 3D model */
  model3dUrl: string | null;
  /** Pipeline status of the 3D model */
  model3dStatus: Model3DStatus;
  /** Accessible product name */
  alt?: string;
  /** Optional click callback (only fires on genuine click, never after drag) */
  onModelClick?: () => void;
  /** Optional extra CSS classes */
  className?: string;
}

const TARGET_MAX_DIMENSION = 1.8;
const FULL_TURN_SECONDS = 11;
const RESUME_DELAY_MS = 1500;
const DRAG_CLICK_THRESHOLD_PX = 6;

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface GlbBoundaryProps {
  resetKey: string;
  onError: () => void;
  children: React.ReactNode;
}

interface GlbBoundaryState {
  hasError: boolean;
}

class GlbErrorBoundary extends Component<GlbBoundaryProps, GlbBoundaryState> {
  state: GlbBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GlbBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  componentDidUpdate(prevProps: GlbBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface NormalizedGlbTurntableProps {
  model3dUrl: string;
  isAutoRotatingRef: React.MutableRefObject<boolean>;
}

const NormalizedGlbTurntable: React.FC<NormalizedGlbTurntableProps> = ({
  model3dUrl,
  isAutoRotatingRef,
}) => {
  const { scene } = useGLTF(model3dUrl);
  const groupRef = useRef<THREE.Group>(null);

  // Clone scene so shared GLTF cache is never mutated, normalize max dimension to 1.8 units,
  // center X/Z at (0, 0), and seat box.min.y strictly on y = 0.
  const normalizedScene = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const rawBox = new THREE.Box3().setFromObject(cloned);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);

    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
    if (maxDim > 0 && Number.isFinite(maxDim)) {
      const uniformScale = TARGET_MAX_DIMENSION / maxDim;
      cloned.scale.multiplyScalar(uniformScale);
    }

    cloned.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    cloned.position.x -= scaledCenter.x;
    cloned.position.z -= scaledCenter.z;
    cloned.position.y -= scaledBox.min.y;

    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    return cloned;
  }, [scene]);

  // Dispose cloned GPU resources cleanly on unmount / model swap
  useEffect(() => {
    return () => {
      disposeObject3D(normalizedScene);
    };
  }, [normalizedScene]);

  // Exact linear constant clockwise turntable rotation: 360° in exactly 11 seconds.
  // Strictly locks rotation.x = 0, rotation.z = 0, position.y = 0 (zero levitation).
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (isAutoRotatingRef.current) {
      const clampedDelta = Math.min(delta, 0.1);
      groupRef.current.rotation.y -= clampedDelta * ((Math.PI * 2) / FULL_TURN_SECONDS);
    }
    groupRef.current.rotation.x = 0;
    groupRef.current.rotation.z = 0;
    groupRef.current.position.y = 0;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <primitive object={normalizedScene} />
    </group>
  );
};

export const ProductTurntable3D: React.FC<ProductTurntable3DProps> = ({
  images,
  model3dUrl,
  model3dStatus,
  alt = 'Article OD-01',
  onModelClick,
  className = '',
}) => {
  const [webglReady, setWebglReady] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const isAutoRotatingRef = useRef<boolean>(true);
  const resumeTimerRef = useRef<number | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setWebglReady(isWebGLSupported());
  }, []);

  useEffect(() => {
    setLoadFailed(false);
  }, [model3dUrl, model3dStatus]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  const canRender3D =
    model3dStatus === 'ready' && Boolean(model3dUrl) && webglReady && !loadFailed;

  const fallbackImage = images[0] ?? '';

  const handleOrbitStart = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    isAutoRotatingRef.current = false;
    setIsInteracting(true);
  };

  const handleOrbitEnd = () => {
    setIsInteracting(false);
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      isAutoRotatingRef.current = true;
      resumeTimerRef.current = null;
    }, RESUME_DELAY_MS);
  };

  if (!canRender3D) {
    return (
      <div
        onClick={onModelClick}
        className={`relative flex h-full w-full items-center justify-center bg-white ${
          onModelClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        {fallbackImage ? (
          <img
            src={fallbackImage}
            alt={alt}
            className="h-full w-full max-h-[82%] max-w-[82%] object-contain select-none"
            draggable={false}
          />
        ) : (
          <div className="text-[10px] tracking-[0.12em] text-[#7A7A7A]">APERÇU INDISPONIBLE</div>
        )}
      </div>
    );
  }

  return (
    <div
      onPointerDown={(e) => {
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (!onModelClick || !pointerDownPosRef.current) return;
        const dist = Math.hypot(
          e.clientX - pointerDownPosRef.current.x,
          e.clientY - pointerDownPosRef.current.y
        );
        pointerDownPosRef.current = null;
        if (dist <= DRAG_CLICK_THRESHOLD_PX) {
          onModelClick();
        }
      }}
      className={`relative h-full w-full select-none bg-white ${
        isInteracting ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
    >
      <GlbErrorBoundary resetKey={model3dUrl ?? ''} onError={() => setLoadFailed(true)}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 1.15, 3.2], fov: 35 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (ev) => {
              ev.preventDefault();
              setWebglReady(false);
            });
          }}
        >
          <color attach="background" args={['#FFFFFF']} />

          {/* Neutral high-precision studio lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 6, 4]} intensity={1.2} castShadow />
          <Environment preset="studio" />

          <Suspense fallback={null}>
            <NormalizedGlbTurntable
              model3dUrl={model3dUrl!}
              isAutoRotatingRef={isAutoRotatingRef}
            />
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
      </GlbErrorBoundary>

      {/* Single discreet monochrome 360° indicator in corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 bottom-3 text-[10px] font-bold tracking-[0.14em] text-[#7A7A7A] tabular-nums"
      >
        360°
      </div>
    </div>
  );
};

export default ProductTurntable3D;
