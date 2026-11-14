import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  STATIC_POSE_TIME_SEC,
  buildLiveActorDefinitions,
} from '../renderers/actors/liveActorsConfig';
import type { HumanAssets } from '../renderers/actors/humanAppearance';
import {
  HUMAN_ASSET_URLS,
  isRiggedActivity,
  setRiggedActorIds,
} from '../renderers/actors/riggedActors';
import type { SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';
import {
  configureSkinTexture,
  createRiggedInstance,
  disposeInstance,
  placeInstance,
  stepInstance,
  type RiggedInstance,
} from './riggedInstance';
import { useActorMotion } from './useActorMotion';

export interface RiggedActorsProps {
  scene?: SceneDoc;
  benchEnabled?: boolean;
}

/** Longest step fed to the mixers, so a long idle gap in the demand loop does not skip the pose. */
const MAX_STEP_SEC = 0.1;

class RiggedErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[explore3d] Rigged characters failed to load, keeping procedural actors.', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function RiggedActorsInner({ scene = SOL_CENTER_SCENE, benchEnabled = false }: RiggedActorsProps) {
  const hairNames = Object.keys(HUMAN_ASSET_URLS.hair) as (keyof typeof HUMAN_ASSET_URLS.hair)[];
  const gltfs = useGLTF(
    [
      HUMAN_ASSET_URLS.male,
      HUMAN_ASSET_URLS.female,
      HUMAN_ASSET_URLS.animations,
      ...hairNames.map(name => HUMAN_ASSET_URLS.hair[name]),
    ],
    false,
  );
  const skinTextures = useLoader(THREE.TextureLoader, [
    HUMAN_ASSET_URLS.skinLight.male,
    HUMAN_ASSET_URLS.skinLight.female,
  ]);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const invalidate = useThree(s => s.invalidate);
  const { shouldAnimate } = useActorMotion(benchEnabled);

  const assets = useMemo(() => {
    const humans: HumanAssets = {
      characters: { male: gltfs[0]!.scene, female: gltfs[1]!.scene },
      hair: Object.fromEntries(hairNames.map((name, i) => [name, gltfs[3 + i]!.scene])),
      skinLight: { male: configureSkinTexture(skinTextures[0]!), female: configureSkinTexture(skinTextures[1]!) },
    };
    return { humans, clips: gltfs[2]!.animations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltfs, skinTextures]);

  const instances = useMemo<RiggedInstance[]>(() => {
    const view = useExploreStore.getState();
    const result: RiggedInstance[] = [];
    for (const def of buildLiveActorDefinitions(scene)) {
      if (!isRiggedActivity(def.activity)) continue;
      const instance = createRiggedInstance(def, assets);
      if (!instance) continue;
      // Poses the character once so reduced-motion / low-power states show a sensible frame.
      const pose = placeInstance(instance, scene, view.levelMode, view.focusLevel, STATIC_POSE_TIME_SEC);
      stepInstance(instance, 0, pose, STATIC_POSE_TIME_SEC);
      result.push(instance);
    }
    return result;
  }, [scene, assets]);

  // Keep each character on its level, even as the stack explodes or collapses.
  useLayoutEffect(() => {
    for (const instance of instances) {
      placeInstance(instance, scene, levelMode, focusLevel, STATIC_POSE_TIME_SEC);
    }
    invalidate();
  }, [instances, scene, levelMode, focusLevel, invalidate]);

  // Only now are these actors safe to hide from the procedural instanced mesh.
  useEffect(() => {
    setRiggedActorIds(instances.map(instance => instance.def.id));
    return () => {
      setRiggedActorIds([]);
    };
  }, [instances]);

  useEffect(() => {
    return () => {
      for (const instance of instances) disposeInstance(instance);
    };
  }, [instances]);

  useFrame(({ clock }, delta) => {
    if (!shouldAnimate || instances.length === 0) return;
    const step = Math.min(delta, MAX_STEP_SEC);
    const timeSec = STATIC_POSE_TIME_SEC + clock.getElapsedTime();
    for (const instance of instances) {
      if (!instance.holder.visible) continue;
      const pose = placeInstance(instance, scene, levelMode, focusLevel, timeSec);
      stepInstance(instance, step, pose, timeSec);
    }
    invalidate();
  });

  if (instances.length === 0) return null;

  return (
    <group name="sol-rigged-actors">
      {instances.map(({ def, holder }) => (
        <primitive key={def.id} object={holder} />
      ))}
    </group>
  );
}

/** Skinned human characters for every activity that has a person in it. */
export function RiggedActors(props: RiggedActorsProps) {
  return (
    <RiggedErrorBoundary>
      <Suspense fallback={null}>
        <RiggedActorsInner {...props} />
      </Suspense>
    </RiggedErrorBoundary>
  );
}

export default RiggedActors;
