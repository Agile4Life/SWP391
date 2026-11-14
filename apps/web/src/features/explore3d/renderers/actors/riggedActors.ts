import { useSyncExternalStore } from 'react';
import type { SceneDoc, Vec3 } from '../../scene/schema';
import type { RiggedHandPropSpec } from './riggedHandProps';
import type { LevelMode } from '../../state/exploreStore';
import {
  getActorWorldAnchor,
  solveHumanPose,
  type ActorActivityKind,
  type HumanPoseAngles,
  type LiveActorDefinition,
} from './liveActorsConfig';
import { benchPress } from './humanPoses';
import type { PoseOverride } from './humanRetarget';

/** Motion-captured clip played by an AnimationMixer. */
export interface RiggedClipSpec {
  /** Animation clip name, or a pick per actor (e.g. jab or cross). */
  clip: string | ((actorId: string) => string);
  /** Multiplies the actor's own speed. */
  timeScale: number;
  /** Optional combo sequence crossfaded across beats (e.g. jab-cross boxing combinations). */
  comboClips?: readonly string[];
  /** Equip padded boxing gloves on both hands. */
  glovesInHands?: boolean;
}

/** Skeleton driven every frame from the activity's pose angles (`solveHumanPose`). */
export interface RiggedPoseSpec {
  /** Keep the lower foot on the ground by moving the hips; off for seated poses. */
  groundLock: boolean;
  /** Hips height in metres when `groundLock` is off (seated on a bike). */
  hipsHeight?: number;
  /** Prop parented to a hand bone; replaces the procedural prop of the same activity. */
  handProp?: RiggedHandPropSpec;
  /** Twist of the hand about the forearm (radians), static or per-phase (e.g. supinating curls). */
  forearmRoll?:
    | Partial<Record<'left' | 'right', number>>
    | ((phase: number) => Partial<Record<'left' | 'right', number>>);
  /** Draw a barbell held between the two hands. */
  barbellInHands?: boolean;
  /** Put a dumbbell in each hand. */
  dumbbellsInHands?: boolean;
  /** Pose the angles cannot express (lying down); receives the actor's phase. */
  override?: (phase: number) => PoseOverride;
}

/** Same phase the procedural solver uses, so both figures stay in step. */
export function getActorPhase(actor: LiveActorDefinition, timeSec: number): number {
  return timeSec * actor.speed * 3.2 + actor.phaseOffset;
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const pick = (a: string, b: string) => (actorId: string) => (hashString(actorId) % 2 === 0 ? a : b);

/** Motion capture from the Universal Animation Library (clip names as in `human-animations.glb`). */
export const HUMAN_CLIP_ACTIVITIES: Partial<Record<ActorActivityKind, RiggedClipSpec>> = {
  'treadmill-run': { clip: 'Jog_Fwd_Loop', timeScale: 1 },
  'walking-patrol': { clip: 'Walk_Loop', timeScale: 1 },
  'lounge-chat': {
    clip: id => (id.endsWith('member-1') ? 'Sitting_Talking_Loop' : 'Idle_Talking_Loop'),
    timeScale: 0.85,
  },
  'boxing-spar': {
    clip: pick('Punch_Jab', 'Punch_Cross'),
    comboClips: ['Punch_Jab', 'Punch_Cross', 'Punch_Jab'],
    glovesInHands: true,
    timeScale: 1,
  },
  'heavy-bag-boxer': {
    clip: pick('Punch_Cross', 'Punch_Jab'),
    comboClips: ['Punch_Cross', 'Punch_Jab', 'Punch_Cross'],
    glovesInHands: true,
    timeScale: 1,
  },
  'swim-freestyle': { clip: 'Swim_Fwd_Loop', timeScale: 1 },
};

/** Racket in the hand on the code-built figure's right (+X, the rig's left hand `hand_l`). */
const RACKET = {
  kind: 'racket',
  bone: 'hand_l',
  position: [0.032, 0.08, 0.02],
  // Shaft emerges out the thumb/index grip axis (+Z of `hand_l`) cocked 20° distally (+Y), face parallel to palm (+X).
  rotation: [-Math.PI / 2 - 0.35, 0, 0],
} as const;

/**
 * Activities whose skeleton follows the same pose angles as the code-built figure, so
 * they move on the same timing and path without needing a captured clip.
 */
export const HUMAN_POSE_ACTIVITIES: Partial<Record<ActorActivityKind, RiggedPoseSpec>> = {
  'upright-bike': { groundLock: false, hipsHeight: 0.93 },
  'elliptical-stride': { groundLock: true },
  'inbody-scan': { groundLock: true },
  'receptionist-greet': { groundLock: true },
  'yoga-flow': { groundLock: true },
  'barbell-squat': { groundLock: true, barbellInHands: true },
  'bench-press': { groundLock: false, barbellInHands: true, override: benchPress },
  'dumbbell-curl': {
    groundLock: true,
    dumbbellsInHands: true,
    forearmRoll: phase => ({
      left: (0.5 - 0.5 * Math.cos(phase * 1.2)) * 1.45,
      right: -(0.5 - 0.5 * Math.cos(phase * 1.2 + Math.PI)) * 1.45,
    }),
  },
  'badminton-player': { groundLock: true, handProp: { ...RACKET, size: 1.08 } },
  'tennis-player': { groundLock: true, handProp: { ...RACKET, size: 1.26 } },
  'pt-coach-tablet': {
    groundLock: true,
    // Palm up so the tablet rests flat on `hand_r` (-X palm normal flipped upward) tilted toward the coach.
    forearmRoll: { left: Math.PI },
    handProp: {
      kind: 'tablet',
      bone: 'hand_r',
      position: [-0.03, 0.095, 0.01],
      rotation: [0, 0, Math.PI / 2 - 0.25],
      size: 1.15,
    },
  },
};

/** The packed Quaternius files in `public/models/explore3d/humans/` (see `scripts/build-human-assets.py`). */
export const HUMAN_ASSET_URLS = {
  male: '/models/explore3d/humans/human-male.glb',
  female: '/models/explore3d/humans/human-female.glb',
  animations: '/models/explore3d/humans/human-animations.glb',
  skinLight: {
    male: '/models/explore3d/humans/skin-male-light.jpg',
    female: '/models/explore3d/humans/skin-female-light.jpg',
  },
  hair: {
    'hair-simpleparted': '/models/explore3d/humans/hair-simpleparted.glb',
    'hair-buzzed': '/models/explore3d/humans/hair-buzzed.glb',
    'hair-beard': '/models/explore3d/humans/hair-beard.glb',
    'hair-long': '/models/explore3d/humans/hair-long.glb',
    'hair-buns': '/models/explore3d/humans/hair-buns.glb',
    'hair-buzzedfemale': '/models/explore3d/humans/hair-buzzedfemale.glb',
  },
} as const;

/** Real-world standing height the characters are scaled to, in metres. */
export const HUMAN_HEIGHT = 1.76;

/** Hand bones of the rig. */
export const HUMAN_HAND_BONES = ['hand_l', 'hand_r'] as const;

/** Procedural parts that the rigged characters replace with a bar held in the hands. */
export const PROCEDURAL_BARBELL_PART_NAMES: ReadonlySet<string> = new Set([
  'barbellShaft',
  'barbellPlateLeft',
  'barbellPlateRight',
]);

/** Procedural hand-held props that the rigged characters replace with bone-attached ones. */
export const PROCEDURAL_HAND_PROP_NAMES: ReadonlySet<string> = new Set([
  'racketShaft',
  'racketHead',
  'coachTablet',
  'dumbbellLeft',
  'dumbbellRight',
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

export type RiggedMotion =
  | { kind: 'clip'; spec: RiggedClipSpec }
  | { kind: 'pose'; spec: RiggedPoseSpec };

export function getRiggedMotion(activity: ActorActivityKind): RiggedMotion | null {
  const clip = HUMAN_CLIP_ACTIVITIES[activity];
  if (clip) return { kind: 'clip', spec: clip };
  const pose = HUMAN_POSE_ACTIVITIES[activity];
  return pose ? { kind: 'pose', spec: pose } : null;
}

export function isRiggedActivity(activity: ActorActivityKind): boolean {
  return getRiggedMotion(activity) !== null;
}

export interface RiggedPlacement {
  position: Vec3;
  yaw: number;
  pose: HumanPoseAngles;
}

/**
 * Where a rigged character stands and which way it faces at `timeSec`, following the
 * same path, sway and yaw as the code-built figure it replaces; also the pose angles.
 */
export function computeRiggedPlacement(
  def: LiveActorDefinition,
  scene: SceneDoc,
  levelMode: LevelMode,
  timeSec: number,
): RiggedPlacement {
  const anchor = getActorWorldAnchor(def, scene, levelMode);
  const { pose, worldPos, yaw } = solveHumanPose(def, timeSec, anchor);
  // Mocap clips already carry root/pelvis weight shift and footwork; adding procedural offsets causes foot-skate.
  if (def.activity in HUMAN_CLIP_ACTIVITIES) {
    return { position: worldPos, yaw, pose };
  }
  const total = yaw + pose.yawOffset;
  const cos = Math.cos(total);
  const sin = Math.sin(total);
  const lx = pose.rootOffset[0];
  const lz = pose.rootOffset[2];
  return {
    position: [worldPos[0] + lx * cos + lz * sin, worldPos[1], worldPos[2] - lx * sin + lz * cos],
    yaw: total,
    pose,
  };
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
