import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLiveActorDefinitions,
  getActorWorldAnchor,
  resolveLevelWorldYMap,
} from '../renderers/actors/liveActorsConfig';
import {
  RIGGED_ACTIVITY_CLIPS,
  RIGGED_CHARACTER_MODELS,
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

describe('rigged actors prototype', () => {
  it('limits the rigged prototype to treadmill runners', () => {
    expect(Object.keys(RIGGED_ACTIVITY_CLIPS)).toEqual(['treadmill-run']);
    expect(isRiggedActivity('treadmill-run')).toBe(true);
    expect(isRiggedActivity('yoga-flow')).toBe(false);

    const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE);
    expect(defs.filter(d => isRiggedActivity(d.activity)).length).toBe(6);
  });

  it('assigns each actor a stable model within range', () => {
    const count = RIGGED_CHARACTER_MODELS.length;
    const defs = buildLiveActorDefinitions(SOL_CENTER_SCENE).filter(d => isRiggedActivity(d.activity));
    const picks = defs.map(d => pickRiggedModelIndex(d.id, count));
    for (const pick of picks) {
      expect(pick).toBeGreaterThanOrEqual(0);
      expect(pick).toBeLessThan(count);
    }
    expect(defs.map(d => pickRiggedModelIndex(d.id, count))).toEqual(picks);
    expect(pickRiggedModelIndex('anything', 0)).toBe(0);
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
    const l2Runner = buildLiveActorDefinitions(SOL_CENTER_SCENE).find(
      d => d.activity === 'treadmill-run' && d.level === 'L2',
    )!;
    const stacked = getActorWorldAnchor(l2Runner, SOL_CENTER_SCENE, 'stacked');
    const exploded = getActorWorldAnchor(l2Runner, SOL_CENTER_SCENE, 'exploded');
    expect(stacked[1]).toBeCloseTo(resolveLevelWorldYMap(SOL_CENTER_SCENE, 'stacked').L2 + l2Runner.anchorPosition[1], 5);
    expect(exploded[1]).toBeGreaterThan(stacked[1]);
    expect(stacked[0]).toBe(l2Runner.anchorPosition[0]);
    expect(stacked[2]).toBe(l2Runner.anchorPosition[2]);
  });
});
