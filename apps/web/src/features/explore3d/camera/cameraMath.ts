import {
  polygonBounds2D,
  type LevelCode,
  type SceneDoc,
  type Vec2,
  type Vec3,
  type Viewpoint,
  type WallNode,
} from '../scene/schema';
import {
  getLevelByCode,
  getLevelWorldY,
  getNode,
  levelOf,
  wallsOfLevel,
  worldBox,
  zoneOf,
  zonesOfLevel,
} from '../scene/selectors';
import type { LevelMode } from '../state/exploreStore';

export const OVERVIEW_VIEWPOINT: Viewpoint = {
  id: 'vp-default-overview',
  kind: 'overview',
  position: [46, 36, 48],
  target: [4, 2, 0],
  fov: 38,
};

export const CAMERA_LIMITS = {
  minDistance: 2.2,
  maxDistance: 95,
  minPolarAngle: 0.18,
  maxPolarAngle: Math.PI / 2 - 0.06,
  boundaryMin: [-36, -6, -28] as Vec3,
  boundaryMax: [52, 24, 28] as Vec3,
} as const;

const INDOOR_LEVELS = new Set<LevelCode>(['B1', 'L1', 'L2', 'RF']);

const CANDIDATE_YAW_SIGNS: readonly Vec2[] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

export interface SolidWallSegment2D {
  a: Vec2;
  b: Vec2;
  thickness: number;
}

export function clampTargetToBounds(target: Vec3): Vec3 {
  const [minX, minY, minZ] = CAMERA_LIMITS.boundaryMin;
  const [maxX, maxY, maxZ] = CAMERA_LIMITS.boundaryMax;
  return [
    Math.min(maxX, Math.max(minX, target[0])),
    Math.min(maxY, Math.max(minY, target[1])),
    Math.min(maxZ, Math.max(minZ, target[2])),
  ];
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function needsTwoHopFlight(
  fromLevel: LevelCode | 'ALL' | null | undefined,
  toLevel: LevelCode | 'ALL' | null | undefined,
): boolean {
  if (!fromLevel || !toLevel || fromLevel === 'ALL' || toLevel === 'ALL') {
    return false;
  }
  if (fromLevel === toLevel) {
    return false;
  }
  return INDOOR_LEVELS.has(fromLevel) && INDOOR_LEVELS.has(toLevel);
}

/**
 * Splits a WallNode into 2D solid segments by carving out walkable openings (doors/arches where sillHeight === 0).
 */
export function getSolidWallSegments2D(wall: WallNode): SolidWallSegment2D[] {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dz);
  if (length <= 1e-4) return [];

  const ux = dx / length;
  const uz = dz / length;

  const passableOpenings = wall.openings
    .filter(op => op.sillHeight === 0 && op.width > 0)
    .map(op => ({
      start: Math.max(0, op.offset),
      end: Math.min(length, op.offset + op.width),
    }))
    .filter(op => op.end > op.start)
    .sort((a, b) => a.start - b.start);

  if (passableOpenings.length === 0) {
    return [{ a: wall.start, b: wall.end, thickness: wall.thickness }];
  }

  const segments: SolidWallSegment2D[] = [];
  let cursor = 0;

  for (const op of passableOpenings) {
    if (op.start > cursor + 0.04) {
      segments.push({
        a: [wall.start[0] + ux * cursor, wall.start[1] + uz * cursor],
        b: [wall.start[0] + ux * op.start, wall.start[1] + uz * op.start],
        thickness: wall.thickness,
      });
    }
    cursor = Math.max(cursor, op.end);
  }

  if (cursor < length - 0.04) {
    segments.push({
      a: [wall.start[0] + ux * cursor, wall.start[1] + uz * cursor],
      b: [wall.end[0], wall.end[1]],
      thickness: wall.thickness,
    });
  }

  return segments;
}

function ccw2D(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function segmentsIntersect2D(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = ccw2D(p1, p2, q1);
  const d2 = ccw2D(p1, p2, q2);
  const d3 = ccw2D(q1, q2, p1);
  const d4 = ccw2D(q1, q2, p2);

  if (((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) &&
      ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6))) {
    return true;
  }
  return false;
}

export function closestPointOnSegment2D(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const lenSq = abx * abx + abz * abz;
  if (lenSq <= 1e-8) return a;
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / lenSq));
  return [a[0] + abx * t, a[1] + abz * t];
}

/**
 * Resolves 2D movement from `from` to `to` with a circle collider against solid wall segments.
 * Allows passing through doors/arches (`sillHeight === 0`) and slides smoothly along walls.
 */
export function resolveWalkCollision2D(
  from: Vec2,
  to: Vec2,
  walls: WallNode[],
  colliderRadius = 0.36,
): Vec2 {
  const solidSegments: SolidWallSegment2D[] = [];
  for (const wall of walls) {
    solidSegments.push(...getSolidWallSegments2D(wall));
  }

  let candidate: Vec2 = [to[0], to[1]];

  for (const seg of solidSegments) {
    const minClearance = colliderRadius + seg.thickness * 0.5;

    if (segmentsIntersect2D(from, candidate, seg.a, seg.b)) {
      // Blocked by direct crossing: project along the wall segment to slide
      const cpFrom = closestPointOnSegment2D(from, seg.a, seg.b);
      let nx = from[0] - cpFrom[0];
      let nz = from[1] - cpFrom[1];
      const nLen = Math.hypot(nx, nz);
      if (nLen > 1e-5) {
        nx /= nLen;
        nz /= nLen;
        const cpTo = closestPointOnSegment2D(candidate, seg.a, seg.b);
        candidate = [cpTo[0] + nx * (minClearance + 0.02), cpTo[1] + nz * (minClearance + 0.02)];
      } else {
        return from;
      }
    }

    const cp = closestPointOnSegment2D(candidate, seg.a, seg.b);
    const dx = candidate[0] - cp[0];
    const dz = candidate[1] - cp[1];
    const dist = Math.hypot(dx, dz);

    if (dist < minClearance) {
      if (dist > 1e-5) {
        const push = (minClearance - dist) / dist;
        candidate = [candidate[0] + dx * push, candidate[1] + dz * push];
      } else {
        return from;
      }
    }
  }

  // Final safety check that our adjusted position did not cross another wall
  for (const seg of solidSegments) {
    if (segmentsIntersect2D(from, candidate, seg.a, seg.b)) {
      return from;
    }
  }

  return candidate;
}

function countInteriorWallCrossings(from: Vec2, to: Vec2, walls: WallNode[]): number {
  let hits = 0;
  for (const wall of walls) {
    if (wall.exterior) continue;
    const segments = getSolidWallSegments2D(wall);
    for (const seg of segments) {
      if (segmentsIntersect2D(from, to, seg.a, seg.b)) {
        hits += wall.material === 'glass' ? 0.5 : 1;
      }
    }
  }
  return hits;
}

export function computeBestViewpoint(
  doc: SceneDoc,
  nodeId: string,
  levelMode: LevelMode = 'stacked',
): Viewpoint {
  const node = getNode(doc, nodeId);
  if (!node) {
    return OVERVIEW_VIEWPOINT;
  }

  const lvl = levelOf(doc, nodeId);
  const extraY = lvl && levelMode === 'exploded' ? lvl.explodedOffset : 0;

  if ('viewpoints' in node && node.viewpoints.length > 0) {
    const vp =
      node.viewpoints.find(v => v.kind === 'hero') ??
      node.viewpoints.find(v => v.kind === 'overview') ??
      node.viewpoints[0];

    const position: Vec3 = [vp.position[0], vp.position[1] + extraY, vp.position[2]];
    const target = clampTargetToBounds([vp.target[0], vp.target[1] + extraY, vp.target[2]]);

    return {
      ...vp,
      position,
      target,
      fov: vp.fov ?? 38,
    };
  }

  if ('viewpoint' in node && node.viewpoint) {
    const vp = node.viewpoint;
    const position: Vec3 = [vp.position[0], vp.position[1] + extraY, vp.position[2]];
    const target = clampTargetToBounds([vp.target[0], vp.target[1] + extraY, vp.target[2]]);

    return {
      ...vp,
      position,
      target,
      fov: vp.fov ?? 38,
    };
  }

  const box = worldBox(doc, nodeId, levelMode);
  if (!box) {
    return OVERVIEW_VIEWPOINT;
  }

  const target = clampTargetToBounds(box.center);
  const maxSpan = Math.max(box.size[0], box.size[1], box.size[2]);
  const rawDistance =
    node.type === 'hotspot' ? 6.4 : Math.max(4.6, maxSpan * 1.65 + 2.8);
  const distance = Math.min(
    CAMERA_LIMITS.maxDistance - 5,
    Math.max(CAMERA_LIMITS.minDistance + 1.4, rawDistance),
  );

  // 35° elevation isometric viewpoint
  const elevationRad = (35 * Math.PI) / 180;
  const horizDist = distance * Math.cos(elevationRad);
  const vertOffset = distance * Math.sin(elevationRad);

  const parentZone = zoneOf(doc, nodeId);
  const zoneHero =
    parentZone?.viewpoints.find(v => v.kind === 'hero') ?? parentZone?.viewpoints[0];

  let prefDirX = 1 / Math.SQRT2;
  let prefDirZ = 1 / Math.SQRT2;
  if (zoneHero) {
    const hx = zoneHero.position[0] - zoneHero.target[0];
    const hz = zoneHero.position[2] - zoneHero.target[2];
    const hLen = Math.hypot(hx, hz);
    if (hLen > 1e-4) {
      prefDirX = hx / hLen;
      prefDirZ = hz / hLen;
    }
  }

  const walls = lvl ? wallsOfLevel(doc, lvl.id) : [];
  let bestScore = -Infinity;
  let bestUx = 1 / Math.SQRT2;
  let bestUz = 1 / Math.SQRT2;

  for (const [sx, sz] of CANDIDATE_YAW_SIGNS) {
    const ux = sx / Math.SQRT2;
    const uz = sz / Math.SQRT2;
    const candidateXZ: Vec2 = [target[0] + ux * horizDist, target[2] + uz * horizDist];
    const wallCrossings = countInteriorWallCrossings(
      [target[0], target[2]],
      candidateXZ,
      walls,
    );
    const alignment = ux * prefDirX + uz * prefDirZ;
    const score = -wallCrossings * 10 + alignment;
    if (score > bestScore) {
      bestScore = score;
      bestUx = ux;
      bestUz = uz;
    }
  }

  const minFloorY = lvl
    ? getLevelWorldY(lvl, levelMode) + 0.5
    : CAMERA_LIMITS.boundaryMin[1] + 0.5;
  const posY = Math.max(minFloorY, target[1] + vertOffset);

  return {
    id: `vp-best-${nodeId}`,
    kind: 'detail',
    position: [
      Number((target[0] + bestUx * horizDist).toFixed(3)),
      Number(posY.toFixed(3)),
      Number((target[2] + bestUz * horizDist).toFixed(3)),
    ],
    target,
    fov: 38,
  };
}

export function computeFitViewpoint(
  doc: SceneDoc,
  nodeId: string,
  levelMode: LevelMode = 'stacked',
  fovDeg = 38,
): Viewpoint {
  const box = worldBox(doc, nodeId, levelMode);
  if (!box) {
    return OVERVIEW_VIEWPOINT;
  }

  const target = clampTargetToBounds(box.center);
  const best = computeBestViewpoint(doc, nodeId, levelMode);

  let dx = best.position[0] - best.target[0];
  let dy = best.position[1] - best.target[1];
  let dz = best.position[2] - best.target[2];
  const dirLen = Math.hypot(dx, dy, dz);

  if (dirLen <= 1e-4) {
    const inv = 1 / Math.sqrt(3);
    dx = inv;
    dy = inv;
    dz = inv;
  } else {
    dx /= dirLen;
    dy /= dirLen;
    dz /= dirLen;
  }

  const radius = Math.max(
    0.45,
    Math.hypot(box.size[0], box.size[1], box.size[2]) * 0.5,
  );
  const padding = 1.35;
  const minDistance = 2.4;
  const safeFovDeg = Number.isFinite(fovDeg) && fovDeg > 5 ? fovDeg : 38;
  const halfFovRad = (safeFovDeg * Math.PI) / 360;
  const rawDistance = (radius * padding) / Math.max(0.15, Math.sin(halfFovRad));
  const distance = Math.min(
    CAMERA_LIMITS.maxDistance,
    Math.max(minDistance, rawDistance),
  );

  const lvl = levelOf(doc, nodeId);
  const minFloorY = lvl
    ? getLevelWorldY(lvl, levelMode) + 0.45
    : CAMERA_LIMITS.boundaryMin[1] + 0.5;
  const rawPosY = target[1] + dy * distance;
  const posY = Math.max(minFloorY, rawPosY);

  return {
    id: `vp-fit-${nodeId}`,
    kind: 'detail',
    position: [
      Number((target[0] + dx * distance).toFixed(3)),
      Number(posY.toFixed(3)),
      Number((target[2] + dz * distance).toFixed(3)),
    ],
    target,
    fov: safeFovDeg,
  };
}

export const WALK_EYE_HEIGHT_M = 1.65;
export const WALK_SPEED_MPS = 3.5;
export const WALK_TURN_RAD_PER_SEC = 1.85;
export const WALK_LOOK_AHEAD_M = 4.5;

export interface WalkPose {
  levelCode: LevelCode;
  position: [number, number, number];
  yaw: number; // radians in XZ plane: 0 looks towards -Z, +PI/2 towards +X
}

export interface WalkStepInput {
  forward: number; // -1..1
  strafe: number;  // -1..1
  turn: number;    // -1..1
}

export function poseToViewpoint(pose: WalkPose): Viewpoint {
  const [x, y, z] = pose.position;
  const lookX = x + Math.sin(pose.yaw) * WALK_LOOK_AHEAD_M;
  const lookZ = z - Math.cos(pose.yaw) * WALK_LOOK_AHEAD_M;
  return {
    id: `vp-walk-${pose.levelCode.toLowerCase()}`,
    kind: 'eye',
    position: [
      Number(x.toFixed(3)),
      Number(y.toFixed(3)),
      Number(z.toFixed(3)),
    ],
    target: [
      Number(lookX.toFixed(3)),
      Number(y.toFixed(3)),
      Number(lookZ.toFixed(3)),
    ],
    fov: 52,
  };
}

export function computeInitialWalkPose(
  doc: SceneDoc,
  selectedId: string | null,
  focusLevel: LevelCode | 'ALL',
): WalkPose {
  const inferredLevel =
    focusLevel !== 'ALL'
      ? focusLevel
      : levelOf(doc, selectedId)?.code ?? 'L1';

  const levelNode =
    getLevelByCode(doc, inferredLevel) ?? getLevelByCode(doc, 'L1')!;
  const eyeY = levelNode.elevation + WALK_EYE_HEIGHT_M;

  const selectedZone = zoneOf(doc, selectedId);
  const candidateZones = zonesOfLevel(doc, levelNode.id);
  const activeZone =
    selectedZone && levelOf(doc, selectedZone.id)?.code === levelNode.code
      ? selectedZone
      : candidateZones.find(z => z.viewpoints.some(v => v.kind === 'eye')) ??
        candidateZones[0] ??
        null;

  const eyeVp = activeZone?.viewpoints.find(v => v.kind === 'eye');
  if (eyeVp) {
    const dx = eyeVp.target[0] - eyeVp.position[0];
    const dz = eyeVp.target[2] - eyeVp.position[2];
    const yaw = Math.atan2(dx, -dz);
    return {
      levelCode: levelNode.code,
      position: [eyeVp.position[0], eyeY, eyeVp.position[2]],
      yaw: Number.isFinite(yaw) ? yaw : 0,
    };
  }

  if (activeZone) {
    const box = worldBox(doc, activeZone.id, 'stacked');
    if (box) {
      return {
        levelCode: levelNode.code,
        position: [box.center[0], eyeY, box.center[2]],
        yaw: 0,
      };
    }
  }

  const slabBounds = polygonBounds2D(levelNode.slabPolygon);
  return {
    levelCode: levelNode.code,
    position: [
      (slabBounds.minX + slabBounds.maxX) * 0.5,
      eyeY,
      (slabBounds.minZ + slabBounds.maxZ) * 0.5,
    ],
    yaw: 0,
  };
}

export function stepWalkPose(
  pose: WalkPose,
  input: WalkStepInput,
  dtSec: number,
  walls: WallNode[],
  slabBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): WalkPose {
  const safeDt = Math.min(0.1, Math.max(0.001, dtSec));
  const nextYaw = pose.yaw + input.turn * WALK_TURN_RAD_PER_SEC * safeDt;

  const forwardX = Math.sin(nextYaw);
  const forwardZ = -Math.cos(nextYaw);
  const rightX = Math.cos(nextYaw);
  const rightZ = Math.sin(nextYaw);

  let moveX = forwardX * input.forward + rightX * input.strafe;
  let moveZ = forwardZ * input.forward + rightZ * input.strafe;
  const moveLen = Math.hypot(moveX, moveZ);
  if (moveLen > 1e-5) {
    moveX = (moveX / moveLen) * WALK_SPEED_MPS * safeDt;
    moveZ = (moveZ / moveLen) * WALK_SPEED_MPS * safeDt;
  }

  const fromXZ: Vec2 = [pose.position[0], pose.position[2]];
  let targetXZ: Vec2 = [fromXZ[0] + moveX, fromXZ[1] + moveZ];

  if (slabBounds) {
    const margin = 0.45;
    targetXZ = [
      Math.min(slabBounds.maxX - margin, Math.max(slabBounds.minX + margin, targetXZ[0])),
      Math.min(slabBounds.maxZ - margin, Math.max(slabBounds.minZ + margin, targetXZ[1])),
    ];
  }

  const resolvedXZ = resolveWalkCollision2D(fromXZ, targetXZ, walls, 0.36);

  return {
    levelCode: pose.levelCode,
    position: [resolvedXZ[0], pose.position[1], resolvedXZ[1]],
    yaw: nextYaw,
  };
}

