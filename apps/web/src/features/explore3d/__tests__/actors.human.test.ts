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
let scale = 1;
let assets: HumanAssets;

beforeAll(async () => {
  male = await load(HUMAN_ASSET_URLS.male);
  female = await load(HUMAN_ASSET_URLS.female);
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
  const pose = solveHumanPose(def, timeSec, [0, 0, 0]).pose;
  applyRetargetPose(rig, pose, spec, spec.forearmRoll, timeSec, spec.override?.(getActorPhase(def, timeSec)));
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

  it('keeps the shell clear of the feet and the top clear of the hands', () => {
    const model = cloneSkinned(female) as THREE.Object3D;
    dressHuman(model, assets, { gender: 'female', palette, hairStyle: 'hair-long', outfit: { ...OUTFIT, sleeves: false, wristbands: false }, swimCap: false });
    const clothes = model.getObjectByName('sportswear') as THREE.SkinnedMesh;
    const position = clothes.geometry.getAttribute('position');
    let maxY = 0;
    let maxX = 0;
    for (let i = 0; i < position.count; i++) {
      maxY = Math.max(maxY, position.getY(i));
      maxX = Math.max(maxX, Math.abs(position.getX(i)));
    }
    // A tank top ends below the neck, and covers neither the arms nor the hands (no wristbands here).
    expect(maxY).toBeLessThan(1.5);
    expect(maxX).toBeLessThan(0.3);
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
