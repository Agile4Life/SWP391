import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLiveActorDefinitions,
  evaluateActorPartsAtTime,
  getActorWorldAnchor,
  getPartCountForActivity,
  resolveLevelWorldYMap,
} from '../renderers/actors/liveActorsConfig';
import {
  PROCEDURAL_BODY_PART_NAMES,
  RIGGED_ACTIVITY_CLIPS,
  RIGGED_CHARACTER_MODELS,
  computeRiggedPlacement,
  getActorPhase,
  getRiggedActorIds,
  isRiggedActivity,
  pickRiggedModelIndex,
  setRiggedActorIds,
  subscribeRiggedActors,
} from '../renderers/actors/riggedActors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';

afterEach(() => {
  setRiggedActorIds([]);
});

function readGlbClipNames(url: string): string[] {
  // Public assets are served from apps/web/public; read the GLB's JSON chunk directly.
  const file = resolve(process.cwd(), 'public', url.replace(/^\//, ''));
  const data = readFileSync(file);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8')) as {
    animations?: { name: string }[];
  };
  return (json.animations ?? []).map(animation => animation.name);
}

describe('rigged actors', () => {
  const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);
  const rigged = defs.filter(d => isRiggedActivity(d.activity));

  it('rigs articulated activities without hand-held props and keeps the rest procedural', () => {
    for (const activity of [
      'treadmill-run',
      'walking-patrol',
      'elliptical-stride',
      'upright-bike',
      'boxing-spar',
      'heavy-bag-boxer',
      'yoga-flow',
      'inbody-scan',
      'receptionist-greet',
      'lounge-chat',
    ] as const) {
      expect(isRiggedActivity(activity)).toBe(true);
    }
    // Props must line up with procedural hands, so these keep the procedural figure.
    for (const activity of [
      'barbell-squat',
      'bench-press',
      'dumbbell-curl',
      'badminton-player',
      'tennis-player',
      'pt-coach-tablet',
      'swim-freestyle',
      'heavy-bag-sway',
      'fountain-plume',
    ] as const) {
      expect(isRiggedActivity(activity)).toBe(false);
    }
    expect(rigged.length).toBe(30);
  });

  it('only references clips that exist in every character GLB', () => {
    for (const model of RIGGED_CHARACTER_MODELS) {
      const clips = new Set(readGlbClipNames(model.url));
      for (const spec of Object.values(RIGGED_ACTIVITY_CLIPS)) {
        for (const def of rigged) {
          const name = typeof spec.clip === 'function' ? spec.clip(def.id) : spec.clip;
          expect(clips.has(name), `${model.url} is missing clip "${name}"`).toBe(true);
        }
      }
    }
  });

  it('assigns each actor a stable model within range', () => {
    const count = RIGGED_CHARACTER_MODELS.length;
    const picks = rigged.map(d => pickRiggedModelIndex(d.id, count));
    for (const pick of picks) {
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(count);
    }
    expect(rigged.map(d => pickRiggedModelIndex(d.id, count))).toEqual(picks);
    expect(pickRiggedModelIndex('anything', 0)).toBe(0);
    // All four looks get used across the 30 actors.
    expect(new Set(picks).size).toBe(count);
  });

  it('tracks which actors are replaced and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRiggedActors(listener);
    setRiggedActorIds(['actor-a', 'actor-b']);
    expect(getRiggedActorIds().has('actor-a')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setRiggedActorIds([]);
    expect(getRiggedActorIds().size).toBe(0);
    unsubscribe();
  });

  it('places actors on their level in stacked and exploded layouts', () => {
    const l2Runner = rigged.find(d => d.activity === 'treadmill-run' && d.level === 'L2')!;
    const stacked = getActorWorldAnchor(l2Runner, SOL_CENTER_SCENE, 'stacked');
    const exploded = getActorWorldAnchor(l2Runner, SOL_CENTER_SCENE, 'exploded');
    expect(stacked[1]).toBeCloseTo(
      resolveLevelWorldYMap(SOL_CENTER_SCENE, 'stacked').L2 + l2Runner.anchorPosition[1],
      5,
    );
    expect(exploded[1]).toBeGreaterThan(stacked[1]);
  });

  it('follows the procedural patrol path and yaw', () => {
    const walker = rigged.find(d => d.activity === 'walking-patrol')!;
    const start = computeRiggedPlacement(walker, SOL_CENTER_SCENE, 'stacked', 0);
    const later = computeRiggedPlacement(walker, SOL_CENTER_SCENE, 'stacked', 30);
    const moved = Math.hypot(later.position[0] - start.position[0], later.position[2] - start.position[2]);
    expect(moved).toBeGreaterThan(0.5);
  });

  it('lifts seated cyclists to saddle height without moving them off their bike', () => {
    const cyclist = rigged.find(d => d.activity === 'upright-bike')!;
    const anchor = getActorWorldAnchor(cyclist, SOL_CENTER_SCENE, 'stacked');
    const placement = computeRiggedPlacement(cyclist, SOL_CENTER_SCENE, 'stacked', 1.25);
    expect(placement.position[1]).toBeGreaterThan(anchor[1] + 0.5);
    expect(Math.hypot(placement.position[0] - anchor[0], placement.position[2] - anchor[2])).toBeLessThan(0.3);
  });

  it('pedals with opposite legs and reaches both arms up symmetrically', () => {
    const bike = RIGGED_ACTIVITY_CLIPS['upright-bike']!.tweakBones!(0.9);
    expect(bike['leg-left']![0]).toBeCloseTo(-bike['leg-right']![0], 6);
    expect(bike['leg-left']![0]).not.toBe(0);

    const yoga = RIGGED_ACTIVITY_CLIPS['yoga-flow']!.tweakBones!;
    const rest = yoga(0);
    expect(rest['arm-left']![2]).toBeCloseTo(0, 6);
    const up = yoga(Math.PI / 0.55);
    expect(up['arm-left']![2]).toBeCloseTo(-up['arm-right']![2], 6);
    expect(Math.abs(up['arm-left']![2])).toBeGreaterThan(1.5);
  });

  it('shares one actor phase between the procedural and rigged figures', () => {
    const def = rigged[0]!;
    expect(getActorPhase(def, 2)).toBeCloseTo(2 * def.speed * 3.2 + def.phaseOffset, 10);
  });

  it('keeps props visible: procedural body parts are named, props are not', () => {
    for (const name of ['torso', 'hips', 'head', 'hair', 'leftShin', 'rightForearm']) {
      expect(PROCEDURAL_BODY_PART_NAMES.has(name)).toBe(true);
    }
    for (const prop of ['barbellShaft', 'dumbbellLeft', 'racketHead', 'coachTablet']) {
      expect(PROCEDURAL_BODY_PART_NAMES.has(prop)).toBe(false);
    }
    // Every rigged activity is a plain 12-part human, so nothing but the body is hidden.
    for (const activity of Object.keys(RIGGED_ACTIVITY_CLIPS)) {
      expect(getPartCountForActivity(activity as never)).toBe(12);
    }
    const sample = evaluateActorPartsAtTime(rigged.slice(0, 1), 1.25, { scene: SOL_CENTER_SCENE });
    expect(sample.every(part => PROCEDURAL_BODY_PART_NAMES.has(part.partName))).toBe(true);
  });
});
