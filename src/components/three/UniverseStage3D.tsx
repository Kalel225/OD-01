import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Product } from '../../types/od01';
import { disposeObject3D } from './disposeUtils';
import { create2DTo3DMeshGroup, Turntable360Controller } from './imageTo3D';
import { createProceduralModel } from './proceduralModels';

interface UniverseStage3DProps {
  /** Strictly ordered [HABITS, CHAUSSURES, ACCESSOIRES] */
  slots: readonly [Product | null, Product | null, Product | null];
  activeIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  onActiveProductClick: () => void;
  onArticleMove?: () => void;
  className?: string;
}

const DRAG_THRESHOLD_PX = 6;
const CLICK_MAX_DURATION_MS = 350;
const SLIDE_TRIGGER_PX = 44;

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
  grad.addColorStop(0, 'rgba(0,0,0,0.20)');
  grad.addColorStop(0.52, 'rgba(0,0,0,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface SlotNode {
  container: THREE.Group;
  pivot: THREE.Group;
  shadow: THREE.Mesh;
  hitProxy: THREE.Mesh;
  currentModel: THREE.Group | null;
  loadedKey: string;
  targetRotY: number;
  targetRotX: number;
  currentRotY: number;
  currentRotX: number;
}

export const UniverseStage3D: React.FC<UniverseStage3DProps> = ({
  slots,
  activeIndex,
  onChangeIndex,
  onActiveProductClick,
  onArticleMove,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onChangeIndexRef = useRef(onChangeIndex);
  onChangeIndexRef.current = onChangeIndex;

  const onActiveClickRef = useRef(onActiveProductClick);
  onActiveClickRef.current = onActiveProductClick;

  const onArticleMoveRef = useRef(onArticleMove);
  onArticleMoveRef.current = onArticleMove;

  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [cursorMode, setCursorMode] = useState<'default' | 'grab' | 'grabbing' | 'pointer'>('grab');

  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    slotNodes: [SlotNode, SlotNode, SlotNode];
    targetIndex: number;
    animatedIndex: number;
    dragTrackOffset: number;
    requestRender: () => void;
    isSoftwareGl: boolean;
  } | null>(null);

  // 1. Initialize unified Three.js 3-universe studio scene ONCE
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
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(container.clientWidth, 1);
    const initH = Math.max(container.clientHeight, 1);
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const fog = new THREE.Fog(0xffffff, 6.2, 9.7);
    scene.fog = fog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, initW / initH, 0.1, 45);
    camera.position.set(0, 0.28, 5.35);
    camera.lookAt(0, -0.02, 0);

    // Calibrated True-Color Studio Lighting (preserves deep black leather & crisp white knit)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xeaeaea, 0.55);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(3.4, 5.2, 4.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf2f6ff, 0.72);
    rimLight.position.set(-4.0, 2.8, -3.4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(-2.2, 0.8, 4.2);
    scene.add(fillLight);

    // Shared contact shadow texture & invisible proxy geometries for fast raycasting
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const hitGeo = new THREE.SphereGeometry(1.32, 14, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    const createSlotNode = (index: number): SlotNode => {
      const slotGroup = new THREE.Group();
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.04, 0);
      slotGroup.add(pivot);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 1,
      });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.2;
      slotGroup.add(shadow);

      const hitProxy = new THREE.Mesh(hitGeo, hitMat);
      hitProxy.userData.slotIndex = index;
      slotGroup.add(hitProxy);

      scene.add(slotGroup);

      return {
        container: slotGroup,
        pivot,
        shadow,
        hitProxy,
        currentModel: null,
        loadedKey: '',
        targetRotY: 0,
        targetRotX: 0.02,
        currentRotY: 0,
        currentRotX: 0.02,
      };
    };

    const slotNodes: [SlotNode, SlotNode, SlotNode] = [
      createSlotNode(0),
      createSlotNode(1),
      createSlotNode(2),
    ];
    const hitProxies = slotNodes.map((n) => n.hitProxy);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastTime = performance.now();
    let idleClock = 0;
    let isActivelyRotating = false;

    const engine = {
      renderer,
      slotNodes,
      targetIndex: activeIndexRef.current,
      animatedIndex: activeIndexRef.current,
      dragTrackOffset: 0,
      requestRender: () => {},
      isSoftwareGl,
    };

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getResponsiveMetrics = () => {
      const aspect = Math.max(camera.aspect || 1, 0.42);
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

      // Keep foreground hero comfortably framed on mobile, portrait tablet, landscape tablet & desktop
      const fgScale = aspect < 0.7 ? 1.02 : aspect < 1.08 ? 1.12 : 1.18;
      const bgScale = aspect < 0.7 ? 0.46 : aspect < 1.08 ? 0.5 : 0.52;
      const heroHalfSpan = 1.16 * fgScale;

      const zForWidth = heroHalfSpan / (tanHalfFov * aspect * 0.7);
      const zForHeight = heroHalfSpan / (tanHalfFov * 0.76);
      const cameraZ = THREE.MathUtils.clamp(Math.max(5.3, zForWidth, zForHeight), 5.3, 9.2);
      const cameraY = aspect < 1.0 ? 0.2 : 0.3;

      const bgZ = -2.9;
      const bgHalfWidth = tanHalfFov * (cameraZ - bgZ) * aspect;

      let spacing: number;
      if (aspect >= 1.55) {
        spacing = THREE.MathUtils.clamp(bgHalfWidth * 0.75, 2.35, 4.1);
      } else if (aspect >= 1.05) {
        // Landscape tablets & compact laptops
        spacing = THREE.MathUtils.clamp(bgHalfWidth * 0.72, 1.9, 3.15);
      } else if (aspect >= 0.7) {
        // Portrait tablets (iPad / Android tablets)
        spacing = THREE.MathUtils.clamp(bgHalfWidth * 0.74, 1.55, 2.45);
      } else {
        // Smartphones
        spacing = THREE.MathUtils.clamp(bgHalfWidth * 0.78, 1.32, 1.88);
      }

      return { cameraZ, cameraY, fgScale, bgScale, bgZ, spacing };
    };

    const syncCameraFraming = () => {
      const { cameraZ, cameraY } = getResponsiveMetrics();
      camera.position.set(0, cameraY, cameraZ);
      camera.lookAt(0, -0.02, 0);
      // Keep consistent ~58% atmospheric depth haze on recessed background items across all viewports
      fog.near = cameraZ + 0.9;
      fog.far = cameraZ + 4.35;
    };

    const layoutSlots = () => {
      const effectiveIndex = engine.animatedIndex + engine.dragTrackOffset;
      const { fgScale, bgScale, bgZ, spacing } = getResponsiveMetrics();

      for (let i = 0; i < 3; i++) {
        const node = slotNodes[i];
        const offset = i - effectiveIndex; // strictly left (-1/-2) to center (0) to right (+1/+2)
        const absOff = Math.abs(offset);
        const bgBlend = Math.min(absOff, 1);

        const posX = offset * spacing;
        const posZ = bgBlend * bgZ - Math.max(0, absOff - 1) * 1.85;
        const posY = bgBlend * 0.22 + Math.max(0, absOff - 1) * 0.1;
        const scale = Math.max(
          0.26,
          fgScale - bgBlend * (fgScale - bgScale) - Math.max(0, absOff - 1) * 0.2
        );

        node.container.position.set(posX, posY, posZ);
        node.container.scale.setScalar(scale);

        // Keep background items effortlessly clickable/tappable on tablets & touchscreens
        node.hitProxy.scale.setScalar(1 + bgBlend * 0.34);

        // Soft diffused shadow for background depth vs grounded foreground contact shadow
        const shadowMat = node.shadow.material as THREE.MeshBasicMaterial;
        shadowMat.opacity = Math.max(0.1, 1 - bgBlend * 0.84 - Math.max(0, absOff - 1) * 0.1);

        // Simple continuous 360° rotation on itself
        node.pivot.position.y = 0.04;
        const turntable = node.currentModel?.userData?.turntable360 as
          | Turntable360Controller
          | undefined;
        if (turntable) {
          node.pivot.rotation.set(0, 0, 0);
          turntable.updateOrbit(
            node.currentRotY,
            node.currentRotX,
            -Math.sign(offset) * bgBlend * 0.14,
            0
          );
        } else {
          node.pivot.rotation.y = node.currentRotY;
          node.pivot.rotation.x = node.currentRotX;
        }
      }
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

        // Simple continuous 360° rotation on itself for every exposed article
        if (!isSoftwareGl && !prefersReducedMotion) {
          idleClock += dt;
          for (let i = 0; i < 3; i++) {
            const node = slotNodes[i];
            const isDraggedSlot = isActivelyRotating && i === activeIndexRef.current;
            if (!isDraggedSlot) {
              const spinSpeed = i === engine.targetIndex ? 0.55 : 0.35;
              node.targetRotY += dt * spinSpeed;
            }
          }
        }

        if (isSoftwareGl || prefersReducedMotion) {
          engine.animatedIndex = engine.targetIndex;
          for (const node of slotNodes) {
            node.currentRotY = node.targetRotY;
            node.currentRotX = node.targetRotX;
          }
        } else {
          engine.animatedIndex = THREE.MathUtils.damp(
            engine.animatedIndex,
            engine.targetIndex,
            8.5,
            dt
          );
          for (const node of slotNodes) {
            node.currentRotY = THREE.MathUtils.damp(node.currentRotY, node.targetRotY, 10, dt);
            node.currentRotX = THREE.MathUtils.damp(node.currentRotX, node.targetRotX, 10, dt);
          }
        }

        layoutSlots();
        renderer.render(scene, camera);

        let stillMoving =
          (!isSoftwareGl && !prefersReducedMotion) ||
          Math.abs(engine.targetIndex - engine.animatedIndex) > 0.001 ||
          Math.abs(engine.dragTrackOffset) > 0.001;

        if (!stillMoving) {
          for (const node of slotNodes) {
            if (
              Math.abs(node.targetRotY - node.currentRotY) > 0.001 ||
              Math.abs(node.targetRotX - node.currentRotX) > 0.001
            ) {
              stillMoving = true;
              break;
            }
          }
        }

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || stillMoving)) {
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

    engine.requestRender = requestRender;
    engineRef.current = engine;

    // Raycast helper
    const dom = renderer.domElement;
    const pickSlotAtClient = (clientX: number, clientY: number): number | null => {
      const rect = dom.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length === 0) return null;
      const slotIndex = hits[0].object.userData.slotIndex;
      return typeof slotIndex === 'number' ? slotIndex : null;
    };

    // Pointer Interaction State
    type DragMode = 'NONE' | 'ROTATE_ACTIVE' | 'BACKGROUND_SLOT' | 'SLIDE_TRACK';
    let mode: DragMode = 'NONE';
    let hitBackgroundSlot: number | null = null;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startTime = 0;
    let totalDistance = 0;
    let lastHoverCheck = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      startTime = performance.now();
      totalDistance = 0;

      const hitSlot = pickSlotAtClient(e.clientX, e.clientY);
      if (hitSlot === activeIndexRef.current) {
        mode = 'ROTATE_ACTIVE';
        hitBackgroundSlot = null;
      } else if (hitSlot !== null) {
        mode = 'BACKGROUND_SLOT';
        hitBackgroundSlot = hitSlot;
      } else {
        mode = 'SLIDE_TRACK';
        hitBackgroundSlot = null;
      }

      dom.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId === null) {
        // Throttled hover cursor feedback
        const now = performance.now();
        if (now - lastHoverCheck < 50) return;
        lastHoverCheck = now;
        const hovered = pickSlotAtClient(e.clientX, e.clientY);
        if (hovered === activeIndexRef.current) {
          setCursorMode('grab');
        } else if (hovered !== null) {
          setCursorMode('pointer');
        } else {
          setCursorMode('default');
        }
        return;
      }

      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      totalDistance += Math.hypot(dx, dy);

      const netDx = e.clientX - startX;

      if (mode === 'ROTATE_ACTIVE') {
        if (totalDistance > DRAG_THRESHOLD_PX) {
          isActivelyRotating = true;
          setCursorMode('grabbing');
          const activeNode = slotNodes[activeIndexRef.current];
          if (activeNode) {
            activeNode.targetRotY += dx * 0.014;
            activeNode.targetRotX = THREE.MathUtils.clamp(
              activeNode.targetRotX + dy * 0.007,
              -0.45,
              0.56
            );
            requestRender();
          }
        }
      } else if (mode === 'SLIDE_TRACK' || mode === 'BACKGROUND_SLOT') {
        if (Math.abs(netDx) > 10) {
          setCursorMode('grabbing');
          const width = Math.max(dom.clientWidth, 320);
          // Clamp tactile preview strictly within linear track bounds [0..2]
          let previewOffset = -(netDx / (width * 0.45));
          const minOffset = -activeIndexRef.current;
          const maxOffset = 2 - activeIndexRef.current;
          previewOffset = THREE.MathUtils.clamp(previewOffset, minOffset - 0.12, maxOffset + 0.12);
          engine.dragTrackOffset = previewOffset;
          requestRender();
        }
      }
    };

    const finishPointer = (e: PointerEvent, cancelled: boolean) => {
      if (e.pointerId !== pointerId) return;
      if (dom.hasPointerCapture(e.pointerId)) {
        dom.releasePointerCapture(e.pointerId);
      }

      const elapsed = performance.now() - startTime;
      const netDx = e.clientX - startX;

      if (!cancelled) {
        if (mode === 'ROTATE_ACTIVE') {
          if (totalDistance <= DRAG_THRESHOLD_PX && elapsed <= CLICK_MAX_DURATION_MS) {
            onActiveClickRef.current();
          } else if (totalDistance > DRAG_THRESHOLD_PX) {
            onArticleMoveRef.current?.();
          }
        } else if (mode === 'BACKGROUND_SLOT') {
          if (Math.abs(netDx) >= SLIDE_TRIGGER_PX) {
            // Strict left-to-right / right-to-left slide
            const nextIdx = THREE.MathUtils.clamp(
              activeIndexRef.current + (netDx < 0 ? 1 : -1),
              0,
              2
            );
            if (nextIdx !== activeIndexRef.current) {
              onChangeIndexRef.current(nextIdx);
            } else {
              onArticleMoveRef.current?.();
            }
          } else if (hitBackgroundSlot !== null && totalDistance <= 18) {
            // Clicking directly on background item brings it smoothly to foreground
            onChangeIndexRef.current(hitBackgroundSlot);
          }
        } else if (mode === 'SLIDE_TRACK') {
          if (Math.abs(netDx) >= SLIDE_TRIGGER_PX) {
            const nextIdx = THREE.MathUtils.clamp(
              activeIndexRef.current + (netDx < 0 ? 1 : -1),
              0,
              2
            );
            if (nextIdx !== activeIndexRef.current) {
              onChangeIndexRef.current(nextIdx);
            } else {
              onArticleMoveRef.current?.();
            }
          }
        }
      }

      isActivelyRotating = false;
      engine.dragTrackOffset = 0;
      mode = 'NONE';
      hitBackgroundSlot = null;
      pointerId = null;
      setCursorMode('grab');
      requestRender();
    };

    const onPointerUp = (e: PointerEvent) => finishPointer(e, false);
    const onPointerCancel = (e: PointerEvent) => finishPointer(e, true);

    // Horizontal trackpad/wheel slide strictly left-to-right & right-to-left
    let lastWheelSlide = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 24) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelSlide < 420) return;
      lastWheelSlide = now;
      const nextIdx = THREE.MathUtils.clamp(
        activeIndexRef.current + (e.deltaX > 0 ? 1 : -1),
        0,
        2
      );
      if (nextIdx !== activeIndexRef.current) {
        onChangeIndexRef.current(nextIdx);
      }
    };

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
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(Math.floor(entry.contentRect.width), 1);
        const h = Math.max(Math.floor(entry.contentRect.height), 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        syncCameraFraming();
        layoutSlots();
        requestRender();
      }
    });
    resizeObserver.observe(container);

    syncCameraFraming();
    layoutSlots();
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
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);

      for (const node of slotNodes) {
        if (node.currentModel) {
          node.pivot.remove(node.currentModel);
          disposeObject3D(node.currentModel);
          node.currentModel = null;
        }
        (node.shadow.material as THREE.Material).dispose();
      }

      shadowGeo.dispose();
      shadowTex.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
      engineRef.current = null;
    };
  }, []);

  // 2. Sync activeIndex target cleanly so the 3-universe track slides strictly left <-> right
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.targetIndex = activeIndex;
    engine.requestRender();
  }, [activeIndex]);

  // 3. Sync each of the 3 universe 3D models independently with strict .dispose()
  const slotKeys = slots.map((p) => {
    if (!p) return 'EMPTY';
    const v360 = p.custom3D?.views360;
    const viewsSig = v360
      ? `${v360.length}:${v360.map((u) => `${u.slice(0, 24)}:${u.length}`).join(',')}`
      : '1';
    return `${p.id}|${p.modelPreset}|${p.custom3D?.imageDataUrl?.length ?? 0}|${viewsSig}|${p.custom3D?.depth ?? 0}|${p.custom3D?.finish ?? ''}|${p.custom3D?.removeBackground ?? false}|${p.custom3D?.volumeMode ?? 'SCULPTED'}|${p.custom3D?.reliefStrength ?? 0.5}|${p.custom3D?.bgTolerance ?? 48}`;
  });

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    let cancelled = false;

    slots.forEach((product, idx) => {
      const node = engine.slotNodes[idx];
      const nextKey = slotKeys[idx];
      if (!node || node.loadedKey === nextKey) return;

      node.loadedKey = nextKey;

      const mountModel = (nextModel: THREE.Group | null) => {
        if (cancelled) {
          if (nextModel) disposeObject3D(nextModel);
          return;
        }
        if (node.currentModel) {
          node.pivot.remove(node.currentModel);
          disposeObject3D(node.currentModel);
          node.currentModel = null;
        }
        if (nextModel) {
          node.currentModel = nextModel;
          node.pivot.add(nextModel);
          node.shadow.position.y = -1.2;
          node.targetRotY = 0;
          node.targetRotX = 0.02;
          node.currentRotY = 0;
          node.currentRotX = 0.02;
        }
        engine.requestRender();
      };

      if (!product) {
        mountModel(null);
        return;
      }

      if (product.custom3D?.imageDataUrl) {
        const maxAniso = engine.renderer.capabilities.getMaxAnisotropy();
        create2DTo3DMeshGroup(product.custom3D, maxAniso)
          .then(mountModel)
          .catch(() => {
            const fallback = product.modelPreset === 'CUSTOM_2D' ? 'SN' : product.modelPreset;
            mountModel(createProceduralModel(fallback));
          });
      } else {
        const preset = product.modelPreset === 'CUSTOM_2D' ? 'SN' : product.modelPreset;
        mountModel(createProceduralModel(preset));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slotKeys[0], slotKeys[1], slotKeys[2]]);

  const activeProduct = slots[activeIndex];

  if (webglUnavailable) {
    return (
      <div
        onClick={onActiveProductClick}
        className={`flex h-full w-full cursor-pointer flex-col items-center justify-center bg-white p-6 text-center ${className}`}
      >
        <div className="text-[11px] font-bold tracking-[0.14em] text-black">
          {activeProduct?.sku ?? 'OD-01'}
        </div>
      </div>
    );
  }

  const cursorClass =
    cursorMode === 'grabbing'
      ? 'cursor-grabbing'
      : cursorMode === 'pointer'
        ? 'cursor-pointer'
        : cursorMode === 'grab'
          ? 'cursor-grab'
          : 'cursor-default';

  return (
    <div
      ref={mountRef}
      role="region"
      tabIndex={0}
      aria-label={`${activeProduct?.name ?? 'Article OD-01'} — Glisser pour pivoter à 360 degrés, cliquer pour ouvrir l'inventaire ou cliquer sur les articles en arrière-plan pour changer d'univers`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActiveProductClick();
        }
      }}
      className={`relative h-full w-full select-none ${cursorClass} ${className}`}
    />
  );
};
