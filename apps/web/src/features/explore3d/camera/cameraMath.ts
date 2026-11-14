import { getCityColliders } from '../renderers/architecture/buildCityMetropolis';
import {
  polygonBounds2D,
  type LevelCode,
  type LevelNode,
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
  itemsOfLevel,
  levelOf,
  wallsOfLevel,
  worldBox,
  zoneOf,
  zonesOfLevel,
} from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import type { LevelMode } from '../state/exploreStore';

export const OVERVIEW_VIEWPOINT: Viewpoint = {
  id: 'vp-default-overview',
  kind: 'overview',
  position: [46, 36, 48],
  target: [4, 2, 0],
  fov: 38,
};

export const OVERVIEW_CAMERA = OVERVIEW_VIEWPOINT;

const OVERVIEW_TARGET: Vec3 = [4, 12, 0];
const OVERVIEW_DIRECTION: Vec3 = [42, 34, 48];
/** Metres of the scene the locked overview shows across the frame at the target. */
const OVERVIEW_VISIBLE_WIDTH_M = 135;

/**
 * The locked hero shot: same bearing and tilt as `OVERVIEW_VIEWPOINT`, pulled back so the whole
 * campus and the skyline behind it stay in frame at this canvas aspect (width / height). The
 * camera can't be zoomed by hand, so the distance has to follow the window, not the other way round.
 */
export function getOverviewViewpoint(aspect: number): Viewpoint {
  const safeAspect = Number.isFinite(aspect) && aspect > 0.2 ? aspect : 1.6;
  const halfFov = (OVERVIEW_VIEWPOINT.fov! * Math.PI) / 360;
  const distance = Math.min(
    150,
    Math.max(80, OVERVIEW_VISIBLE_WIDTH_M / (2 * Math.tan(halfFov) * safeAspect)),
  );
  const len = Math.hypot(...OVERVIEW_DIRECTION);
  return {
    ...OVERVIEW_VIEWPOINT,
    position: [
      OVERVIEW_TARGET[0] + (OVERVIEW_DIRECTION[0] / len) * distance,
      OVERVIEW_TARGET[1] + (OVERVIEW_DIRECTION[1] / len) * distance,
      OVERVIEW_TARGET[2] + (OVERVIEW_DIRECTION[2] / len) * distance,
    ],
    target: OVERVIEW_TARGET,
  };
}

export const CAMERA_LIMITS = {
  minDistance: 0.65,
  maxDistance: 165,
  // Orbit view is locked to one cinematic tilt (28° above the horizon, the overview's own angle):
  // vertical drags do nothing, only walk mode frees the camera. It also keeps clear of the
  // near-top-down range, where figures below the vertical vanishing point are drawn head-down.
  minPolarAngle: 1.08,
  maxPolarAngle: 1.08,
  boundaryMin: [-54, -8, -42] as Vec3,
  boundaryMax: [68, 36, 42] as Vec3,
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

export interface ObstacleBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const WALKABLE_SURFACE_ITEM_KINDS = new Set<string>([
  'yoga-mat',
  'badminton-court',
  'pickleball-court',
  'tennis-court',
  'swim-lane',
  'swimming-lane',
  'wall-mirror',
  'stair-core',
  'elevator-core',
]);

/**
 * Collects 2D axis-aligned obstacle boxes for solid floor-standing equipment and the B1 deep pool basin
 * so first-person walkers cannot pass through machines, counters, lockers, or deep water.
 */
export function getWalkObstaclesForLevel(
  doc: SceneDoc,
  levelCode: LevelCode,
): ObstacleBox2D[] {
  const obstacles: ObstacleBox2D[] = [];

  if (levelCode === 'B1') {
    // Deep water basin of Oasis 25m Lap Pool (leaves east deck x>=5.5 and south deck z>=0.8 walkable)
    obstacles.push({
      minX: -18.4,
      maxX: 5.1,
      minZ: -11.4,
      maxZ: 0.35,
    });
  }

  for (const item of itemsOfLevel(doc, levelCode)) {
    if (WALKABLE_SURFACE_ITEM_KINDS.has(item.kind)) continue;
    // Skip ceiling or high wall-mounted items
    if (item.position[1] > 1.2) continue;

    const [x, , z] = item.position;
    const [w, , d] = item.dimensions;
    const cos = Math.abs(Math.cos(item.rotationY));
    const sin = Math.abs(Math.sin(item.rotationY));
    const halfW = Math.max(0.18, (w * cos + d * sin) * 0.5 - 0.08);
    const halfD = Math.max(0.18, (w * sin + d * cos) * 0.5 - 0.08);

    obstacles.push({
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD,
    });
  }

  return obstacles;
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

export function sanitizeCameraPose(
  position: Vec3,
  target: Vec3,
  minCameraY = -4.2,
): { position: Vec3; target: Vec3 } {
  const safeTarget: Vec3 =
    Array.isArray(target) &&
    Number.isFinite(target[0]) &&
    Number.isFinite(target[1]) &&
    Number.isFinite(target[2])
      ? target
      : [...OVERVIEW_VIEWPOINT.target];

  const safePosition: Vec3 =
    Array.isArray(position) &&
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1]) &&
    Number.isFinite(position[2])
      ? position
      : [...OVERVIEW_VIEWPOINT.position];

  const clampedTarget = clampTargetToBounds(safeTarget);

  const ox = safePosition[0] - clampedTarget[0];
  const oy = safePosition[1] - clampedTarget[1];
  const oz = safePosition[2] - clampedTarget[2];
  const rawDist = Math.hypot(ox, oy, oz);

  let ux: number;
  let uy: number;
  let uz: number;
  let clampedDist: number;

  if (rawDist < 1e-4) {
    const defLen = Math.hypot(0.55, 0.52, 0.65);
    ux = 0.55 / defLen;
    uy = 0.52 / defLen;
    uz = 0.65 / defLen;
    clampedDist = CAMERA_LIMITS.minDistance;
  } else {
    ux = ox / rawDist;
    uy = oy / rawDist;
    uz = oz / rawDist;
    clampedDist = Math.min(
      CAMERA_LIMITS.maxDistance,
      Math.max(CAMERA_LIMITS.minDistance, rawDist),
    );
  }

  let px = clampedTarget[0] + ux * clampedDist;
  let py = clampedTarget[1] + uy * clampedDist;
  let pz = clampedTarget[2] + uz * clampedDist;

  const safeMinY = Number.isFinite(minCameraY) ? minCameraY : -4.2;
  const floorY = Math.max(safeMinY, clampedTarget[1] - 0.15);
  if (py < floorY) {
    py = floorY;
    const dy = py - clampedTarget[1];
    const currDist = Math.hypot(px - clampedTarget[0], dy, pz - clampedTarget[2]);
    if (currDist < CAMERA_LIMITS.minDistance) {
      const reqHoriz = Math.sqrt(
        Math.max(0, CAMERA_LIMITS.minDistance ** 2 - dy ** 2),
      );
      const hLen = Math.hypot(px - clampedTarget[0], pz - clampedTarget[2]);
      if (hLen > 1e-4) {
        const scale = reqHoriz / hLen;
        px = clampedTarget[0] + (px - clampedTarget[0]) * scale;
        pz = clampedTarget[2] + (pz - clampedTarget[2]) * scale;
      } else {
        px = clampedTarget[0] + reqHoriz * (1 / Math.SQRT2);
        pz = clampedTarget[2] + reqHoriz * (1 / Math.SQRT2);
      }
    }
  }

  // Keep the lens outside surrounding city towers (margin covers near-plane clipping).
  const margin = 3;
  for (const c of getCityColliders()) {
    const dx = px - c.x;
    const dz = pz - c.z;
    const ex = c.hw + margin - Math.abs(dx);
    const ez = c.hd + margin - Math.abs(dz);
    if (ex > 0 && ez > 0 && py < c.h + margin) {
      if (ex < ez) px += (dx >= 0 ? 1 : -1) * ex;
      else pz += (dz >= 0 ? 1 : -1) * ez;
    }
  }

  return {
    position: [
      Number(px.toFixed(4)),
      Number(py.toFixed(4)),
      Number(pz.toFixed(4)),
    ],
    target: clampedTarget,
  };
}

export function computeProportionalZoomStep(
  currentDistance: number,
  direction: 'in' | 'out',
): number {
  const safeDist = Number.isFinite(currentDistance)
    ? Math.max(
        CAMERA_LIMITS.minDistance,
        Math.min(CAMERA_LIMITS.maxDistance, currentDistance),
      )
    : 24;
  const baseDelta = Math.max(0.45, Math.min(16, safeDist * 0.24));
  const rawNext = direction === 'in' ? safeDist - baseDelta : safeDist + baseDelta;
  return Math.min(
    CAMERA_LIMITS.maxDistance,
    Math.max(CAMERA_LIMITS.minDistance, Number(rawNext.toFixed(4))),
  );
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

function pushCircleOutOfBox2D(
  p: Vec2,
  box: ObstacleBox2D,
  radius: number,
): Vec2 {
  const expandedMinX = box.minX - radius;
  const expandedMaxX = box.maxX + radius;
  const expandedMinZ = box.minZ - radius;
  const expandedMaxZ = box.maxZ + radius;

  if (
    p[0] <= expandedMinX ||
    p[0] >= expandedMaxX ||
    p[1] <= expandedMinZ ||
    p[1] >= expandedMaxZ
  ) {
    return p;
  }

  // Clamp to inner box to find nearest point on box surface
  const cx = Math.min(box.maxX, Math.max(box.minX, p[0]));
  const cz = Math.min(box.maxZ, Math.max(box.minZ, p[1]));
  const dx = p[0] - cx;
  const dz = p[1] - cz;
  const dist = Math.hypot(dx, dz);

  if (dist > 1e-5 && dist < radius) {
    const push = (radius - dist + 1e-3) / dist;
    return [p[0] + dx * push, p[1] + dz * push];
  }

  // Center is inside the box: push out through the nearest face
  const dLeft = Math.abs(p[0] - expandedMinX);
  const dRight = Math.abs(expandedMaxX - p[0]);
  const dTop = Math.abs(p[1] - expandedMinZ);
  const dBottom = Math.abs(expandedMaxZ - p[1]);
  const minPen = Math.min(dLeft, dRight, dTop, dBottom);

  if (minPen === dLeft) return [expandedMinX - 1e-3, p[1]];
  if (minPen === dRight) return [expandedMaxX + 1e-3, p[1]];
  if (minPen === dTop) return [p[0], expandedMinZ - 1e-3];
  return [p[0], expandedMaxZ + 1e-3];
}

/**
 * Resolves 2D movement from `from` to `to` with a circle collider against solid wall segments
 * and optional equipment/pool obstacles.
 * Uses micro-substepping (0.16m), 4-iteration corner depenetration, and a hard topological guard
 * so the walker can slide smoothly along walls and through doorways (`sillHeight === 0`) without
 * ever clipping or passing through a wall.
 */
export function resolveWalkCollision2D(
  from: Vec2,
  to: Vec2,
  walls: WallNode[],
  colliderRadius = 0.42,
  obstacles: ObstacleBox2D[] = [],
): Vec2 {
  const solidSegments: SolidWallSegment2D[] = [];
  for (const wall of walls) {
    solidSegments.push(...getSolidWallSegments2D(wall));
  }

  const totalDx = to[0] - from[0];
  const totalDz = to[1] - from[1];
  const totalDist = Math.hypot(totalDx, totalDz);
  if (totalDist <= 1e-5) return [from[0], from[1]];

  const maxSubstepM = 0.16;
  const steps = Math.max(1, Math.min(48, Math.ceil(totalDist / maxSubstepM)));

  let curr: Vec2 = [from[0], from[1]];

  for (let stepIdx = 1; stepIdx <= steps; stepIdx++) {
    const t0 = (stepIdx - 1) / steps;
    const t1 = stepIdx / steps;
    const stepDx = totalDx * (t1 - t0);
    const stepDz = totalDz * (t1 - t0);

    let candidate: Vec2 = [curr[0] + stepDx, curr[1] + stepDz];
    let disp: Vec2 = [stepDx, stepDz];

    // Multi-pass tangent sliding: if hitting a wall, slide along the wall tangent (-nz, nx)
    for (let pass = 0; pass < 3; pass++) {
      let collidedSeg: SolidWallSegment2D | null = null;
      let minClearance = colliderRadius;

      for (const seg of solidSegments) {
        const segClearance = colliderRadius + seg.thickness * 0.5;
        if (segmentsIntersect2D(curr, candidate, seg.a, seg.b)) {
          collidedSeg = seg;
          minClearance = segClearance;
          break;
        }
        const cp = closestPointOnSegment2D(candidate, seg.a, seg.b);
        const dist = Math.hypot(candidate[0] - cp[0], candidate[1] - cp[1]);
        if (dist < segClearance - 1e-4) {
          collidedSeg = seg;
          minClearance = segClearance;
          break;
        }
      }

      if (!collidedSeg) break;

      // Contact point & normal pointing from segment to curr
      const cp = closestPointOnSegment2D(curr, collidedSeg.a, collidedSeg.b);
      let nx = curr[0] - cp[0];
      let nz = curr[1] - cp[1];
      let nLen = Math.hypot(nx, nz);
      if (nLen < 1e-4) {
        // Fallback to segment perpendicular
        const segDx = collidedSeg.b[0] - collidedSeg.a[0];
        const segDz = collidedSeg.b[1] - collidedSeg.a[1];
        nx = -segDz;
        nz = segDx;
        nLen = Math.hypot(nx, nz);
      }
      if (nLen > 1e-5) {
        nx /= nLen;
        nz /= nLen;
      } else {
        nx = 0;
        nz = 1;
      }

      // Tangent vector
      const tx = -nz;
      const tz = nx;

      // Project remaining displacement onto tangent
      const dot = disp[0] * tx + disp[1] * tz;
      disp = [tx * dot, tz * dot];

      // Depenetrate curr slightly outside wall boundary
      const safeX = cp[0] + nx * (minClearance + 0.002);
      const safeZ = cp[1] + nz * (minClearance + 0.002);
      candidate = [safeX + disp[0], safeZ + disp[1]];
    }

    // Depenetrate against all segments and obstacle boxes
    for (let iter = 0; iter < 4; iter++) {
      for (const seg of solidSegments) {
        const minClearance = colliderRadius + seg.thickness * 0.5;
        const cp = closestPointOnSegment2D(candidate, seg.a, seg.b);
        const dx = candidate[0] - cp[0];
        const dz = candidate[1] - cp[1];
        const dist = Math.hypot(dx, dz);
        if (dist < minClearance) {
          if (dist > 1e-5) {
            const push = (minClearance - dist + 1e-3) / dist;
            candidate = [candidate[0] + dx * push, candidate[1] + dz * push];
          }
        }
      }

      if (obstacles.length > 0) {
        const eqRadius = colliderRadius * 0.72;
        for (const box of obstacles) {
          candidate = pushCircleOutOfBox2D(candidate, box, eqRadius);
        }
      }
    }

    // Final safety guard: ensure candidate never intersects any wall segment
    let crossed = false;
    for (const seg of solidSegments) {
      if (segmentsIntersect2D(curr, candidate, seg.a, seg.b)) {
        crossed = true;
        break;
      }
    }

    if (crossed) {
      // Single axis fallback: try X-only, then Z-only
      const tryX: Vec2 = [curr[0] + disp[0], curr[1]];
      const tryZ: Vec2 = [curr[0], curr[1] + disp[1]];
      let xCrossed = false;
      let zCrossed = false;
      for (const seg of solidSegments) {
        if (!xCrossed && segmentsIntersect2D(curr, tryX, seg.a, seg.b)) xCrossed = true;
        if (!zCrossed && segmentsIntersect2D(curr, tryZ, seg.a, seg.b)) zCrossed = true;
      }
      if (!xCrossed) {
        candidate = tryX;
      } else if (!zCrossed) {
        candidate = tryZ;
      } else {
        break;
      }
    }

    curr = candidate;
  }

  return curr;
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
  const radius = Math.max(
    0.45,
    Math.hypot(box.size[0], box.size[1], box.size[2]) * 0.5,
  );
  const rawDistance =
    node.type === 'hotspot'
      ? 6.4
      : node.type === 'item'
        ? Math.min(16, Math.max(CAMERA_LIMITS.minDistance + 0.35, radius * 2.1))
        : Math.max(4.6, maxSpan * 1.65 + 2.8);
  const distance = Math.min(
    CAMERA_LIMITS.maxDistance - 5,
    Math.max(CAMERA_LIMITS.minDistance + 0.35, rawDistance),
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
  const node = getNode(doc, nodeId);
  const padding = 1.35;
  const minDistance = CAMERA_LIMITS.minDistance + 0.35;
  const safeFovDeg = Number.isFinite(fovDeg) && fovDeg > 5 ? fovDeg : 38;
  const halfFovRad = (safeFovDeg * Math.PI) / 360;
  const rawDistance = (radius * padding) / Math.max(0.15, Math.sin(halfFovRad));
  const distance =
    node?.type === 'item'
      ? Math.min(16, Math.max(minDistance, radius * 2.1))
      : Math.min(CAMERA_LIMITS.maxDistance, Math.max(minDistance, rawDistance));

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

export const computeFitItemCamera = computeFitViewpoint;

export const WALK_EYE_HEIGHT_M = 1.65;
export const WALK_SPEED_MPS = 3.6;
export const WALK_TURN_RAD_PER_SEC = 1.85;
export const WALK_PITCH_RAD_PER_SEC = 1.35;
export const WALK_LOOK_AHEAD_M = 4.5;
export const WALK_FOV_DEG = 60;
export const WALK_COLLIDER_RADIUS_M = 0.42;
export const WALK_MAX_PITCH_RAD = (62 * Math.PI) / 180;

export interface WalkPose {
  levelCode: LevelCode;
  position: [number, number, number];
  yaw: number; // radians in XZ plane: 0 looks towards -Z, +PI/2 towards +X
  pitch?: number; // radians vertical look: positive looks up, negative looks down
}

export interface WalkStepInput {
  forward: number; // -1..1
  strafe: number;  // -1..1
  turn: number;    // -1..1
  pitchDelta?: number; // -1..1
}

export function clampWalkPitch(pitchRad: number): number {
  if (!Number.isFinite(pitchRad)) return 0;
  return Math.min(WALK_MAX_PITCH_RAD, Math.max(-WALK_MAX_PITCH_RAD, pitchRad));
}

export function rotateWalkPose(
  pose: WalkPose,
  deltaYawRad: number,
  deltaPitchRad = 0,
): WalkPose {
  const nextYaw = pose.yaw + (Number.isFinite(deltaYawRad) ? deltaYawRad : 0);
  const nextPitch = clampWalkPitch(
    (pose.pitch ?? 0) + (Number.isFinite(deltaPitchRad) ? deltaPitchRad : 0),
  );
  return {
    ...pose,
    yaw: nextYaw,
    pitch: nextPitch,
  };
}

export function poseToViewpoint(pose: WalkPose): Viewpoint {
  const [x, y, z] = pose.position;
  const pitch = clampWalkPitch(pose.pitch ?? 0);
  const horizDist = Math.cos(pitch) * WALK_LOOK_AHEAD_M;
  const lookX = x + Math.sin(pose.yaw) * horizDist;
  const lookY = y + Math.sin(pitch) * WALK_LOOK_AHEAD_M;
  const lookZ = z - Math.cos(pose.yaw) * horizDist;
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
      Number(lookY.toFixed(3)),
      Number(lookZ.toFixed(3)),
    ],
    fov: WALK_FOV_DEG,
  };
}

export interface StairElevationState {
  onStairs: boolean;
  progress: number; // 0 at lower south entry, 1 at upper north landing
  elevationOffset: number; // 0..2.15m vertical climb along the stair flight
  stairItemId: string | null;
}

export function computeStairElevationOffset(
  doc: SceneDoc,
  levelCode: LevelCode,
  x: number,
  z: number,
): StairElevationState {
  for (const item of itemsOfLevel(doc, levelCode)) {
    if (item.kind !== 'stair-core') continue;
    const [sx, , sz] = item.position;
    const [w, , d] = item.dimensions;
    const halfW = w * 0.5 + 0.35;
    const halfD = d * 0.5 + 0.35;
    if (Math.abs(x - sx) <= halfW && Math.abs(z - sz) <= halfD) {
      const rawProgress = (sz + d * 0.5 - z) / Math.max(0.5, d);
      const progress = Math.max(0, Math.min(1, rawProgress));

      // Compute exact floor-to-floor vertical rise between stacked levels
      let span = 4.5;
      const currentLvl = getLevelByCode(doc, levelCode);
      if (currentLvl) {
        const idx = VERTICAL_STAIR_FLOORS.indexOf(levelCode);
        if (idx !== -1 && idx < VERTICAL_STAIR_FLOORS.length - 1) {
          const nextLvl = getLevelByCode(doc, VERTICAL_STAIR_FLOORS[idx + 1]!);
          if (nextLvl) {
            span = Math.max(2.5, nextLvl.elevation - currentLvl.elevation);
          }
        } else if (idx > 0) {
          const prevLvl = getLevelByCode(doc, VERTICAL_STAIR_FLOORS[idx - 1]!);
          if (prevLvl) {
            span = Math.max(2.5, currentLvl.elevation - prevLvl.elevation);
          }
        }
      }

      const elevationOffset = Number((progress * span).toFixed(3));
      return {
        onStairs: true,
        progress: Number(progress.toFixed(3)),
        elevationOffset,
        stairItemId: item.id,
      };
    }
  }
  return {
    onStairs: false,
    progress: 0,
    elevationOffset: 0,
    stairItemId: null,
  };
}

const VERTICAL_STAIR_FLOORS: readonly LevelCode[] = ['B1', 'L1', 'L2', 'RF'] as const;

/**
 * Evaluates whether a walk step across a `stair-core` landing triggers a floor transition
 * up or down between B1 <-> L1 <-> L2 <-> RF.
 */
export function evaluateStairOrElevatorPortal(
  doc: SceneDoc,
  prevPose: WalkPose,
  nextPose: WalkPose,
): LevelCode | null {
  if (prevPose.levelCode !== nextPose.levelCode) return null;
  const idx = VERTICAL_STAIR_FLOORS.indexOf(nextPose.levelCode);
  if (idx === -1) return null;

  const prevStair = computeStairElevationOffset(
    doc,
    prevPose.levelCode,
    prevPose.position[0],
    prevPose.position[2],
  );
  const nextStair = computeStairElevationOffset(
    doc,
    nextPose.levelCode,
    nextPose.position[0],
    nextPose.position[2],
  );

  // Walking North (-Z) to the upper landing of the staircase
  if (
    nextStair.onStairs &&
    nextStair.progress >= 0.82 &&
    nextPose.position[2] < prevPose.position[2] - 0.005
  ) {
    if (nextPose.levelCode === 'RF') {
      return 'L2';
    }
    return VERTICAL_STAIR_FLOORS[Math.min(VERTICAL_STAIR_FLOORS.length - 1, idx + 1)]!;
  }

  // Walking South (+Z) back down to the lower landing after being on the stair flight
  if (
    prevStair.onStairs &&
    prevStair.progress > 0.22 &&
    nextStair.onStairs &&
    nextStair.progress <= 0.18 &&
    nextPose.position[2] > prevPose.position[2] + 0.005
  ) {
    if (nextPose.levelCode === 'B1') {
      return 'L1';
    }
    return VERTICAL_STAIR_FLOORS[Math.max(0, idx - 1)]!;
  }

  return null;
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

  const selectedNode = selectedId ? getNode(doc, selectedId) : null;
  const selectedNodeLevel = selectedId ? levelOf(doc, selectedId) : null;
  const selectedZone = zoneOf(doc, selectedId);
  const candidateZones = zonesOfLevel(doc, levelNode.id);
  const activeZone =
    selectedZone && levelOf(doc, selectedZone.id)?.code === levelNode.code
      ? selectedZone
      : candidateZones.find(z => z.viewpoints.some(v => v.kind === 'eye')) ??
        candidateZones[0] ??
        null;

  // When a specific ItemNode or HotspotNode on this level is selected, spawn in front of it facing it directly
  if (
    selectedNode &&
    selectedNodeLevel?.code === levelNode.code &&
    (selectedNode.type === 'item' || selectedNode.type === 'hotspot')
  ) {
    const ix = selectedNode.position[0];
    const iz = selectedNode.position[2];
    const walls = wallsOfLevel(doc, levelNode.code);
    const obstacles = getWalkObstaclesForLevel(doc, levelNode.code);
    const slabBounds = polygonBounds2D(levelNode.slabPolygon);
    const zoneBounds = activeZone ? polygonBounds2D(activeZone.polygon) : slabBounds;

    if (
      selectedNode.type === 'item' &&
      (selectedNode.kind === 'stair-core' || selectedNode.kind === 'elevator-core')
    ) {
      const halfD = selectedNode.dimensions[2] * 0.5;
      const approachZ = Math.min(slabBounds.maxZ - 0.65, iz + halfD + 1.25);
      const safeXZ = resolveWalkCollision2D(
        [ix, approachZ],
        [ix, approachZ],
        walls,
        WALK_COLLIDER_RADIUS_M,
        obstacles,
      );
      const dx = ix - safeXZ[0];
      const dz = iz - safeXZ[1];
      const yaw = Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, -dz) : 0;
      return {
        levelCode: levelNode.code,
        position: [
          Number(safeXZ[0].toFixed(3)),
          eyeY,
          Number(safeXZ[1].toFixed(3)),
        ],
        yaw: Number.isFinite(yaw) ? yaw : 0,
        pitch: 0,
      };
    }

    const itemRadius =
      selectedNode.type === 'item'
        ? Math.min(
            2.4,
            Math.hypot(selectedNode.dimensions[0], selectedNode.dimensions[2]) * 0.5,
          )
        : 0.4;
    const standOff = Math.max(2.1, Math.min(3.4, itemRadius + 1.45));

    const eyeVp = activeZone?.viewpoints.find(v => v.kind === 'eye');
    const refX = eyeVp
      ? eyeVp.position[0]
      : (zoneBounds.minX + zoneBounds.maxX) * 0.5;
    const refZ = eyeVp
      ? eyeVp.position[2]
      : (zoneBounds.minZ + zoneBounds.maxZ) * 0.5;

    const toRefDx = refX - ix;
    const toRefDz = refZ - iz;
    const toRefLen = Math.hypot(toRefDx, toRefDz);

    const candidateDirs: Vec2[] = [];
    if (toRefLen > 0.25) {
      candidateDirs.push([toRefDx / toRefLen, toRefDz / toRefLen]);
    }
    if (selectedNode.type === 'item') {
      const rot = selectedNode.rotationY;
      candidateDirs.push([Math.sin(rot), Math.cos(rot)]);
      candidateDirs.push([-Math.sin(rot), -Math.cos(rot)]);
    }
    candidateDirs.push(
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1 / Math.SQRT2, 1 / Math.SQRT2],
      [-1 / Math.SQRT2, 1 / Math.SQRT2],
      [1 / Math.SQRT2, -1 / Math.SQRT2],
      [-1 / Math.SQRT2, -1 / Math.SQRT2],
    );

    let bestCandidate: Vec2 = [refX, refZ];
    let bestScore = -Infinity;

    for (const [ux, uz] of candidateDirs) {
      const rawCx = ix + ux * standOff;
      const rawCz = iz + uz * standOff;
      const cx = Math.min(
        slabBounds.maxX - 0.6,
        Math.max(slabBounds.minX + 0.6, rawCx),
      );
      const cz = Math.min(
        slabBounds.maxZ - 0.6,
        Math.max(slabBounds.minZ + 0.6, rawCz),
      );
      const resolved = resolveWalkCollision2D(
        [cx, cz],
        [cx, cz],
        walls,
        WALK_COLLIDER_RADIUS_M,
        obstacles,
      );
      const distToItem = Math.hypot(resolved[0] - ix, resolved[1] - iz);
      if (distToItem < 0.75) continue;

      const wallHits = countInteriorWallCrossings([ix, iz], resolved, walls);
      const inZone =
        resolved[0] >= zoneBounds.minX + 0.35 &&
        resolved[0] <= zoneBounds.maxX - 0.35 &&
        resolved[1] >= zoneBounds.minZ + 0.35 &&
        resolved[1] <= zoneBounds.maxZ - 0.35;
      const distToRef = Math.hypot(resolved[0] - refX, resolved[1] - refZ);
      const score =
        -wallHits * 25 +
        (inZone ? 8 : 0) -
        Math.abs(distToItem - standOff) * 1.5 -
        distToRef * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = resolved;
      }
    }

    const dx = ix - bestCandidate[0];
    const dz = iz - bestCandidate[1];
    const yaw = Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, -dz) : 0;

    return {
      levelCode: levelNode.code,
      position: [
        Number(bestCandidate[0].toFixed(3)),
        eyeY,
        Number(bestCandidate[1].toFixed(3)),
      ],
      yaw: Number.isFinite(yaw) ? yaw : 0,
      pitch: -0.08,
    };
  }

  const eyeVp = activeZone?.viewpoints.find(v => v.kind === 'eye');
  if (eyeVp) {
    const dx = eyeVp.target[0] - eyeVp.position[0];
    const dz = eyeVp.target[2] - eyeVp.position[2];
    const yaw = Math.atan2(dx, -dz);
    return {
      levelCode: levelNode.code,
      position: [eyeVp.position[0], eyeY, eyeVp.position[2]],
      yaw: Number.isFinite(yaw) ? yaw : 0,
      pitch: 0,
    };
  }

  if (activeZone) {
    const box = worldBox(doc, activeZone.id, 'stacked');
    if (box) {
      return {
        levelCode: levelNode.code,
        position: [box.center[0], eyeY, box.center[2]],
        yaw: 0,
        pitch: 0,
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
    pitch: 0,
  };
}

export function stepWalkPose(
  pose: WalkPose,
  input: WalkStepInput,
  dtSec: number,
  walls: WallNode[],
  slabBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
  obstacles: ObstacleBox2D[] = [],
  doc: SceneDoc = SOL_CENTER_SCENE,
): WalkPose {
  const safeDt = Math.min(0.1, Math.max(0.001, dtSec));
  const nextYaw = pose.yaw + input.turn * WALK_TURN_RAD_PER_SEC * safeDt;
  const nextPitch = clampWalkPitch(
    (pose.pitch ?? 0) + (input.pitchDelta ?? 0) * WALK_PITCH_RAD_PER_SEC * safeDt,
  );

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
    if (pose.levelCode === 'L1') {
      // L1 connects seamlessly to outdoor plaza through main entry and east doors
      const plazaMinX = -45;
      const plazaMaxX = 58;
      const plazaMinZ = -30;
      const plazaMaxZ = 30;
      targetXZ = [
        Math.min(plazaMaxX, Math.max(plazaMinX, targetXZ[0])),
        Math.min(plazaMaxZ, Math.max(plazaMinZ, targetXZ[1])),
      ];
    } else {
      const margin = 0.52;
      targetXZ = [
        Math.min(slabBounds.maxX - margin, Math.max(slabBounds.minX + margin, targetXZ[0])),
        Math.min(slabBounds.maxZ - margin, Math.max(slabBounds.minZ + margin, targetXZ[1])),
      ];
    }
  }

  const resolvedXZ = resolveWalkCollision2D(
    fromXZ,
    targetXZ,
    walls,
    WALK_COLLIDER_RADIUS_M,
    obstacles,
  );

  let finalX = resolvedXZ[0];
  const finalZ = resolvedXZ[1];

  const levelNode = getLevelByCode(doc, pose.levelCode);
  const baseEyeY = levelNode
    ? levelNode.elevation + WALK_EYE_HEIGHT_M
    : pose.position[1];
  const stairState = computeStairElevationOffset(
    doc,
    pose.levelCode,
    finalX,
    finalZ,
  );

  // Hard Lateral Balustrade Guard: clamp lateral X firmly within clear inner balustrade width while on flight
  if (stairState.onStairs && stairState.progress > 0.06 && stairState.progress < 0.94) {
    const stairItem = stairState.stairItemId ? getNode(doc, stairState.stairItemId) : null;
    const stairX = stairItem?.type === 'item' ? stairItem.position[0] : 10.5;
    finalX = Math.min(stairX + 1.15, Math.max(stairX - 1.15, finalX));
  }

  const nextY = Number((baseEyeY + stairState.elevationOffset).toFixed(3));

  return {
    levelCode: pose.levelCode,
    position: [finalX, nextY, finalZ],
    yaw: nextYaw,
    pitch: nextPitch,
  };
}

export interface ContinuousStairFlightState {
  onStairs: boolean;
  flightFrom: LevelCode | null;
  flightTo: LevelCode | null;
  progress: number;
  surfaceFootY: number;
  midpointLevel: LevelCode | null;
  collisionLevel: LevelCode | null;
  stairX: number;
}

/**
 * Resolves which physical 3D stair flight (`B1->L1`, `L1->L2`, or `L2->RF`) the walker is on
 * using BOTH `(x, z)` stairwell footprint and actual 3D elevation proximity (`currentFootY`).
 *
 * Because all 4 floors share vertically stacked shafts at `(10.5, 11.5)`, matching against
 * `currentFootY` prevents double-floor teleports (`L1 -> L2 -> RF`) at landings and enables
 * smooth bidirectional ascending/descending across all levels.
 */
export function resolveContinuousStairFlight(
  doc: SceneDoc,
  x: number,
  z: number,
  currentFootY: number,
): ContinuousStairFlightState {
  let bestMatch: ContinuousStairFlightState | null = null;
  let bestDy = Infinity;

  for (let i = 0; i < VERTICAL_STAIR_FLOORS.length - 1; i++) {
    const fromCode = VERTICAL_STAIR_FLOORS[i]!;
    const toCode = VERTICAL_STAIR_FLOORS[i + 1]!;
    const fromLvl = getLevelByCode(doc, fromCode);
    const toLvl = getLevelByCode(doc, toCode);
    if (!fromLvl || !toLvl) continue;

    for (const item of itemsOfLevel(doc, fromCode)) {
      if (item.kind !== 'stair-core') continue;
      const [sx, , sz] = item.position;
      const [w, , d] = item.dimensions;
      const halfW = Math.min(1.75, w * 0.5);
      const halfD = d * 0.5 + 0.35;
      if (Math.abs(x - sx) > halfW || Math.abs(z - sz) > halfD) continue;

      const rawProgress = (sz + d * 0.5 - z) / Math.max(0.5, d);
      const progress = Math.max(0, Math.min(1, rawProgress));
      const surfaceFootY =
        fromLvl.elevation + progress * (toLvl.elevation - fromLvl.elevation);
      const dy = Math.abs(surfaceFootY - currentFootY);

      if (dy <= 1.85 && dy < bestDy) {
        bestDy = dy;
        const midY = (fromLvl.elevation + toLvl.elevation) * 0.5;
        const isUpperHalf = surfaceFootY >= midY;
        const collisionLevel =
          progress <= 0.15
            ? fromCode
            : progress >= 0.85
              ? toCode
              : isUpperHalf
                ? toCode
                : fromCode;
        bestMatch = {
          onStairs: true,
          flightFrom: fromCode,
          flightTo: toCode,
          progress: Number(progress.toFixed(4)),
          surfaceFootY: Number(surfaceFootY.toFixed(4)),
          midpointLevel: isUpperHalf ? toCode : fromCode,
          collisionLevel,
          stairX: sx,
        };
      }
    }
  }

  return (
    bestMatch ?? {
      onStairs: false,
      flightFrom: null,
      flightTo: null,
      progress: 0,
      surfaceFootY: currentFootY,
      midpointLevel: null,
      collisionLevel: null,
      stairX: 10.5,
    }
  );
}

/**
 * Finds the structural indoor floor level (`B1`, `L1`, `L2`, or `RF`) whose slab elevation
 * matches the walker's current vertical foot position.
 */
export function resolveHorizontalLevelAtElevation(
  doc: SceneDoc,
  footY: number,
): LevelNode {
  let bestLevel = getLevelByCode(doc, 'L1')!;
  let bestDy = Infinity;
  for (const code of VERTICAL_STAIR_FLOORS) {
    const lvl = getLevelByCode(doc, code);
    if (!lvl) continue;
    const dy = Math.abs(lvl.elevation - footY);
    if (dy < bestDy) {
      bestDy = dy;
      bestLevel = lvl;
    }
  }
  return bestLevel;
}

/**
 * Continuous 3D movement solver for live WalkView:
 * - Zero-stick tangent-sliding wall + equipment collision
 * - Seamless indoor/outdoor L1 courtyard + tennis arena transition
 * - Elevation-locked stair flight ascending/descending with hard lateral balustrade clamp
 */
export function stepContinuousWalkPose3D(
  doc: SceneDoc,
  pose: WalkPose,
  dispX: number,
  dispZ: number,
  nextYaw: number,
  nextPitch: number,
): { pose: WalkPose; targetEyeY: number; stairState: ContinuousStairFlightState } {
  const safePitch = clampWalkPitch(nextPitch);
  const prevFootY = pose.position[1] - WALK_EYE_HEIGHT_M;
  let posX = pose.position[0];
  let posZ = pose.position[2];

  const preStair = resolveContinuousStairFlight(doc, posX, posZ, prevFootY);
  const nearestLvl = resolveHorizontalLevelAtElevation(doc, prevFootY);
  const collisionCode: LevelCode =
    preStair.onStairs && preStair.collisionLevel
      ? preStair.collisionLevel
      : nearestLvl.code;

  if (Math.hypot(dispX, dispZ) > 1e-6) {
    const fromXZ: Vec2 = [posX, posZ];
    let destXZ: Vec2 = [posX + dispX, posZ + dispZ];

    const collisionLevelNode = getLevelByCode(doc, collisionCode);
    let walls = wallsOfLevel(doc, collisionCode);
    let obstacles = getWalkObstaclesForLevel(doc, collisionCode);

    // Ground floor seamlessly bridges indoor L1 and outdoor plaza / tennis fences
    if (collisionCode === 'L1') {
      walls = [...walls, ...wallsOfLevel(doc, 'OUT')];
      obstacles = [...obstacles, ...getWalkObstaclesForLevel(doc, 'OUT')];
    }

    if (collisionLevelNode) {
      const bounds = polygonBounds2D(collisionLevelNode.slabPolygon);
      if (collisionCode === 'L1') {
        destXZ = [
          Math.min(52, Math.max(-44, destXZ[0])),
          Math.min(28, Math.max(-26, destXZ[1])),
        ];
      } else {
        destXZ = [
          Math.min(bounds.maxX - 0.52, Math.max(bounds.minX + 0.52, destXZ[0])),
          Math.min(bounds.maxZ - 0.52, Math.max(bounds.minZ + 0.52, destXZ[1])),
        ];
      }
    }

    const resolvedXZ = resolveWalkCollision2D(
      fromXZ,
      destXZ,
      walls,
      WALK_COLLIDER_RADIUS_M,
      obstacles,
    );
    posX = resolvedXZ[0];
    posZ = resolvedXZ[1];
  }

  const stairState = resolveContinuousStairFlight(doc, posX, posZ, prevFootY);
  let targetFootY: number;
  let nextLevelCode: LevelCode;

  if (stairState.onStairs) {
    if (stairState.progress > 0.06 && stairState.progress < 0.94) {
      posX = Math.min(stairState.stairX + 1.15, Math.max(stairState.stairX - 1.15, posX));
    }
    targetFootY = stairState.surfaceFootY;
    nextLevelCode = stairState.midpointLevel ?? nearestLvl.code;
  } else {
    const settledLvl = resolveHorizontalLevelAtElevation(doc, prevFootY);
    targetFootY = settledLvl.elevation;
    if (settledLvl.code === 'L1' && posX > 22.5 && Math.abs(posZ) <= 17.5) {
      nextLevelCode = 'OUT';
    } else {
      nextLevelCode = settledLvl.code;
    }
  }

  const targetEyeY = Number((targetFootY + WALK_EYE_HEIGHT_M).toFixed(4));
  return {
    pose: {
      levelCode: nextLevelCode,
      position: [posX, targetEyeY, posZ],
      yaw: nextYaw,
      pitch: safePitch,
    },
    targetEyeY,
    stairState,
  };
}


