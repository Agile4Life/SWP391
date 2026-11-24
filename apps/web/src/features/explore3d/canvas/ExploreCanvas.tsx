import { Canvas, type RootState } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ResolvedSceneBindings } from '../data/bindings';
import { BenchmarkRunner } from '../perf/BenchmarkRunner';
import { PerformanceGovernor } from '../perf/PerformanceGovernor';
import { CinematicPipeline } from '../postfx/CinematicPipeline';
import { patchSoftShadowChunk } from '../postfx/softShadows';
import { loadSurfaceTextures } from '../renderers/surfaceTextures';
import { useExploreStore } from '../state/exploreStore';
import { WalkController } from '../walk/WalkController';
import { CameraRig } from './CameraRig';
import { CityMetropolis } from './CityMetropolis';
import { Courts } from './Courts';
import { Cutaway } from './Cutaway';
import { Environment } from './Environment';
import { Hotspots } from './Hotspots';
import { ImageBasedLighting } from './ImageBasedLighting';
import { ItemInstances } from './ItemInstances';
import { LevelStack } from './LevelStack';
import { Lights } from './Lights';
import { LiveActivityActors } from './LiveActivityActors';
import { Picking, handleCanvasPointerMissed } from './Picking';
import { Pool } from './Pool';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { RiggedActors } from './RiggedActors';
import { SelectionHighlight } from './SelectionHighlight';

// Wider, edge-faded Vogel PCF; must run before the first material compiles.
patchSoftShadowChunk();

/** Props của canvas 3D: dữ liệu thật đã gắn vào cảnh và cờ chạy benchmark. */
export interface ExploreCanvasProps {
  bindings?: ResolvedSceneBindings;
  benchEnabled?: boolean;
}

// AA comes from MSAA on the HDR render target + FXAA in the final pass.
// Cấu hình WebGL: tắt MSAA gốc vì khử răng cưa do MSAA trên HDR target và FXAA ở bước cuối.
const GL_CONFIG = {
  antialias: false,
  alpha: false,
  stencil: false,
  depth: true,
  powerPreference: 'high-performance' as const,
};

/** Cấu hình camera ban đầu (vị trí, góc mở, mặt phẳng gần/xa). */
const INITIAL_CAMERA_CONFIG = {
  position: [46, 36, 48] as [number, number, number],
  fov: 38,
  near: 0.05,
  far: 1200,
};

/**
 * Canvas react-three-fiber của cảnh khám phá: dựng cảnh, camera, hậu kỳ, hiệu năng, benchmark và xử lý mất ngữ
 * cảnh WebGL.
 */
export function ExploreCanvas({ bindings, benchEnabled = false }: ExploreCanvasProps) {
  const tier = useExploreStore(s => s.tier);
  const dpr = useExploreStore(s => s.dpr);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
    };
  }, []);

  // Khi canvas được tạo: bật bóng đổ và đăng ký các listener mất/khôi phục ngữ cảnh WebGL và rời trang.
  const handleCreated = useCallback((state: RootState) => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    if (state.gl.shadowMap) {
      state.gl.shadowMap.enabled = true;
      // PCFSoftShadowMap was removed in r186; softness comes from the patched Vogel filter.
      state.gl.shadowMap.type = THREE.PCFShadowMap;
    }

    // Only used by the forward fallback: the cinematic pipeline tone maps itself
    // (three skips renderer tone mapping when drawing into render targets).
    if ('toneMapping' in state.gl) {
      state.gl.toneMapping = THREE.ACESFilmicToneMapping;
      state.gl.toneMappingExposure = 1.06;
    }

    // Scanned PBR surface sets stream in; materials use procedural detail until then.
    if (useExploreStore.getState().tier !== 'low') {
      loadSurfaceTextures(() => state.invalidate(), Math.min(4, state.gl.capabilities?.getMaxAnisotropy?.() ?? 4));
    }

    const domElement = state.gl.domElement;
    if (!domElement || typeof domElement.addEventListener !== 'function') {
      return;
    }

    // Mất ngữ cảnh WebGL: chặn mặc định và ghi nhận (từ lần thứ hai chuyển sang 2D).
    const onContextLost = (event: Event) => {
      event.preventDefault();
      useExploreStore.getState().recordContextLost();
    };

    // Ngữ cảnh được khôi phục thì vẽ lại.
    const onContextRestored = () => {
      state.invalidate();
    };

    // Rời trang thì chủ động bỏ ngữ cảnh WebGL (bỏ qua lỗi khi đóng trang).
    const onPageHide = () => {
      try {
        state.gl.forceContextLoss();
      } catch {
        // Ignore teardown errors during page navigation
      }
    };

    domElement.addEventListener('webglcontextlost', onContextLost, false);
    domElement.addEventListener('webglcontextrestored', onContextRestored, false);
    window.addEventListener('pagehide', onPageHide, false);
    window.addEventListener('beforeunload', onPageHide, false);

    cleanupListenersRef.current = () => {
      domElement.removeEventListener('webglcontextlost', onContextLost, false);
      domElement.removeEventListener('webglcontextrestored', onContextRestored, false);
      window.removeEventListener('pagehide', onPageHide, false);
      window.removeEventListener('beforeunload', onPageHide, false);
    };
  }, []);

  return (
    <Canvas
      data-html2canvas-ignore="true"
      frameloop="demand"
      shadows={tier !== 'low'}
      dpr={dpr}
      gl={GL_CONFIG}
      camera={INITIAL_CAMERA_CONFIG}
      onCreated={handleCreated}
      onPointerMissed={handleCanvasPointerMissed}
    >
      <Environment />
      <CityMetropolis />
      <ImageBasedLighting />
      <Lights />
      <CameraRig />
      <Cutaway />
      <Picking>
        <LevelStack />
        <Courts />
        {/* Không dựng nước/bể procedural khi khu hồ bơi đã bỏ khỏi scene. */}
        {SOL_CENTER_SCENE.nodes['zone-b1-pool'] && <Pool />}
        <ItemInstances resolvedItems={bindings?.items} />
      </Picking>
      <LiveActivityActors benchEnabled={benchEnabled} />
      <RiggedActors benchEnabled={benchEnabled} />
      <SelectionHighlight />
      <Hotspots />
      <WalkController />
      <PerformanceGovernor />
      <CinematicPipeline />
      {benchEnabled && <BenchmarkRunner />}
    </Canvas>
  );
}

export default ExploreCanvas;
