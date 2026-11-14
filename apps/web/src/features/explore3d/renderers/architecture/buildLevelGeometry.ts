import * as THREE from 'three';
import type {
  LevelCode,
  LevelNode,
  SceneDoc,
  Vec2,
  WallNode,
  WallOpening,
  ZoneNode,
} from '../../scene/schema';
import { polygonBounds2D } from '../../scene/schema';
import { getLevelByCode, wallsOfLevel, zonesOfLevel } from '../../scene/selectors';
import { buildLevelInteriorDetailsGeometry } from './buildInteriorDetails';

export const CUTAWAY_WALL_HEIGHT = 0.45;
export const SLAB_EDGE_HEIGHT = 0.06;
export const SLAB_EDGE_THICKNESS = 0.06;
export const ZONE_FLOOR_Y = 0.015;
export const ZONE_BORDER_Y = 0.018;
export const ZONE_BORDER_WIDTH = 0.05;

export interface WallSubSegment {
  wallId: string;
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  kind: 'solid' | 'sill' | 'header';
  openingId?: string;
}

export interface ZoneFloorBuiltGeometry {
  zoneId: string;
  code: string;
  floorMaterial: ZoneNode['floorMaterial'];
  accentColor?: string;
  geometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
  center: [number, number, number];
}

export interface ExteriorWallBuiltRecord {
  wallId: string;
  normal: [number, number];
  center: [number, number];
  material: WallNode['material'];
  fullGeometry: THREE.BufferGeometry;
  lowCutGeometry: THREE.BufferGeometry;
}

export interface LevelBuiltGeometry {
  levelId: string;
  levelCode: LevelCode;
  slabGeometry: THREE.BufferGeometry;
  slabEdgeGeometry: THREE.BufferGeometry;
  zoneFloorGeometries: ZoneFloorBuiltGeometry[];
  exteriorWallsByNormal: ExteriorWallBuiltRecord[];
  interiorOpaqueGeometry: THREE.BufferGeometry;
  glassWallGeometry: THREE.BufferGeometry;
  interiorDetailsGeometry: THREE.BufferGeometry;
}

function createEmptyGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(0), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(0), 2));
  geom.setIndex(new THREE.BufferAttribute(new Uint16Array(0), 1));
  return geom;
}

/**
 * Merges an array of BufferGeometries into a single indexed BufferGeometry
 * using typed arrays directly (`position`, `normal`, `uv`, `index`).
 */
export function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const valid = geometries.filter(g => {
    const pos = g.getAttribute('position');
    return Boolean(pos && pos.count > 0);
  });

  if (valid.length === 0) {
    return createEmptyGeometry();
  }

  let totalVertices = 0;
  let totalIndices = 0;

  for (const geom of valid) {
    const pos = geom.getAttribute('position');
    const vCount = pos.count;
    totalVertices += vCount;
    const idx = geom.getIndex();
    totalIndices += idx ? idx.count : vCount;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices =
    totalVertices > 65535
      ? new Uint32Array(totalIndices)
      : new Uint16Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geom of valid) {
    const posAttr = geom.getAttribute('position');
    const vCount = posAttr.count;

    let normAttr = geom.getAttribute('normal');
    if (!normAttr || normAttr.count !== vCount) {
      const cloned = geom.clone();
      cloned.computeVertexNormals();
      normAttr = cloned.getAttribute('normal');
    }

    const uvAttr = geom.getAttribute('uv');

    for (let i = 0; i < vCount; i++) {
      const pBase = (vertexOffset + i) * 3;
      positions[pBase] = posAttr.getX(i);
      positions[pBase + 1] = posAttr.getY(i);
      positions[pBase + 2] = posAttr.getZ(i);

      if (normAttr) {
        normals[pBase] = normAttr.getX(i);
        normals[pBase + 1] = normAttr.getY(i);
        normals[pBase + 2] = normAttr.getZ(i);
      } else {
        normals[pBase] = 0;
        normals[pBase + 1] = 1;
        normals[pBase + 2] = 0;
      }

      const uBase = (vertexOffset + i) * 2;
      if (uvAttr && i < uvAttr.count) {
        uvs[uBase] = uvAttr.getX(i);
        uvs[uBase + 1] = uvAttr.getY(i);
      } else {
        uvs[uBase] = 0;
        uvs[uBase + 1] = 0;
      }
    }

    const idxAttr = geom.getIndex();
    if (idxAttr) {
      for (let i = 0; i < idxAttr.count; i++) {
        indices[indexOffset + i] = idxAttr.getX(i) + vertexOffset;
      }
      indexOffset += idxAttr.count;
    } else {
      for (let i = 0; i < vCount; i++) {
        indices[indexOffset + i] = vertexOffset + i;
      }
      indexOffset += vCount;
    }

    vertexOffset += vCount;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

export const STAIRWELL_OPENING_BOUNDS = {
  minX: 8.65,
  maxX: 12.35,
  minZ: 9.35,
  maxZ: 13.55,
} as const;

function createPolygonShape(
  polygon: Vec2[],
  holeBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < polygon.length; i++) {
    const [x, z] = polygon[i];
    if (i === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  }
  shape.closePath();

  if (holeBounds) {
    const hole = new THREE.Path();
    // Counter-clockwise hole in (X, -Z) plane opposite to CW outer polygon
    hole.moveTo(holeBounds.minX, -holeBounds.minZ);
    hole.lineTo(holeBounds.minX, -holeBounds.maxZ);
    hole.lineTo(holeBounds.maxX, -holeBounds.maxZ);
    hole.lineTo(holeBounds.maxX, -holeBounds.minZ);
    hole.closePath();
    shape.holes.push(hole);
  }

  return shape;
}

function buildSlabGeometry(
  polygon: Vec2[],
  thickness: number,
  holeBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): THREE.BufferGeometry {
  const shape = createPolygonShape(polygon, holeBounds);
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  raw.rotateX(-Math.PI / 2);
  raw.translate(0, -thickness, 0);
  const indexed = mergeBufferGeometries([raw]);
  raw.dispose();
  return indexed;
}

function buildPerimeterStripGeometry(
  polygon: Vec2[],
  stripWidth: number,
  stripHeight: number,
  centerY: number,
): THREE.BufferGeometry {
  const segments: THREE.BufferGeometry[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const [x1, z1] = polygon[i];
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len <= 1e-4) continue;

    const box = new THREE.BoxGeometry(len + stripWidth, stripHeight, stripWidth);
    const angle = Math.atan2(-dz, dx);
    box.rotateY(angle);
    box.translate((x1 + x2) * 0.5, centerY, (z1 + z2) * 0.5);
    segments.push(box);
  }
  const merged = mergeBufferGeometries(segments);
  segments.forEach(s => s.dispose());
  return merged;
}

function buildZoneFloorGeometry(
  zone: ZoneNode,
  holeBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
): ZoneFloorBuiltGeometry {
  const bounds = polygonBounds2D(zone.polygon);
  const overlapsHole =
    holeBounds &&
    bounds.minX <= holeBounds.maxX &&
    bounds.maxX >= holeBounds.minX &&
    bounds.minZ <= holeBounds.maxZ &&
    bounds.maxZ >= holeBounds.minZ;

  const shape = createPolygonShape(zone.polygon, overlapsHole ? holeBounds : undefined);
  const rawFloor = new THREE.ShapeGeometry(shape, 1);
  rawFloor.rotateX(-Math.PI / 2);
  rawFloor.translate(0, ZONE_FLOOR_Y, 0);
  const floorGeom = mergeBufferGeometries([rawFloor]);
  rawFloor.dispose();

  const borderGeometry = buildPerimeterStripGeometry(
    zone.polygon,
    ZONE_BORDER_WIDTH,
    0.006,
    ZONE_BORDER_Y,
  );

  const center: [number, number, number] = [
    (bounds.minX + bounds.maxX) * 0.5,
    ZONE_FLOOR_Y,
    (bounds.minZ + bounds.maxZ) * 0.5,
  ];

  return {
    zoneId: zone.id,
    code: zone.code,
    floorMaterial: zone.floorMaterial,
    accentColor: zone.accentColor,
    geometry: floorGeom,
    borderGeometry,
    center,
  };
}

/**
 * Computes the outward XZ unit normal of an exterior wall relative to the level's slab polygon.
 */
export function computeExteriorWallNormal(
  wall: WallNode,
  slabPolygon: Vec2[],
): [number, number] {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const len = Math.hypot(dx, dz);
  if (len <= 1e-5) {
    return [0, 1];
  }

  const bounds = polygonBounds2D(slabPolygon);
  const slabCenterX = (bounds.minX + bounds.maxX) * 0.5;
  const slabCenterZ = (bounds.minZ + bounds.maxZ) * 0.5;

  const wallCenterX = (wall.start[0] + wall.end[0]) * 0.5;
  const wallCenterZ = (wall.start[1] + wall.end[1]) * 0.5;

  // Candidate perpendicular normals
  const n1x = -dz / len;
  const n1z = dx / len;

  const toWallX = wallCenterX - slabCenterX;
  const toWallZ = wallCenterZ - slabCenterZ;
  const dot = n1x * toWallX + n1z * toWallZ;

  if (dot >= 0) {
    return [Number(n1x.toFixed(6)) || 0, Number(n1z.toFixed(6)) || 0];
  }
  return [Number((-n1x).toFixed(6)) || 0, Number((-n1z).toFixed(6)) || 0];
}

/**
 * Splits a wall into rectangular sub-segments around its openings without CSG:
 * - Left / intermediate / right full-height segments
 * - Sill segments (`0..sillHeight`) under windows
 * - Header/lintel segments (`sillHeight + height..wall.height`) above doors/windows/arches
 */
export function splitWallIntoSegments(
  wall: WallNode,
  maxWallHeight?: number,
): WallSubSegment[] {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLength = Math.hypot(dx, dz);
  const effectiveHeight = Math.max(0.05, Math.min(wall.height, maxWallHeight ?? wall.height));

  if (wallLength <= 1e-4) {
    return [];
  }

  const sortedOpenings: WallOpening[] = [...wall.openings]
    .filter(op => op.width > 1e-4 && op.offset < wallLength)
    .sort((a, b) => a.offset - b.offset);

  if (sortedOpenings.length === 0) {
    return [
      {
        wallId: wall.id,
        u0: 0,
        u1: wallLength,
        y0: 0,
        y1: effectiveHeight,
        kind: 'solid',
      },
    ];
  }

  const segments: WallSubSegment[] = [];
  let cursor = 0;

  for (const op of sortedOpenings) {
    const opStart = Math.max(cursor, Math.min(wallLength, op.offset));
    const opEnd = Math.max(opStart, Math.min(wallLength, op.offset + op.width));

    // Solid segment before opening
    if (opStart - cursor > 1e-3) {
      segments.push({
        wallId: wall.id,
        u0: cursor,
        u1: opStart,
        y0: 0,
        y1: effectiveHeight,
        kind: 'solid',
      });
    }

    if (opEnd - opStart > 1e-3) {
      // Sill segment below window opening
      const sillTop = Math.min(op.sillHeight, effectiveHeight);
      if (sillTop > 1e-3) {
        segments.push({
          wallId: wall.id,
          u0: opStart,
          u1: opEnd,
          y0: 0,
          y1: sillTop,
          kind: 'sill',
          openingId: op.id,
        });
      }

      // Header/lintel segment above opening
      const openTop = op.sillHeight + op.height;
      if (effectiveHeight - openTop > 1e-3) {
        segments.push({
          wallId: wall.id,
          u0: opStart,
          u1: opEnd,
          y0: openTop,
          y1: effectiveHeight,
          kind: 'header',
          openingId: op.id,
        });
      }
    }

    cursor = opEnd;
  }

  // Solid segment after last opening
  if (wallLength - cursor > 1e-3) {
    segments.push({
      wallId: wall.id,
      u0: cursor,
      u1: wallLength,
      y0: 0,
      y1: effectiveHeight,
      kind: 'solid',
    });
  }

  return segments;
}

function buildBoxForWallRange(
  wall: WallNode,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  thicknessOverride?: number,
): THREE.BufferGeometry | null {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLength = Math.hypot(dx, dz);
  const segLen = u1 - u0;
  const segHeight = y1 - y0;

  if (wallLength <= 1e-4 || segLen <= 1e-3 || segHeight <= 1e-3) {
    return null;
  }

  const dirX = dx / wallLength;
  const dirZ = dz / wallLength;
  const uMid = (u0 + u1) * 0.5;
  const cx = wall.start[0] + dirX * uMid;
  const cz = wall.start[1] + dirZ * uMid;
  const cy = (y0 + y1) * 0.5;
  const angle = Math.atan2(-dirZ, dirX);

  const box = new THREE.BoxGeometry(
    segLen,
    segHeight,
    thicknessOverride ?? wall.thickness,
  );
  box.rotateY(angle);
  box.translate(cx, cy, cz);
  return box;
}

export function buildSegmentedWallGeometry(
  wall: WallNode,
  maxWallHeight?: number,
): THREE.BufferGeometry {
  const subSegments = splitWallIntoSegments(wall, maxWallHeight);
  const boxes: THREE.BufferGeometry[] = [];

  for (const seg of subSegments) {
    const box = buildBoxForWallRange(wall, seg.u0, seg.u1, seg.y0, seg.y1);
    if (box) {
      boxes.push(box);
    }
  }

  const merged = mergeBufferGeometries(boxes);
  boxes.forEach(b => b.dispose());
  return merged;
}

interface OpeningBuiltGeometries {
  opaqueFrames: THREE.BufferGeometry[];
  glassPanes: THREE.BufferGeometry[];
}

function buildOpeningArchitecturalDetails(wall: WallNode): OpeningBuiltGeometries {
  const opaqueFrames: THREE.BufferGeometry[] = [];
  const glassPanes: THREE.BufferGeometry[] = [];

  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLen = Math.hypot(dx, dz);
  if (wallLen <= 1e-4) return { opaqueFrames, glassPanes };

  const wallAngle = Math.atan2(-dz, dx);
  const unitX = dx / wallLen;
  const unitZ = dz / wallLen;

  for (const op of wall.openings) {
    const isDoor =
      op.kind === 'door' ||
      op.kind === 'double-door' ||
      op.kind === 'glass-door' ||
      op.kind === 'arch';

    if (isDoor) {
      // 1. Left and right door jambs
      const jambWidth = 0.06;
      const leftJamb = buildBoxForWallRange(
        wall,
        op.offset,
        op.offset + jambWidth,
        0,
        op.height,
        wall.thickness + 0.02,
      );
      if (leftJamb) opaqueFrames.push(leftJamb);

      const rightJamb = buildBoxForWallRange(
        wall,
        op.offset + op.width - jambWidth,
        op.offset + op.width,
        0,
        op.height,
        wall.thickness + 0.02,
      );
      if (rightJamb) opaqueFrames.push(rightJamb);

      // 2. Transom header bar
      const transom = buildBoxForWallRange(
        wall,
        op.offset,
        op.offset + op.width,
        op.height - 0.06,
        op.height,
        wall.thickness + 0.02,
      );
      if (transom) opaqueFrames.push(transom);

      // 3. Subtle 85°-open door leaf tucked outside walk path (only for doors, not arch)
      if (op.kind !== 'arch') {
        const leafW = Math.min(
          0.92,
          (op.width - jambWidth * 2) * (op.kind === 'double-door' ? 0.48 : 0.95),
        );
        const leafH = Math.max(0.2, op.height - 0.08);
        const leafThick = 0.04;

        // Pivot on left jamb, swing open ~85° inwards
        const hingeU = op.offset + jambWidth;
        const hx = wall.start[0] + unitX * hingeU;
        const hz = wall.start[1] + unitZ * hingeU;
        const swingAngle = wallAngle + 1.48; // ~85° open

        const leafMidX = hx + Math.cos(-swingAngle) * (leafW * 0.5);
        const leafMidZ = hz - Math.sin(-swingAngle) * (leafW * 0.5);
        const leafMidY = leafH * 0.5;

        const leafBox = new THREE.BoxGeometry(leafW, leafH, leafThick);
        leafBox.rotateY(swingAngle);
        leafBox.translate(leafMidX, leafMidY, leafMidZ);

        if (op.kind === 'glass-door') {
          glassPanes.push(leafBox);
        } else {
          opaqueFrames.push(leafBox);
        }
      }
    } else if (op.kind === 'window') {
      // Window frame perimeter + full glass pane
      const y0 = op.sillHeight;
      const y1 = Math.min(wall.height, op.sillHeight + op.height);
      const pane = buildBoxForWallRange(
        wall,
        op.offset,
        op.offset + op.width,
        y0,
        y1,
        wall.thickness * 0.35,
      );
      if (pane) {
        glassPanes.push(pane);
      }
    }
  }

  return { opaqueFrames, glassPanes };
}

export function buildLevelGeometry(
  doc: SceneDoc,
  levelIdOrCode: string,
): LevelBuiltGeometry {
  const candidate = doc.nodes[levelIdOrCode];
  const level: LevelNode | null =
    candidate && candidate.type === 'level'
      ? candidate
      : getLevelByCode(doc, levelIdOrCode as LevelCode);

  if (!level) {
    throw new Error(`Level "${levelIdOrCode}" not found in SceneDoc`);
  }

  const hasStairwellHole =
    level.code === 'L1' || level.code === 'L2' || level.code === 'RF';
  const holeBounds = hasStairwellHole ? STAIRWELL_OPENING_BOUNDS : undefined;

  const slabGeometry = buildSlabGeometry(
    level.slabPolygon,
    level.slabThickness,
    holeBounds,
  );
  const slabEdgeGeometry = buildPerimeterStripGeometry(
    level.slabPolygon,
    SLAB_EDGE_THICKNESS,
    SLAB_EDGE_HEIGHT,
    -SLAB_EDGE_HEIGHT * 0.25,
  );

  const zones = zonesOfLevel(doc, level.id);
  const zoneFloorGeometries = zones.map(z => buildZoneFloorGeometry(z, holeBounds));

  const walls = wallsOfLevel(doc, level.id);
  const exteriorWallsByNormal: ExteriorWallBuiltRecord[] = [];
  const interiorOpaqueParts: THREE.BufferGeometry[] = [];
  const glassParts: THREE.BufferGeometry[] = [];

  for (const wall of walls) {
    const details = buildOpeningArchitecturalDetails(wall);
    glassParts.push(...details.glassPanes);
    interiorOpaqueParts.push(...details.opaqueFrames);

    if (wall.exterior) {
      const normal = computeExteriorWallNormal(wall, level.slabPolygon);
      const center: [number, number] = [
        (wall.start[0] + wall.end[0]) * 0.5,
        (wall.start[1] + wall.end[1]) * 0.5,
      ];
      const fullGeometry = buildSegmentedWallGeometry(wall, wall.height);
      const lowCutGeometry = buildSegmentedWallGeometry(
        wall,
        Math.min(CUTAWAY_WALL_HEIGHT, wall.height),
      );
      exteriorWallsByNormal.push({
        wallId: wall.id,
        normal,
        center,
        material: wall.material,
        fullGeometry,
        lowCutGeometry,
      });
    } else if (wall.material === 'glass') {
      glassParts.push(buildSegmentedWallGeometry(wall, wall.height));
    } else {
      interiorOpaqueParts.push(buildSegmentedWallGeometry(wall, wall.height));
    }
  }

  const interiorOpaqueGeometry = mergeBufferGeometries(interiorOpaqueParts);
  const glassWallGeometry = mergeBufferGeometries(glassParts);
  const interiorDetailsGeometry = buildLevelInteriorDetailsGeometry(level.code);

  interiorOpaqueParts.forEach(g => g.dispose());
  glassParts.forEach(g => g.dispose());

  return {
    levelId: level.id,
    levelCode: level.code,
    slabGeometry,
    slabEdgeGeometry,
    zoneFloorGeometries,
    exteriorWallsByNormal,
    interiorOpaqueGeometry,
    glassWallGeometry,
    interiorDetailsGeometry,
  };
}
