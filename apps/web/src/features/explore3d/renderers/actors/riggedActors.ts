import { useSyncExternalStore } from 'react';
import type { SceneDoc, Vec3 } from '../../scene/schema';
import type { RiggedHandPropSpec } from './riggedHandProps';
import type { LevelMode } from '../../state/exploreStore';
import {
  getActorWorldAnchor,
  solveHumanPose,
  type ActorActivityKind,
  type LiveActorDefinition,
} from './liveActorsConfig';

export type RiggedBoneName =
  | 'leg-left'
  | 'leg-right'
  | 'torso'
  | 'arm-left'
  | 'arm-right'
  | 'head';

/** Extra Euler rotation (radians, applied on top of the clip) per bone. */
export type RiggedBoneTweaks = Partial<Record<RiggedBoneName, readonly [number, number, number]>>;

export interface RiggedClipSpec {
  /** Animation clip name, or a pick per actor (e.g. left/right punches). */
  clip: string | ((actorId: string) => string);
  /** Multiplies the actor's own speed. */
  timeScale: number;
  /** Local offset (x right, y up, z forward, in the actor's yaw frame), e.g. to sit on a bike saddle. */
  offset?: readonly [number, number, number];
  /** Prop parented to a hand bone; replaces the procedural prop of the same activity. */
  handProp?: RiggedHandPropSpec;
  /** Optional procedural tweak layered over the clip each frame. */
  tweakBones?: (phase: number) => RiggedBoneTweaks;
}

/** Same phase the procedural solver uses, so both figures stay in step. */
export function getActorPhase(actor: LiveActorDefinition, timeSec: number): number {
  return timeSec * actor.speed * 3.2 + actor.phaseOffset;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Hand position and arm direction in the right-arm bone's space (model units). Measured
 * from the skin weights: the Kenney arm runs along the bone's -X axis, hand at about -0.25.
 */
const HAND_TIP = [-0.22, 0, 0] as const;
const ALONG_ARM = [0, 0, -Math.PI / 2] as const;

const punchClip = (actorId: string) =>
  hashString(actorId) % 2 === 0 ? 'attack-melee-right' : 'attack-melee-left';

/**
 * Activities drawn with a skinned, animated character instead of the procedural
 * jointed body. Rackets and the coach's tablet are attached to the hand bone; barbell,
 * dumbbells and swimming need knees, elbows or a prone pose and stay procedural.
 */
export const RIGGED_ACTIVITY_CLIPS: Partial<Record<ActorActivityKind, RiggedClipSpec>> = {
  'treadmill-run': { clip: 'walk', timeScale: 1.7 },
  'walking-patrol': { clip: 'walk', timeScale: 1.0 },
  'elliptical-stride': { clip: 'walk', timeScale: 0.8 },
  'upright-bike': {
    clip: 'drive',
    timeScale: 1,
    offset: [0, 0.72, 0],
    // Pedaling: legs alternate around the seated pose.
    tweakBones: phase => {
      const crank = Math.sin(phase * 1.5);
      return { 'leg-left': [crank * 0.45, 0, 0], 'leg-right': [-crank * 0.45, 0, 0] };
    },
  },
  'boxing-spar': { clip: punchClip, timeScale: 1.2 },
  'heavy-bag-boxer': { clip: punchClip, timeScale: 1.2 },
  'yoga-flow': {
    clip: 'idle',
    timeScale: 0.6,
    // Slow overhead reach and release, like the procedural sun-salutation breath.
    tweakBones: phase => {
      const breath = 0.5 - 0.5 * Math.cos(phase * 0.55);
      return { 'arm-left': [0, 0, breath * 2.0], 'arm-right': [0, 0, -breath * 2.0] };
    },
  },
  'inbody-scan': { clip: 'idle', timeScale: 0.8 },
  'badminton-player': {
    clip: 'attack-melee-right',
    timeScale: 0.5,
    handProp: { kind: 'racket', bone: 'arm-right', position: HAND_TIP, rotation: ALONG_ARM, size: 1.1 },
  },
  'tennis-player': {
    clip: 'attack-melee-right',
    timeScale: 0.4,
    handProp: { kind: 'racket', bone: 'arm-right', position: HAND_TIP, rotation: ALONG_ARM, size: 1.3 },
  },
  'pt-coach-tablet': {
    clip: 'holding-both',
    timeScale: 1,
    handProp: {
      kind: 'tablet',
      bone: 'arm-right',
      // Past the blunt arm end so the tablet is not buried inside the thick arm mesh.
      position: [-0.33, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      size: 1.2,
    },
  },
  'receptionist-greet': { clip: 'interact-right', timeScale: 0.8 },
  'lounge-chat': { clip: 'emote-yes', timeScale: 0.7 },
};

/** Procedural hand-held props that the rigged characters replace with bone-attached ones. */
export const PROCEDURAL_HAND_PROP_NAMES: ReadonlySet<string> = new Set([
  'racketShaft',
  'racketHead',
  'coachTablet',
]);

/** Procedural parts that make up the human body; props are not in this list. */
export const PROCEDURAL_BODY_PART_NAMES: ReadonlySet<string> = new Set([
  'torso',
  'hips',
  'head',
  'hair',
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
  'leftThigh',
  'leftShin',
  'rightThigh',
  'rightShin',
]);

export interface RiggedCharacterModel {
  url: string;
  author: string;
  source: string;
  license: 'CC0';
}

const KENNEY_MINI = 'https://kenney.nl/assets/mini-characters';

export const RIGGED_CHARACTER_MODELS: readonly RiggedCharacterModel[] = [
  { url: '/models/explore3d/characters/character-male-a.glb', author: 'Kenney', source: KENNEY_MINI, license: 'CC0' },
  { url: '/models/explore3d/characters/character-female-a.glb', author: 'Kenney', source: KENNEY_MINI, license: 'CC0' },
  { url: '/models/explore3d/characters/character-male-c.glb', author: 'Kenney', source: KENNEY_MINI, license: 'CC0' },
  { url: '/models/explore3d/characters/character-female-c.glb', author: 'Kenney', source: KENNEY_MINI, license: 'CC0' },
];

/** Standing height the loaded characters are scaled to, in world units (procedural humans are ~1.75). */
export const RIGGED_CHARACTER_HEIGHT = 1.5;

/**
 * Where a rigged character stands and which way it faces at `timeSec`, following the
 * same path, sway and yaw as the procedural figure it replaces.
 */
export function computeRiggedPlacement(
  def: LiveActorDefinition,
  scene: SceneDoc,
  levelMode: LevelMode,
  timeSec: number,
): { position: Vec3; yaw: number } {
  const anchor = getActorWorldAnchor(def, scene, levelMode);
  const { pose, worldPos, yaw } = solveHumanPose(def, timeSec, anchor);
  const total = yaw + pose.yawOffset;
  const cos = Math.cos(total);
  const sin = Math.sin(total);
  const [ox, oy, oz] = RIGGED_ACTIVITY_CLIPS[def.activity]?.offset ?? [0, 0, 0];
  const lx = pose.rootOffset[0] + ox;
  const lz = pose.rootOffset[2] + oz;
  return {
    position: [worldPos[0] + lx * cos + lz * sin, worldPos[1] + oy, worldPos[2] - lx * sin + lz * cos],
    // Kenney characters face +Z at yaw 0, the same convention as the procedural figures.
    yaw: total,
  };
}

export function isRiggedActivity(activity: ActorActivityKind): boolean {
  return activity in RIGGED_ACTIVITY_CLIPS;
}

/** Stable pick so an actor keeps the same look between renders and level changes. */
export function pickRiggedModelIndex(actorId: string, modelCount: number): number {
  let hash = 0;
  for (let i = 0; i < actorId.length; i++) {
    hash = (hash * 31 + actorId.charCodeAt(i)) >>> 0;
  }
  return modelCount > 0 ? hash % modelCount : 0;
}

// --- Registry of actors currently drawn as rigged characters -------------------
// The procedural instanced mesh hides these actors' parts; actors only land here
// after their model loaded, so a failed load keeps the procedural figure.

let riggedActorIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function setRiggedActorIds(ids: Iterable<string>): void {
  riggedActorIds = new Set(ids);
  for (const listener of listeners) listener();
}

export function getRiggedActorIds(): ReadonlySet<string> {
  return riggedActorIds;
}

export function subscribeRiggedActors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRiggedActorIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeRiggedActors, getRiggedActorIds, getRiggedActorIds);
}
