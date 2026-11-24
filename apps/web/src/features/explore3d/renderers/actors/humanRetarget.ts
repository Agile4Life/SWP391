import * as THREE from 'three';
import type { HumanPoseAngles } from './liveActorsConfig';

/**
 * Điều khiển bộ xương Universal (các nhân vật Quaternius) trực tiếp từ góc tư thế của hoạt động
 * (`solveHumanPose`), giúp mọi hoạt động không có dữ liệu motion-capture vẫn có bộ xương người
 * chuyển động đúng nhịp với hình nhân dựng bằng mã.
 *
 * Các góc tư thế biểu diễn hướng tuyệt đối: mỗi đoạn chi trỏ dọc theo
 * `limbDirection(pitch, splay)` trong hệ trục của nhân vật (+Y lên, +Z tới trước, phía "trái"
 * của hình dựng bằng mã ở -X). Mỗi đoạn chi được hướng theo vectơ đó bằng phép xoay ngắn nhất,
 * giữ nguyên chiều dài xương và giúp khớp gập tự nhiên như người thật. Ở tư thế nghỉ, bộ xương
 * đứng dạng T-pose với phía trái của nhân vật ở +X.
 */

/** Tên xương của bộ xương cho từng khớp mà module này điều khiển. */
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
/** Tên một khớp được điều khiển. */
export type DrivenBone = keyof typeof HUMAN_BONES;
const DRIVEN = Object.keys(HUMAN_BONES) as DrivenBone[];

/** Hướng đoạn chi theo góc gập (pitch, tới trước) và góc dạng (splay, sang ngang) trong hệ nhân vật. */
export function limbDirection(pitch: number, splay: number): THREE.Vector3 {
  const cs = Math.cos(splay);
  return new THREE.Vector3(Math.sin(splay), -cs * Math.cos(pitch), cs * Math.sin(pitch));
}

/** Một xương của bộ xương: đối tượng, quay lúc nghỉ (cục bộ và thế giới) và hướng tới xương con. */
interface RigBone {
  object: THREE.Object3D;
  restLocal: THREE.Quaternion;
  restWorld: THREE.Quaternion;
  /** Hướng tới xương tiếp theo dọc theo chi, trong hệ trục riêng của xương. */
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

/** Các đoạn chi mà tư thế có thể hướng tới một hướng thế giới cụ thể thay cho góc pitch/splay. */
export type AimBone =
  | 'LeftArm'
  | 'LeftForeArm'
  | 'RightArm'
  | 'RightForeArm'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'RightUpLeg'
  | 'RightLeg';

/** Tư thế mà góc pitch/splay không diễn tả được (nằm): xoay thế giới cho thân và hướng cụ thể cho các chi. */
export interface PoseOverride {
  /** Vị trí hông tính bằng mét trong hệ trục của nhân vật (chân ở 0). */
  hipsPosition?: readonly [number, number, number];
  /** Các góc xoay thế giới bổ sung theo từng xương, áp dụng theo thứ tự từ hông ra ngoài. */
  rotations?: Partial<Record<'Hips' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head', THREE.Quaternion>>;
  aims?: Partial<Record<AimBone, THREE.Vector3>>;
  /** Góc xoay thế giới áp dụng lên hướng nghỉ của mỗi bàn chân; bỏ qua để giữ bàn chân phẳng và hướng về trước. */
  footTurn?: THREE.Quaternion;
}

/** Tùy chọn retarget: khóa chân xuống đất bằng cách dời hông (tắt khi ngồi) và độ cao hông. */
export interface RetargetOptions {
  /** Giữ bàn chân thấp hơn chạm đất bằng cách dời hông; tắt cho các tư thế ngồi. */
  groundLock: boolean;
  /** Độ cao hông tính bằng mét khi `groundLock` tắt (ví dụ ngồi trên xe đạp). */
  hipsHeight?: number;
}

/**
 * Bộ xương đã chuẩn bị để retarget: gốc, các xương được điều khiển, hông, vị trí hông lúc nghỉ và các tham số
 * hệ trục.
 */
export interface RetargetRig {
  root: THREE.Object3D;
  bones: Map<DrivenBone, RigBone>;
  hips: THREE.Object3D;
  /** Vị trí hông lúc nghỉ trong hệ trục của nhân vật (+Y hướng lên), theo đơn vị mô hình. */
  hipsRestModel: THREE.Vector3;
  /** Góc xoay từ không gian cha của hông (xương gốc xoay 90° theo kiểu Blender) sang hệ trục của nhân vật. */
  hipsParent: THREE.Quaternion;
  /** Độ cao mắt cá thấp nhất so với hông lúc nghỉ, theo đơn vị mô hình. */
  restAnkleRel: number;
  modelScale: number;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Quay thế giới của một nút (nhân các quaternion từ nút lên tới gốc). */
function worldOf(object: THREE.Object3D, root?: THREE.Object3D): THREE.Quaternion {
  const result = new THREE.Quaternion();
  for (let node: THREE.Object3D | null = object; node && node !== root; node = node.parent) {
    result.premultiply(node.quaternion);
  }
  return result;
}

/** Chuẩn bị bộ retarget từ một mô hình vừa nhân bản còn ở tư thế nghỉ; thiếu xương cần thiết thì trả null. */
export function createRetargetRig(model: THREE.Object3D, modelScale: number): RetargetRig | null {
  const bones = new Map<DrivenBone, RigBone>();
  for (const name of DRIVEN) {
    const object = model.getObjectByName(HUMAN_BONES[name]);
    if (!object) return null;
    bones.set(name, {
      object,
      restLocal: object.quaternion.clone(),
      restWorld: worldOf(object, model),
    });
  }
  for (const [name, next] of Object.entries(NEXT) as [DrivenBone, DrivenBone][]) {
    const bone = bones.get(name)!;
    bone.childDir = bones.get(next)!.object.position.clone().normalize();
  }
  const hips = bones.get('Hips')!.object;
  const hipsParent = hips.parent ? worldOf(hips.parent, model) : new THREE.Quaternion();
  const rig: RetargetRig = {
    root: model,
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

/** Độ cao mắt cá của chân thấp nhất so với hông (đơn vị mô hình), cho quay thế giới của từng xương. */
function lowestAnkleRel(rig: RetargetRig, worlds: Map<THREE.Object3D, THREE.Quaternion>): number {
  let lowest = Infinity;
  for (const side of ['Left', 'Right'] as const) {
    const ankle = rig.bones.get(`${side}Foot` as DrivenBone)!.object;
    const path: THREE.Object3D[] = [];
    for (let node: THREE.Object3D | null = ankle; node && node !== rig.hips; node = node.parent) path.push(node);
    const position = new THREE.Vector3();
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i]!;
      const parentWorld = node.parent ? (worlds.get(node.parent) ?? worldOf(node.parent, rig.root)) : new THREE.Quaternion();
      position.add(node.position.clone().applyQuaternion(parentWorld));
    }
    lowest = Math.min(lowest, position.y);
  }
  return lowest;
}

const quat = new THREE.Quaternion();
const delta = new THREE.Quaternion();

/** Ghi góc xoay của các xương (và độ cao hông) cho `pose` trong hệ trục riêng của nhân vật (`rig.root`). */
export function applyRetargetPose(
  rig: RetargetRig,
  pose: HumanPoseAngles,
  options: RetargetOptions,
  forearmRoll?: Partial<Record<'left' | 'right', number>>,
  timeSec = 0,
  override?: PoseOverride,
): void {
  const worlds = new Map<THREE.Object3D, THREE.Quaternion>();
  worlds.set(rig.root, new THREE.Quaternion());
  // Lấy quay thế giới của xương (xương chưa được điều khiển thì lấy quay nghỉ cộng quay của cha).
  const worldOfBone = (object: THREE.Object3D): THREE.Quaternion => {
    const known = worlds.get(object);
    if (known) return known;
    // Chưa được điều khiển (xương cha nằm bên trong `rig.root`): giữ góc xoay nghỉ cộng với góc xoay của cha.
    const parent = object.parent && object.parent !== rig.root ? worldOfBone(object.parent) : new THREE.Quaternion();
    const result = parent.clone().multiply(object.quaternion);
    worlds.set(object, result);
    return result;
  };

  // Quay thế giới của nút cha của một xương.
  const parentWorld = (bone: RigBone) =>
    bone.object.parent ? worldOfBone(bone.object.parent) : new THREE.Quaternion();

  /** Xoay một xương quanh các trục thế giới qua khớp, chồng lên chuyển động của xương cha. */
  const rotate = (name: DrivenBone, d: THREE.Quaternion) => {
    const bone = rig.bones.get(name)!;
    const pw = parentWorld(bone);
    const local = pw.clone().invert().multiply(d).multiply(pw).multiply(bone.restLocal);
    bone.object.quaternion.copy(local);
    worlds.set(bone.object, pw.clone().multiply(local));
  };

  /** Hướng đoạn chi tới `target` (phép xoay ngắn nhất tính từ vị trí xương cha để lại). */
  const aim = (name: DrivenBone, target: THREE.Vector3) => {
    const bone = rig.bones.get(name)!;
    const pw = parentWorld(bone);
    const base = pw.clone().multiply(bone.restLocal);
    const current = bone.childDir!.clone().applyQuaternion(base);
    rotate(name, delta.setFromUnitVectors(current, target.clone().normalize()));
  };

  // Xoay quanh một trục cho trước một góc.
  const axis = (a: THREE.Vector3, angle: number) => quat.clone().setFromAxisAngle(a, angle);
  const extra = override?.rotations;

  // Nhịp bước: xương chậu xoay về phía chân trụ bước trước còn lồng ngực xoay ngược lại,
  // giúp dáng đi hoặc chạy tự nhiên như người thật thay vì hai chân gắn cứng trên trụ.
  const stride = pose.leftHipPitch - pose.rightHipPitch;
  const twist = THREE.MathUtils.clamp(stride * 0.09, -0.16, 0.16);
  // Nhịp thở chậm và chuyển trọng tâm nhẹ để người đang đứng không bị đứng đơ.
  const breath = Math.sin(timeSec * 1.7) * 0.012;
  const sway = Math.sin(timeSec * 0.55) * 0.02;
  const look = Math.sin(timeSec * 0.31 + 1.3) * 0.1;

  // Thân trên: hông gánh 1/3 độ nghiêng và 1/4 độ xoắn trục; cột sống gánh phần còn lại.
  const lean = pose.torsoPitch;
  const axialTwist = pose.torsoTwist ?? 0;
  const hipsTurn = axis(X, lean * 0.35)
    .multiply(axis(Y, twist + axialTwist * 0.26))
    .multiply(axis(Z, sway));
  rotate('Hips', extra?.Hips ? extra.Hips.clone().multiply(hipsTurn) : hipsTurn);
  for (const name of ['Spine', 'Spine1', 'Spine2'] as const) {
    const turn = axis(X, (lean * 0.65) / 3 + breath / 3)
      .multiply(axis(Y, (-twist * 1.7 + axialTwist * 0.74) / 3))
      .multiply(axis(Z, -pose.torsoRoll / 3 - sway / 3));
    rotate(name, extra?.[name] ? extra[name]!.clone().multiply(turn) : turn);
  }
  const headExtra = lean * 0.5 + pose.headPitch - lean;
  rotate('Neck', (extra?.Neck ?? new THREE.Quaternion()).clone().multiply(axis(X, headExtra * 0.5)).multiply(axis(Y, (pose.headYaw + look) * 0.4)));
  rotate('Head', (extra?.Head ?? new THREE.Quaternion()).clone().multiply(axis(X, headExtra * 0.5)).multiply(axis(Y, (pose.headYaw + look) * 0.6)));

  // Phía trái của hình dựng bằng mã nằm ở -X, tương ứng phía phải (Right) của bộ xương.
  const arms = [
    {
      side: 'Right',
      clavicleSign: -1,
      shoulderPitch: pose.leftShoulderPitch,
      shoulderSplay: pose.leftShoulderSplay,
      elbowPitch: pose.leftElbowPitch,
      elbowSplay: pose.leftElbowSplay,
      roll: forearmRoll?.left,
    },
    {
      side: 'Left',
      clavicleSign: 1,
      shoulderPitch: pose.rightShoulderPitch,
      shoulderSplay: pose.rightShoulderSplay,
      elbowPitch: pose.rightElbowPitch,
      elbowSplay: pose.rightElbowSplay,
      roll: forearmRoll?.right,
    },
  ] as const;
  for (const arm of arms) {
    const upper = `${arm.side}Arm` as AimBone;
    const fore = `${arm.side}ForeArm` as AimBone;
    const upperDirection = override?.aims?.[upper] ?? limbDirection(arm.shoulderPitch, arm.shoulderSplay);
    if (override) {
      rotate(`${arm.side}Shoulder` as DrivenBone, new THREE.Quaternion());
    } else {
      // Nhịp bả vai - cánh tay tự nhiên (~24%): xương đòn nâng lên khi tay giơ quá ngang vai và đưa ra trước khi vươn tay.
      const elev = THREE.MathUtils.clamp((upperDirection.y + 0.35) * 0.24, -0.04, 0.32);
      const protract = THREE.MathUtils.clamp(upperDirection.z * 0.1, -0.08, 0.12);
      const clavTurn = axis(Z, arm.clavicleSign * elev).multiply(axis(Y, -arm.clavicleSign * protract));
      rotate(`${arm.side}Shoulder` as DrivenBone, clavTurn);
    }
    aim(upper, upperDirection);
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
    // Bàn chân: đặt phẳng khi nghỉ, nhấc mũi khi chân bước tới và nhấc gót khi đạp đẩy.
    const foot = rig.bones.get(`${leg.side}Foot` as DrivenBone)!;
    const pw = parentWorld(foot);
    const turn = override
      ? (override.footTurn ?? new THREE.Quaternion())
      : axis(X, THREE.MathUtils.clamp(-0.5 * leg.hipPitch, -0.3, 0.55));
    const target = turn.clone().multiply(foot.restWorld);
    foot.object.quaternion.copy(pw.clone().invert().multiply(target));
    worlds.set(foot.object, target);
  }

  // Xương hông nằm trong không gian đã xoay của xương gốc: biểu diễn vị trí đích trong hệ nhân vật rồi đổi ngược lại.
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
