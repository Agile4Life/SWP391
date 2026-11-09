import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  STATIC_POSE_TIME_SEC,
  buildLiveActorDefinitions,
  isActorLevelVisible,
  type LiveActorDefinition,
} from '../renderers/actors/liveActorsConfig';
import {
  RIGGED_ACTIVITY_CLIPS,
  RIGGED_CHARACTER_HEIGHT,
  RIGGED_CHARACTER_MODELS,
  computeRiggedPlacement,
  getActorPhase,
  isRiggedActivity,
  pickRiggedModelIndex,
  setRiggedActorIds,
  type RiggedBoneName,
  type RiggedClipSpec,
} from '../renderers/actors/riggedActors';
import type { LevelCode, SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore, type LevelMode } from '../state/exploreStore';
import { buildHandProp } from '../renderers/actors/riggedHandProps';
import { useActorMotion } from './useActorMotion';

export interface RiggedActorsProps {
  scene?: SceneDoc;
  benchEnabled?: boolean;
}

const NOOP_RAYCAST = () => null;
/** Longest step fed to the mixers, so a long idle gap in the demand loop does not skip the pose. */
const MAX_STEP_SEC = 0.1;

interface TweakedBone {
  name: RiggedBoneName;
  bone: THREE.Object3D;
  /** Clip output before the procedural tweak, so tweaks never accumulate between frames. */
  clipPose: THREE.Quaternion;
}

interface RiggedInstance {
  def: LiveActorDefinition;
  spec: RiggedClipSpec;
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  bones: TweakedBone[];
}

const tweakEuler = new THREE.Euler();
const tweakQuaternion = new THREE.Quaternion();

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

function placeInstance(
  { def, holder }: RiggedInstance,
  scene: SceneDoc,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
  timeSec: number,
): void {
  const placement = computeRiggedPlacement(def, scene, levelMode, timeSec);
  holder.position.set(placement.position[0], placement.position[1], placement.position[2]);
  holder.rotation.set(0, placement.yaw, 0);
  holder.visible = isActorLevelVisible(def.level, levelMode, focusLevel);
}

/** Steps the clip, then layers the activity's procedural bone tweaks on top. */
function stepInstance(instance: RiggedInstance, deltaSec: number, timeSec: number): void {
  const { def, spec, mixer, bones } = instance;
  for (const { bone, clipPose } of bones) bone.quaternion.copy(clipPose);
  mixer.update(deltaSec);
  if (!spec.tweakBones || bones.length === 0) return;
  const tweaks = spec.tweakBones(getActorPhase(def, timeSec));
  for (const { name, bone, clipPose } of bones) {
    clipPose.copy(bone.quaternion);
    const tweak = tweaks[name];
    if (!tweak) continue;
    tweakEuler.set(tweak[0], tweak[1], tweak[2]);
    bone.quaternion.multiply(tweakQuaternion.setFromEuler(tweakEuler));
  }
}

function RiggedActorsInner({ scene = SOL_CENTER_SCENE, benchEnabled = false }: RiggedActorsProps) {
  const gltfs = useGLTF(
    RIGGED_CHARACTER_MODELS.map(model => model.url),
    false,
  );
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const invalidate = useThree(s => s.invalidate);
  const { shouldAnimate } = useActorMotion(benchEnabled);

  const modelScales = useMemo(
    () =>
      gltfs.map(gltf => {
        const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
        return size.y > 1e-4 ? RIGGED_CHARACTER_HEIGHT / size.y : 1;
      }),
    [gltfs],
  );

  const instances = useMemo<RiggedInstance[]>(() => {
    const defs = buildLiveActorDefinitions(scene).filter(def => isRiggedActivity(def.activity));
    const result: RiggedInstance[] = [];

    for (const def of defs) {
      const spec = RIGGED_ACTIVITY_CLIPS[def.activity];
      const modelIndex = pickRiggedModelIndex(def.id, gltfs.length);
      const gltf = gltfs[modelIndex];
      const clipName = spec && (typeof spec.clip === 'function' ? spec.clip(def.id) : spec.clip);
      const clip = gltf?.animations.find(a => a.name === clipName);
      if (!spec || !gltf || !clip) continue;

      const model = cloneSkinned(gltf.scene) as THREE.Object3D;
      const scale = modelScales[modelIndex] ?? 1;
      model.scale.setScalar(scale);
      model.traverse(object => {
        object.frustumCulled = false;
        object.raycast = NOOP_RAYCAST;
        object.castShadow = false;
        object.receiveShadow = false;
      });

      const holder = new THREE.Group();
      holder.name = `rigged-${def.id}`;
      holder.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.timeScale = Math.max(0.2, def.speed * spec.timeScale);
      action.play();
      action.time = (def.phaseOffset / (Math.PI * 2)) * clip.duration;

      const bones: TweakedBone[] = [];
      if (spec.tweakBones) {
        for (const name of Object.keys(spec.tweakBones(0)) as RiggedBoneName[]) {
          const bone = model.getObjectByName(name);
          if (bone) bones.push({ name, bone, clipPose: bone.quaternion.clone() });
        }
      }
      if (spec.handProp) {
        const handBone = model.getObjectByName(spec.handProp.bone);
        handBone?.add(buildHandProp(spec.handProp, scale));
      }

      const instance: RiggedInstance = { def, spec, holder, mixer, bones };
      // Poses the character once so reduced-motion / low-power states show a sensible frame.
      stepInstance(instance, 0, STATIC_POSE_TIME_SEC);

      result.push(instance);
    }
    return result;
  }, [scene, gltfs, modelScales]);

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
      for (const { mixer, holder } of instances) {
        mixer.stopAllAction();
        const root = holder.children[0];
        if (root) mixer.uncacheRoot(root);
      }
    };
  }, [instances]);

  useFrame(({ clock }, delta) => {
    if (!shouldAnimate || instances.length === 0) return;
    const step = Math.min(delta, MAX_STEP_SEC);
    const timeSec = STATIC_POSE_TIME_SEC + clock.getElapsedTime();
    for (const instance of instances) {
      if (!instance.holder.visible) continue;
      placeInstance(instance, scene, levelMode, focusLevel, timeSec);
      stepInstance(instance, step, timeSec);
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

/** Skinned characters for activities listed in RIGGED_ACTIVITY_CLIPS; skipped on the low tier. */
export function RiggedActors(props: RiggedActorsProps) {
  const tier = useExploreStore(s => s.tier);
  if (tier === 'low') return null;

  return (
    <RiggedErrorBoundary>
      <Suspense fallback={null}>
        <RiggedActorsInner {...props} />
      </Suspense>
    </RiggedErrorBoundary>
  );
}

export default RiggedActors;
