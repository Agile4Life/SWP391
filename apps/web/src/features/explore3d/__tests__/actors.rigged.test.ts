import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import {
  buildLiveActorDefinitions,
  evaluateActorPartsAtTime,
  getActorWorldAnchor,
  resolveLevelWorldYMap,
} from '../renderers/actors/liveActorsConfig';
import { buildHandProp } from '../renderers/actors/riggedHandProps';
import {
  HUMAN_CLIP_ACTIVITIES,
  HUMAN_POSE_ACTIVITIES,
  PROCEDURAL_BARBELL_PART_NAMES,
  PROCEDURAL_BODY_PART_NAMES,
  PROCEDURAL_HAND_PROP_NAMES,
  computeRiggedPlacement,
  getActorPhase,
  getRiggedActorIds,
  getRiggedMotion,
  hashString,
  isRiggedActivity,
  setRiggedActorIds,
  subscribeRiggedActors,
} from '../renderers/actors/riggedActors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';

afterEach(() => {
  setRiggedActorIds([]);
});

describe('rigged actors', () => {
  const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);
  const rigged = defs.filter(d => isRiggedActivity(d.activity));

  it('draws every person as the Quaternius human and only objects stay procedural', () => {
    // Every activity that has a person in it.
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
      'badminton-player',
      'tennis-player',
      'pt-coach-tablet',
      'barbell-squat',
      'bench-press',
      'dumbbell-curl',
      'swim-freestyle',
    ] as const) {
      expect(isRiggedActivity(activity), activity).toBe(true);
    }
    // Not a person at all.
    for (const activity of [
      'heavy-bag-sway',
      'badminton-shuttlecock',
      'tennis-ball',
      'fountain-plume',
    ] as const) {
      expect(isRiggedActivity(activity), activity).toBe(false);
    }
    // Every actor that is not a prop or an effect.
    const objects = new Set(['heavy-bag-sway', 'badminton-shuttlecock', 'tennis-ball', 'fountain-plume']);
    expect(rigged.length).toBe(defs.filter(d => !objects.has(d.activity)).length);
    expect(rigged.length).toBe(53);
  });

  it('gives each activity exactly one way to move', () => {
    for (const activity of Object.keys(HUMAN_CLIP_ACTIVITIES)) {
      expect(activity in HUMAN_POSE_ACTIVITIES, activity).toBe(false);
    }
    expect(getRiggedMotion('boxing-spar')?.kind).toBe('clip');
    expect(getRiggedMotion('barbell-squat')?.kind).toBe('pose');
    expect(getRiggedMotion('treadmill-run')?.kind).toBe('clip');
    expect(getRiggedMotion('fountain-plume')).toBeNull();
  });

  it('gives actors a stable height variation', () => {
    const heights = rigged.map(d => hashString(d.id) % 11);
    expect(rigged.map(d => hashString(d.id) % 11)).toEqual(heights);
    expect(new Set(heights).size).toBeGreaterThan(4);
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

  it('keeps cyclists on their bike and swimmers on their lap path', () => {
    const cyclist = rigged.find(d => d.activity === 'upright-bike')!;
    const anchor = getActorWorldAnchor(cyclist, SOL_CENTER_SCENE, 'stacked');
    const placement = computeRiggedPlacement(cyclist, SOL_CENTER_SCENE, 'stacked', 1.25);
    expect(Math.hypot(placement.position[0] - anchor[0], placement.position[2] - anchor[2])).toBeLessThan(0.3);

    const swimmer = rigged.find(d => d.activity === 'swim-freestyle')!;
    const a = computeRiggedPlacement(swimmer, SOL_CENTER_SCENE, 'stacked', 0);
    const b = computeRiggedPlacement(swimmer, SOL_CENTER_SCENE, 'stacked', 40);
    expect(Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2])).toBeGreaterThan(2);
  });

  it('shares one actor phase between the procedural and rigged figures', () => {
    const def = rigged[0]!;
    expect(getActorPhase(def, 2)).toBeCloseTo(2 * def.speed * 3.2 + def.phaseOffset, 10);
  });

  it('hides the procedural body, bar and replaced hand props of rigged actors', () => {
    for (const name of ['torso', 'hips', 'head', 'hair', 'leftShin', 'rightForearm']) {
      expect(PROCEDURAL_BODY_PART_NAMES.has(name)).toBe(true);
    }
    for (const name of ['racketShaft', 'racketHead', 'coachTablet', 'dumbbellLeft', 'dumbbellRight']) {
      expect(PROCEDURAL_HAND_PROP_NAMES.has(name)).toBe(true);
    }
    // Nothing a rigged actor still draws procedurally may be left visible: every part is hidden.
    const sample = evaluateActorPartsAtTime(rigged, 1.25, { scene: SOL_CENTER_SCENE });
    for (const part of sample) {
      // The swimmers' water spray is an effect around the kicking feet and stays drawn.
      if (part.partName.startsWith('splash')) continue;
      expect(
        PROCEDURAL_BODY_PART_NAMES.has(part.partName) ||
          PROCEDURAL_HAND_PROP_NAMES.has(part.partName) ||
          PROCEDURAL_BARBELL_PART_NAMES.has(part.partName),
        `${part.actorId} would leave "${part.partName}" floating`,
      ).toBe(true);
    }
  });

  it('builds hand props sized in world units regardless of model scale', () => {
    const racket = HUMAN_POSE_ACTIVITIES['badminton-player']!.handProp!;
    const small = buildHandProp(racket, 1);
    const scaled = buildHandProp(racket, 2.5);
    expect(small.children.length).toBeGreaterThanOrEqual(3);
    expect(scaled.scale.x * 2.5).toBeCloseTo(small.scale.x * 1, 6);
    // Geometry and materials are shared between props.
    const a = small.children[0] as THREE.Mesh;
    const b = scaled.children[0] as THREE.Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).toBe(b.material);

    const tablet = buildHandProp(HUMAN_POSE_ACTIVITIES['pt-coach-tablet']!.handProp!, 2);
    expect(tablet.children.length).toBe(2);
    const dumbbell = buildHandProp(
      { kind: 'dumbbell', bone: 'hand_l', position: [0, 0.05, 0], rotation: [0, 0, 0], size: 1 },
      1,
    );
    expect(dumbbell.children.length).toBe(3);
  });
});
