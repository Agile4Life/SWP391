import { useSyncExternalStore } from 'react';
import type { ActorActivityKind } from './liveActorsConfig';

export interface RiggedClipSpec {
  /** Animation clip name inside the character GLB. */
  clip: string;
  /** Multiplies the actor's own speed. */
  timeScale: number;
}

/**
 * Activities drawn with a skinned, animated character instead of the procedural
 * jointed parts. Prototype scope: treadmill runners only.
 */
export const RIGGED_ACTIVITY_CLIPS: Partial<Record<ActorActivityKind, RiggedClipSpec>> = {
  'treadmill-run': { clip: 'walk', timeScale: 1.7 },
};

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

/** Radians added to the actor's yaw so the model's front matches the procedural facing. */
export const RIGGED_FACING_OFFSET = Math.PI;

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
