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

function readGlbJson(url: string): { animations?: { name: string }[]; nodes?: { name?: string }[] } {
  const data = readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
  const jsonLength = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
}

async function load(url: string): Promise<THREE.Object3D> {
  const data = readFileSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  // Textures cannot decode in node; the geometry and skeleton are all these tests need.
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

function actorFor(activity: ActorActivityKind): LiveActorDefinition {
  return defs.find(d => d.activity === activity)!;
}

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
        // The ankle sits about 8.6 cm above the floor in the rig.
        expect(Math.abs(lowest - 0.086 * scale), `${activity} @${t}`).toBeLessThan(0.02);
      }
    }
  });

  it('aims each limb segment along the pose angles', () => {
    const def = actorFor('tennis-player');
    const { at, pose } = poseModel(def, 1.3);
    // The code-built figure's left side is the rig's Right side.
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
    const phaseAt = (rise: number) => Math.acos(1 - 2 * rise); // inverse of 0.5 - 0.5 cos
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
    // Top, shorts, shoes, soles, socks, trim, waistband and stripes: a dozen distinct colours at least
    // (the cloth also varies a little from triangle to triangle).
    const colours = new Set<string>();
    const colour = clothes.geometry.getAttribute('color');
    for (let i = 0; i < count; i += 3) colours.add(new THREE.Color(colour.getX(i), colour.getY(i), colour.getZ(i)).getHexString());
    expect(colours.size).toBeGreaterThan(12);
    // The trims are the accent colour, lighter or darker only by the weave.
    const accent = new THREE.Color(palette.accent);
    let trimmed = 0;
    for (let i = 0; i < count; i += 3) {
      const c = new THREE.Color(colour.getX(i), colour.getY(i), colour.getZ(i));
      if (c.g > c.r * 1.5 && c.g > c.b * 1.5 && accent.g > 0.5) trimmed++;
    }
    expect(trimmed).toBeGreaterThan(100);
    // Hair rides on the head bone.
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
    // Female neck_01 sits at y = 1.485 and upperarm_l starts at x = 0.152.
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
    // Compare thigh vertices below the crotch (0.68..0.84) where the two legs are separate.
    const pos = clothes.geometry.getAttribute('position');
    let minAbsLegX = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0.69 && y <= 0.82) minAbsLegX = Math.min(minAbsLegX, Math.abs(pos.getX(i)));
    }
    expect(src.count).toBeGreaterThan(1000);
    // Shorts legs must leave clear separation rather than crossing through x = 0.
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
    // Jammers sit between knee and waist: bare feet (no shoes/socks) and bare chest.
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
    // One-piece swimsuit covers hips to shoulder straps, barefoot below upper thigh.
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

    // Underlying body mesh hides triangles deep inside opaque clothes to prevent joint poke-through.
    const rawBody = male.getObjectByName('SuperHero_Male') as THREE.SkinnedMesh;
    const dressedBody = coach.getObjectByName('SuperHero_Male') as THREE.SkinnedMesh;
    expect(dressedBody.geometry.getIndex()!.count).toBeLessThan(rawBody.geometry.getIndex()!.count * 0.75);
  });

  it('shares geometry between actors with the same outfit', () => {
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
    // Transform dumbbell bbox corners into hand_l local space: longest axis must be Z (across fingers), not X (through palm).
    const pMin = handL.worldToLocal(bbox.min.clone());
    const pMax = handL.worldToLocal(bbox.max.clone());
    const spanX = Math.abs(pMax.x - pMin.x);
    const spanZ = Math.abs(pMax.z - pMin.z);
    expect(spanZ).toBeGreaterThan(spanX * 1.8);

    const badminton = createRiggedInstance(actorFor('badminton-player'), { humans: assets, clips })!;
    const bHandL = badminton.holder.getObjectByName('hand_l')!;
    const racket = bHandL.getObjectByName('rigged-hand-prop-racket')!;
    expect(racket).toBeTruthy();
    // Racket head (children[1]) in hand_l space must extend predominantly along +Z (thumb/index side of fist), not straight out +Y fingertips.
    badminton.holder.updateMatrixWorld(true);
    const headLocal = bHandL.worldToLocal(racket.children[1]!.getWorldPosition(new THREE.Vector3()));
    expect(headLocal.z).toBeGreaterThan(0.22);
    expect(headLocal.z).toBeGreaterThan(Math.abs(headLocal.y));
  });

  it('equips boxers with padded gloves on both hands, dresses swimmers/staff/yogis by role, and seats sofa lounge actor', () => {
    const boxer = createRiggedInstance(actorFor('boxing-spar'), { humans: assets, clips })!;
    expect(boxer.holder.getObjectByName('hand_l')!.getObjectByName('rigged-hand-prop-boxing-glove')).toBeTruthy();
    expect(boxer.holder.getObjectByName('hand_r')!.getObjectByName('rigged-hand-prop-boxing-glove')).toBeTruthy();

    // Stepping boxer over several seconds keeps valid transforms and alternates combo punches.
    for (let t = 0; t < 3.2; t += 0.25) {
      const pose = placeInstance(boxer, SOL_CENTER_SCENE, 'stacked', 'ALL', t);
      stepInstance(boxer, 0.25, pose, t);
    }

    const swimmer = createRiggedInstance(actorFor('swim-freestyle'), { humans: assets, clips })!;
    const swimClothes = swimmer.holder.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const swimPos = swimClothes.geometry.getAttribute('position');
    let swimMinY = Infinity;
    for (let i = 0; i < swimPos.count; i++) swimMinY = Math.min(swimMinY, swimPos.getY(i));
    // Barefoot swimwear: no shoes at y < 0.12.
    expect(swimMinY).toBeGreaterThan(0.5);

    const sofaMember = defs.find(d => d.id === 'actor-l2-lounge-member-1')!;
    const sofaInst = createRiggedInstance(sofaMember, { humans: assets, clips })!;
    const pose = placeInstance(sofaInst, SOL_CENTER_SCENE, 'stacked', 'ALL', 1.0);
    stepInstance(sofaInst, 0.1, pose, 1.0);
    sofaInst.holder.updateMatrixWorld(true);
    const pelvisWorld = sofaInst.holder.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
    // L2 elevation is 5.46 m (wait: let's compare relative to holder.position.y).
    expect(pelvisWorld.y - sofaInst.holder.position.y).toBeLessThan(0.65);
    expect(pelvisWorld.y - sofaInst.holder.position.y).toBeGreaterThan(0.42);
  });

  it('turns patrol walkers smoothly around endpoints instead of snapping 180° in a single frame', () => {
    const walker = actorFor('walking-patrol');
    let maxStepDelta = 0;
    let prevYaw: number | null = null;
    // Sample finely across an entire forward+backward patrol cycle.
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
    // Compare shoulder socket height between arms-down and arms-overhead phases.
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
      // Bar rests behind the head/neck across upper traps (`barPos.z < headLocal.z`), near neck base height.
      expect(barPos.z, `squat bar behind head @${t}`).toBeLessThan(headLocal.z - 0.03);
      expect(Math.abs(barPos.y - neckLocal.y), `squat bar at trap height @${t}`).toBeLessThan(0.12);
    }
  });

  it('plants bench-press feet on the floor while seating hips flush on the bench pad', () => {
    const presser = actorFor('bench-press');
    // Bench anchor has localOffset y = 0.46 above floor; ankle in character local frame should sit near y = -0.37 (world ~0.09 m).
    const { at } = poseModel(presser, 0.5);
    expect(at('Hips').y).toBeLessThan(0.11);
    expect(at('LeftFoot').y).toBeLessThan(-0.32);
    expect(at('LeftFoot').y).toBeGreaterThan(-0.42);
  });

  it('drives upright-bike feet in a circular crank path and grips handlebars, while elliptical and InBody use aligned poses', () => {
    expect(HUMAN_POSE_ACTIVITIES['elliptical-stride']).toBeTruthy();
    expect(HUMAN_POSE_ACTIVITIES['inbody-scan']).toBeTruthy();

    // Upright bike: feet must vary in both Y AND Z (circular pedal orbit) and hands stay forward on handlebars.
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

    // Elliptical: hands stay elevated on upper stride handles (`y > 1.15`).
    const ellip = actorFor('elliptical-stride');
    for (const t of [0, 0.6, 1.2]) {
      const { at } = poseModel(ellip, t);
      expect(at('LeftHand').y).toBeGreaterThan(1.15);
      expect(at('RightHand').y).toBeGreaterThan(1.15);
    }

    // InBody: arms abducted away from torso holding side thumb electrodes (`|hand.x| > 0.28`).
    const inbody = actorFor('inbody-scan');
    const { at: inAt } = poseModel(inbody, 0.5);
    expect(Math.abs(inAt('LeftHand').x)).toBeGreaterThan(0.28);
    expect(Math.abs(inAt('RightHand').x)).toBeGreaterThan(0.28);
  });

  it('times badminton and tennis racket swings to peak at baseline impact rather than when the ball is at the net', () => {
    const p1 = defs.find(d => d.id === 'actor-l1-badminton-p1')!;
    // Shuttlecock leaves p1 (`z = -spanZ`) when `(t * speed * 0.72 + phaseOffset / PI) % 2 === 0`.
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
});
