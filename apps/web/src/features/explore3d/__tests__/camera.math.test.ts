import { describe, expect, it } from 'vitest';
import {
  CAMERA_LIMITS,
  OVERVIEW_VIEWPOINT,
  WALK_EYE_HEIGHT_M,
  clampTargetToBounds,
  computeBestViewpoint,
  computeFitViewpoint,
  computeInitialWalkPose,
  getSolidWallSegments2D,
  needsTwoHopFlight,
  prefersReducedMotion,
  resolveWalkCollision2D,
  stepWalkPose,
} from '../camera/cameraMath';
import {
  allHotspots,
  allItems,
  allZones,
  getLevels,
  getNode,
  wallsOfLevel,
} from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { TOTAL_TOUR_DURATION_MS, TOUR_STEPS } from '../tour/tourSteps';

describe('Explore 3D Camera Math, Guided Tour & Walk Collision', () => {
  it('computes valid best viewpoints for every ZoneNode, LevelNode, ItemNode, and HotspotNode in SOL_CENTER_SCENE', () => {
    const levels = getLevels(SOL_CENTER_SCENE);
    const zones = allZones(SOL_CENTER_SCENE);
    const items = allItems(SOL_CENTER_SCENE);
    const hotspots = allHotspots(SOL_CENTER_SCENE);

    const allTargetNodes = [
      SOL_CENTER_SCENE.nodes['site-sol'],
      ...levels,
      ...zones,
      ...items,
      ...hotspots,
    ];

    expect(allTargetNodes.length).toBeGreaterThan(80);

    for (const node of allTargetNodes) {
      const vp = computeBestViewpoint(SOL_CENTER_SCENE, node.id, 'stacked');
      expect(vp.id.length).toBeGreaterThan(0);
      for (const c of vp.position) {
        expect(Number.isFinite(c)).toBe(true);
      }
      for (const c of vp.target) {
        expect(Number.isFinite(c)).toBe(true);
      }

      // Target must always lie inside CAMERA_LIMITS bounds
      expect(vp.target[0]).toBeGreaterThanOrEqual(CAMERA_LIMITS.boundaryMin[0]);
      expect(vp.target[0]).toBeLessThanOrEqual(CAMERA_LIMITS.boundaryMax[0]);
      expect(vp.target[1]).toBeGreaterThanOrEqual(CAMERA_LIMITS.boundaryMin[1]);
      expect(vp.target[1]).toBeLessThanOrEqual(CAMERA_LIMITS.boundaryMax[1]);
      expect(vp.target[2]).toBeGreaterThanOrEqual(CAMERA_LIMITS.boundaryMin[2]);
      expect(vp.target[2]).toBeLessThanOrEqual(CAMERA_LIMITS.boundaryMax[2]);

      const dist = Math.hypot(
        vp.position[0] - vp.target[0],
        vp.position[1] - vp.target[1],
        vp.position[2] - vp.target[2],
      );
      expect(dist).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance);
    }

    // Exploded mode shifts Y upward for L2 and downward for B1
    const vpL2Stacked = computeBestViewpoint(
      SOL_CENTER_SCENE,
      'zone-l2-vip-gym',
      'stacked',
    );
    const vpL2Exploded = computeBestViewpoint(
      SOL_CENTER_SCENE,
      'zone-l2-vip-gym',
      'exploded',
    );
    expect(vpL2Exploded.position[1]).toBeGreaterThan(vpL2Stacked.position[1]);
    expect(vpL2Exploded.target[1]).toBeGreaterThan(vpL2Stacked.target[1]);

    // Unknown node falls back to OVERVIEW_VIEWPOINT
    expect(computeBestViewpoint(SOL_CENTER_SCENE, 'non-existent-node')).toEqual(
      OVERVIEW_VIEWPOINT,
    );
  });

  it('computes close-up fit viewpoints with distance >= CAMERA_LIMITS.minDistance and finite coordinates', () => {
    const sampleIds = [
      'site-sol',
      'lvl-l1',
      'zone-l1-gym',
      'item-l1-run-1',
      'item-l2-vip-inbody-1',
      'item-out-tennis-01',
      'hs-l1-checkin',
    ];

    for (const id of sampleIds) {
      const vp = computeFitViewpoint(SOL_CENTER_SCENE, id, 'stacked', 38);
      for (const c of [...vp.position, ...vp.target]) {
        expect(Number.isFinite(c)).toBe(true);
      }
      const dist = Math.hypot(
        vp.position[0] - vp.target[0],
        vp.position[1] - vp.target[1],
        vp.position[2] - vp.target[2],
      );
      expect(dist).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance);
      expect(dist).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance + 1);
    }
  });

  it('clamps out-of-range target coordinates into [-36..52, -6..24, -28..28]', () => {
    expect(clampTargetToBounds([-100, -50, -90])).toEqual([-36, -6, -28]);
    expect(clampTargetToBounds([200, 100, 99])).toEqual([52, 24, 28]);
    expect(clampTargetToBounds([4, 2, -5])).toEqual([4, 2, -5]);
  });

  it('evaluates needsTwoHopFlight for indoor cross-level transitions', () => {
    expect(needsTwoHopFlight('B1', 'L2')).toBe(true);
    expect(needsTwoHopFlight('L1', 'RF')).toBe(true);
    expect(needsTwoHopFlight('L1', 'L1')).toBe(false);
    expect(needsTwoHopFlight('ALL', 'L1')).toBe(false);
    expect(needsTwoHopFlight(null, 'L2')).toBe(false);
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });

  it('defines 8 valid Guided Tour steps totaling 90 seconds and referencing existing scene nodes', () => {
    expect(TOUR_STEPS).toHaveLength(8);
    expect(TOTAL_TOUR_DURATION_MS).toBe(90000);

    for (const step of TOUR_STEPS) {
      const node = getNode(SOL_CENTER_SCENE, step.nodeId);
      expect(
        node,
        `Expected TOUR_STEPS node "${step.nodeId}" to exist in SOL_CENTER_SCENE`,
      ).not.toBeNull();
      expect(step.title.vi.length).toBeGreaterThan(0);
      expect(step.title.en.length).toBeGreaterThan(0);
      expect(step.caption.vi.length).toBeGreaterThan(0);
      expect(step.caption.en.length).toBeGreaterThan(0);
      expect(step.ctaTo.startsWith('/')).toBe(true);
      expect(step.durationMs).toBeGreaterThanOrEqual(8000);
    }
  });

  it('performs 2D wall collision while allowing passage through doors and arches (sillHeight === 0)', () => {
    const l1Walls = wallsOfLevel(SOL_CENTER_SCENE, 'L1');
    const gymSouthWall = l1Walls.find(w => w.id === 'wall-l1-gym-south')!;
    expect(gymSouthWall).toBeDefined();

    // wall-l1-gym-south runs from [-20, 2] to [4, 2] with a 3.0m door at offset 16 (x = -4..-1)
    const segments = getSolidWallSegments2D(gymSouthWall);
    expect(segments.length).toBe(2);

    // Passing through the doorway at x = -2.5 from z = 3.2 to z = 0.8 should succeed
    const throughDoor = resolveWalkCollision2D([-2.5, 3.2], [-2.5, 0.8], [gymSouthWall]);
    expect(throughDoor[1]).toBeCloseTo(0.8, 2);

    // Walking straight through the solid wall part at x = -12 from z = 3.2 to z = 0.8 should be blocked
    const blockedByWall = resolveWalkCollision2D([-12, 3.2], [-12, 0.8], [gymSouthWall]);
    expect(blockedByWall[1]).toBeGreaterThan(2.0);

    // Initial walk pose on L1 starts at 1.65m eye height
    const pose = computeInitialWalkPose(SOL_CENTER_SCENE, 'zone-l1-lobby', 'L1');
    expect(pose.levelCode).toBe('L1');
    expect(pose.position[1]).toBeCloseTo(WALK_EYE_HEIGHT_M, 2);

    const stepped = stepWalkPose(pose, { forward: 1, strafe: 0, turn: 0 }, 0.2, l1Walls);
    expect(Number.isFinite(stepped.position[0])).toBe(true);
    expect(Number.isFinite(stepped.position[2])).toBe(true);
  });
});
