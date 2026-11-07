import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';
import {
  STATIC_POSE_TIME_SEC,
  buildLiveActorDefinitions,
  createActorPartGeometry,
  evaluateActorPartsAtTime,
  getTotalActorInstanceCount,
  prefersReducedMotion,
  type EvaluatedPartTransform,
} from '../renderers/actors/liveActorsConfig';

export interface LiveActivityActorsProps {
  scene?: SceneDoc;
  benchEnabled?: boolean;
}

const TICK_INTERVAL_MS = 33; // ~30 FPS throttled demand-frameloop ticker

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempColor = new THREE.Color();

function isBenchmarkActive(benchEnabledProp?: boolean): boolean {
  if (benchEnabledProp) return true;
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bench') === '1') {
      return true;
    }
  }
  return false;
}

function applyPartsToInstancedMesh(
  mesh: THREE.InstancedMesh,
  parts: readonly EvaluatedPartTransform[],
  writeColors: boolean,
): void {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    tempPosition.set(part.position[0], part.position[1], part.position[2]);
    tempEuler.set(part.rotation[0], part.rotation[1], part.rotation[2], 'YXZ');
    tempQuaternion.setFromEuler(tempEuler);
    tempScale.set(part.scale[0], part.scale[1], part.scale[2]);
    tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
    mesh.setMatrixAt(i, tempMatrix);

    if (writeColors) {
      tempColor.set(part.color);
      mesh.setColorAt(i, tempColor);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (writeColors && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

export function LiveActivityActors({
  scene = SOL_CENTER_SCENE,
  benchEnabled = false,
}: LiveActivityActorsProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const viewMode = useExploreStore(s => s.viewMode);
  const invalidate = useThree(s => s.invalidate);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const actorDefs = useMemo(() => buildLiveActorDefinitions(scene), [scene]);
  const totalInstances = useMemo(() => getTotalActorInstanceCount(actorDefs), [actorDefs]);
  const unitGeometry = useMemo(() => createActorPartGeometry(), []);

  const sharedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: 'sol-live-activity-actors-mat',
        color: '#ffffff',
        vertexColors: false,
        roughness: 0.52,
        metalness: 0.14,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      sharedMaterial.dispose();
    };
  }, [sharedMaterial]);

  const benchActive = isBenchmarkActive(benchEnabled);
  const shouldAnimate = !reducedMotion && !benchActive && viewMode === '3d';

  // Apply initial / static pose immediately whenever definitions or level visibility changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || totalInstances === 0) return;

    const parts = evaluateActorPartsAtTime(actorDefs, STATIC_POSE_TIME_SEC, {
      scene,
      levelMode,
      focusLevel,
    });
    applyPartsToInstancedMesh(mesh, parts, true);
    invalidate();
  }, [actorDefs, totalInstances, scene, levelMode, focusLevel, invalidate]);

  // Throttled ~30 FPS demand-frameloop animation ticker
  useEffect(() => {
    if (!shouldAnimate || totalInstances === 0) {
      return;
    }

    let rafId = 0;
    let lastTickMs = 0;
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const tick = (nowMs: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (nowMs - lastTickMs < TICK_INTERVAL_MS) {
        return;
      }
      lastTickMs = nowMs;

      const mesh = meshRef.current;
      if (!mesh) return;

      const elapsedSec = STATIC_POSE_TIME_SEC + (nowMs - startMs) * 0.001;
      const parts = evaluateActorPartsAtTime(actorDefs, elapsedSec, {
        scene,
        levelMode,
        focusLevel,
      });
      applyPartsToInstancedMesh(mesh, parts, false);
      invalidate();
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [shouldAnimate, totalInstances, actorDefs, scene, levelMode, focusLevel, invalidate]);

  if (totalInstances === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      name="sol-live-activity-actors"
      args={[unitGeometry, sharedMaterial, totalInstances]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
    />
  );
}

export default LiveActivityActors;
