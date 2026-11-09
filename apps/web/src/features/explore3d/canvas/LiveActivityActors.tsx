import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  type EvaluatedPartTransform,
} from '../renderers/actors/liveActorsConfig';
import {
  PROCEDURAL_BODY_PART_NAMES,
  useRiggedActorIds,
} from '../renderers/actors/riggedActors';
import { useActorMotion } from './useActorMotion';

export interface LiveActivityActorsProps {
  scene?: SceneDoc;
  benchEnabled?: boolean;
}

const NOOP_RAYCAST = () => null;
const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempColor = new THREE.Color();

function applyPartsToInstancedMesh(
  mesh: THREE.InstancedMesh,
  parts: readonly EvaluatedPartTransform[],
  writeColors: boolean,
  hiddenActorIds: ReadonlySet<string>,
): void {
  let anyVisible = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const sx = part.scale[0];
    const sy = part.scale[1];
    const sz = part.scale[2];

    if (
      (sx === 0 && sy === 0 && sz === 0) || (hiddenActorIds.has(part.actorId) && PROCEDURAL_BODY_PART_NAMES.has(part.partName))
    ) {
      mesh.setMatrixAt(i, HIDDEN_MATRIX);
    } else {
      anyVisible = true;
      tempPosition.set(part.position[0], part.position[1], part.position[2]);
      tempEuler.set(part.rotation[0], part.rotation[1], part.rotation[2], 'YXZ');
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(sx, sy, sz);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      mesh.setMatrixAt(i, tempMatrix);
    }

    if (writeColors) {
      tempColor.set(part.color);
      mesh.setColorAt(i, tempColor);
    }
  }

  mesh.visible = anyVisible;
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
  const colorsWrittenRef = useRef(false);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const invalidate = useThree(s => s.invalidate);
  // Actors drawn as skinned characters are hidden here once their model has loaded.
  const riggedActorIds = useRiggedActorIds();
  const { reducedMotion, shouldAnimate } = useActorMotion(benchEnabled);

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

  useLayoutEffect(() => {
    colorsWrittenRef.current = false;
  }, [actorDefs, totalInstances]);

  const applyTransforms = useCallback(
    (timeSec: number) => {
      const mesh = meshRef.current;
      if (!mesh || totalInstances === 0) return;

      const parts = evaluateActorPartsAtTime(actorDefs, timeSec, {
        scene,
        levelMode,
        focusLevel,
      });
      const writeColors = !colorsWrittenRef.current;
      applyPartsToInstancedMesh(mesh, parts, writeColors, riggedActorIds);
      colorsWrittenRef.current = true;
    },
    [actorDefs, totalInstances, scene, levelMode, focusLevel, riggedActorIds],
  );

  // Apply initial / static pose immediately whenever definitions or level visibility changes
  useLayoutEffect(() => {
    applyTransforms(STATIC_POSE_TIME_SEC);
    invalidate();
  }, [applyTransforms, reducedMotion, shouldAnimate, invalidate]);

  // Smooth 60 FPS animation synchronized natively with R3F's render loop
  useFrame(({ clock }) => {
    if (!shouldAnimate || totalInstances === 0) return;
    applyTransforms(STATIC_POSE_TIME_SEC + clock.getElapsedTime());
    invalidate();
  });

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
      raycast={NOOP_RAYCAST}
    />
  );
}

export default LiveActivityActors;
