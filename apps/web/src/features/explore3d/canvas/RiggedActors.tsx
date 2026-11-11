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
  MIXAMO_CHARACTER_MODEL,
  MIXAMO_HAND_BONES,
  RIGGED_CHARACTER_HEIGHT,
  RIGGED_CHARACTER_MODELS,
  computeRiggedPlacement,
  getRiggedClipSpec,
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

interface HeldBarbell {
  bar: THREE.Object3D;
  left: THREE.Object3D;
  right: THREE.Object3D;
}

interface RiggedInstance {
  def: LiveActorDefinition;
  spec: RiggedClipSpec;
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  bones: TweakedBone[];
  barbell?: HeldBarbell;
  /** Materials cloned per actor (outfit tint), disposed with the instance. */
  ownedMaterials: THREE.Material[];
}

const barStart = new THREE.Vector3();
const barEnd = new THREE.Vector3();
const barDir = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const outfitHsl = { h: 0, s: 0, l: 0 };

/** Olympic bar with bumper plates, built along +X and centred on the origin. */
function buildHeldBarbell(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'held-barbell';
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.2, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.88, metalness: 0 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number) => {
    geometry.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = x;
    mesh.castShadow = true;
    mesh.raycast = NOOP_RAYCAST;
    group.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 10), steel, 0);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12), steel, s * 0.82);
    add(new THREE.CylinderGeometry(0.225, 0.225, 0.055, 24), rubber, s * 0.72);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 24), rubber, s * 0.78);
  }
  return group;
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

/** Keeps a held bar centred between the two hands, along the line joining them. */
function updateHeldBarbell(holder: THREE.Object3D, held: HeldBarbell): void {
  holder.updateMatrixWorld(true);
  held.left.getWorldPosition(barStart);
  held.right.getWorldPosition(barEnd);
  holder.worldToLocal(barStart);
  holder.worldToLocal(barEnd);
  held.bar.position.copy(barStart).add(barEnd).multiplyScalar(0.5);
  barDir.subVectors(barEnd, barStart);
  if (barDir.lengthSq() > 1e-8) held.bar.quaternion.setFromUnitVectors(X_AXIS, barDir.normalize());
}

/** Steps the clip, then layers the activity's procedural bone tweaks on top. */
function stepInstance(instance: RiggedInstance, deltaSec: number, timeSec: number): void {
  const { def, spec, mixer, bones } = instance;
  for (const { bone, clipPose } of bones) bone.quaternion.copy(clipPose);
  mixer.update(deltaSec);
  if (instance.barbell) updateHeldBarbell(instance.holder, instance.barbell);
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
  const loaded = useGLTF(
    [...RIGGED_CHARACTER_MODELS.map(model => model.url), MIXAMO_CHARACTER_MODEL.url],
    false,
  );
  const gltfs = useMemo(() => loaded.slice(0, RIGGED_CHARACTER_MODELS.length), [loaded]);
  const mixamoGltf = loaded[RIGGED_CHARACTER_MODELS.length];
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
  const mixamoScale = useMemo(() => {
    if (!mixamoGltf) return 1;
    const size = new THREE.Box3().setFromObject(mixamoGltf.scene).getSize(new THREE.Vector3());
    return size.y > 1e-4 ? MIXAMO_CHARACTER_MODEL.height / size.y : 1;
  }, [mixamoGltf]);

  const instances = useMemo<RiggedInstance[]>(() => {
    const defs = buildLiveActorDefinitions(scene).filter(def => isRiggedActivity(def.activity));
    const result: RiggedInstance[] = [];

    for (const def of defs) {
      const picked = getRiggedClipSpec(def.activity);
      if (!picked) continue;
      const { spec, mixamo } = picked;
      const modelIndex = pickRiggedModelIndex(def.id, gltfs.length);
      const gltf = mixamo ? mixamoGltf : gltfs[modelIndex];
      const clipName = typeof spec.clip === 'function' ? spec.clip(def.id) : spec.clip;
      const clip = gltf?.animations.find(a => a.name === clipName);
      if (!gltf || !clip) continue;

      const model = cloneSkinned(gltf.scene) as THREE.Object3D;
      const scale = mixamo ? mixamoScale : (modelScales[modelIndex] ?? 1);
      model.scale.setScalar(scale);
      const ownedMaterials: THREE.Material[] = [];
      model.traverse(object => {
        object.frustumCulled = false;
        object.raycast = NOOP_RAYCAST;
        // The realistic character grounds itself with a cast shadow; the toy ones never did.
        object.castShadow = mixamo;
        object.receiveShadow = mixamo;
        const mesh = object as THREE.Mesh;
        if (mixamo && mesh.isMesh && !Array.isArray(mesh.material)) {
          // Outfit tint per actor: sportswear colour on the body shell, dark joints.
          const material = (mesh.material as THREE.MeshStandardMaterial).clone();
          const isJoint = material.name === 'joints';
          material.color.set(isJoint ? '#1c1c1f' : def.palette.top);
          if (!isJoint) {
            // Real sportswear is muted: pull the toy-bright outfit colours toward grey.
            material.color.getHSL(outfitHsl);
            material.color.setHSL(outfitHsl.h, outfitHsl.s * 0.45, Math.min(0.42, outfitHsl.l * 0.8));
          }
          material.roughness = isJoint ? 0.42 : 0.62;
          material.metalness = 0;
          mesh.material = material;
          ownedMaterials.push(material);
        }
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

      let barbell: HeldBarbell | undefined;
      if (spec.barbellInHands) {
        const left = model.getObjectByName(MIXAMO_HAND_BONES[0]);
        const right = model.getObjectByName(MIXAMO_HAND_BONES[1]);
        if (left && right) {
          const bar = buildHeldBarbell();
          holder.add(bar);
          barbell = { bar, left, right };
        }
      }

      const instance: RiggedInstance = { def, spec, holder, mixer, bones, barbell, ownedMaterials };
      // Poses the character once so reduced-motion / low-power states show a sensible frame.
      stepInstance(instance, 0, STATIC_POSE_TIME_SEC);

      result.push(instance);
    }
    return result;
  }, [scene, gltfs, modelScales, mixamoGltf, mixamoScale]);

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
      for (const { mixer, holder, ownedMaterials, barbell } of instances) {
        mixer.stopAllAction();
        const root = holder.children[0];
        if (root) mixer.uncacheRoot(root);
        for (const material of ownedMaterials) material.dispose();
        barbell?.bar.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
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

/** Skinned characters for activities in MIXAMO_ACTIVITY_CLIPS / RIGGED_ACTIVITY_CLIPS; skipped on the low tier. */
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
