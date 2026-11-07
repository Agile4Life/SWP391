import { Canvas, type RootState } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ResolvedSceneBindings } from '../data/bindings';
import { BenchmarkRunner } from '../perf/BenchmarkRunner';
import { PerformanceGovernor } from '../perf/PerformanceGovernor';
import { useExploreStore } from '../state/exploreStore';
import { WalkController } from '../walk/WalkController';
import { CameraRig } from './CameraRig';
import { Courts } from './Courts';
import { Cutaway } from './Cutaway';
import { Environment } from './Environment';
import { Hotspots } from './Hotspots';
import { ItemInstances } from './ItemInstances';
import { LevelStack } from './LevelStack';
import { Lights } from './Lights';
import { LiveActivityActors } from './LiveActivityActors';
import { Picking, handleCanvasPointerMissed } from './Picking';
import { Pool } from './Pool';
import { SelectionHighlight } from './SelectionHighlight';

export interface ExploreCanvasProps {
  bindings?: ResolvedSceneBindings;
  benchEnabled?: boolean;
}

const GL_CONFIG = {
  antialias: true,
  alpha: false,
  stencil: false,
  depth: true,
  powerPreference: 'high-performance' as const,
};

const INITIAL_CAMERA_CONFIG = {
  position: [46, 36, 48] as [number, number, number],
  fov: 38,
  near: 0.05,
  far: 380,
};

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

  const handleCreated = useCallback((state: RootState) => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    if (state.gl.shadowMap) {
      state.gl.shadowMap.enabled = true;
      state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    if ('toneMapping' in state.gl) {
      state.gl.toneMapping = THREE.ACESFilmicToneMapping;
      state.gl.toneMappingExposure = 1.06;
    }

    const domElement = state.gl.domElement;
    if (!domElement || typeof domElement.addEventListener !== 'function') {
      return;
    }

    const onContextLost = (event: Event) => {
      event.preventDefault();
      useExploreStore.getState().recordContextLost();
    };

    const onContextRestored = () => {
      state.invalidate();
    };

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
      <Lights />
      <CameraRig />
      <Cutaway />
      <Picking>
        <LevelStack />
        <Courts />
        <Pool />
        <ItemInstances resolvedItems={bindings?.items} />
      </Picking>
      <LiveActivityActors benchEnabled={benchEnabled} />
      <SelectionHighlight />
      <Hotspots />
      <WalkController />
      <PerformanceGovernor />
      {benchEnabled && <BenchmarkRunner />}
    </Canvas>
  );
}

export default ExploreCanvas;
