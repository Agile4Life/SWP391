import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  isActorLevelVisible,
  type HumanPoseAngles,
  type LiveActorDefinition,
} from '../renderers/actors/liveActorsConfig';
import {
  HAIR_STYLES,
  dressHuman,
  relaxHands,
  type Gender,
  type HairStyleName,
  type HumanAssets,
  type OutfitVariant,
} from '../renderers/actors/humanAppearance';
import {
  applyRetargetPose,
  createRetargetRig,
  type RetargetRig,
} from '../renderers/actors/humanRetarget';
import {
  HUMAN_HAND_BONES,
  HUMAN_HEIGHT,
  computeRiggedPlacement,
  getActorPhase,
  getRiggedMotion,
  hashString,
  type RiggedMotion,
} from '../renderers/actors/riggedActors';
import { buildHandProp } from '../renderers/actors/riggedHandProps';
import type { LevelCode, SceneDoc } from '../scene/schema';
import type { LevelMode } from '../state/exploreStore';

const NOOP_RAYCAST = () => null;

interface HeldBarbell {
  bar: THREE.Object3D;
  left: THREE.Object3D;
  right: THREE.Object3D;
}

export interface RiggedInstance {
  def: LiveActorDefinition;
  motion: RiggedMotion;
  holder: THREE.Group;
  /** Clip playback (motion capture or generated clips). */
  mixer?: THREE.AnimationMixer;
  /** Pose-driven skeleton. */
  rig?: RetargetRig;
  barbell?: HeldBarbell;
}

export interface RiggedAssets {
  humans: HumanAssets;
  clips: readonly THREE.AnimationClip[];
}

/** Makes a loaded JPEG follow the glTF texture convention, so it drops into the body material. */
export function configureSkinTexture(texture: THREE.Texture): THREE.Texture {
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The cut and details of an actor's sportswear, stable per actor. */
function outfitFor(id: string, gender: Gender): OutfitVariant {
  const bits = hashString(`${id}:outfit`);
  const bit = (n: number) => ((bits >>> n) & 1) === 1;
  return {
    sleeves: !bit(0),
    // Cropped tops and leggings are for the women's wear; the men get tees and shorts.
    crop: gender === 'female' && bit(1) && bit(2),
    leggings: gender === 'female' && bit(3),
    stripe: bit(4),
    wristbands: bit(5) && bit(6),
    headband: bit(7) && bit(8),
  };
}

const heights = new WeakMap<THREE.Object3D, number>();
/** Scale that makes the character stand `HUMAN_HEIGHT` tall. */
function baseScale(character: THREE.Object3D): number {
  let height = heights.get(character);
  if (height === undefined) {
    height = new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3()).y;
    heights.set(character, height);
  }
  return height > 1e-4 ? HUMAN_HEIGHT / height : 1;
}

const barStart = new THREE.Vector3();
const barEnd = new THREE.Vector3();
const barDir = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0);

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

/** A person for `def`, or null when the activity has no person or its clip is missing. */
export function createRiggedInstance(def: LiveActorDefinition, assets: RiggedAssets): RiggedInstance | null {
  const motion = getRiggedMotion(def.activity);
  if (!motion) return null;

  let clip: THREE.AnimationClip | undefined;
  if (motion.kind === 'clip') {
    const clipName = typeof motion.spec.clip === 'function' ? motion.spec.clip(def.id) : motion.spec.clip;
    clip = assets.clips.find(a => a.name === clipName);
    if (!clip) return null;
  }

  const hash = hashString(def.id);
  const gender: Gender = hash % 2 === 0 ? 'male' : 'female';
  const model = cloneSkinned(assets.humans.characters[gender]) as THREE.Object3D;
  const isBoxer = def.activity === 'boxing-spar' || def.activity === 'heavy-bag-boxer';
  const racketHand = motion.kind === 'pose' && motion.spec.handProp?.kind === 'racket';
  const swimmer = def.activity === 'swim-freestyle';
  // Everyone is a little different in height, stable per actor.
  const scale = baseScale(assets.humans.characters[gender]) * (0.95 + (hash % 11) * 0.01);

  // All of this happens while the clone is still in its rest pose and unscaled.
  relaxHands(model, isBoxer || racketHand ? 2 : 1);
  const rig = motion.kind === 'pose' ? createRetargetRig(model, scale) : null;
  if (motion.kind === 'pose' && !rig) return null;
  const styles = HAIR_STYLES[gender];
  const hairStyle: HairStyleName = swimmer
    ? gender === 'male'
      ? 'hair-buzzed'
      : 'hair-buzzedfemale'
    : styles[(hash >>> 5) % styles.length]!;
  dressHuman(model, assets.humans, {
    gender,
    palette: def.palette,
    hairStyle,
    outfit: outfitFor(def.id, gender),
    swimCap: swimmer,
  });

  model.scale.setScalar(scale);
  model.traverse(object => {
    object.frustumCulled = false;
    object.raycast = NOOP_RAYCAST;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const holder = new THREE.Group();
  holder.name = `rigged-${def.id}`;
  holder.add(model);

  const instance: RiggedInstance = { def, motion, holder };

  if (motion.kind === 'clip' && clip) {
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.timeScale = Math.max(0.2, def.speed * motion.spec.timeScale);
    action.play();
    action.time = (def.phaseOffset / (Math.PI * 2)) * clip.duration;
    instance.mixer = mixer;

  } else if (motion.kind === 'pose' && rig) {
    instance.rig = rig;
    const { handProp, dumbbellsInHands, barbellInHands } = motion.spec;
    if (handProp) model.getObjectByName(handProp.bone)?.add(buildHandProp(handProp, scale));
    if (dumbbellsInHands) {
      for (const handName of HUMAN_HAND_BONES) {
        // The grip axis runs along the hand bone's X; the palm centre is ~4 cm out along Y.
        const dumbbell = buildHandProp(
          { kind: 'dumbbell', bone: handName, position: [0, 0.05, 0], rotation: [0, 0, 0], size: 1 },
          scale,
        );
        model.getObjectByName(handName)?.add(dumbbell);
      }
    }
    if (barbellInHands) {
      const left = model.getObjectByName(HUMAN_HAND_BONES[0]);
      const right = model.getObjectByName(HUMAN_HAND_BONES[1]);
      if (left && right) {
        const bar = buildHeldBarbell();
        holder.add(bar);
        instance.barbell = { bar, left, right };
      }
    }
  }
  return instance;
}

export function placeInstance(
  { def, holder }: RiggedInstance,
  scene: SceneDoc,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
  timeSec: number,
): HumanPoseAngles {
  const placement = computeRiggedPlacement(def, scene, levelMode, timeSec);
  holder.position.set(placement.position[0], placement.position[1], placement.position[2]);
  holder.rotation.set(0, placement.yaw, 0);
  holder.visible = isActorLevelVisible(def.level, levelMode, focusLevel);
  return placement.pose;
}

/** Advances the clip, or poses the skeleton from the activity's angles. */
export function stepInstance(
  instance: RiggedInstance,
  deltaSec: number,
  pose: HumanPoseAngles,
  timeSec: number,
): void {
  const { motion, mixer, rig } = instance;
  if (motion.kind === 'clip') {
    mixer?.update(deltaSec);
  } else if (rig) {
    const override = motion.spec.override?.(getActorPhase(instance.def, timeSec));
    applyRetargetPose(rig, pose, motion.spec, motion.spec.forearmRoll, timeSec, override);
  }
  if (instance.barbell) updateHeldBarbell(instance.holder, instance.barbell);
}

export function disposeInstance(instance: RiggedInstance): void {
  // Body, clothes and hair geometry and materials are shared between actors and stay cached.
  const { mixer, holder, barbell } = instance;
  mixer?.stopAllAction();
  const root = holder.children[0];
  if (mixer && root) mixer.uncacheRoot(root);
  barbell?.bar.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}
