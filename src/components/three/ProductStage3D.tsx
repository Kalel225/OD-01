import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Product } from '../../types/od01';
import { disposeObject3D } from './disposeUtils';
import { create2DTo3DMeshGroup } from './imageTo3D';
import { createProceduralModel } from './proceduralModels';

interface ProductStage3DProps {
  product: Product;
  onObjectClick?: () => void;
  interactiveCatalogClick?: boolean;
  className?: string;
}

const DRAG_THRESHOLD_PX = 6;
const CLICK_MAX_DURATION_MS = 340;

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const ProductStage3D: React.FC<ProductStage3DProps> = ({
  product,
  onObjectClick,
  interactiveCatalogClick = true,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onClickRef = useRef(onObjectClick);
  onClickRef.current = onObjectClick;

  const interactiveClickRef = useRef(interactiveCatalogClick);
  interactiveClickRef.current = interactiveCatalogClick;

  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Scene imperative handles so product swaps never recreate the WebGL context
  const sceneStateRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    pivot: THREE.Group;
    currentModel: THREE.Group | null;
    targetRotY: number;
    targetRotX: number;
    currentRotY: number;
    currentRotX: number;
    entryScale: number;
    requestRender: () => void;
    isSoftwareGl: boolean;
  } | null>(null);

  // 1. Initialize WebGLRenderer & Studio Rig ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Studio Environment Reflection (RoomEnvironment via PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.45, 5.1);
    camera.lookAt(0, -0.05, 0);

    // 3-Point Studio Lighting (Warm Key + Cool Hemisphere Fill + Crisp Rim)
    const hemiLight = new THREE.HemisphereLight(0xf6f8ff, 0xe8e8e8, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.85);
    keyLight.position.set(3.5, 5.2, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xeef3ff, 1.15);
    rimLight.position.set(-4.0, 2.8, -3.5);
    scene.add(rimLight);

    // Contact shadow grounding plane
    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.22;
    scene.add(shadowPlane);

    // Product Pivot Group
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.02, 0);
    scene.add(pivot);

    // On-demand + smoothly damped render scheduler with Software WebGL pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastTime = performance.now();
    let draggingLocal = false;

    const state = {
      scene,
      renderer,
      pivot,
      currentModel: null as THREE.Group | null,
      targetRotY: 0.42,
      targetRotX: 0.14,
      currentRotY: 0.42,
      currentRotX: 0.14,
      entryScale: 0.92,
      requestRender: () => {},
      isSoftwareGl,
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Gentle studio turntable motion on GPU devices only when idle
        if (!isSoftwareGl && !prefersReducedMotion && !draggingLocal) {
          state.targetRotY += dt * 0.22;
        }

        if (isSoftwareGl || prefersReducedMotion) {
          state.currentRotY = state.targetRotY;
          state.currentRotX = state.targetRotX;
          state.entryScale = 1;
        } else {
          state.currentRotY = THREE.MathUtils.damp(state.currentRotY, state.targetRotY, 10, dt);
          state.currentRotX = THREE.MathUtils.damp(state.currentRotX, state.targetRotX, 10, dt);
          state.entryScale = THREE.MathUtils.damp(state.entryScale, 1, 12, dt);
        }

        pivot.rotation.y = state.currentRotY;
        pivot.rotation.x = state.currentRotX;
        pivot.scale.setScalar(state.entryScale);

        renderer.render(scene, camera);

        const stillSettling =
          (!isSoftwareGl && !prefersReducedMotion) ||
          Math.abs(state.targetRotY - state.currentRotY) > 0.0008 ||
          Math.abs(state.targetRotX - state.currentRotX) > 0.0008 ||
          Math.abs(1 - state.entryScale) > 0.002;

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || stillSettling)) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    };

    state.requestRender = requestRender;
    sceneStateRef.current = state;

    // Pointer Interaction: Strict Drag (360° orbit) vs Click (Open Catalog Popup)
    const dom = renderer.domElement;
    let pointerDown = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startTime = 0;
    let movedDistance = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointerDown = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      startTime = performance.now();
      movedDistance = 0;
      dom.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown || e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      movedDistance += Math.hypot(dx, dy);

      if (movedDistance > DRAG_THRESHOLD_PX) {
        if (!draggingLocal) {
          draggingLocal = true;
          setIsDragging(true);
        }
        state.targetRotY += dx * 0.0115;
        state.targetRotX = THREE.MathUtils.clamp(state.targetRotX + dy * 0.007, -0.45, 0.58);
        requestRender();
      }
    };

    const finishPointer = (e: PointerEvent, cancelled: boolean) => {
      if (!pointerDown || e.pointerId !== pointerId) return;
      pointerDown = false;
      pointerId = null;
      if (dom.hasPointerCapture(e.pointerId)) {
        dom.releasePointerCapture(e.pointerId);
      }

      const elapsed = performance.now() - startTime;
      const wasClick = !cancelled && movedDistance <= DRAG_THRESHOLD_PX && elapsed <= CLICK_MAX_DURATION_MS;

      if (draggingLocal) {
        draggingLocal = false;
        setIsDragging(false);
      }

      if (wasClick && interactiveClickRef.current && onClickRef.current) {
        onClickRef.current();
      }
    };

    const onPointerUp = (e: PointerEvent) => finishPointer(e, false);
    const onPointerCancel = (e: PointerEvent) => finishPointer(e, true);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onContextRestored = () => {
      setWebglUnavailable(false);
      requestRender();
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerCancel);
    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    // ResizeObserver for crisp responsive viewport
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(Math.floor(entry.contentRect.width), 1);
        const h = Math.max(Math.floor(entry.contentRect.height), 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        requestRender();
      }
    });
    resizeObserver.observe(container);

    requestRender();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerCancel);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);

      if (state.currentModel) {
        pivot.remove(state.currentModel);
        disposeObject3D(state.currentModel);
        state.currentModel = null;
      }

      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
      sceneStateRef.current = null;
    };
  }, []);

  // 2. Swap 3D Product Mesh cleanly on product or custom3D change
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;

    let cancelled = false;

    const mountModel = (nextModel: THREE.Group) => {
      if (cancelled) {
        disposeObject3D(nextModel);
        return;
      }
      if (state.currentModel) {
        state.pivot.remove(state.currentModel);
        disposeObject3D(state.currentModel);
      }
      state.currentModel = nextModel;
      state.pivot.add(nextModel);
      state.entryScale = state.isSoftwareGl ? 1 : 0.88;
      state.targetRotY = 0.45;
      state.targetRotX = 0.14;
      state.requestRender();
    };

    if (product.modelPreset === 'CUSTOM_2D' && product.custom3D?.imageDataUrl) {
      const maxAniso = state.renderer.capabilities.getMaxAnisotropy();
      create2DTo3DMeshGroup(product.custom3D, maxAniso)
        .then(mountModel)
        .catch(() => {
          mountModel(createProceduralModel('SN'));
        });
    } else {
      const preset = product.modelPreset === 'CUSTOM_2D' ? 'SN' : product.modelPreset;
      const proceduralGroup = createProceduralModel(preset);
      mountModel(proceduralGroup);
    }

    return () => {
      cancelled = true;
    };
  }, [
    product.id,
    product.modelPreset,
    product.custom3D?.imageDataUrl,
    product.custom3D?.removeBackground,
    product.custom3D?.depth,
    product.custom3D?.finish,
  ]);

  if (webglUnavailable) {
    return (
      <div
        onClick={() => interactiveCatalogClick && onObjectClick?.()}
        className={`flex h-full w-full cursor-pointer flex-col items-center justify-center border border-[#E5E5E5] bg-white p-6 text-center ${className}`}
      >
        <div className="text-[11px] font-bold tracking-[0.14em] text-black">{product.sku}</div>
        <div className="mt-2 text-[10px] text-[#7A7A7A]">APERÇU 3D INDISPONIBLE — CLIQUER POUR LE CATALOGUE</div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      role="button"
      tabIndex={0}
      aria-label={`${product.name} — Glisser pour pivoter à 360 degrés, cliquer pour ouvrir le catalogue`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (interactiveCatalogClick && onObjectClick) {
            onObjectClick();
          }
        }
      }}
      className={`relative h-full w-full select-none ${
        isDragging ? 'cursor-grabbing' : interactiveCatalogClick ? 'cursor-grab' : 'cursor-grab'
      } ${className}`}
    />
  );
};
