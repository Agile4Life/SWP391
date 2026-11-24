import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { dressHuman, relaxHands, type HumanAssets } from '../renderers/actors/humanAppearance';
import { benchPress } from '../renderers/actors/humanPoses';
import {
  HUMAN_BONES,
  applyRetargetPose,
  createRetargetRig,
  limbDirection,
  type DrivenBone,
} from '../renderers/actors/humanRetarget';
import {
  buildLiveActorDefinitions,
  solveHumanPose,
  type ActorActivityKind,
  type LiveActorDefinition,
} from '../renderers/actors/liveActorsConfig';
import {
  HUMAN_ASSET_URLS,
  HUMAN_CLIP_ACTIVITIES,
  HUMAN_HEIGHT,
  HUMAN_POSE_ACTIVITIES,
  getActorPhase,
} from '../renderers/actors/riggedActors';
import {
  createRiggedInstance,
  placeInstance,
  prepareCharacterClip,
  stepInstance,
} from '../canvas/riggedInstance';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';

const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);

// Đọc phần JSON của một file GLB.
function readGlbJson(url: string): { animations?: { name: string }[]; nodes?: { name?: string }[] } {
  const data = readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
  const jsonLength = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
}

// Tải một mô hình GLB.
async function load(url: string): Promise<THREE.Object3D> {
  const data = readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  // Texture không thể giải mã trong môi trường Node; các kiểm thử này chỉ cần hình học và bộ xương.
  const gltf = await new Promise<{ scene: THREE.Object3D }>((ok, fail) =>
    new GLTFLoader().parse(buffer as ArrayBuffer, '', ok as never, fail),
  );
  return gltf.scene;
}

let male: THREE.Object3D;
let female: THREE.Object3D;
let clips: THREE.AnimationClip[];
let scale = 1;
let assets: HumanAssets;

beforeAll(async () => {
  male = await load(HUMAN_ASSET_URLS.male);
  female = await load(HUMAN_ASSET_URLS.female);
  const animBuf = readFileSync(resolve(process.cwd(), 'public', HUMAN_ASSET_URLS.animations.replace(/^\//, '')));
  const animAb = animBuf.buffer.slice(animBuf.byteOffset, animBuf.byteOffset + animBuf.byteLength);
  const animGltf = await new Promise<{ animations: THREE.AnimationClip[] }>((ok, fail) =>
    new GLTFLoader().parse(animAb as ArrayBuffer, '', ok as never, fail),
  );
  clips = animGltf.animations;
  const hair: Record<string, THREE.Object3D> = {};
  for (const [name, url] of Object.entries(HUMAN_ASSET_URLS.hair)) hair[name] = await load(url);
  scale = HUMAN_HEIGHT / new THREE.Box3().setFromObject(male).getSize(new THREE.Vector3()).y;
  assets = {
    characters: { male, female },
    hair,
    skinLight: { male: new THREE.Texture(), female: new THREE.Texture() },
  };
});

// Tìm nhân vật có hoạt động cho trước.
function actorFor(activity: ActorActivityKind): LiveActorDefinition {
  return defs.find(d => d.activity === activity) ?? { ...defs[0]!, id: `fixture-${activity}`, activity };
}

// Đặt tư thế cho mô hình tại một thời điểm.
function poseModel(def: LiveActorDefinition, timeSec: number) {
  const model = cloneSkinned(male) as THREE.Object3D;
  model.scale.setScalar(scale);
  const rig = createRetargetRig(model, scale)!;
  const spec = HUMAN_POSE_ACTIVITIES[def.activity]!;
  const phase = getActorPhase(def, timeSec);
  const pose = solveHumanPose(def, timeSec, [0, 0, 0]).pose;
  const roll = typeof spec.forearmRoll === 'function' ? spec.forearmRoll(phase) : spec.forearmRoll;
  applyRetargetPose(rig, pose, spec, roll, timeSec, spec.override?.(phase));
  model.updateMatrixWorld(true);
  // Vị trí thế giới của một xương.
  const at = (name: DrivenBone) => model.getObjectByName(HUMAN_BONES[name])!.getWorldPosition(new THREE.Vector3());
  return { model, rig, pose, at };
}

describe('packed Quaternius assets', () => {
  it('has every clip the activity table asks for', () => {
    const clips = new Set((readGlbJson(HUMAN_ASSET_URLS.animations).animations ?? []).map(a => a.name));
    for (const [activity, spec] of Object.entries(HUMAN_CLIP_ACTIVITIES)) {
      const names = typeof spec.clip === 'function' ? [spec.clip('a'), spec.clip('b'), spec.clip('ab')] : [spec.clip];
      for (const name of names) expect(clips.has(name), `${activity} -> ${name}`).toBe(true);
    }
  });

  it('shares one rig between both bodies and every clip target', () => {
    const clipNodes = new Set((readGlbJson(HUMAN_ASSET_URLS.animations).nodes ?? []).map(n => n.name));
    for (const body of [male, female]) {
      for (const bone of Object.values(HUMAN_BONES)) {
        expect(body.getObjectByName(bone), bone).toBeTruthy();
        expect(clipNodes.has(bone), `animations lack ${bone}`).toBe(true);
      }
    }
    for (const spec of Object.values(HUMAN_POSE_ACTIVITIES)) {
      if (spec.handProp) expect(male.getObjectByName(spec.handProp.bone), spec.handProp.bone).toBeTruthy();
    }
  });

  it('stands about as tall as a person', () => {
    const height = new THREE.Box3().setFromObject(male).getSize(new THREE.Vector3()).y;
    expect(height * scale).toBeCloseTo(HUMAN_HEIGHT, 3);
  });
});

describe('pose-driven skeleton', () => {
  it('never produces invalid rotations, for every pose activity over time', () => {
    for (const activity of Object.keys(HUMAN_POSE_ACTIVITIES) as ActorActivityKind[]) {
      for (const t of [0, 0.7, 1.9, 4.3, 11]) {
        const { model } = poseModel(actorFor(activity), t);
        model.traverse(object => {
          for (const value of [...object.quaternion.toArray(), ...object.position.toArray()]) {
            expect(Number.isFinite(value), `${activity} @${t} ${object.name}`).toBe(true);
          }
        });
      }
    }
  });

  it('keeps the lower foot on the floor for standing activities', () => {
    const rest = poseModel(actorFor('receptionist-greet'), 0).rig.restAnkleRel;
    expect(rest).toBeLessThan(0);
    for (const activity of ['barbell-squat', 'dumbbell-curl', 'tennis-player', 'badminton-player', 'yoga-flow', 'receptionist-greet'] as const) {
      for (const t of [0, 0.4, 0.9, 1.6, 3.1]) {
        const { at } = poseModel(actorFor(activity), t);
        const lowest = Math.min(at('LeftFoot').y, at('RightFoot').y);
        // Cổ chân nằm cao hơn mặt sàn khoảng 8,6 cm trong rig.
        expect(Math.abs(lowest - 0.086 * scale), `${activity} @${t}`).toBeLessThan(0.02);
      }
    }
  });

  it('aims each limb segment along the pose angles', () => {
    const def = actorFor('tennis-player');
    const { at, pose } = poseModel(def, 1.3);
    // Bên trái của hình nhân dựng bằng code tương ứng với bên phải (Right) của rig.
    const upper = at('RightForeArm').sub(at('RightArm')).normalize();
    const fore = at('RightHand').sub(at('RightForeArm')).normalize();
    expect(upper.dot(limbDirection(pose.leftShoulderPitch, pose.leftShoulderSplay))).toBeGreaterThan(0.99);
    expect(fore.dot(limbDirection(pose.leftElbowPitch, pose.leftElbowSplay))).toBeGreaterThan(0.99);
    const thigh = at('RightLeg').sub(at('RightUpLeg')).normalize();
    expect(thigh.dot(limbDirection(pose.leftHipPitch, pose.leftHipSplay))).toBeGreaterThan(0.99);
  });

  it('seats cyclists at saddle height', () => {
    const { at } = poseModel(actorFor('upright-bike'), 1.1);
    expect(at('Hips').y).toBeCloseTo(0.93, 1);
    expect(at('LeftFoot').y).toBeLessThan(at('LeftLeg').y);
    expect(at('Head').y).toBeGreaterThan(at('Hips').y + 0.4);
  });

  it('bench press: lies on the bench, head toward +Z, bar rises, hands stay wide', () => {
    const def = actorFor('bench-press');
    // Pha tương ứng một mức nâng (nghịch đảo của 0,5 − 0,5 cos).
    const phaseAt = (rise: number) => Math.acos(1 - 2 * rise); // nghịch đảo của 0,5 - 0,5 cos
    // Lấy mẫu tư thế tại một mức nâng.
    const sample = (rise: number) => {
      const model = cloneSkinned(male) as THREE.Object3D;
      model.scale.setScalar(scale);
      const rig = createRetargetRig(model, scale)!;
      applyRetargetPose(rig, solveHumanPose(def, 0, [0, 0, 0]).pose, { groundLock: false }, undefined, 0, benchPress(phaseAt(rise)));
      model.updateMatrixWorld(true);
      return (name: DrivenBone) => model.getObjectByName(HUMAN_BONES[name])!.getWorldPosition(new THREE.Vector3());
    };
    const top = sample(1);
    const bottom = sample(0);
    expect(Math.abs(top('Head').y - top('Hips').y)).toBeLessThan(0.35);
    expect(top('Head').z).toBeGreaterThan(top('Hips').z + 0.4);
    expect(top('LeftFoot').z).toBeLessThan(top('Hips').z - 0.3);
    expect(top('LeftHand').y).toBeGreaterThan(bottom('LeftHand').y + 0.15);
    for (const pose of [top, bottom]) {
      expect(pose('LeftHand').x).toBeCloseTo(-pose('RightHand').x, 3);
      expect(Math.abs(pose('LeftHand').x)).toBeGreaterThan(0.3);
      expect(Math.abs(pose('LeftHand').x)).toBeLessThan(0.6);
    }
  });
});

describe('human appearance', () => {
  const OUTFIT = { sleeves: true, crop: false, leggings: false, stripe: true, wristbands: true, headband: true };
  const palette = { skin: '#d9a679', hair: '#222222', top: '#3366ff', bottom: '#aa3333', shoe: '#ffffff', accent: '#00ff00' };

  it('dresses a character: sportswear shell and a hairstyle on the head', () => {
    const model = cloneSkinned(male) as THREE.Object3D;
    dressHuman(model, assets, { gender: 'male', palette, hairStyle: 'hair-simpleparted', outfit: OUTFIT, swimCap: false });
    const clothes = model.getObjectByName('sportswear') as THREE.SkinnedMesh;
    expect(clothes.isSkinnedMesh).toBe(true);
    const count = clothes.geometry.getAttribute('position').count;
    expect(count).toBeGreaterThan(3000);
    // Áo, quần short, giày, đế giày, tất, viền, cạp quần và sọc: tối thiểu khoảng một tá màu khác nhau
    // (bề mặt vải cũng có biến thiên nhẹ giữa các tam giác).
    const colours = new Set<string>();
    const colour = clothes.geometry.getAttribute('color');
    for (let i = 0; i < count; i += 3) colours.add(new THREE.Color(colour.getX(i), colour.getY(i), colour.getZ(i)).getHexString());
    expect(colours.size).toBeGreaterThan(12);
    // Các đường viền dùng màu nhấn, chỉ sáng hoặc tối hơn đôi chút theo vân vải.
    const accent = new THREE.Color(palette.accent);
    let trimmed = 0;
    for (let i = 0; i < count; i += 3) {
      const c = new THREE.Color(colour.getX(i), colour.getY(i), colour.getZ(i));
      if (c.g > c.r * 1.5 && c.g > c.b * 1.5 && accent.g > 0.5) trimmed++;
    }
    expect(trimmed).toBeGreaterThan(100);
    // Tóc được gắn theo xương đầu.
    expect(model.getObjectByName('Head')!.getObjectByName('hair')).toBeTruthy();
  });

  it('keeps the female tank top strictly on the female torso without spilling onto upper arms or throat', () => {
    const model = cloneSkinned(female) as THREE.Object3D;
    dressHuman(model, assets, {
      gender: 'female',
      palette,
      hairStyle: 'hair-long',
      outfit: { ...OUTFIT, sleeves: false, wristbands: false, headband: false },
      swimCap: false,
    });
    const clothes = model.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const position = clothes.geometry.getAttribute('position');
    let maxY = 0;
    let maxUpperBodyX = 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const ax = Math.abs(position.getX(i));
      maxY = Math.max(maxY, y);
      if (y > 1.05) maxUpperBodyX = Math.max(maxUpperBodyX, ax);
    }
    // Ở mô hình nữ, neck_01 nằm tại y = 1.485 và upperarm_l bắt đầu tại x = 0.152.
    expect(maxY).toBeLessThan(1.47);
    expect(maxUpperBodyX).toBeLessThan(0.175);
  });

  it('keeps loose shorts from self-intersecting across the inner-thigh midline', () => {
    const src = (male.getObjectByName('SuperHero_Male') as THREE.SkinnedMesh).geometry.getAttribute('position');
    const model = cloneSkinned(male) as THREE.Object3D;
    dressHuman(model, assets, {
      gender: 'male',
      palette,
      hairStyle: 'hair-simpleparted',
      outfit: { ...OUTFIT, leggings: false },
      swimCap: false,
    });
    const clothes = model.getObjectByName('sportswear') as THREE.SkinnedMesh;
    // So sánh các đỉnh vùng đùi bên dưới đáy quần (0.68..0.84), nơi hai ống chân tách biệt nhau.
    const pos = clothes.geometry.getAttribute('position');
    let minAbsLegX = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0.69 && y <= 0.82) minAbsLegX = Math.min(minAbsLegX, Math.abs(pos.getX(i)));
    }
    expect(src.count).toBeGreaterThan(1000);
    // Hai ống quần short phải có khoảng tách rõ ràng, không cắt chéo qua trục x = 0.
    expect(minAbsLegX).toBeGreaterThan(0.004);
  });

  it('gives swimmers sleek barefoot swimwear without sneakers, socks, or baggy shirts', () => {
    const maleSwimmer = cloneSkinned(male) as THREE.Object3D;
    dressHuman(maleSwimmer, assets, {
      gender: 'male',
      palette,
      hairStyle: 'hair-buzzed',
      outfit: OUTFIT,
      swimCap: true,
      wear: 'swim',
    });
    const trunks = maleSwimmer.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const mPos = trunks.geometry.getAttribute('position');
    let mMinY = Infinity;
    let mMaxY = -Infinity;
    for (let i = 0; i < mPos.count; i++) {
      mMinY = Math.min(mMinY, mPos.getY(i));
      mMaxY = Math.max(mMaxY, mPos.getY(i));
    }
    // Quần bơi ôm đùi nằm giữa đầu gối và thắt lưng: chân trần (không giày/tất) và ngực trần.
    expect(mMinY).toBeGreaterThan(0.55);
    expect(mMaxY).toBeLessThan(1.06);

    const femaleSwimmer = cloneSkinned(female) as THREE.Object3D;
    dressHuman(femaleSwimmer, assets, {
      gender: 'female',
      palette,
      hairStyle: 'hair-buzzedfemale',
      outfit: OUTFIT,
      swimCap: true,
      wear: 'swim',
    });
    const suit = femaleSwimmer.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const fPos = suit.geometry.getAttribute('position');
    let fMinY = Infinity;
    let fMaxY = -Infinity;
    for (let i = 0; i < fPos.count; i++) {
      fMinY = Math.min(fMinY, fPos.getY(i));
      fMaxY = Math.max(fMaxY, fPos.getY(i));
    }
    // Đồ bơi liền thân che từ hông tới dây vai, để trần từ đùi trên xuống chân.
    expect(fMinY).toBeGreaterThan(0.78);
    expect(fMaxY).toBeGreaterThan(1.36);
    expect(fMaxY).toBeLessThan(1.47);
  });

  it('keeps yoga and InBody participants barefoot while giving staff full-length pants and shoes', () => {
    const yogi = cloneSkinned(female) as THREE.Object3D;
    dressHuman(yogi, assets, {
      gender: 'female',
      palette,
      hairStyle: 'hair-buns',
      outfit: { ...OUTFIT, sleeves: false, crop: true, leggings: true },
      swimCap: false,
      wear: 'barefoot',
    });
    const yogiPos = (yogi.getObjectByName('sportswear') as THREE.SkinnedMesh).geometry.getAttribute('position');
    let yogiMinY = Infinity;
    for (let i = 0; i < yogiPos.count; i++) yogiMinY = Math.min(yogiMinY, yogiPos.getY(i));
    expect(yogiMinY).toBeGreaterThan(0.18);

    const coach = cloneSkinned(male) as THREE.Object3D;
    dressHuman(coach, assets, {
      gender: 'male',
      palette,
      hairStyle: 'hair-simpleparted',
      outfit: OUTFIT,
      swimCap: false,
      wear: 'staff',
      beard: true,
    });
    const coachClothes = coach.getObjectByName('sportswear') as THREE.SkinnedMesh;
    expect(coachClothes.geometry.getAttribute('aRoughness')).toBeTruthy();
    expect(coach.getObjectByName('Head')!.getObjectByName('hair')!.children.length).toBeGreaterThanOrEqual(2);

    // Lưới cơ thể bên dưới ẩn các tam giác nằm sâu trong trang phục đục để tránh xuyên khớp.
    const rawBody = male.getObjectByName('SuperHero_Male') as THREE.SkinnedMesh;
    const dressedBody = coach.getObjectByName('SuperHero_Male') as THREE.SkinnedMesh;
    expect(dressedBody.geometry.getIndex()!.count).toBeLessThan(rawBody.geometry.getIndex()!.count * 0.75);
  });

  it('shares geometry between actors with the same outfit', () => {
    // Tạo mô hình mới để thử.
    const make = () => {
      const model = cloneSkinned(male) as THREE.Object3D;
      dressHuman(model, assets, { gender: 'male', palette, hairStyle: 'hair-buzzed', outfit: OUTFIT, swimCap: false });
      return (model.getObjectByName('sportswear') as THREE.SkinnedMesh).geometry;
    };
    expect(make()).toBe(make());
  });

  it('bends the fingers, more for a grip than for a relaxed hand', () => {
    const relaxed = cloneSkinned(male) as THREE.Object3D;
    const fist = cloneSkinned(male) as THREE.Object3D;
    relaxHands(relaxed, 1);
    relaxHands(fist, 2);
    // Góc xoay của một mô hình.
    const angle = (model: THREE.Object3D) =>
      model.getObjectByName('index_02_l')!.quaternion.angleTo(male.getObjectByName('index_02_l')!.quaternion);
    expect(angle(relaxed)).toBeGreaterThan(0.2);
    expect(angle(fist)).toBeGreaterThan(angle(relaxed) * 1.5);
  });
});

describe('clip retargeting, hand props & role instances', () => {
  it('preserves female shoulder & limb proportions instead of stretching +55% during mocap clips', () => {
    const fRestLen = female.getObjectByName('upperarm_l')!.position.length();
    const walkRaw = clips.find(c => c.name === 'Walk_Loop')!;
    const fModel = cloneSkinned(female) as THREE.Object3D;
    const walkRetargeted = prepareCharacterClip(walkRaw, fModel, 'female');
    const mixer = new THREE.AnimationMixer(fModel);
    mixer.clipAction(walkRetargeted).play();
    mixer.update(0.25);
    fModel.updateMatrixWorld(true);
    expect(fModel.getObjectByName('upperarm_l')!.position.length()).toBeCloseTo(fRestLen, 4);
  });

  it('aligns dumbbell bar and racket shaft along the anatomical palm grip axis (+Z) rather than impaling the palm', () => {
    const curler = createRiggedInstance(actorFor('dumbbell-curl'), { humans: assets, clips })!;
    const handL = curler.holder.getObjectByName('hand_l')!;
    const dumbbell = handL.getObjectByName('rigged-hand-prop-dumbbell')!;
    expect(dumbbell).toBeTruthy();
    const bbox = new THREE.Box3().setFromObject(dumbbell);
    // Chuyển các góc hộp bao tạ tay sang không gian cục bộ của hand_l: trục dài nhất phải là Z (ngang qua các ngón tay), không phải X (xuyên qua lòng bàn tay).
    const pMin = handL.worldToLocal(bbox.min.clone());
    const pMax = handL.worldToLocal(bbox.max.clone());
    const spanX = Math.abs(pMax.x - pMin.x);
    const spanZ = Math.abs(pMax.z - pMin.z);
    expect(spanZ).toBeGreaterThan(spanX * 1.8);

    const badminton = createRiggedInstance(actorFor('badminton-player'), { humans: assets, clips })!;
    const bHandL = badminton.holder.getObjectByName('hand_l')!;
    const racket = bHandL.getObjectByName('rigged-hand-prop-racket')!;
    expect(racket).toBeTruthy();
    // Mặt vợt (children[1]) trong không gian hand_l phải vươn chủ yếu theo chiều +Z (phía ngón cái/ngón trỏ của nắm tay), không hướng thẳng ra đầu ngón tay +Y.
    badminton.holder.updateMatrixWorld(true);
    const headLocal = bHandL.worldToLocal(racket.children[1]!.getWorldPosition(new THREE.Vector3()));
    expect(headLocal.z).toBeGreaterThan(0.22);
    expect(headLocal.z).toBeGreaterThan(Math.abs(headLocal.y));
  });

  it('equips boxers with padded gloves on both hands, dresses swimmers/staff/yogis by role, and seats sofa lounge actor', () => {
    const boxer = createRiggedInstance(actorFor('boxing-spar'), { humans: assets, clips })!;
    expect(boxer.holder.getObjectByName('hand_l')!.getObjectByName('rigged-hand-prop-boxing-glove')).toBeTruthy();
    expect(boxer.holder.getObjectByName('hand_r')!.getObjectByName('rigged-hand-prop-boxing-glove')).toBeTruthy();

    // Cập nhật nhân vật đấm bốc qua nhiều giây vẫn giữ phép biến đổi hợp lệ và luân phiên các tổ hợp đấm.
    for (let t = 0; t < 3.2; t += 0.25) {
      const pose = placeInstance(boxer, SOL_CENTER_SCENE, 'stacked', 'ALL', t);
      stepInstance(boxer, 0.25, pose, t);
    }

    const swimmer = createRiggedInstance(actorFor('swim-freestyle'), { humans: assets, clips })!;
    const swimClothes = swimmer.holder.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const swimPos = swimClothes.geometry.getAttribute('position');
    let swimMinY = Infinity;
    for (let i = 0; i < swimPos.count; i++) swimMinY = Math.min(swimMinY, swimPos.getY(i));
    // Đồ bơi chân trần: không có giày ở vùng y < 0.12.
    expect(swimMinY).toBeGreaterThan(0.5);

    const sofaMember = { ...actorFor('lounge-chat'), id: 'actor-l2-lounge-member-1' };
    const sofaInst = createRiggedInstance(sofaMember, { humans: assets, clips })!;
    const pose = placeInstance(sofaInst, SOL_CENTER_SCENE, 'stacked', 'ALL', 1.0);
    stepInstance(sofaInst, 0.1, pose, 1.0);
    sofaInst.holder.updateMatrixWorld(true);
    const pelvisWorld = sofaInst.holder.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
    // Cao độ tầng L2 là 5,46 m (so sánh tương đối theo holder.position.y).
    expect(pelvisWorld.y - sofaInst.holder.position.y).toBeLessThan(0.65);
    expect(pelvisWorld.y - sofaInst.holder.position.y).toBeGreaterThan(0.42);
  });

  it('turns patrol walkers smoothly around endpoints instead of snapping 180° in a single frame', () => {
    const walker = actorFor('walking-patrol');
    let maxStepDelta = 0;
    let prevYaw: number | null = null;
    // Lấy mẫu dày trên trọn một chu kỳ tuần tra đi và về.
    for (let t = 0; t <= 18; t += 0.05) {
      const { yaw } = solveHumanPose(walker, t, [0, 0, 0]);
      if (prevYaw !== null) {
        const diff = Math.abs(Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw)));
        maxStepDelta = Math.max(maxStepDelta, diff);
      }
      prevYaw = yaw;
    }
    expect(maxStepDelta).toBeLessThan(0.65);
  });
});

describe('biomechanical poses & machine alignment', () => {
  it('elevates clavicles naturally when arms reach overhead in yoga', () => {
    const yogi = actorFor('yoga-flow');
    // So sánh độ cao khớp vai giữa pha hạ tay và pha giơ tay quá đầu.
    let minArmY = Infinity;
    let maxArmY = -Infinity;
    for (const t of [0, 1.2, 2.4, 3.6, 4.8, 6.0]) {
      const { at } = poseModel(yogi, t);
      const rel = at('LeftArm').y - at('Spine2').y;
      minArmY = Math.min(minArmY, rel);
      maxArmY = Math.max(maxArmY, rel);
    }
    expect(maxArmY - minArmY).toBeGreaterThan(0.025);
  });

  it('places the barbell behind the neck on the upper traps during barbell squats instead of floating in front of the chest', () => {
    const lifter = actorFor('barbell-squat');
    const inst = createRiggedInstance(lifter, { humans: assets, clips })!;
    for (const t of [0, 0.9, 1.8]) {
      const pose = placeInstance(inst, SOL_CENTER_SCENE, 'stacked', 'ALL', t);
      stepInstance(inst, 0, pose, t);
      inst.holder.updateMatrixWorld(true);
      const headLocal = inst.holder.worldToLocal(inst.holder.getObjectByName('Head')!.getWorldPosition(new THREE.Vector3()));
      const neckLocal = inst.holder.worldToLocal(inst.holder.getObjectByName('neck_01')!.getWorldPosition(new THREE.Vector3()));
      const barPos = inst.barbell!.bar.position;
      // Thanh tạ đặt sau đầu/cổ trên cơ cầu vai trên (`barPos.z < headLocal.z`), gần độ cao gốc cổ.
      expect(barPos.z, `squat bar behind head @${t}`).toBeLessThan(headLocal.z - 0.03);
      expect(Math.abs(barPos.y - neckLocal.y), `squat bar at trap height @${t}`).toBeLessThan(0.12);
    }
  });

  it('plants bench-press feet on the floor while seating hips flush on the bench pad', () => {
    const presser = actorFor('bench-press');
    // Điểm neo ghế tập có localOffset y = 0.46 trên mặt sàn; cổ chân trong hệ tọa độ cục bộ nhân vật phải nằm gần y = -0.37 (tọa độ thế giới ~0,09 m).
    const { at } = poseModel(presser, 0.5);
    expect(at('Hips').y).toBeLessThan(0.11);
    expect(at('LeftFoot').y).toBeLessThan(-0.32);
    expect(at('LeftFoot').y).toBeGreaterThan(-0.42);
  });

  it('drives upright-bike feet in a circular crank path and grips handlebars, while elliptical and InBody use aligned poses', () => {
    expect(HUMAN_POSE_ACTIVITIES['elliptical-stride']).toBeTruthy();
    expect(HUMAN_POSE_ACTIVITIES['inbody-scan']).toBeTruthy();

    // Xe đạp tập thẳng đứng: bàn chân phải thay đổi theo cả Y và Z (quỹ đạo đạp tròn) còn hai tay giữ phía trước trên tay lái.
    const cyclist = actorFor('upright-bike');
    const zs: number[] = [];
    const ys: number[] = [];
    for (let t = 0; t < 2.0; t += 0.25) {
      const { at } = poseModel(cyclist, t);
      zs.push(at('LeftFoot').z);
      ys.push(at('LeftFoot').y);
      expect(at('LeftHand').z).toBeGreaterThan(0.35);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.2);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.2);

    // Máy tập toàn thân elliptical: hai tay giữ ở mức cao trên tay cầm phía trên (`y > 1.15`).
    const ellip = actorFor('elliptical-stride');
    for (const t of [0, 0.6, 1.2]) {
      const { at } = poseModel(ellip, t);
      expect(at('LeftHand').y).toBeGreaterThan(1.15);
      expect(at('RightHand').y).toBeGreaterThan(1.15);
    }

    // Máy InBody: hai cánh tay dang khỏi thân để cầm điện cực ngón cái hai bên (`|hand.x| > 0.28`).
    const inbody = actorFor('inbody-scan');
    const { at: inAt } = poseModel(inbody, 0.5);
    expect(Math.abs(inAt('LeftHand').x)).toBeGreaterThan(0.28);
    expect(Math.abs(inAt('RightHand').x)).toBeGreaterThan(0.28);
  });

  it('times badminton and tennis racket swings to peak at baseline impact rather than when the ball is at the net', () => {
    const p1 = { ...actorFor('badminton-player'), id: 'actor-l1-badminton-p1' };
    // Quả cầu rời người chơi p1 (`z = -spanZ`) khi `(t * speed * 0.72 + phaseOffset / PI) % 2 === 0`.
    const tImpact = ((2 - (p1.phaseOffset / Math.PI) % 2) % 2) / (p1.speed * 0.72);
    const tAtNet = tImpact + 0.5 / (p1.speed * 0.72);
    const impactPose = solveHumanPose(p1, tImpact, [0, 0, 0]).pose;
    const netPose = solveHumanPose(p1, tAtNet, [0, 0, 0]).pose;
    expect(impactPose.rightShoulderPitch).toBeGreaterThan(netPose.rightShoulderPitch + 0.5);
  });

  it('keeps pose-driven skeleton local coordinates invariant to holder yaw rotation (no 180° inside-out twist)', () => {
    const cyclist = actorFor('upright-bike');
    const inst = createRiggedInstance(cyclist, { humans: assets, clips })!;
    const pose = solveHumanPose(cyclist, 1.1, [0, 0, 0]).pose;

    inst.holder.rotation.set(0, 0, 0);
    stepInstance(inst, 0, pose, 1.1);
    inst.holder.updateMatrixWorld(true);
    const footAtZero = inst.holder.worldToLocal(inst.holder.getObjectByName('foot_l')!.getWorldPosition(new THREE.Vector3()));
    const handAtZero = inst.holder.worldToLocal(inst.holder.getObjectByName('hand_l')!.getWorldPosition(new THREE.Vector3()));

    inst.holder.rotation.set(0, Math.PI, 0);
    stepInstance(inst, 0, pose, 1.1);
    inst.holder.updateMatrixWorld(true);
    const footAtPi = inst.holder.worldToLocal(inst.holder.getObjectByName('foot_l')!.getWorldPosition(new THREE.Vector3()));
    const handAtPi = inst.holder.worldToLocal(inst.holder.getObjectByName('hand_l')!.getWorldPosition(new THREE.Vector3()));

    expect(footAtPi.distanceTo(footAtZero)).toBeLessThan(1e-4);
    expect(handAtPi.distanceTo(handAtZero)).toBeLessThan(1e-4);
  });

  it('keeps white sportswear crisp instead of muddy grey and drapes untucked shirts cleanly over shorts', () => {
    const model = cloneSkinned(male) as THREE.Object3D;
    // Dữ liệu mẫu dùng trong các ca kiểm thử.
    const whiteKit = {
      skin: '#e0b18a',
      hair: '#1f1a17',
      top: '#f8fafc',
      bottom: '#1e293b',
      shoe: '#f8fafc',
      accent: '#ce9180',
    };
    dressHuman(model, assets, {
      gender: 'male',
      palette: whiteKit,
      hairStyle: 'hair-simpleparted',
      outfit: {
        sleeves: true,
        crop: false,
        leggings: false,
        stripe: true,
        wristbands: true,
        headband: true,
      },
      swimCap: false,
    });
    const clothes = model.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const pos = clothes.geometry.getAttribute('position');
    const col = clothes.geometry.getAttribute('color');

    let maxChestLuma = 0;
    let maxUntuckedHemR = 0;
    let maxUpperShortsR = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const x = pos.getX(i);
      if (y > 1.15 && y < 1.35 && z > 0.05) {
        const luma = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        maxChestLuma = Math.max(maxChestLuma, luma);
      }
      // Gấu áo bỏ ngoài quần (`y ~ 0.97..1.00`) phải phủ nhô ra nhẹ so với phần quần short ngay bên dưới (`y ~ 0.90..0.93`).
      if (Math.abs(x) < 0.06 && z > 0.06) {
        const r = Math.hypot(x, z);
        if (y >= 0.97 && y <= 1.0) maxUntuckedHemR = Math.max(maxUntuckedHemR, r);
        if (y >= 0.9 && y <= 0.93) maxUpperShortsR = Math.max(maxUpperShortsR, r);
      }
    }
    expect(maxChestLuma).toBeGreaterThan(0.72);
    expect(maxUntuckedHemR).toBeGreaterThan(maxUpperShortsR + 0.002);
  });

  it('does not instantiate removed sport actors in the Gym scene', () => {
    expect(defs.some(def => /tennis|badminton|swim|yoga|boxing/.test(def.activity))).toBe(false);
  });

  it('culls glute/back skin inside garments to prevent hip-bend poke-through, keeps tennis jerseys distinct from skin', () => {
    // 1. Người chơi tennis không được giữ lại tam giác da nào ở dải mông/chậu đã che kín (`y trong [0.75, 0.96], z < -0.04`).
    for (const activity of ['tennis-player', 'badminton-player', 'yoga-flow'] as const) {
      const def = actorFor(activity);
      const pid = def.id;
      const inst = createRiggedInstance(def, { humans: assets, clips })!;
      let bodyMesh: THREE.SkinnedMesh | undefined;
      inst.holder.traverse(obj => {
        const m = obj as THREE.SkinnedMesh;
        if (m.isSkinnedMesh && /^superhero/i.test(m.name)) bodyMesh = m;
      });
      expect(bodyMesh, `${pid} bodyMesh`).toBeDefined();
      const idx = bodyMesh!.geometry.getIndex()!;
      const pos = bodyMesh!.geometry.getAttribute('position');
      let coveredGluteSkinVerts = 0;
      for (let i = 0; i < idx.count; i++) {
        const vi = idx.getX(i);
        const y = pos.getY(vi);
        const z = pos.getZ(vi);
        if (y >= 0.76 && y <= 0.96 && z < -0.05) {
          coveredGluteSkinVerts++;
        }
      }
      expect(coveredGluteSkinVerts, `${pid} must cull covered glute skin triangles`).toBe(0);

      // Màu áo thể thao phải tách biệt rõ về mặt thị giác so với màu da (`khoảng cách RGB >= 0.20`).
      const clothes = inst.holder.getObjectByName('sportswear') as THREE.SkinnedMesh;
      const cPos = clothes.geometry.getAttribute('position');
      const cCol = clothes.geometry.getAttribute('color');
      const skinColor = new THREE.Color(def.palette.skin);
      let backTopSample: THREE.Color | null = null;
      for (let i = 0; i < cPos.count; i++) {
        if (cPos.getY(i) > 1.22 && cPos.getY(i) < 1.30 && cPos.getZ(i) < -0.04 && Math.abs(cPos.getX(i)) < 0.05) {
          backTopSample = new THREE.Color(cCol.getX(i), cCol.getY(i), cCol.getZ(i));
          break;
        }
      }
      expect(backTopSample, `${pid} back shirt sample`).not.toBeNull();
      const dist = Math.hypot(
        backTopSample!.r - skinColor.r,
        backTopSample!.g - skinColor.g,
        backTopSample!.b - skinColor.b,
      );
      expect(dist, `${pid} jersey must contrast against skin`).toBeGreaterThanOrEqual(0.2);
    }

  });
});
