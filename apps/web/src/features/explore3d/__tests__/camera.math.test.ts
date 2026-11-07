import { describe, expect, it } from 'vitest';
import {
  CAMERA_LIMITS,
  OVERVIEW_VIEWPOINT,
  WALK_COLLIDER_RADIUS_M,
  WALK_EYE_HEIGHT_M,
  WALK_MAX_PITCH_RAD,
  clampTargetToBounds,
  clampWalkPitch,
  computeBestViewpoint,
  computeFitViewpoint,
  computeInitialWalkPose,
  computeProportionalZoomStep,
  computeStairElevationOffset,
  evaluateStairOrElevatorPortal,
  getSolidWallSegments2D,
  getWalkObstaclesForLevel,
  needsTwoHopFlight,
  poseToViewpoint,
  prefersReducedMotion,
  resolveWalkCollision2D,
  rotateWalkPose,
  sanitizeCameraPose,
  segmentsIntersect2D,
  stepWalkPose,
} from '../camera/cameraMath';
import {
  allHotspots,
  allItems,
  allZones,
  getLevels,
  getNode,
  itemsOfLevel,
  levelOf,
  wallsOfLevel,
} from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';
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

  it('clamps out-of-range target coordinates into [-54..68, -8..36, -42..42]', () => {
    expect(clampTargetToBounds([-100, -50, -90])).toEqual([-54, -8, -42]);
    expect(clampTargetToBounds([200, 100, 99])).toEqual([68, 36, 42]);
    expect(clampTargetToBounds([4, 2, -5])).toEqual([4, 2, -5]);
  });

  it('expands CAMERA_LIMITS to support ultra-close inspection (0.65m) and full-campus zoom-out (165m)', () => {
    expect(CAMERA_LIMITS.minDistance).toBe(0.65);
    expect(CAMERA_LIMITS.maxDistance).toBe(165);
    expect(CAMERA_LIMITS.minPolarAngle).toBeCloseTo(0.08, 4);
    expect(CAMERA_LIMITS.maxPolarAngle).toBeCloseTo(Math.PI / 2 - 0.03, 4);
    expect(CAMERA_LIMITS.boundaryMin).toEqual([-54, -8, -42]);
    expect(CAMERA_LIMITS.boundaryMax).toEqual([68, 36, 42]);
  });

  it('sanitizes camera pose against extreme zoom-in (< 0.65m), extreme zoom-out (> 165m), underground Y, and NaN coordinates', () => {
    // 1. Extreme zoom-in (< 0.65m) clamps to minDistance (0.65m)
    const closePose = sanitizeCameraPose([0.1, 2.1, 0.1], [0, 2, 0]);
    const closeDist = Math.hypot(
      closePose.position[0] - closePose.target[0],
      closePose.position[1] - closePose.target[1],
      closePose.position[2] - closePose.target[2],
    );
    expect(closeDist).toBeCloseTo(CAMERA_LIMITS.minDistance, 2);

    // 2. Zero-distance coincidence recovers with default direction at minDistance
    const zeroPose = sanitizeCameraPose([4, 2, 0], [4, 2, 0]);
    const zeroDist = Math.hypot(
      zeroPose.position[0] - zeroPose.target[0],
      zeroPose.position[1] - zeroPose.target[1],
      zeroPose.position[2] - zeroPose.target[2],
    );
    expect(zeroDist).toBeCloseTo(CAMERA_LIMITS.minDistance, 2);

    // 3. Extreme zoom-out (> 165m) clamps to maxDistance (165m)
    const farPose = sanitizeCameraPose([240, 180, 240], [0, 2, 0]);
    const farDist = Math.hypot(
      farPose.position[0] - farPose.target[0],
      farPose.position[1] - farPose.target[1],
      farPose.position[2] - farPose.target[2],
    );
    expect(farDist).toBeCloseTo(CAMERA_LIMITS.maxDistance, 2);

    // 4. Underground camera Y is clamped above floor slab
    const undergroundPose = sanitizeCameraPose([6, -25, 6], [0, 1, 0], -4.2);
    expect(undergroundPose.position[1]).toBeGreaterThanOrEqual(1 - 0.15);

    // 5. NaN / Infinity recovery falls back safely to finite coordinates
    const nanPose = sanitizeCameraPose([Number.NaN, 10, Number.POSITIVE_INFINITY], [Number.NaN, 0, 0]);
    for (const c of [...nanPose.position, ...nanPose.target]) {
      expect(Number.isFinite(c)).toBe(true);
    }
    expect(nanPose.target).toEqual(OVERVIEW_VIEWPOINT.target);
  });

  it('computes proportional zoom steps smoothly across close (1.2m) and far (90m) distances within [0.65, 165]', () => {
    const stepCloseIn = computeProportionalZoomStep(1.2, 'in');
    const stepCloseOut = computeProportionalZoomStep(1.2, 'out');
    const closeDeltaIn = 1.2 - stepCloseIn;
    const closeDeltaOut = stepCloseOut - 1.2;

    const stepFarIn = computeProportionalZoomStep(90, 'in');
    const stepFarOut = computeProportionalZoomStep(90, 'out');
    const farDeltaIn = 90 - stepFarIn;
    const farDeltaOut = stepFarOut - 90;

    // Close zoom step is fine-grained (~0.45m), while far zoom step is much faster (16m)
    expect(closeDeltaIn).toBeCloseTo(0.45, 3);
    expect(closeDeltaOut).toBeCloseTo(0.45, 3);
    expect(farDeltaIn).toBeCloseTo(16, 3);
    expect(farDeltaOut).toBeCloseTo(16, 3);
    expect(farDeltaIn).toBeGreaterThan(closeDeltaIn * 10);

    // Clamps strictly to [0.65, 165] at boundaries
    expect(computeProportionalZoomStep(0.7, 'in')).toBe(CAMERA_LIMITS.minDistance);
    expect(computeProportionalZoomStep(160, 'out')).toBe(CAMERA_LIMITS.maxDistance);
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

  it('supports 360° yaw and clamped vertical pitch look-around without moving eye position', () => {
    const initial = computeInitialWalkPose(SOL_CENTER_SCENE, 'zone-l1-gym', 'L1');
    expect(initial.pitch ?? 0).toBe(0);

    // Rotate 90° right and 30° up
    const lookedUpRight = rotateWalkPose(initial, Math.PI / 2, Math.PI / 6);
    expect(lookedUpRight.position).toEqual(initial.position);
    expect(lookedUpRight.yaw).toBeCloseTo(initial.yaw + Math.PI / 2, 4);
    expect(lookedUpRight.pitch).toBeCloseTo(Math.PI / 6, 4);

    const vp = poseToViewpoint(lookedUpRight);
    expect(vp.target[1]).toBeGreaterThan(vp.position[1]);
    expect(vp.fov).toBe(60);

    // Pitch clamps at ±WALK_MAX_PITCH_RAD
    expect(clampWalkPitch(Math.PI)).toBeCloseTo(WALK_MAX_PITCH_RAD, 5);
    expect(clampWalkPitch(-Math.PI)).toBeCloseTo(-WALK_MAX_PITCH_RAD, 5);
  });

  it('prevents walking through walls at corners, long strides, equipment obstacles, and B1 pool basin', () => {
    const l1Walls = wallsOfLevel(SOL_CENTER_SCENE, 'L1');
    const allL1Segments = l1Walls.flatMap(w => getSolidWallSegments2D(w));

    // Attempt a long 8m diagonal dash directly into the NW exterior corner [-22, -16] from [-18, -12]
    const fromCorner: [number, number] = [-18, -12];
    const intoCorner: [number, number] = [-25, -20];
    const resolvedCorner = resolveWalkCollision2D(
      fromCorner,
      intoCorner,
      l1Walls,
      WALK_COLLIDER_RADIUS_M,
    );

    // Must remain strictly inside the [-22, -16] exterior walls with clearance
    expect(resolvedCorner[0]).toBeGreaterThan(-22 + WALK_COLLIDER_RADIUS_M);
    expect(resolvedCorner[1]).toBeGreaterThan(-16 + WALK_COLLIDER_RADIUS_M);
    for (const seg of allL1Segments) {
      expect(segmentsIntersect2D(fromCorner, resolvedCorner, seg.a, seg.b)).toBe(false);
    }

    // B1 pool basin obstacle blocks walking from poolside (x=6, z=-5) into deep water (x=0, z=-5)
    const b1Walls = wallsOfLevel(SOL_CENTER_SCENE, 'B1');
    const b1Obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, 'B1');
    expect(b1Obstacles.length).toBeGreaterThan(0);

    const stoppedAtPoolEdge = resolveWalkCollision2D(
      [6, -5],
      [0, -5],
      b1Walls,
      WALK_COLLIDER_RADIUS_M,
      b1Obstacles,
    );
    expect(stoppedAtPoolEdge[0]).toBeGreaterThan(5.1);
  });

  it('audits 100% of zones (18), items (90+), and hotspots (28) in Walk Mode so camera always faces the selected target without wall occlusion', () => {
    const zones = allZones(SOL_CENTER_SCENE);
    expect(zones).toHaveLength(18);

    // Every single zone must define both a hero and an eye viewpoint
    for (const zone of zones) {
      expect(
        zone.viewpoints.some(v => v.kind === 'hero'),
        `Zone ${zone.id} missing hero viewpoint`,
      ).toBe(true);
      expect(
        zone.viewpoints.some(v => v.kind === 'eye'),
        `Zone ${zone.id} missing eye viewpoint`,
      ).toBe(true);

      const lvl = levelOf(SOL_CENTER_SCENE, zone.id)!;
      const pose = computeInitialWalkPose(SOL_CENTER_SCENE, zone.id, lvl.code);
      expect(pose.levelCode).toBe(lvl.code);
      expect(Number.isFinite(pose.position[0])).toBe(true);
      expect(Number.isFinite(pose.position[1])).toBe(true);
      expect(Number.isFinite(pose.position[2])).toBe(true);
      expect(Number.isFinite(pose.yaw)).toBe(true);
    }

    // Audit every ItemNode and HotspotNode: initial walk pose must face the selected node
    const items = allItems(SOL_CENTER_SCENE);
    const hotspots = allHotspots(SOL_CENTER_SCENE);
    for (const node of [...items, ...hotspots]) {
      const lvl = levelOf(SOL_CENTER_SCENE, node.id)!;
      const pose = computeInitialWalkPose(SOL_CENTER_SCENE, node.id, lvl.code);
      const vp = poseToViewpoint(pose);

      const lookDx = vp.target[0] - vp.position[0];
      const lookDz = vp.target[2] - vp.position[2];
      const lookLen = Math.hypot(lookDx, lookDz);
      const toItemDx = node.position[0] - vp.position[0];
      const toItemDz = node.position[2] - vp.position[2];
      const toItemLen = Math.hypot(toItemDx, toItemDz);

      expect(lookLen).toBeGreaterThan(0.1);
      expect(toItemLen).toBeGreaterThan(0.3);

      // Cosine of angle between camera look vector and vector to the selected item/hotspot must be > 0.95
      const cosAngle =
        (lookDx * toItemDx + lookDz * toItemDz) / (lookLen * toItemLen);
      expect(
        cosAngle,
        `Expected walk pose for ${node.id} to face node directly`,
      ).toBeGreaterThan(0.95);
    }

    // Specifically verify Sofa Thư giãn Platinum 01 (item-l2-sofa-1) looks toward the sofa (z = 10.2), not the North wall
    const sofaPose = computeInitialWalkPose(SOL_CENTER_SCENE, 'item-l2-sofa-1', 'L2');
    const sofaVp = poseToViewpoint(sofaPose);
    expect(sofaVp.target[2]).toBeGreaterThan(sofaVp.position[2]);
  });

  it('supports physical staircase climbing and floor transitions across B1 <-> L1 <-> L2 <-> RF', () => {
    // All 4 indoor levels must have both a stair-core and an elevator-core
    for (const code of ['B1', 'L1', 'L2', 'RF'] as const) {
      const levelItems = itemsOfLevel(SOL_CENTER_SCENE, code);
      expect(
        levelItems.some(i => i.kind === 'stair-core'),
        `Level ${code} missing stair-core`,
      ).toBe(true);
      expect(
        levelItems.some(i => i.kind === 'elevator-core'),
        `Level ${code} missing elevator-core`,
      ).toBe(true);
    }

    // Walk up the L1 staircase (item-l1-stairs at [10.5, 0, 1.0], dimensions [3.6, 3.8, 4.2], z = -1.1..3.1)
    const l1Walls = wallsOfLevel(SOL_CENTER_SCENE, 'L1');
    const l1Obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, 'L1');
    let pose = computeInitialWalkPose(SOL_CENTER_SCENE, 'item-l1-stairs', 'L1');
    expect(pose.levelCode).toBe('L1');
    const initialY = pose.position[1];

    let transitionedTo: string | null = null;
    let maxClimbedY = initialY;

    for (let step = 0; step < 30; step++) {
      const nextPose = stepWalkPose(
        pose,
        { forward: 1, strafe: 0, turn: 0 },
        0.1,
        l1Walls,
        undefined,
        l1Obstacles,
        SOL_CENTER_SCENE,
      );
      maxClimbedY = Math.max(maxClimbedY, nextPose.position[1]);
      const portal = evaluateStairOrElevatorPortal(SOL_CENTER_SCENE, pose, nextPose);
      pose = nextPose;
      if (portal) {
        transitionedTo = portal;
        break;
      }
    }

    // Eye height must have climbed up the staircase (> +1.4m above floor) and triggered transition to L2
    expect(maxClimbedY).toBeGreaterThan(initialY + 1.4);
    expect(transitionedTo).toBe('L2');

    // Verify descending staircase from mid-flight (progress ~ 0.5) to lower south landing triggers down transition
    const midStairL2: typeof pose = {
      levelCode: 'L2',
      position: [10.5, 4.5 + WALK_EYE_HEIGHT_M + 1.1, 11.5],
      yaw: Math.PI, // facing South (+Z) down the stairs
      pitch: 0,
    };
    const bottomStairL2: typeof pose = {
      levelCode: 'L2',
      position: [10.5, 4.5 + WALK_EYE_HEIGHT_M + 0.2, 13.2],
      yaw: Math.PI,
      pitch: 0,
    };
    expect(computeStairElevationOffset(SOL_CENTER_SCENE, 'L2', 10.5, 11.5).onStairs).toBe(true);
    expect(
      evaluateStairOrElevatorPortal(SOL_CENTER_SCENE, midStairL2, bottomStairL2),
    ).toBe('L1');

    // Verify store selectNode isolates indoor levels in solo mode and transitions floors when clicking stairs in walkMode
    useExploreStore.getState().resetExplore();
    useExploreStore.getState().selectNode('zone-b1-locker');
    expect(useExploreStore.getState().focusLevel).toBe('B1');
    expect(useExploreStore.getState().levelMode).toBe('solo');

    useExploreStore.getState().setWalkMode(true);
    expect(useExploreStore.getState().focusLevel).toBe('B1');
    useExploreStore.getState().selectNode('item-b1-stairs');
    expect(useExploreStore.getState().focusLevel).toBe('L1');
    expect(useExploreStore.getState().selectedId).toBe('item-l1-stairs');
    useExploreStore.getState().selectNode('item-l1-stairs');
    expect(useExploreStore.getState().focusLevel).toBe('L2');
    expect(useExploreStore.getState().selectedId).toBe('item-l2-stairs');
    useExploreStore.getState().selectNode('item-l2-stairs');
    expect(useExploreStore.getState().focusLevel).toBe('RF');
    expect(useExploreStore.getState().selectedId).toBe('item-rf-stairs');
    useExploreStore.getState().selectNode('item-rf-stairs');
    expect(useExploreStore.getState().focusLevel).toBe('L2');
  });
});
