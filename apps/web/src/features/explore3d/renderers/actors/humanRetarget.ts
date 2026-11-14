import * as THREE from 'three';
import type { HumanPoseAngles } from './liveActorsConfig';

/**
 * Drives the Universal rig (Quaternius characters) straight from the activity's pose
 * angles (`solveHumanPose`), so every activity without motion-captured data still gets
 * a human skeleton moving on the same timing as the code-built figure.
 *
 * The pose angles name absolute directions: a limb segment points along
 * `limbDirection(pitch, splay)` in the actor's frame (+Y up, +Z forward, the code-built
 * figure's "left" at -X). Each segment is aimed at that direction with the shortest
 * rotation, which keeps bone lengths and makes the joints bend like a person's. The rig
 * stands in a T-pose at rest, with the character's left at +X.
 */

/** Bone names of the rig for each joint this module drives. */
export const HUMAN_BONES = {
  Hips: 'pelvis',
  Spine: 'spine_01',
  Spine1: 'spine_02',
  Spine2: 'spine_03',
  Neck: 'neck_01',
  Head: 'Head',
  LeftShoulder: 'clavicle_l',
  LeftArm: 'upperarm_l',
  LeftForeArm: 'lowerarm_l',
  LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r',
  RightArm: 'upperarm_r',
  RightForeArm: 'lowerarm_r',
  RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l',
  LeftLeg: 'calf_l',
  LeftFoot: 'foot_l',
  RightUpLeg: 'thigh_r',
  RightLeg: 'calf_r',
  RightFoot: 'foot_r',
} as const;
export type DrivenBone = keyof typeof HUMAN_BONES;
const DRIVEN = Object.keys(HUMAN_BONES) as DrivenBone[];

/** Limb segment pointing direction for a pitch (forward) and splay (sideways), actor frame. */
export function limbDirection(pitch: number, splay: number): THREE.Vector3 {
  const cs = Math.cos(splay);
  return new THREE.Vector3(Math.sin(splay), -cs * Math.cos(pitch), cs * Math.sin(pitch));
}

interface RigBone {
  object: THREE.Object3D;
  restLocal: THREE.Quaternion;
  restWorld: THREE.Quaternion;
  /** Direction toward the next bone down the limb, in the bone's own frame. */
  childDir?: THREE.Vector3;
}

const NEXT: Partial<Record<DrivenBone, DrivenBone>> = {
  LeftArm: 'LeftForeArm',
  LeftForeArm: 'LeftHand',
  RightArm: 'RightForeArm',
  RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg',
  LeftLeg: 'LeftFoot',
  RightUpLeg: 'RightLeg',
  RightLeg: 'RightFoot',
};

/** Limb segments a pose may aim at explicit world directions instead of pitch/splay angles. */
export type AimBone =
  | 'LeftArm'
  | 'LeftForeArm'
  | 'RightArm'
  | 'RightForeArm'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'RightUpLeg'
  | 'RightLeg';

/**
 * Pose that the pitch/splay angles cannot express (lying down): world rotations for the
 * trunk and explicit directions for the limbs.
 */
export interface PoseOverride {
  /** Hips position in metres in the character's frame (feet at 0). */
  hipsPosition?: readonly [number, number, number];
  /** Extra world rotations per bone, applied in order from the hips outward. */
  rotations?: Partial<Record<'Hips' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head', THREE.Quaternion>>;
  aims?: Partial<Record<AimBone, THREE.Vector3>>;
  /** World rotation applied to each foot's rest orientation; omit to keep the feet flat and forward. */
  footTurn?: THREE.Quaternion;
}

export interface RetargetOptions {
  /** Keep the lower foot on the ground by moving the hips; off for seated poses. */
  groundLock: boolean;
  /** Hips height in metres when `groundLock` is off (seated on a bike). */
  hipsHeight?: number;
}

export interface RetargetRig {
  bones: Map<DrivenBone, RigBone>;
  hips: THREE.Object3D;
  /** Hips position at rest in the character's frame (+Y up), model units. */
  hipsRestModel: THREE.Vector3;
  /** Rotation from the hips' parent space (the root bone is turned 90°, Blender style) to the character's frame. */
  hipsParent: THREE.Quaternion;
  /** Lowest ankle height above the hips at rest, in model units. */
  restAnkleRel: number;
  modelScale: number;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function worldOf(object: THREE.Object3D): THREE.Quaternion {
  const result = new THREE.Quaternion();
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    result.premultiply(node.quaternion);
  }
  return result;
}

/** Call on a freshly cloned model that is still in its rest pose. */
export function createRetargetRig(model: THREE.Object3D, modelScale: number): RetargetRig | null {
  const bones = new Map<DrivenBone, RigBone>();
  for (const name of DRIVEN) {
    const object = model.getObjectByName(HUMAN_BONES[name]);
    if (!object) return null;
    bones.set(name, {
      object,
      restLocal: object.quaternion.clone(),
      restWorld: worldOf(object),
    });
  }
  for (const [name, next] of Object.entries(NEXT) as [DrivenBone, DrivenBone][]) {
    const bone = bones.get(name)!;
    bone.childDir = bones.get(next)!.object.position.clone().normalize();
  }
  const hips = bones.get('Hips')!.object;
  const hipsParent = hips.parent ? worldOf(hips.parent) : new THREE.Quaternion();
  const rig: RetargetRig = {
    bones,
    hips,
    hipsRestModel: hips.position.clone().applyQuaternion(hipsParent),
    hipsParent,
    restAnkleRel: 0,
    modelScale,
  };
  const worlds = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const bone of bones.values()) worlds.set(bone.object, bone.restWorld);
  rig.restAnkleRel = lowestAnkleRel(rig, worlds);
  return rig;
}

/** Ankle height above the hips (model units) for the lowest foot, given every bone's world rotation. */
function lowestAnkleRel(rig: RetargetRig, worlds: Map<THREE.Object3D, THREE.Quaternion>): number {
  let lowest = Infinity;
  for (const side of ['Left', 'Right'] as const) {
    const ankle = rig.bones.get(`${side}Foot` as DrivenBone)!.object;
    const path: THREE.Object3D[] = [];
    for (let node: THREE.Object3D | null = ankle; node && node !== rig.hips; node = node.parent) path.push(node);
    const position = new THREE.Vector3();
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i]!;
      const parentWorld = node.parent ? (worlds.get(node.parent) ?? worldOf(node.parent)) : new THREE.Quaternion();
      position.add(node.position.clone().applyQuaternion(parentWorld));
    }
    lowest = Math.min(lowest, position.y);
  }
  return lowest;
}

const quat = new THREE.Quaternion();
const delta = new THREE.Quaternion();

/** Writes the bone rotations (and hips height) for `pose`. */
export function applyRetargetPose(
  rig: RetargetRig,
  pose: HumanPoseAngles,
  options: RetargetOptions,
  forearmRoll?: Partial<Record<'left' | 'right', number>>,
  timeSec = 0,
  override?: PoseOverride,
): void {
  const worlds = new Map<THREE.Object3D, THREE.Quaternion>();
  const worldOfBone = (object: THREE.Object3D): THREE.Quaternion => {
    const known = worlds.get(object);
    if (known) return known;
    // Not driven yet (an undriven ancestor): rest rotation on top of its parent.
    const parent = object.parent ? worldOfBone(object.parent) : new THREE.Quaternion();
    const result = parent.clone().multiply(object.quaternion);
    worlds.set(object, result);
    return result;
  };

  const parentWorld = (bone: RigBone) =>
    bone.object.parent ? worldOfBone(bone.object.parent) : new THREE.Quaternion();

  /** Rotate about world axes through the joint, on top of the parents' motion. */
  const rotate = (name: DrivenBone, d: THREE.Quaternion) => {
    const bone = rig.bones.get(name)!;
    const pw = parentWorld(bone);
    const local = pw.clone().invert().multiply(d).multiply(pw).multiply(bone.restLocal);
    bone.object.quaternion.copy(local);
    worlds.set(bone.object, pw.clone().multiply(local));
  };

  /** Point the segment toward `target` (shortest rotation from where the parents leave it). */
  const aim = (name: DrivenBone, target: THREE.Vector3) => {
    const bone = rig.bones.get(name)!;
    const pw = parentWorld(bone);
    const base = pw.clone().multiply(bone.restLocal);
    const current = bone.childDir!.clone().applyQuaternion(base);
    rotate(name, delta.setFromUnitVectors(current, target.clone().normalize()));
  };

  const axis = (a: THREE.Vector3, angle: number) => quat.clone().setFromAxisAngle(a, angle);
  const extra = override?.rotations;

  // Stride: the pelvis turns toward the leading leg and the chest counter-turns, which is
  // what makes a walk or run look like a person's rather than a pair of legs on a post.
  const stride = pose.leftHipPitch - pose.rightHipPitch;
  const twist = THREE.MathUtils.clamp(stride * 0.09, -0.16, 0.16);
  // Slow breathing and weight shift, so a standing person is never frozen.
  const breath = Math.sin(timeSec * 1.7) * 0.012;
  const sway = Math.sin(timeSec * 0.55) * 0.02;
  const look = Math.sin(timeSec * 0.31 + 1.3) * 0.1;

  // Trunk: hips take a third of the lean, the spine the rest, the head follows half of it.
  const lean = pose.torsoPitch;
  const hipsTurn = axis(X, lean * 0.35).multiply(axis(Y, twist)).multiply(axis(Z, sway));
  rotate('Hips', extra?.Hips ? extra.Hips.clone().multiply(hipsTurn) : hipsTurn);
  for (const name of ['Spine', 'Spine1', 'Spine2'] as const) {
    const turn = axis(X, (lean * 0.65) / 3 + breath / 3)
      .multiply(axis(Y, (-twist * 1.7) / 3))
      .multiply(axis(Z, -pose.torsoRoll / 3 - sway / 3));
    rotate(name, extra?.[name] ? extra[name]!.clone().multiply(turn) : turn);
  }
  const headExtra = lean * 0.5 + pose.headPitch - lean;
  rotate('Neck', (extra?.Neck ?? new THREE.Quaternion()).clone().multiply(axis(X, headExtra * 0.5)).multiply(axis(Y, (pose.headYaw + look) * 0.4)));
  rotate('Head', (extra?.Head ?? new THREE.Quaternion()).clone().multiply(axis(X, headExtra * 0.5)).multiply(axis(Y, (pose.headYaw + look) * 0.6)));

  rotate('LeftShoulder', new THREE.Quaternion());
  rotate('RightShoulder', new THREE.Quaternion());

  // The code-built figure's left side sits at -X, the rig's Right side.
  const arms = [
    { side: 'Right', shoulderPitch: pose.leftShoulderPitch, shoulderSplay: pose.leftShoulderSplay, elbowPitch: pose.leftElbowPitch, elbowSplay: pose.leftElbowSplay, roll: forearmRoll?.left },
    { side: 'Left', shoulderPitch: pose.rightShoulderPitch, shoulderSplay: pose.rightShoulderSplay, elbowPitch: pose.rightElbowPitch, elbowSplay: pose.rightElbowSplay, roll: forearmRoll?.right },
  ] as const;
  for (const arm of arms) {
    const upper = `${arm.side}Arm` as AimBone;
    const fore = `${arm.side}ForeArm` as AimBone;
    aim(upper, override?.aims?.[upper] ?? limbDirection(arm.shoulderPitch, arm.shoulderSplay));
    const forearmDirection = override?.aims?.[fore] ?? limbDirection(arm.elbowPitch, arm.elbowSplay);
    aim(fore, forearmDirection);
    rotate(`${arm.side}Hand`, axis(forearmDirection.clone().normalize(), arm.roll ?? 0));
  }

  const legs = [
    { side: 'Right', hipPitch: pose.leftHipPitch, hipSplay: pose.leftHipSplay, kneePitch: pose.leftKneePitch },
    { side: 'Left', hipPitch: pose.rightHipPitch, hipSplay: pose.rightHipSplay, kneePitch: pose.rightKneePitch },
  ] as const;
  for (const leg of legs) {
    const thigh = `${leg.side}UpLeg` as AimBone;
    const calf = `${leg.side}Leg` as AimBone;
    aim(thigh, override?.aims?.[thigh] ?? limbDirection(leg.hipPitch, leg.hipSplay));
    aim(calf, override?.aims?.[calf] ?? limbDirection(leg.kneePitch, leg.hipSplay * 0.5));
    // Feet: flat at rest, toes up as the leg reaches forward and heel up as it pushes off.
    const foot = rig.bones.get(`${leg.side}Foot` as DrivenBone)!;
    const pw = parentWorld(foot);
    const turn = override
      ? (override.footTurn ?? new THREE.Quaternion())
      : axis(X, THREE.MathUtils.clamp(-0.5 * leg.hipPitch, -0.3, 0.55));
    const target = turn.clone().multiply(foot.restWorld);
    foot.object.quaternion.copy(pw.clone().invert().multiply(target));
    worlds.set(foot.object, target);
  }

  // The hips live in the root bone's turned space: express the target in the character's frame.
  const placeHips = (x: number, y: number, z: number) => {
    rig.hips.position.set(x, y, z).applyQuaternion(rig.hipsParent.clone().invert());
  };
  if (override?.hipsPosition) {
    const [hx, hy, hz] = override.hipsPosition;
    placeHips(hx / rig.modelScale, hy / rig.modelScale, hz / rig.modelScale);
    return;
  }
  const rest = rig.hipsRestModel;
  const hipsY = options.groundLock
    ? rest.y + rig.restAnkleRel - lowestAnkleRel(rig, worlds)
    : (options.hipsHeight ?? 0.92) / rig.modelScale;
  placeHips(rest.x, hipsY, rest.z);
}
