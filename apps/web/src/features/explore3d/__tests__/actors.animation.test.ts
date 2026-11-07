import { describe, expect, it } from 'vitest';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { LEVEL_ORDER, type LevelCode } from '../scene/schema';
import {
  buildLiveActorDefinitions,
  createActorPartGeometry,
  evaluateActorPartsAtTime,
  getTotalActorInstanceCount,
  type ActorActivityKind,
} from '../renderers/actors/liveActorsConfig';

describe('Live 3D Activity Actors & Dynamic Objects', () => {
  it('builds actor definitions across all 5 levels (B1, L1, L2, RF, OUT) with contiguous instance indices', () => {
    const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);
    expect(defs.length).toBeGreaterThanOrEqual(45);

    const levelsPresent = new Set<LevelCode>(defs.map(d => d.level));
    for (const lvl of LEVEL_ORDER) {
      expect(levelsPresent.has(lvl)).toBe(true);
    }

    const activities = new Set<ActorActivityKind>(defs.map(d => d.activity));
    const expectedActivities: ActorActivityKind[] = [
      'treadmill-run',
      'upright-bike',
      'barbell-squat',
      'bench-press',
      'dumbbell-curl',
      'boxing-spar',
      'heavy-bag-boxer',
      'heavy-bag-sway',
      'badminton-player',
      'badminton-shuttlecock',
      'swim-freestyle',
      'yoga-flow',
      'tennis-player',
      'tennis-ball',
      'inbody-scan',
      'pt-coach-tablet',
      'receptionist-greet',
      'walking-patrol',
      'fountain-plume',
    ];
    for (const act of expectedActivities) {
      expect(activities.has(act)).toBe(true);
    }

    // Verify contiguous non-overlapping instance ranges
    let expectedCursor = 0;
    for (const def of defs) {
      expect(def.instanceStartIndex).toBe(expectedCursor);
      expect(def.partCount).toBeGreaterThan(0);
      expectedCursor += def.partCount;
    }
    expect(getTotalActorInstanceCount(defs)).toBe(expectedCursor);
  });

  it('uses a compact unit chamfered geometry within the 24..44 triangle budget', () => {
    const geom = createActorPartGeometry();
    const index = geom.getIndex();
    expect(index).not.toBeNull();
    const triCount = Math.floor((index?.count ?? 0) / 3);
    expect(triCount).toBeGreaterThanOrEqual(24);
    expect(triCount).toBeLessThanOrEqual(44);

    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-0.5, 3);
    expect(bb.max.x).toBeCloseTo(0.5, 3);
    expect(bb.min.y).toBeCloseTo(-0.5, 3);
    expect(bb.max.y).toBeCloseTo(0.5, 3);
    expect(bb.min.z).toBeCloseTo(-0.5, 3);
    expect(bb.max.z).toBeCloseTo(0.5, 3);
  });

  it('evaluates finite world transforms & colors and animates poses between t=0 and t=0.8', () => {
    const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);
    const totalInstances = getTotalActorInstanceCount(defs);

    const partsT0 = evaluateActorPartsAtTime(defs, 0.0, {
      scene: SOL_CENTER_SCENE,
      levelMode: 'stacked',
      focusLevel: 'ALL',
    });
    const partsT1 = evaluateActorPartsAtTime(defs, 0.8, {
      scene: SOL_CENTER_SCENE,
      levelMode: 'stacked',
      focusLevel: 'ALL',
    });

    expect(partsT0.length).toBe(totalInstances);
    expect(partsT1.length).toBe(totalInstances);

    for (const p of partsT0) {
      expect(p.visible).toBe(true);
      expect(p.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      for (const v of [...p.position, ...p.rotation, ...p.scale]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(p.scale[0]).toBeGreaterThan(0);
      expect(p.scale[1]).toBeGreaterThan(0);
      expect(p.scale[2]).toBeGreaterThan(0);
    }

    // Verify dynamic movement across key activities (shuttlecock, tennis ball, swimmer, barbell squat, runner)
    const checkActorMoved = (actorId: string) => {
      const a0 = partsT0.filter(p => p.actorId === actorId);
      const a1 = partsT1.filter(p => p.actorId === actorId);
      expect(a0.length).toBeGreaterThan(0);
      const delta = a0.reduce((sum, p0, i) => {
        const p1 = a1[i]!;
        return (
          sum +
          Math.hypot(
            p1.position[0] - p0.position[0],
            p1.position[1] - p0.position[1],
            p1.position[2] - p0.position[2],
          ) +
          Math.hypot(
            p1.rotation[0] - p0.rotation[0],
            p1.rotation[1] - p0.rotation[1],
            p1.rotation[2] - p0.rotation[2],
          )
        );
      }, 0);
      expect(delta).toBeGreaterThan(0.05);
    };

    checkActorMoved('actor-l1-runner-1');
    checkActorMoved('actor-l1-squat-lifter-1');
    checkActorMoved('prop-l1-shuttlecock-1');
    checkActorMoved('prop-out-tennis-ball-1');
    checkActorMoved('actor-b1-swimmer-1');
    checkActorMoved('actor-rf-yoga-Instructor'.toLowerCase());
    checkActorMoved('actor-out-pedestrian-1');
  });

  it('respects exploded level Y offsets and solo level visibility filtering', () => {
    const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);

    const stacked = evaluateActorPartsAtTime(defs, 1.25, {
      scene: SOL_CENTER_SCENE,
      levelMode: 'stacked',
      focusLevel: 'ALL',
    });
    const exploded = evaluateActorPartsAtTime(defs, 1.25, {
      scene: SOL_CENTER_SCENE,
      levelMode: 'exploded',
      focusLevel: 'ALL',
    });

    // B1 has explodedOffset = -6.0, RF has explodedOffset = +12.0, L2 has explodedOffset = +6.0
    const b1Idx = stacked.findIndex(p => p.level === 'B1');
    const l2Idx = stacked.findIndex(p => p.level === 'L2');
    const rfIdx = stacked.findIndex(p => p.level === 'RF');

    expect(exploded[b1Idx]!.position[1] - stacked[b1Idx]!.position[1]).toBeCloseTo(-6.0, 3);
    expect(exploded[l2Idx]!.position[1] - stacked[l2Idx]!.position[1]).toBeCloseTo(6.0, 3);
    expect(exploded[rfIdx]!.position[1] - stacked[rfIdx]!.position[1]).toBeCloseTo(12.0, 3);

    // Solo mode on L1 hides all non-L1 actors by scaling them to [0, 0, 0]
    const soloL1 = evaluateActorPartsAtTime(defs, 1.25, {
      scene: SOL_CENTER_SCENE,
      levelMode: 'solo',
      focusLevel: 'L1',
    });

    for (const part of soloL1) {
      if (part.level === 'L1') {
        expect(part.visible).toBe(true);
        expect(part.scale[0]).toBeGreaterThan(0);
      } else {
        expect(part.visible).toBe(false);
        expect(part.scale).toEqual([0, 0, 0]);
      }
    }
  });
});
