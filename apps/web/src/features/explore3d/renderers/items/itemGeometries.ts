import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createGymBuilders, type GymBuilderHelpers } from './gymBuilders';
import { createInteriorBuilders } from './interiorBuilders';
import {
  ALL_ITEM_KINDS,
  type ItemKind,
  type ItemNode,
  type LevelCode,
  type LevelNode,
  type SceneDoc,
  type Vec3,
} from '../../scene/schema';
import { allItems, getLevelWorldY, levelOf } from '../../scene/selectors';
import type { LevelMode } from '../../state/exploreStore';

/** Mức chi tiết của hình học đồ vật: cao hoặc thấp. */
export type ItemDetailLevel = 'high' | 'low';

/** Bảng màu dùng chung của đồ vật (than chì, kim loại, hồng salmon, gỗ, đá, kính, lá cây...). */
export const ITEM_PALETTE = {
  charcoal: '#26262a',
  charcoalDeep: '#19191c',
  charcoalSoft: '#34353b',
  metal: '#8b8d94',
  metalLight: '#b8bac2',
  salmon: '#ce9180',
  salmonBright: '#e1aa98',
  screen: '#1e293b',
  screenGlow: '#68b5c9',
  wood: '#a77b5b',
  woodLight: '#c49a76',
  stone: '#d6d3cd',
  white: '#f4f3ef',
  water: '#3a7ca5',
  foliage: '#4a6b53',
  foliageLight: '#62876c',
  terracotta: '#9e6252',
  glass: '#5a6978',
} as const;

export const DEFAULT_ITEM_DIMENSIONS: Record<ItemKind, Vec3> = {
  treadmill: [1.0, 1.45, 2.0],
  'upright-bike': [0.7, 1.3, 1.2],
  elliptical: [1.0, 1.65, 2.1],
  'smith-machine': [2.2, 2.25, 1.6],
  'lat-pulldown': [1.6, 2.2, 1.5],
  'squat-rack': [1.7, 2.3, 1.8],
  'dumbbell-rack': [2.6, 0.95, 0.8],
  'adjustable-bench': [0.8, 0.95, 1.4],
  'kinesis-station': [2.4, 2.25, 1.6],
  'inbody-analyzer': [0.9, 1.35, 1.2],
  'boxing-ring': [5.6, 1.6, 5.6],
  'heavy-bag': [0.9, 2.3, 0.9],
  'speed-bag': [0.8, 2.1, 0.8],
  'badminton-court': [5.6, 1.55, 5.2],
  'tennis-court': [9.5, 1.1, 22.0],
  'swim-lane': [25.0, 0.4, 3.5],
  'starting-block': [0.8, 0.75, 0.8],
  'yoga-mat': [0.8, 0.05, 1.85],
  'meditation-bolster': [0.65, 0.28, 0.65],
  'reception-desk': [5.4, 1.15, 1.6],
  'qr-turnstile': [1.2, 1.05, 1.6],
  'kiosk-checkin': [0.9, 1.55, 0.7],
  'card-printer': [1.1, 1.25, 0.8],
  'supplement-shelf': [2.0, 2.1, 0.8],
  'nutrition-board': [2.4, 1.9, 0.5],
  'trophy-totem': [1.0, 2.1, 0.6],
  'coach-podium': [1.4, 1.2, 1.0],
  'consultation-pod': [2.0, 0.9, 2.0],
  'locker-bank': [3.2, 2.0, 0.9],
  'sauna-bench': [4.2, 1.1, 1.8],
  'jacuzzi-tub': [3.6, 0.95, 3.2],
  'lounge-sofa': [2.6, 0.85, 1.4],
  'juice-bar': [3.8, 1.15, 1.4],
  'stair-core': [3.6, 4.56, 4.28],
  'elevator-core': [2.6, 3.8, 2.6],
  'planter-tree': [1.4, 2.6, 1.4],
};

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempColor = new THREE.Color();

/**
 * Per-part PBR response [roughness, metalness], keyed by palette colour and
 * written to the `surf` vertex attribute. One instanced material can then
 * render chrome, powder-coated steel, rubber and vinyl differently.
 */
const SURFACE_BY_COLOR: Record<string, readonly [number, number]> = {
  [ITEM_PALETTE.charcoal]: [0.42, 0.2],
  [ITEM_PALETTE.charcoalDeep]: [0.82, 0],
  [ITEM_PALETTE.charcoalSoft]: [0.5, 0],
  [ITEM_PALETTE.metal]: [0.3, 1],
  [ITEM_PALETTE.metalLight]: [0.14, 1],
  [ITEM_PALETTE.salmon]: [0.45, 0],
  [ITEM_PALETTE.salmonBright]: [0.45, 0],
  [ITEM_PALETTE.screen]: [0.08, 0],
  [ITEM_PALETTE.screenGlow]: [0.1, 0],
  [ITEM_PALETTE.wood]: [0.6, 0],
  [ITEM_PALETTE.woodLight]: [0.6, 0],
  [ITEM_PALETTE.stone]: [0.7, 0],
  [ITEM_PALETTE.white]: [0.45, 0],
  [ITEM_PALETTE.water]: [0.06, 0],
  [ITEM_PALETTE.foliage]: [0.8, 0],
  [ITEM_PALETTE.foliageLight]: [0.8, 0],
  [ITEM_PALETTE.terracotta]: [0.75, 0],
  [ITEM_PALETTE.glass]: [0.06, 0],
};
const DEFAULT_SURFACE: readonly [number, number] = [0.5, 0];

/**
 * Khai báo một màu sẽ được đổ bóng thế nào (độ nhám, độ kim loại); trả lại chính mã màu.
 *
 * Declare how a colour should shade (roughness, metalness).
 */
export function registerItemSurface(colorHex: string, roughness: number, metalness: number): string {
  SURFACE_BY_COLOR[colorHex] = [roughness, metalness];
  return colorHex;
}

/** Tô màu và biến đổi (vị trí, xoay, tỉ lệ) một hình học, ghi màu và thuộc tính bề mặt vào từng đỉnh. */
function paintGeometry(
  geom: THREE.BufferGeometry,
  colorHex: string,
  pos: Vec3 = [0, 0, 0],
  rot?: Vec3,
  scale?: Vec3,
): THREE.BufferGeometry {
  tempPosition.set(pos[0], pos[1], pos[2]);
  if (rot) {
    tempEuler.set(rot[0], rot[1], rot[2]);
    tempQuaternion.setFromEuler(tempEuler);
  } else {
    tempQuaternion.identity();
  }
  if (scale) {
    tempScale.set(scale[0], scale[1], scale[2]);
  } else {
    tempScale.set(1, 1, 1);
  }
  tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
  geom.applyMatrix4(tempMatrix);

  const posAttr = geom.getAttribute('position');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  tempColor.set(colorHex);
  const r = tempColor.r;
  const g = tempColor.g;
  const b = tempColor.b;
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    colors[idx] = r;
    colors[idx + 1] = g;
    colors[idx + 2] = b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const [rough, metal] = SURFACE_BY_COLOR[colorHex] ?? DEFAULT_SURFACE;
  const surf = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    surf[i * 2] = rough;
    surf[i * 2 + 1] = metal;
  }
  geom.setAttribute('surf', new THREE.BufferAttribute(surf, 2));
  return geom;
}

/** Edge chamfer used on item boxes. Capped relative to the smallest dimension. */
export const ITEM_BEVEL_MAX = 0.03;
const ITEM_BEVEL_MIN_DIMENSION = 0.08;

/**
 * Khối hộp vát 45° ở mọi cạnh (44 tam giác); dải vát có pháp tuyến chéo riêng nên cạnh bắt sáng mảnh thay vì
 * đường đen/trắng gắt của hộp thường, mà không tốn nhiều tam giác.
 *
 * Box with a single 45 degree chamfer on every edge (44 triangles). The bevel
 * strips carry their own diagonal normals so edges catch a thin highlight
 * instead of the hard black/white seam of a plain box, without the ~100+
 * triangles a RoundedBoxGeometry would add per part.
 */
export function buildChamferBoxGeometry(
  w: number,
  h: number,
  d: number,
  bevel: number,
): THREE.BufferGeometry {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const r = Math.min(bevel, hx * 0.45, hy * 0.45, hz * 0.45);
  const ix = hx - r;
  const iy = hy - r;
  const iz = hz - r;

  const positions: number[] = [];
  const normals: number[] = [];

  // Thêm một tam giác (tính diện tích từ ba điểm) với pháp tuyến n.
  const pushTri = (a: Vec3, b: Vec3, c: Vec3, n: Vec3) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const [p1, p2, p3] = flip ? [a, c, b] : [a, b, c];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / len;
    const ny = n[1] / len;
    const nz = n[2] / len;
    for (const p of [p1, p2, p3]) {
      positions.push(p[0], p[1], p[2]);
      normals.push(nx, ny, nz);
    }
  };
  // Thêm một hình tứ giác bằng hai tam giác cùng pháp tuyến.
  const pushQuad = (a: Vec3, b: Vec3, c: Vec3, e: Vec3, n: Vec3) => {
    pushTri(a, b, c, n);
    pushTri(a, c, e, n);
  };

  const signs = [-1, 1] as const;

  // Sáu mặt đã thu nhỏ vào trong (inset).
  for (const s of signs) {
    pushQuad(
      [s * hx, -iy, -iz],
      [s * hx, iy, -iz],
      [s * hx, iy, iz],
      [s * hx, -iy, iz],
      [s, 0, 0],
    );
    pushQuad(
      [-ix, s * hy, -iz],
      [ix, s * hy, -iz],
      [ix, s * hy, iz],
      [-ix, s * hy, iz],
      [0, s, 0],
    );
    pushQuad(
      [-ix, -iy, s * hz],
      [ix, -iy, s * hz],
      [ix, iy, s * hz],
      [-ix, iy, s * hz],
      [0, 0, s],
    );
  }

  // Mười hai dải vát (bevel), mỗi trục bốn dải.
  for (const sa of signs) {
    for (const sb of signs) {
      // Cạnh dọc theo trục X, nằm giữa mặt Y và mặt Z.
      pushQuad(
        [-ix, sa * hy, sb * iz],
        [ix, sa * hy, sb * iz],
        [ix, sa * iy, sb * hz],
        [-ix, sa * iy, sb * hz],
        [0, sa, sb],
      );
      // Cạnh dọc theo trục Y, nằm giữa mặt X và mặt Z.
      pushQuad(
        [sa * hx, -iy, sb * iz],
        [sa * hx, iy, sb * iz],
        [sa * ix, iy, sb * hz],
        [sa * ix, -iy, sb * hz],
        [sa, 0, sb],
      );
      // Cạnh dọc theo trục Z, nằm giữa mặt X và mặt Y.
      pushQuad(
        [sa * hx, sb * iy, -iz],
        [sa * hx, sb * iy, iz],
        [sa * ix, sb * hy, iz],
        [sa * ix, sb * hy, -iz],
        [sa, sb, 0],
      );
    }
  }

  // Tám tam giác ở các góc.
  for (const sx of signs) {
    for (const sy of signs) {
      for (const sz of signs) {
        pushTri(
          [sx * hx, sy * iy, sz * iz],
          [sx * ix, sy * hy, sz * iz],
          [sx * ix, sy * iy, sz * hz],
          [sx, sy, sz],
        );
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  return geom;
}

/** Matches the per-item budget asserted in items.geometries.test.ts. */
export const ITEM_HIGH_DETAIL_TRIANGLE_BUDGET = 9000;

let bevelEnabled = true;

/** Tạo khối hộp (w, h, d) có màu, vị trí và xoay. */
function box(
  w: number,
  h: number,
  d: number,
  colorHex: string,
  pos: Vec3 = [0, h * 0.5, 0],
  rot?: Vec3,
): THREE.BufferGeometry {
  const smallest = Math.min(w, h, d);
  if (!bevelEnabled || smallest < ITEM_BEVEL_MIN_DIMENSION) {
    return paintGeometry(new THREE.BoxGeometry(w, h, d), colorHex, pos, rot);
  }
  const bevel = Math.min(ITEM_BEVEL_MAX, smallest * 0.18);
  return paintGeometry(buildChamferBoxGeometry(w, h, d, bevel), colorHex, pos, rot);
}

/** Tạo khối trụ (bán kính trên/dưới, chiều cao) có màu, vị trí và xoay. */
function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  colorHex: string,
  pos: Vec3 = [0, h * 0.5, 0],
  rot?: Vec3,
  radialSegments = 8,
): THREE.BufferGeometry {
  return paintGeometry(
    new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments, 1),
    colorHex,
    pos,
    rot,
  );
}

/** Tạo hình cầu có màu, vị trí và tỉ lệ. */
function sphere(
  radius: number,
  colorHex: string,
  pos: Vec3 = [0, radius, 0],
  scale?: Vec3,
  widthSegments = 8,
  heightSegments = 6,
): THREE.BufferGeometry {
  return paintGeometry(
    new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    colorHex,
    pos,
    undefined,
    scale,
  );
}

/** Gộp nhiều phần thành một hình học và co vừa kích thước đích (tỉ lệ đều, đáy ở y = 0, căn giữa X/Z). */
export function mergeAndFit(parts: THREE.BufferGeometry[], targetDimensions: Vec3): THREE.BufferGeometry {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const part of parts) {
    if (!part.getAttribute('normal')) {
      part.computeVertexNormals();
    }
    const vCount = part.getAttribute('position').count;
    totalVertices += vCount;
    const idx = part.getIndex();
    totalIndices += idx ? idx.count : vCount;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 3);
  const surfaces = new Float32Array(totalVertices * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const part of parts) {
    const posAttr = part.getAttribute('position');
    const normAttr = part.getAttribute('normal');
    const colAttr = part.getAttribute('color');
    const surfAttr = part.getAttribute('surf');
    const vCount = posAttr.count;

    for (let i = 0; i < vCount; i++) {
      const dst = (vOffset + i) * 3;
      surfaces[(vOffset + i) * 2] = surfAttr ? surfAttr.getX(i) : DEFAULT_SURFACE[0];
      surfaces[(vOffset + i) * 2 + 1] = surfAttr ? surfAttr.getY(i) : DEFAULT_SURFACE[1];
      positions[dst] = posAttr.getX(i);
      positions[dst + 1] = posAttr.getY(i);
      positions[dst + 2] = posAttr.getZ(i);

      normals[dst] = normAttr ? normAttr.getX(i) : 0;
      normals[dst + 1] = normAttr ? normAttr.getY(i) : 1;
      normals[dst + 2] = normAttr ? normAttr.getZ(i) : 0;

      colors[dst] = colAttr ? colAttr.getX(i) : 0.5;
      colors[dst + 1] = colAttr ? colAttr.getY(i) : 0.5;
      colors[dst + 2] = colAttr ? colAttr.getZ(i) : 0.5;
    }

    const idx = part.getIndex();
    if (idx) {
      const idxCount = idx.count;
      for (let i = 0; i < idxCount; i++) {
        indices[iOffset + i] = idx.getX(i) + vOffset;
      }
      iOffset += idxCount;
    } else {
      for (let i = 0; i < vCount; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += vCount;
    }

    vOffset += vCount;
    part.dispose();
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < totalVertices; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const spanX = Math.max(maxX - minX, 1e-4);
  const spanY = Math.max(maxY - minY, 1e-4);
  const spanZ = Math.max(maxZ - minZ, 1e-4);

  const [targetW, targetH, targetD] = targetDimensions;
  const scaleX = targetW / spanX;
  const scaleY = targetH / spanY;
  const scaleZ = targetD / spanZ;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const invScaleX = 1 / Math.max(scaleX, 1e-4);
  const invScaleY = 1 / Math.max(scaleY, 1e-4);
  const invScaleZ = 1 / Math.max(scaleZ, 1e-4);

  for (let i = 0; i < totalVertices; i++) {
    const idx = i * 3;
    positions[idx] = (positions[idx] - centerX) * scaleX;
    positions[idx + 1] = (positions[idx + 1] - minY) * scaleY;
    positions[idx + 2] = (positions[idx + 2] - centerZ) * scaleZ;

    let nx = normals[idx] * invScaleX;
    let ny = normals[idx + 1] * invScaleY;
    let nz = normals[idx + 2] * invScaleZ;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-6) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = 0;
      ny = 1;
      nz = 0;
    }
    normals[idx] = nx;
    normals[idx + 1] = ny;
    normals[idx + 2] = nz;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.setAttribute('surf', new THREE.BufferAttribute(surfaces, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/**
 * Khối hộp bo cạnh mềm dùng cho đồ bọc, vỏ máy và thân thiết bị.
 *
 * Soft-edged box for upholstery, shrouds and housings.
 */
function roundedBox(
  w: number,
  h: number,
  d: number,
  radius: number,
  colorHex: string,
  pos: Vec3 = [0, h * 0.5, 0],
  rot?: Vec3,
): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) * 0.49);
  return paintGeometry(new RoundedBoxGeometry(w, h, d, 2, r), colorHex, pos, rot);
}

/**
 * Ống thép uốn qua các điểm: đoạn thẳng nối bằng khúc cua bo tròn và hai đầu bán cầu — đúng dạng khung, tay lái
 * và ray thật thay vì thanh vuông.
 *
 * Bent steel tube through `points`: straight runs joined by rounded bends,
 * closed with hemispherical ends. This is what frames, handlebars and rails
 * are actually made of, instead of square sticks.
 */
function tube(
  points: readonly Vec3[],
  radius: number,
  colorHex: string,
  radialSegments = 8,
  bend = 0.07,
): THREE.BufferGeometry[] {
  const pts = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const corner = pts[i];
    if (i === pts.length - 1) {
      path.add(new THREE.LineCurve3(cursor, corner.clone()));
      break;
    }
    const inDir = corner.clone().sub(pts[i - 1]);
    const outDir = pts[i + 1].clone().sub(corner);
    const r = Math.min(bend, inDir.length() * 0.45, outDir.length() * 0.45);
    const a = corner.clone().addScaledVector(inDir.normalize(), -r);
    const b = corner.clone().addScaledVector(outDir.normalize(), r);
    path.add(new THREE.LineCurve3(cursor, a));
    path.add(new THREE.QuadraticBezierCurve3(a, corner.clone(), b));
    cursor = b;
  }
  const segments = Math.max(2, (pts.length - 1) * 5);
  const body = paintGeometry(
    new THREE.TubeGeometry(path, segments, radius, radialSegments, false),
    colorHex,
  );
  const capA = paintGeometry(new THREE.SphereGeometry(radius, radialSegments, 4), colorHex, points[0]);
  const capB = paintGeometry(
    new THREE.SphereGeometry(radius, radialSegments, 4),
    colorHex,
    points[points.length - 1],
  );
  return [body, capA, capB];
}

/**
 * Đĩa/bánh xe/đĩa tạ có trục theo X (mặc định), Y hoặc Z.
 *
 * Disc / wheel / weight plate whose axis runs along X (default), Y or Z.
 */
function disc(
  radius: number,
  thickness: number,
  colorHex: string,
  pos: Vec3,
  axis: 'x' | 'y' | 'z' = 'x',
  segments = 24,
): THREE.BufferGeometry {
  const rot: Vec3 | undefined =
    axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : undefined;
  return paintGeometry(
    new THREE.CylinderGeometry(radius, radius, thickness, segments, 1),
    colorHex,
    pos,
    rot,
  );
}

/**
 * Bọc bất kỳ hình học nào (capsule, lathe...) bằng màu bảng màu và phép biến đổi.
 *
 * Wraps any geometry (capsule, lathe...) with a palette colour and transform.
 */
function shape(
  geometry: THREE.BufferGeometry,
  colorHex: string,
  pos: Vec3 = [0, 0, 0],
  rot?: Vec3,
  scale?: Vec3,
): THREE.BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  if (source !== geometry) geometry.dispose();
  return paintGeometry(source, colorHex, pos, rot, scale);
}

// ============================================================================
// BỘ DỰNG HÌNH CHI TIẾT CAO CHO CÁC ITEM (36 hình dáng dễ nhận biết, mỗi cái <= 900 tam giác)
// ============================================================================

/** Dựng hình học bản chi tiết của máy chạy bộ từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildTreadmill(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Đế máy và băng chạy.
      box(0.92, 0.14, 1.94, P.charcoal, [0, 0.07, 0]),
      box(0.68, 0.04, 1.66, P.charcoalDeep, [0, 0.15, 0.08]),
      // Hai thanh bậc đứng màu salmon hai bên.
      box(0.09, 0.05, 1.72, P.salmon, [-0.41, 0.155, 0.05]),
      box(0.09, 0.05, 1.72, P.salmon, [0.41, 0.155, 0.05]),
      // Nắp động cơ phía trước.
      box(0.94, 0.24, 0.42, P.charcoalSoft, [0, 0.18, -0.76]),
      // Hai trụ nghiêng bên trái và bên phải.
      box(0.09, 1.18, 0.12, P.charcoal, [-0.42, 0.72, -0.68], [0.16, 0, 0]),
      box(0.09, 1.18, 0.12, P.charcoal, [0.42, 0.72, -0.68], [0.16, 0, 0]),
      // Hai tay vịn hai bên.
      box(0.07, 0.07, 0.72, P.metal, [-0.42, 1.12, -0.38], [0.12, 0, 0]),
      box(0.07, 0.07, 0.72, P.metal, [0.42, 1.12, -0.38], [0.12, 0, 0]),
      // Cầu bảng điều khiển và màn hình cảm ứng.
      box(0.96, 0.14, 0.28, P.charcoalSoft, [0, 1.24, -0.62]),
      box(0.62, 0.34, 0.08, P.charcoal, [0, 1.34, -0.64], [-0.42, 0, 0]),
      box(0.54, 0.26, 0.03, P.screen, [0, 1.35, -0.61], [-0.42, 0, 0]),
      box(0.54, 0.04, 0.04, P.salmon, [0, 1.44, -0.66], [-0.42, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS.treadmill,
  );
}

/** Dựng hình học bản chi tiết của xe đạp tập đứng từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildUprightBike(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Chân cân bằng.
      box(0.64, 0.07, 0.12, P.charcoal, [0, 0.035, -0.48]),
      box(0.64, 0.07, 0.12, P.charcoal, [0, 0.035, 0.48]),
      box(0.14, 0.07, 0.96, P.charcoal, [0, 0.035, 0]),
      // Vỏ bánh đà và hộp trục quay pedal.
      cyl(0.28, 0.28, 0.18, P.charcoalSoft, [0, 0.38, -0.1], [0, 0, Math.PI / 2], 10),
      box(0.2, 0.48, 0.56, P.charcoal, [0, 0.34, 0.04], [-0.2, 0, 0]),
      box(0.21, 0.08, 0.44, P.salmon, [0, 0.42, 0.02], [-0.2, 0, 0]),
      // Bàn đạp.
      box(0.14, 0.04, 0.18, P.charcoalDeep, [-0.18, 0.24, -0.05]),
      box(0.14, 0.04, 0.18, P.charcoalDeep, [0.18, 0.46, -0.14]),
      // Cột yên và yên xe công thái học.
      box(0.08, 0.62, 0.08, P.metal, [0, 0.66, 0.28], [0.22, 0, 0]),
      box(0.26, 0.09, 0.32, P.charcoalDeep, [0, 0.96, 0.34]),
      // Trụ tay lái, hai tay cầm và màn hình hiển thị.
      box(0.08, 0.88, 0.09, P.charcoal, [0, 0.72, -0.34], [-0.18, 0, 0]),
      box(0.56, 0.06, 0.06, P.metal, [0, 1.14, -0.38]),
      box(0.06, 0.18, 0.24, P.charcoalDeep, [-0.25, 1.2, -0.28], [0.3, 0, 0]),
      box(0.06, 0.18, 0.24, P.charcoalDeep, [0.25, 1.2, -0.28], [0.3, 0, 0]),
      box(0.32, 0.22, 0.06, P.screen, [0, 1.22, -0.4], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['upright-bike'],
  );
}

/** Dựng hình học bản chi tiết của máy elliptical từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildElliptical(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Hai thanh khung đế.
      box(0.88, 0.08, 1.98, P.charcoal, [0, 0.04, 0]),
      // Trống dẫn động phía sau.
      cyl(0.38, 0.38, 0.28, P.charcoalSoft, [0, 0.44, 0.56], [0, 0, Math.PI / 2], 10),
      cyl(0.24, 0.24, 0.3, P.salmon, [0, 0.44, 0.56], [0, 0, Math.PI / 2], 8),
      // Ray bàn đạp chân và tấm đặt chân cỡ lớn.
      box(0.1, 0.06, 1.35, P.metal, [-0.26, 0.24, 0.1], [0.08, 0, 0]),
      box(0.1, 0.06, 1.35, P.metal, [0.26, 0.24, 0.1], [-0.05, 0, 0]),
      box(0.2, 0.07, 0.44, P.charcoalDeep, [-0.26, 0.3, 0.12]),
      box(0.2, 0.07, 0.44, P.charcoalDeep, [0.26, 0.26, -0.04]),
      // Trụ bảng điều khiển ở giữa.
      box(0.18, 1.28, 0.22, P.charcoal, [0, 0.72, -0.68], [-0.16, 0, 0]),
      box(0.48, 0.3, 0.08, P.screen, [0, 1.44, -0.74], [-0.42, 0, 0]),
      box(0.5, 0.05, 0.09, P.salmon, [0, 1.58, -0.78], [-0.42, 0, 0]),
      // Hai tay sải chuyển động.
      box(0.06, 1.32, 0.08, P.metal, [-0.36, 0.92, -0.46], [0.18, 0, 0]),
      box(0.06, 1.32, 0.08, P.metal, [0.36, 0.92, -0.54], [-0.14, 0, 0]),
      box(0.08, 0.28, 0.08, P.charcoalDeep, [-0.36, 1.48, -0.34]),
      box(0.08, 0.28, 0.08, P.charcoalDeep, [0.36, 1.48, -0.62]),
    ],
    DEFAULT_ITEM_DIMENSIONS.elliptical,
  );
}

/** Dựng hình học bản chi tiết của máy Smith từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSmithMachine(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Hai thanh chạy đế bên trái và bên phải.
      box(0.14, 0.1, 1.52, P.charcoal, [-0.82, 0.05, 0]),
      box(0.14, 0.1, 1.52, P.charcoal, [0.82, 0.05, 0]),
      box(1.78, 0.08, 0.14, P.charcoal, [0, 0.05, -0.66]),
      // Các cột đứng chính và thanh chống nghiêng phía sau.
      box(0.12, 2.18, 0.12, P.charcoal, [-0.82, 1.12, -0.18]),
      box(0.12, 2.18, 0.12, P.charcoal, [0.82, 1.12, -0.18]),
      box(0.1, 2.16, 0.1, P.charcoalSoft, [-0.82, 1.1, -0.58], [0.18, 0, 0]),
      box(0.1, 2.16, 0.1, P.charcoalSoft, [0.82, 1.1, -0.58], [0.18, 0, 0]),
      // Xà ngang phía trên và huy hiệu đầu màu salmon.
      box(1.84, 0.14, 0.24, P.charcoal, [0, 2.16, -0.26]),
      box(0.92, 0.08, 0.26, P.salmon, [0, 2.16, -0.26]),
      // Hai thanh dẫn hướng chrome.
      cyl(0.025, 0.025, 2.04, P.metalLight, [-0.72, 1.08, -0.02], undefined, 6),
      cyl(0.025, 0.025, 2.04, P.metalLight, [0.72, 1.08, -0.02], undefined, 6),
      // Thanh tạ Olympic được dẫn hướng cùng các đĩa tạ.
      cyl(0.028, 0.028, 2.18, P.metalLight, [0, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [-0.94, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [0.94, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.16, 0.16, 0.06, P.salmon, [-1.02, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.16, 0.16, 0.06, P.salmon, [1.02, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      // Chốt cất đĩa tạ hai bên.
      box(0.22, 0.05, 0.05, P.metal, [-0.96, 0.65, -0.45]),
      box(0.22, 0.05, 0.05, P.metal, [0.96, 0.65, -0.45]),
    ],
    DEFAULT_ITEM_DIMENSIONS['smith-machine'],
  );
}

/** Dựng hình học bản chi tiết của máy kéo xô từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildLatPulldown(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Các thanh chạy ở đế.
      box(1.1, 0.08, 1.44, P.charcoal, [0, 0.04, 0]),
      // Tháp khối tạ được bao kín.
      box(0.68, 2.08, 0.36, P.charcoalSoft, [0, 1.06, -0.52]),
      box(0.46, 1.56, 0.24, P.charcoalDeep, [0, 0.96, -0.5]),
      box(0.48, 0.08, 0.28, P.salmon, [0, 1.24, -0.5]),
      // Cần puly kép phía trên.
      box(0.24, 0.12, 0.96, P.charcoal, [0, 2.12, -0.18]),
      cyl(0.09, 0.09, 0.06, P.salmon, [0, 2.08, 0.22], [0, 0, Math.PI / 2], 8),
      // Thanh kéo xô rộng treo dưới cần.
      cyl(0.022, 0.022, 1.24, P.metalLight, [0, 1.82, 0.22], [0, 0, Math.PI / 2], 8),
      box(0.18, 0.05, 0.05, P.charcoalDeep, [-0.66, 1.78, 0.22], [0, 0, 0.35]),
      box(0.18, 0.05, 0.05, P.charcoalDeep, [0.66, 1.78, 0.22], [0, 0, -0.35]),
      // Cột ghế, đệm ngồi và con lăn giữ đùi.
      box(0.12, 0.44, 0.12, P.charcoal, [0, 0.24, 0.28]),
      box(0.38, 0.08, 0.44, P.charcoalDeep, [0, 0.48, 0.3]),
      cyl(0.08, 0.08, 0.48, P.charcoalDeep, [0, 0.66, 0.12], [0, 0, Math.PI / 2], 8),
      box(0.08, 0.22, 0.26, P.metal, [0, 0.58, -0.02]),
    ],
    DEFAULT_ITEM_DIMENSIONS['lat-pulldown'],
  );
}

/** Dựng hình học bản chi tiết của giá squat từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSquatRack(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ nâng tạ (giữa bằng gỗ sồi, hai cánh cao su).
      box(1.66, 0.06, 1.74, P.charcoalDeep, [0, 0.03, 0]),
      box(0.86, 0.065, 1.72, P.wood, [0, 0.033, 0]),
      // Bốn trụ đứng chắc chắn.
      box(0.1, 2.22, 0.1, P.charcoal, [-0.62, 1.14, -0.56]),
      box(0.1, 2.22, 0.1, P.charcoal, [0.62, 1.14, -0.56]),
      box(0.1, 2.22, 0.1, P.charcoal, [-0.62, 1.14, 0.26]),
      box(0.1, 2.22, 0.1, P.charcoal, [0.62, 1.14, 0.26]),
      // Các xà ngang phía trên và thanh kéo xà.
      box(0.1, 0.12, 0.92, P.charcoal, [-0.62, 2.2, -0.15]),
      box(0.1, 0.12, 0.92, P.charcoal, [0.62, 2.2, -0.15]),
      box(1.34, 0.14, 0.12, P.salmon, [0, 2.2, -0.56]),
      cyl(0.026, 0.026, 1.28, P.metal, [0, 2.18, 0.26], [0, 0, Math.PI / 2], 8),
      // Tay đỡ an toàn cho người hỗ trợ (spotter).
      box(0.08, 0.07, 0.92, P.metal, [-0.62, 0.88, -0.15]),
      box(0.08, 0.07, 0.92, P.metal, [0.62, 0.88, -0.15]),
      // Thanh tạ Olympic cùng đĩa tạ bumper.
      cyl(0.026, 0.026, 1.68, P.metalLight, [0, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [-0.74, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [0.74, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.18, 0.18, 0.06, P.salmon, [-0.81, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.18, 0.18, 0.06, P.salmon, [0.81, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['squat-rack'],
  );
}

/** Dựng hình học bản chi tiết của giá tạ tay từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildDumbbellRack(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Chân hình chữ A bên trái, giữa và bên phải.
    box(0.1, 0.88, 0.72, P.charcoal, [-1.18, 0.44, 0]),
    box(0.1, 0.88, 0.72, P.charcoal, [0, 0.44, 0]),
    box(0.1, 0.88, 0.72, P.charcoal, [1.18, 0.44, 0]),
    // Thanh kệ tầng trên và tầng dưới.
    box(2.52, 0.07, 0.28, P.charcoalSoft, [0, 0.78, -0.08], [0.18, 0, 0]),
    box(2.52, 0.07, 0.32, P.charcoalSoft, [0, 0.42, 0.08], [0.18, 0, 0]),
    box(2.54, 0.03, 0.04, P.salmon, [0, 0.81, 0.06]),
    box(2.54, 0.03, 0.04, P.salmon, [0, 0.45, 0.23]),
  ];

  // 6 cặp tạ tay trải trên kệ trên và kệ dưới.
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + i * 0.4;
    // Tạ tay ở kệ trên.
    parts.push(box(0.12, 0.12, 0.32, P.charcoalDeep, [x - 0.07, 0.86, -0.08]));
    parts.push(box(0.12, 0.12, 0.32, P.charcoalDeep, [x + 0.07, 0.86, -0.08]));
    // Tạ tay nặng hơn ở kệ dưới.
    parts.push(box(0.14, 0.14, 0.36, P.charcoalDeep, [x, 0.52, 0.08]));
    parts.push(box(0.06, 0.06, 0.38, P.metalLight, [x, 0.52, 0.08]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['dumbbell-rack']);
}

/** Dựng hình học bản chi tiết của ghế tập điều chỉnh từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildAdjustableBench(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Đế thép hình chữ H.
      box(0.68, 0.06, 0.12, P.charcoal, [0, 0.03, -0.56]),
      box(0.54, 0.06, 0.12, P.charcoal, [0, 0.03, 0.56]),
      box(0.1, 0.07, 1.24, P.charcoal, [0, 0.04, 0]),
      // Các trụ đỡ đứng.
      box(0.09, 0.38, 0.09, P.charcoal, [0, 0.22, 0.32]),
      box(0.09, 0.38, 0.09, P.charcoal, [0, 0.22, -0.22]),
      // Đệm ngồi.
      box(0.34, 0.08, 0.38, P.charcoalDeep, [0, 0.44, 0.36], [-0.12, 0, 0]),
      // Đệm tựa lưng nghiêng cùng viền salmon.
      box(0.36, 0.09, 0.82, P.charcoalDeep, [0, 0.64, -0.22], [0.46, 0, 0]),
      box(0.38, 0.03, 0.83, P.salmon, [0, 0.62, -0.23], [0.46, 0, 0]),
      // Thanh chống để điều chỉnh độ nghiêng.
      box(0.06, 0.42, 0.05, P.metal, [0, 0.44, -0.34], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['adjustable-bench'],
  );
}

/** Dựng hình học bản chi tiết của máy Kinesis đa năng từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildKinesisStation(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ đế.
      box(2.34, 0.08, 1.48, P.charcoal, [0, 0.04, 0]),
      // Lõi tường đứng kết hợp gỗ và than theo phong cách kiến trúc.
      box(2.28, 2.16, 0.24, P.charcoalSoft, [0, 1.12, -0.56]),
      box(1.42, 2.08, 0.06, P.wood, [0, 1.12, -0.42]),
      box(1.44, 0.08, 0.08, P.salmon, [0, 2.12, -0.41]),
      // Hai tháp tạ bên trái và bên phải.
      box(0.38, 2.1, 0.32, P.charcoal, [-0.92, 1.1, -0.52]),
      box(0.38, 2.1, 0.32, P.charcoal, [0.92, 1.1, -0.52]),
      // Các tay puly 3D phía trên.
      box(0.07, 0.07, 0.92, P.metalLight, [-0.88, 1.96, -0.02], [0.1, -0.18, 0]),
      box(0.07, 0.07, 0.92, P.metalLight, [0.88, 1.96, -0.02], [0.1, 0.18, 0]),
      cyl(0.08, 0.08, 0.06, P.salmon, [-0.78, 1.92, 0.4], [0, 0, Math.PI / 2], 8),
      cyl(0.08, 0.08, 0.06, P.salmon, [0.78, 1.92, 0.4], [0, 0, Math.PI / 2], 8),
      // Các tay puly 3D ở giữa.
      box(0.07, 0.07, 0.78, P.metal, [-0.96, 1.16, -0.08], [0, -0.25, 0]),
      box(0.07, 0.07, 0.78, P.metal, [0.96, 1.16, -0.08], [0, 0.25, 0]),
      // Các tay puly phía dưới.
      box(0.07, 0.07, 0.68, P.metal, [-0.86, 0.32, -0.14]),
      box(0.07, 0.07, 0.68, P.metal, [0.86, 0.32, -0.14]),
      // Màn hình cảm ứng ở giữa.
      box(0.44, 0.56, 0.05, P.screen, [0, 1.42, -0.38]),
    ],
    DEFAULT_ITEM_DIMENSIONS['kinesis-station'],
  );
}

/** Dựng hình học bản chi tiết của máy phân tích InBody từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildInbodyAnalyzer(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ cân kèm 4 điện cực kim loại cho chân.
      cyl(0.42, 0.44, 0.09, P.charcoalSoft, [0, 0.045, 0.12], undefined, 10),
      box(0.14, 0.02, 0.32, P.metalLight, [-0.14, 0.095, 0.14]),
      box(0.14, 0.02, 0.32, P.metalLight, [0.14, 0.095, 0.14]),
      // Trụ máy gọn gàng theo phong cách y tế.
      box(0.18, 1.16, 0.16, P.white, [0, 0.64, -0.28], [-0.1, 0, 0]),
      box(0.2, 0.48, 0.18, P.charcoal, [0, 0.3, -0.24], [-0.1, 0, 0]),
      // Hai tay điện cực khớp nối bên trái và bên phải.
      box(0.32, 0.05, 0.06, P.metal, [-0.24, 0.96, -0.28], [0, 0, -0.2]),
      box(0.32, 0.05, 0.06, P.metal, [0.24, 0.96, -0.28], [0, 0, 0.2]),
      cyl(0.032, 0.032, 0.28, P.charcoalDeep, [-0.38, 0.94, -0.12], [1.1, 0, 0], 8),
      cyl(0.032, 0.032, 0.28, P.charcoalDeep, [0.38, 0.94, -0.12], [1.1, 0, 0], 8),
      // Đầu màn hình y tế.
      box(0.38, 0.3, 0.07, P.charcoal, [0, 1.22, -0.34], [-0.38, 0, 0]),
      box(0.32, 0.22, 0.03, P.screenGlow, [0, 1.23, -0.31], [-0.38, 0, 0]),
      box(0.38, 0.04, 0.08, P.salmon, [0, 1.34, -0.38], [-0.38, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['inbody-analyzer'],
  );
}

/** Dựng hình học bản chi tiết của sàn đấu boxing từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildBoxingRing(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Tạp dề sàn đài nâng và tấm thảm đấu.
    box(5.5, 0.44, 5.5, P.charcoal, [0, 0.22, 0]),
    box(5.28, 0.06, 5.28, P.charcoalSoft, [0, 0.46, 0]),
    // Hình vuông biểu tượng SÖL ở giữa thảm.
    box(1.8, 0.02, 1.8, P.salmon, [0, 0.495, 0]),
    box(1.4, 0.022, 1.4, P.charcoalDeep, [0, 0.498, 0]),
    // Các cột góc (4 góc).
    cyl(0.09, 0.09, 1.15, P.salmon, [-2.55, 1.02, -2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.white, [2.55, 1.02, 2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.charcoalDeep, [-2.55, 1.02, 2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.charcoalDeep, [2.55, 1.02, -2.55], undefined, 8),
  ];

  // 3 tầng dây thừng ngang bao quanh cả 4 cạnh.
  const ropeHeights = [0.78, 1.1, 1.42];
  const ropeColors = [P.white, P.salmon, P.white];
  for (let i = 0; i < 3; i++) {
    const ry = ropeHeights[i];
    const rc = ropeColors[i];
    parts.push(box(5.0, 0.035, 0.035, rc, [0, ry, -2.5]));
    parts.push(box(5.0, 0.035, 0.035, rc, [0, ry, 2.5]));
    parts.push(box(0.035, 0.035, 5.0, rc, [-2.5, ry, 0]));
    parts.push(box(0.035, 0.035, 5.0, rc, [2.5, ry, 0]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['boxing-ring']);
}

/** Dựng hình học bản chi tiết của bao cát nặng từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildHeavyBag(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Các chân đế có tạ giữ vững.
      box(0.86, 0.07, 0.12, P.charcoal, [0, 0.035, -0.36]),
      box(0.12, 0.07, 0.86, P.charcoal, [0, 0.035, 0]),
      // Trụ thép đứng và cần phía trên.
      box(0.11, 2.22, 0.11, P.charcoal, [0, 1.14, -0.36]),
      box(0.1, 0.1, 0.56, P.charcoal, [0, 2.22, -0.12]),
      // Xích xoay và bao cát nặng bằng da.
      cyl(0.03, 0.03, 0.28, P.metalLight, [0, 2.04, 0.1], undefined, 6),
      cyl(0.22, 0.22, 1.26, P.charcoalDeep, [0, 1.28, 0.1], undefined, 10),
      cyl(0.226, 0.226, 0.22, P.salmon, [0, 1.42, 0.1], undefined, 10),
    ],
    DEFAULT_ITEM_DIMENSIONS['heavy-bag'],
  );
}

/** Dựng hình học bản chi tiết của bao tốc độ từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSpeedBag(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Tấm đế và cột đứng.
      cyl(0.36, 0.38, 0.08, P.charcoal, [0, 0.04, 0], undefined, 10),
      box(0.1, 2.0, 0.1, P.charcoal, [0, 1.04, -0.24]),
      box(0.1, 0.1, 0.42, P.metal, [0, 1.88, -0.06]),
      // Mặt trống phản hồi tròn bằng gỗ.
      cyl(0.34, 0.34, 0.05, P.wood, [0, 1.78, 0.08], undefined, 12),
      // Bao tốc độ hình giọt nước.
      sphere(0.13, P.salmon, [0, 1.56, 0.08], [0.85, 1.35, 0.85], 8, 6),
    ],
    DEFAULT_ITEM_DIMENSIONS['speed-bag'],
  );
}

/** Dựng hình học bản chi tiết của sân cầu lông từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildBadmintonCourt(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Các chốt ranh giới nhỏ ở góc để hộp bao khớp với diện tích sân [5.6, 1.55, 5.2].
      box(0.08, 0.02, 0.08, P.white, [-2.76, 0.01, -2.56]),
      box(0.08, 0.02, 0.08, P.white, [2.76, 0.01, -2.56]),
      box(0.08, 0.02, 0.08, P.white, [-2.76, 0.01, 2.56]),
      box(0.08, 0.02, 0.08, P.white, [2.76, 0.01, 2.56]),
      // Cột lưới và đế nặng tại x = ±2.72, z = 0.
      cyl(0.18, 0.2, 0.08, P.charcoal, [-2.6, 0.04, 0], undefined, 8),
      cyl(0.18, 0.2, 0.08, P.charcoal, [2.6, 0.04, 0], undefined, 8),
      cyl(0.035, 0.035, 1.52, P.charcoal, [-2.6, 0.78, 0], undefined, 8),
      cyl(0.035, 0.035, 1.52, P.charcoal, [2.6, 0.78, 0], undefined, 8),
      cyl(0.042, 0.042, 0.08, P.salmon, [-2.6, 1.51, 0], undefined, 8),
      cyl(0.042, 0.042, 0.08, P.salmon, [2.6, 1.51, 0], undefined, 8),
      // Lưới căng và dải băng trắng phía trên.
      box(5.16, 0.72, 0.025, P.charcoalSoft, [0, 1.12, 0]),
      box(5.2, 0.06, 0.035, P.white, [0, 1.5, 0]),
      box(5.18, 0.03, 0.03, P.salmon, [0, 0.76, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['badminton-court'],
  );
}

/** Dựng hình học bản chi tiết của sân tennis từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildTennisCourt(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Các mốc góc ở đường biên cuối sân để hộp bao trải dài [9.5, 1.1, 22.0].
      box(0.12, 0.03, 0.12, P.white, [-4.68, 0.015, -10.94]),
      box(0.12, 0.03, 0.12, P.white, [4.68, 0.015, -10.94]),
      box(0.12, 0.03, 0.12, P.white, [-4.68, 0.015, 10.94]),
      box(0.12, 0.03, 0.12, P.white, [4.68, 0.015, 10.94]),
      // Cột lưới tennis nặng tại x = ±4.35, z = 0.
      cyl(0.06, 0.06, 1.07, P.charcoal, [-4.35, 0.535, 0], undefined, 8),
      cyl(0.06, 0.06, 1.07, P.charcoal, [4.35, 0.535, 0], undefined, 8),
      cyl(0.07, 0.07, 0.08, P.salmon, [-4.35, 1.05, 0], undefined, 8),
      cyl(0.07, 0.07, 0.08, P.salmon, [4.35, 1.05, 0], undefined, 8),
      // Thân lưới tennis, dải trắng phía trên và dây giữa.
      box(8.64, 0.88, 0.035, P.charcoalDeep, [0, 0.48, 0]),
      box(8.7, 0.07, 0.05, P.white, [0, 0.94, 0]),
      box(0.07, 0.92, 0.055, P.white, [0, 0.48, 0]),
      // Ghế trọng tài tại x = 4.55, z = 0.
      box(0.5, 1.04, 0.56, P.charcoal, [4.48, 0.52, 0]),
      box(0.46, 0.06, 0.44, P.wood, [4.48, 0.82, 0]),
      box(0.46, 0.24, 0.06, P.salmon, [4.68, 0.96, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['tennis-court'],
  );
}

/** Dựng hình học bản chi tiết của làn bơi từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSwimLane(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Giá neo inox ở hai đầu tường hồ.
    box(0.18, 0.22, 0.18, P.metalLight, [-12.4, 0.18, -1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [12.4, 0.18, -1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [-12.4, 0.18, 1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [12.4, 0.18, 1.65]),
    // Dây căng dọc theo z = ±1.65.
    box(24.8, 0.03, 0.03, P.charcoal, [0, 0.18, -1.65]),
    box(24.8, 0.03, 0.03, P.charcoal, [0, 0.18, 1.65]),
  ];

  // Các phao hình trụ chia đoạn chống sóng (vùng quay đầu 5m màu salmon, giữa hồ màu trắng).
  const segments = 12;
  const segLen = 24.0 / segments;
  for (let i = 0; i < segments; i++) {
    const cx = -12.0 + (i + 0.5) * segLen;
    const isTurnZone = i < 2 || i >= segments - 2;
    const color = isTurnZone ? P.salmon : i % 2 === 0 ? P.white : P.water;
    parts.push(
      cyl(0.085, 0.085, segLen * 0.88, color, [cx, 0.18, -1.65], [0, 0, Math.PI / 2], 6),
    );
    parts.push(
      cyl(0.085, 0.085, segLen * 0.88, color, [cx, 0.18, 1.65], [0, 0, Math.PI / 2], 6),
    );
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['swim-lane']);
}

/** Dựng hình học bản chi tiết của bục xuất phát hồ bơi từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildStartingBlock(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ neo và cột inox nghiêng.
      box(0.56, 0.08, 0.56, P.metalLight, [0, 0.04, 0]),
      box(0.24, 0.54, 0.28, P.charcoalSoft, [0, 0.32, 0.06], [-0.18, 0, 0]),
      // Mặt bục trên nghiêng chống trượt và nêm đạp xuất phát kiểu track-start điều chỉnh được.
      box(0.72, 0.08, 0.74, P.charcoalDeep, [0, 0.62, 0], [0.16, 0, 0]),
      box(0.52, 0.12, 0.14, P.salmon, [0, 0.7, 0.24], [-0.35, 0, 0]),
      // Tay nắm phía trước dành cho bơi ngửa.
      box(0.64, 0.04, 0.04, P.metalLight, [0, 0.42, -0.34]),
      box(0.04, 0.22, 0.14, P.metal, [-0.28, 0.48, -0.28]),
      box(0.04, 0.22, 0.14, P.metal, [0.28, 0.48, -0.28]),
    ],
    DEFAULT_ITEM_DIMENSIONS['starting-block'],
  );
}

/** Dựng hình học bản chi tiết của thảm yoga từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildYogaMat(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Viền than bên ngoài và mặt bần màu salmon bên trong.
      box(0.8, 0.018, 1.85, P.charcoal, [0, 0.009, 0]),
      box(0.74, 0.016, 1.78, P.salmon, [0, 0.02, 0]),
      // Đường căn giữa và khăn cuộn ở đầu thảm.
      box(0.02, 0.006, 1.5, P.charcoalDeep, [0, 0.03, 0.04]),
      cyl(0.022, 0.022, 0.52, P.white, [0, 0.032, -0.74], [0, 0, Math.PI / 2], 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['yoga-mat'],
  );
}

/** Dựng hình học bản chi tiết của gối thiền từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildMeditationBolster(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Tấm thảm zabuton dệt trên sàn.
      cyl(0.32, 0.32, 0.04, P.woodLight, [0, 0.02, 0], undefined, 10),
      // Gối zafu hình trụ đầy đặn.
      cyl(0.24, 0.25, 0.18, P.terracotta, [0, 0.13, 0], undefined, 12),
      cyl(0.21, 0.24, 0.06, P.salmon, [0, 0.24, 0], undefined, 12),
      // Chi tiết nhấn là bát hát (singing bowl).
      cyl(0.06, 0.04, 0.05, P.metalLight, [0.22, 0.06, 0.18], undefined, 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['meditation-bolster'],
  );
}

/** Dựng hình học bản chi tiết của quầy lễ tân từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildReceptionDesk(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Chân đế đèn LED âm màu salmon.
    box(5.16, 0.08, 1.36, P.salmon, [0, 0.04, 0]),
    // Thân quầy chính màu than.
    box(5.32, 0.96, 1.48, P.charcoal, [0, 0.54, 0]),
    // Mặt quầy giao dịch bằng đá travertine và quầy làm việc phía dưới.
    box(5.4, 0.1, 0.64, P.stone, [0, 1.08, 0.46]),
    box(5.1, 0.06, 0.82, P.charcoalSoft, [0, 0.86, -0.26]),
    // Hai màn hình máy POS.
    box(0.48, 0.3, 0.05, P.screen, [-1.2, 1.04, -0.1], [0.25, 0, 0]),
    box(0.48, 0.3, 0.05, P.screen, [1.2, 1.04, -0.1], [0.25, 0, 0]),
  ];

  // Các nan gỗ kiến trúc dọc mặt tiền.
  for (let i = 0; i < 11; i++) {
    const x = -2.3 + i * 0.46;
    parts.push(box(0.14, 0.9, 0.06, P.wood, [x, 0.54, 0.75]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['reception-desk']);
}

/** Dựng hình học bản chi tiết của cổng soát vé QR từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildQrTurnstile(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Hai tủ cổng bằng thép xước và than bên trái, bên phải.
      box(0.24, 0.98, 1.56, P.charcoal, [-0.48, 0.49, 0]),
      box(0.24, 0.98, 1.56, P.charcoal, [0.48, 0.49, 0]),
      box(0.26, 0.06, 1.58, P.metalLight, [-0.48, 1.0, 0]),
      box(0.26, 0.06, 1.58, P.metalLight, [0.48, 1.0, 0]),
      // Ô đọc mã QR ở mặt trước tủ bên phải.
      box(0.18, 0.05, 0.24, P.salmonBright, [0.48, 1.04, 0.58], [0.2, 0, 0]),
      box(0.18, 0.05, 0.24, P.screenGlow, [-0.48, 1.04, 0.58], [0.2, 0, 0]),
      // Hai cánh kính xoay thu gọn được ở giữa làn.
      box(0.32, 0.76, 0.04, P.glass, [-0.19, 0.52, 0]),
      box(0.32, 0.76, 0.04, P.glass, [0.19, 0.52, 0]),
      box(0.32, 0.05, 0.05, P.salmon, [-0.19, 0.91, 0]),
      box(0.32, 0.05, 0.05, P.salmon, [0.19, 0.91, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['qr-turnstile'],
  );
}

/**
 * Dựng hình học bản chi tiết của máy check-in tự phục vụ từ các khối, ống và đĩa rồi co vừa kích thước mặc
 * định.
 */
function buildKioskCheckin(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Đế nặng đặt sàn.
      box(0.76, 0.06, 0.62, P.charcoal, [0, 0.03, 0]),
      // Bệ trụ totem nghiêng.
      box(0.46, 0.96, 0.22, P.charcoalSoft, [0, 0.52, -0.06], [-0.12, 0, 0]),
      // Hộp màn hình tương tác dạng dọc.
      box(0.64, 0.78, 0.09, P.charcoalDeep, [0, 1.14, 0.02], [-0.22, 0, 0]),
      box(0.54, 0.64, 0.03, P.screen, [0, 1.15, 0.06], [-0.22, 0, 0]),
      box(0.64, 0.06, 0.1, P.salmon, [0, 1.5, -0.06], [-0.22, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['kiosk-checkin'],
  );
}

/** Dựng hình học bản chi tiết của máy in thẻ hội viên từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildCardPrinter(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Tủ credenza.
      box(1.06, 0.82, 0.74, P.charcoal, [0, 0.41, 0]),
      box(0.98, 0.7, 0.04, P.wood, [0, 0.41, 0.37]),
      box(1.1, 0.05, 0.78, P.stone, [0, 0.84, 0]),
      // Hộp máy in thẻ RFID nhiệt.
      box(0.38, 0.28, 0.44, P.charcoalSoft, [-0.24, 1.0, 0]),
      box(0.22, 0.06, 0.08, P.salmon, [-0.24, 0.98, 0.23]),
      // Màn hình ghi mã và chồng thẻ SÖL.
      box(0.42, 0.32, 0.05, P.screen, [0.24, 1.06, -0.1], [-0.2, -0.2, 0]),
      box(0.16, 0.05, 0.22, P.salmonBright, [0.22, 0.89, 0.18]),
    ],
    DEFAULT_ITEM_DIMENSIONS['card-printer'],
  );
}

/** Dựng hình học bản chi tiết của kệ thực phẩm bổ sung từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSupplementShelf(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Khung kệ đứng và tấm lưng gỗ ấm.
    box(1.96, 2.06, 0.1, P.charcoal, [0, 1.03, -0.32]),
    box(1.84, 1.88, 0.04, P.wood, [0, 1.0, -0.25]),
    // Hộp đèn tiêu đề màu salmon phía trên.
    box(1.98, 0.2, 0.46, P.salmon, [0, 1.98, -0.12]),
    // Bệ đế và 3 tầng kệ phía trên.
    box(1.96, 0.16, 0.74, P.charcoal, [0, 0.08, 0]),
    box(1.92, 0.05, 0.62, P.charcoalSoft, [0, 0.58, -0.04]),
    box(1.92, 0.05, 0.58, P.charcoalSoft, [0, 1.06, -0.06]),
    box(1.92, 0.05, 0.54, P.charcoalSoft, [0, 1.52, -0.08]),
  ];

  // Hũ whey protein và lọ BCAA trên các kệ.
  const shelfYs = [0.28, 0.74, 1.21, 1.66];
  for (let s = 0; s < shelfYs.length; s++) {
    const y = shelfYs[s];
    for (let c = 0; c < 4; c++) {
      const x = -0.66 + c * 0.44;
      const tubColor = (s + c) % 3 === 0 ? P.salmon : (s + c) % 2 === 0 ? P.charcoalDeep : P.white;
      parts.push(cyl(0.11, 0.11, 0.24, tubColor, [x, y, 0.02], undefined, 6));
    }
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['supplement-shelf']);
}

/** Dựng hình học bản chi tiết của bảng dinh dưỡng từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildNutritionBoard(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Chân đế tự đứng và các trụ thép đứng.
      box(0.16, 0.06, 0.48, P.charcoal, [-0.96, 0.03, 0]),
      box(0.16, 0.06, 0.48, P.charcoal, [0.96, 0.03, 0]),
      box(0.1, 1.86, 0.1, P.charcoal, [-0.96, 0.94, 0]),
      box(0.1, 1.86, 0.1, P.charcoal, [0.96, 0.94, 0]),
      // Bảng thông tin dinh dưỡng có khung.
      box(2.26, 1.38, 0.12, P.wood, [0, 1.18, 0]),
      box(2.12, 1.24, 0.14, P.charcoalDeep, [0, 1.18, 0]),
      // Tiêu đề đồ họa và các hàng macro.
      box(1.92, 0.18, 0.16, P.white, [0, 1.62, 0]),
      box(1.92, 0.1, 0.16, P.salmon, [0, 1.36, 0]),
      box(1.4, 0.08, 0.16, P.metalLight, [-0.26, 1.14, 0]),
      box(1.65, 0.08, 0.16, P.salmonBright, [-0.13, 0.94, 0]),
      box(1.1, 0.08, 0.16, P.metalLight, [-0.41, 0.74, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['nutrition-board'],
  );
}

/** Dựng hình học bản chi tiết của trụ trưng bày cúp từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildTrophyTotem(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Bệ đá và cột monolith màu than.
    box(0.96, 0.18, 0.56, P.stone, [0, 0.09, 0]),
    box(0.76, 1.72, 0.34, P.charcoal, [0, 1.02, 0]),
    // Vương miện biểu tượng chuỗi streak SÖL phía trên.
    cyl(0.22, 0.22, 0.1, P.salmon, [0, 1.96, 0], [Math.PI / 2, 0, 0], 10),
  ];

  // Các ô streak phát sáng dạng lưới con rắn ở mặt trước.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const x = -0.2 + c * 0.2;
      const y = 0.56 + r * 0.28;
      const color = (r + c) % 2 === 0 ? P.salmonBright : P.salmon;
      parts.push(box(0.14, 0.18, 0.04, color, [x, y, 0.18]));
    }
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['trophy-totem']);
}

/** Dựng hình học bản chi tiết của bục HLV từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildCoachPodium(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ đế và thân bục giảng nghiêng.
      box(1.34, 0.08, 0.92, P.charcoal, [0, 0.04, 0]),
      box(1.24, 0.98, 0.68, P.charcoalSoft, [0, 0.54, 0]),
      box(1.12, 0.86, 0.05, P.wood, [0, 0.54, 0.35]),
      // Mặt bàn nghiêng phía trên và hai máy tính bảng.
      box(1.36, 0.08, 0.82, P.stone, [0, 1.06, 0], [0.16, 0, 0]),
      box(1.36, 0.04, 0.06, P.salmon, [0, 1.02, 0.41]),
      box(0.42, 0.24, 0.04, P.screen, [-0.28, 1.15, -0.06], [-0.45, 0, 0]),
      box(0.42, 0.24, 0.04, P.screenGlow, [0.28, 1.15, -0.06], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['coach-podium'],
  );
}

/** Dựng hình học bản chi tiết của phòng tư vấn (pod) từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildConsultationPod(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bàn gỗ tròn và chân trụ giữa.
      cyl(0.42, 0.46, 0.05, P.charcoal, [0, 0.025, 0], undefined, 10),
      cyl(0.08, 0.08, 0.72, P.charcoal, [0, 0.38, 0], undefined, 8),
      cyl(0.58, 0.58, 0.06, P.wood, [0, 0.74, 0], undefined, 12),
      box(0.28, 0.03, 0.2, P.screen, [0, 0.78, 0]),
      // Ghế lounge bên trái.
      box(0.56, 0.42, 0.58, P.charcoalDeep, [-0.68, 0.24, 0]),
      box(0.14, 0.46, 0.58, P.salmon, [-0.9, 0.64, 0]),
      // Ghế lounge bên phải.
      box(0.56, 0.42, 0.58, P.charcoalDeep, [0.68, 0.24, 0]),
      box(0.14, 0.46, 0.58, P.salmon, [0.9, 0.64, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['consultation-pod'],
  );
}

/** Dựng hình học bản chi tiết của dãy tủ khóa từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildLockerBank(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Thân tủ chính màu than và gờ trên.
    box(3.16, 1.96, 0.58, P.charcoal, [0, 0.98, -0.14]),
    box(3.2, 0.08, 0.64, P.charcoalSoft, [0, 1.96, -0.12]),
    // Ghế gỗ thay đồ tích hợp ở mặt trước.
    box(3.08, 0.07, 0.36, P.woodLight, [0, 0.44, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [-1.36, 0.21, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [0, 0.21, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [1.36, 0.21, 0.26]),
  ];

  // 6 cột × 2 tầng cửa tủ gỗ kèm huy hiệu đầu đọc RFID.
  for (let col = 0; col < 6; col++) {
    const x = -1.25 + col * 0.5;
    // Cửa tầng trên.
    parts.push(box(0.44, 0.66, 0.04, P.wood, [x, 1.54, 0.16]));
    parts.push(box(0.06, 0.09, 0.05, P.salmon, [x + 0.14, 1.54, 0.17]));
    // Cửa tầng dưới.
    parts.push(box(0.44, 0.66, 0.04, P.wood, [x, 0.82, 0.16]));
    parts.push(box(0.06, 0.09, 0.05, P.salmon, [x + 0.14, 0.82, 0.17]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['locker-bank']);
}

/** Dựng hình học bản chi tiết của ghế sauna từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildSaunaBench(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Ghế gỗ tuyết tùng hai bậc kèm tựa lưng.
      box(3.28, 0.44, 0.82, P.wood, [-0.42, 0.22, 0.36]),
      box(3.28, 0.86, 0.86, P.woodLight, [-0.42, 0.43, -0.44]),
      box(3.28, 0.24, 0.08, P.wood, [-0.42, 0.98, -0.82]),
      // Lò đá muối Himalaya ở đầu bên phải.
      box(0.72, 0.82, 0.72, P.charcoal, [1.68, 0.41, -0.18]),
      box(0.58, 0.22, 0.58, P.salmonBright, [1.68, 0.86, -0.18]),
      box(0.82, 0.06, 0.82, P.woodLight, [1.68, 0.92, -0.18]),
    ],
    DEFAULT_ITEM_DIMENSIONS['sauna-bench'],
  );
}

/** Dựng hình học bản chi tiết của bồn jacuzzi từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildJacuzziTub(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Vỏ bồn ngoài bằng nan tuyết tùng và than.
      box(3.56, 0.84, 3.16, P.charcoal, [0, 0.42, 0]),
      box(3.6, 0.1, 3.2, P.stone, [0, 0.88, 0]),
      // Mặt nước trị liệu âm ở bên trong.
      box(2.96, 0.08, 2.56, P.water, [0, 0.89, 0]),
      // Gối tựa đầu ở góc và bậc lên xuống.
      box(0.64, 0.09, 0.24, P.white, [-0.9, 0.95, -1.36]),
      box(0.64, 0.09, 0.24, P.white, [0.9, 0.95, -1.36]),
      box(1.4, 0.38, 0.44, P.wood, [0, 0.19, 1.48]),
    ],
    DEFAULT_ITEM_DIMENSIONS['jacuzzi-tub'],
  );
}

/** Dựng hình học bản chi tiết của ghế sofa phòng chờ từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildLoungeSofa(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bệ gỗ ấm.
      box(2.58, 0.16, 1.36, P.wood, [0, 0.08, 0]),
      // 3 đệm ngồi sâu.
      box(0.78, 0.24, 1.12, P.charcoalDeep, [-0.8, 0.28, 0.08]),
      box(0.78, 0.24, 1.12, P.charcoalDeep, [0, 0.28, 0.08]),
      box(0.78, 0.24, 1.12, P.charcoalDeep, [0.8, 0.28, 0.08]),
      // Tựa lưng và tay vịn rộng.
      box(2.52, 0.46, 0.28, P.charcoal, [0, 0.62, -0.52]),
      box(0.24, 0.38, 1.32, P.charcoal, [-1.16, 0.56, 0]),
      box(0.24, 0.38, 1.32, P.charcoal, [1.16, 0.56, 0]),
      // Gối tựa màu salmon.
      box(0.42, 0.28, 0.14, P.salmon, [-0.76, 0.54, -0.32], [0.2, 0.15, 0]),
      box(0.42, 0.28, 0.14, P.salmonBright, [0.76, 0.54, -0.32], [0.2, -0.15, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['lounge-sofa'],
  );
}

/** Dựng hình học bản chi tiết của quầy nước ép từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildJuiceBar(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Thân quầy, mặt trước nan và mặt quầy bằng đá.
      box(3.76, 0.96, 1.28, P.charcoal, [0, 0.48, 0]),
      box(3.64, 0.84, 0.05, P.wood, [0, 0.48, 0.65]),
      box(3.8, 0.08, 1.38, P.stone, [0, 1.0, 0]),
      // Tủ trưng bày chai lạnh và máy xay shaker protein.
      box(1.36, 0.28, 0.52, P.glass, [-1.05, 1.14, 0.16]),
      box(1.38, 0.04, 0.54, P.salmon, [-1.05, 1.29, 0.16]),
      cyl(0.12, 0.14, 0.28, P.metalLight, [0.42, 1.16, 0], undefined, 8),
      cyl(0.12, 0.14, 0.28, P.salmon, [0.86, 1.16, 0], undefined, 8),
      box(0.48, 0.26, 0.05, P.screen, [1.42, 1.15, 0.1], [0.25, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['juice-bar'],
  );
}

/** Dựng hình học bản chi tiết của lõi cầu thang từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildStairCore(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Ngưỡng dưới (y = 0..0.08), chiếu nghỉ giữa (y = 1.90), cầu đến phía trên (y = 3.80).
    box(3.2, 0.08, 0.52, P.stone, [0, 0.04, 1.88]),
    box(3.2, 0.12, 0.64, P.stone, [0, 1.84, 0]),
    box(3.2, 0.14, 0.52, P.stone, [0, 3.73, -1.88]),
    // Hai dầm bên (các đợt thang dưới và trên) cùng giá đỡ ngoài rộng 3.60 m.
    box(0.08, 0.24, 1.9, P.charcoal, [-1.46, 0.88, 0.98], [-0.82, 0, 0]),
    box(0.08, 0.24, 1.9, P.charcoal, [1.46, 0.88, 0.98], [-0.82, 0, 0]),
    box(0.08, 0.24, 1.9, P.charcoal, [-1.46, 2.78, -0.98], [-0.82, 0, 0]),
    box(0.08, 0.24, 1.9, P.charcoal, [1.46, 2.78, -0.98], [-0.82, 0, 0]),
    box(0.08, 0.06, 0.14, P.metal, [-1.76, 1.92, 0]),
    box(0.08, 0.06, 0.14, P.metal, [1.76, 1.92, 0]),
    // Các trụ thép hở và tay vịn phía trên đạt đỉnh y = 4.56 (không tường giữa hoặc dùng kính đặc).
    box(0.04, 0.74, 0.05, P.charcoal, [-1.66, 0.45, 1.94]),
    box(0.04, 0.74, 0.05, P.charcoal, [1.66, 0.45, 1.94]),
    box(0.04, 0.74, 0.05, P.charcoal, [-1.66, 2.27, 0]),
    box(0.04, 0.74, 0.05, P.charcoal, [1.66, 2.27, 0]),
    box(0.04, 0.76, 0.05, P.charcoal, [-1.66, 4.18, -1.94]),
    box(0.04, 0.76, 0.05, P.charcoal, [1.66, 4.18, -1.94]),
    box(0.05, 0.05, 2.2, P.woodLight, [-1.66, 1.72, 1.12], [-0.78, 0, 0]),
    box(0.05, 0.05, 2.2, P.woodLight, [1.66, 1.72, 1.12], [-0.78, 0, 0]),
    box(0.05, 0.05, 2.2, P.woodLight, [-1.66, 3.62, -1.12], [-0.78, 0, 0]),
    box(0.05, 0.05, 2.2, P.woodLight, [1.66, 3.62, -1.12], [-0.78, 0, 0]),
  ];

  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    parts.push(box(3.04, 0.08, 0.26, P.wood, [0, 0.24 + t * 1.42, 1.52 - t * 1.08]));
    parts.push(box(3.04, 0.08, 0.26, P.wood, [0, 2.14 + t * 1.42, -0.44 - t * 1.08]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['stair-core']);
}

/** Dựng hình học bản chi tiết của lõi thang máy từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildElevatorCore(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Hố đáy và nắp máy trên mái.
      box(2.58, 0.18, 2.58, P.charcoal, [0, 0.09, 0]),
      box(2.58, 0.24, 2.58, P.charcoal, [0, 3.68, 0]),
      // 4 cột thép kết cấu ở các góc.
      box(0.18, 3.6, 0.18, P.charcoal, [-1.2, 1.88, -1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [1.2, 1.88, -1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [-1.2, 1.88, 1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [1.2, 1.88, 1.2]),
      // Vỏ giếng thang bằng kính toàn cảnh.
      box(2.26, 3.4, 2.26, P.glass, [0, 1.88, 0]),
      // Cabin thang máy bên trong và cửa thép xước.
      box(1.96, 2.4, 1.96, P.charcoalSoft, [0, 1.38, -0.06]),
      box(0.76, 2.15, 0.06, P.metalLight, [-0.4, 1.26, 1.18]),
      box(0.76, 2.15, 0.06, P.metalLight, [0.4, 1.26, 1.18]),
      // Hộp chỉ báo tầng màu salmon phía trên cửa.
      box(1.68, 0.14, 0.08, P.salmon, [0, 2.48, 1.22]),
    ],
    DEFAULT_ITEM_DIMENSIONS['elevator-core'],
  );
}

/** Dựng hình học bản chi tiết của chậu cây từ các khối, ống và đĩa rồi co vừa kích thước mặc định. */
function buildPlanterTree(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Chậu cây thon kiểu kiến trúc cùng viền trong màu đất nung.
      cyl(0.56, 0.42, 0.68, P.charcoal, [0, 0.34, 0], undefined, 10),
      cyl(0.58, 0.56, 0.08, P.salmon, [0, 0.68, 0], undefined, 10),
      cyl(0.5, 0.5, 0.04, P.wood, [0, 0.71, 0], undefined, 8),
      // Thân ô liu/tre nhiều nhánh được tạo hình.
      cyl(0.055, 0.08, 1.35, P.wood, [0, 1.34, 0], [0.06, 0, -0.05], 6),
      cyl(0.04, 0.055, 0.85, P.woodLight, [0.16, 1.62, 0.08], [0.15, 0, 0.28], 6),
      cyl(0.04, 0.055, 0.82, P.woodLight, [-0.15, 1.58, -0.08], [-0.15, 0, -0.26], 6),
      // Các cụm tán lá hữu cơ nhiều lớp.
      sphere(0.56, P.foliage, [0, 2.14, 0], [1.15, 0.78, 1.15], 8, 6),
      sphere(0.42, P.foliageLight, [0.28, 1.94, 0.18], [1.1, 0.75, 1.1], 8, 6),
      sphere(0.4, P.foliageLight, [-0.26, 1.9, -0.16], [1.1, 0.75, 1.1], 8, 6),
    ],
    DEFAULT_ITEM_DIMENSIONS['planter-tree'],
  );
}

const HIGH_DETAIL_BUILDERS: Record<ItemKind, () => THREE.BufferGeometry> = {
  treadmill: buildTreadmill,
  'upright-bike': buildUprightBike,
  elliptical: buildElliptical,
  'smith-machine': buildSmithMachine,
  'lat-pulldown': buildLatPulldown,
  'squat-rack': buildSquatRack,
  'dumbbell-rack': buildDumbbellRack,
  'adjustable-bench': buildAdjustableBench,
  'kinesis-station': buildKinesisStation,
  'inbody-analyzer': buildInbodyAnalyzer,
  'boxing-ring': buildBoxingRing,
  'heavy-bag': buildHeavyBag,
  'speed-bag': buildSpeedBag,
  'badminton-court': buildBadmintonCourt,
  'tennis-court': buildTennisCourt,
  'swim-lane': buildSwimLane,
  'starting-block': buildStartingBlock,
  'yoga-mat': buildYogaMat,
  'meditation-bolster': buildMeditationBolster,
  'reception-desk': buildReceptionDesk,
  'qr-turnstile': buildQrTurnstile,
  'kiosk-checkin': buildKioskCheckin,
  'card-printer': buildCardPrinter,
  'supplement-shelf': buildSupplementShelf,
  'nutrition-board': buildNutritionBoard,
  'trophy-totem': buildTrophyTotem,
  'coach-podium': buildCoachPodium,
  'consultation-pod': buildConsultationPod,
  'locker-bank': buildLockerBank,
  'sauna-bench': buildSaunaBench,
  'jacuzzi-tub': buildJacuzziTub,
  'lounge-sofa': buildLoungeSofa,
  'juice-bar': buildJuiceBar,
  'stair-core': buildStairCore,
  'elevator-core': buildElevatorCore,
  'planter-tree': buildPlanterTree,
};

// Thiết bị gym và nội thất thực tế thay thế các hình dạng dựng bằng hộp
// cho các loại item này.
const BUILDER_HELPERS: GymBuilderHelpers = {
  P: ITEM_PALETTE,
  dims: DEFAULT_ITEM_DIMENSIONS,
  box,
  cyl,
  sphere,
  roundedBox,
  tube,
  disc,
  shape,
  surface: registerItemSurface,
  fit: mergeAndFit,
};
Object.assign(
  HIGH_DETAIL_BUILDERS,
  createGymBuilders(BUILDER_HELPERS),
  createInteriorBuilders(BUILDER_HELPERS),
);

// ============================================================================
// BỘ DỰNG PROXY LOD ĐỘ CHI TIẾT THẤP (<= 72 tam giác mỗi item)
// ============================================================================

/**
 * Dựng bản chi tiết thấp (ít khối) của một loại đồ vật theo kích thước mặc định, dùng khi ở xa hoặc chất lượng
 * thấp.
 */
function buildLowDetailGeometry(kind: ItemKind): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const dims = DEFAULT_ITEM_DIMENSIONS[kind];
  const [w, h, d] = dims;

  switch (kind) {
    case 'treadmill':
    case 'elliptical':
    case 'upright-bike':
    case 'inbody-analyzer':
      return mergeAndFit(
        [
          box(w, h * 0.18, d, P.charcoal, [0, h * 0.09, 0]),
          box(w * 0.72, h * 0.82, d * 0.24, P.charcoalSoft, [0, h * 0.56, -d * 0.34]),
          box(w * 0.58, h * 0.2, d * 0.12, P.salmon, [0, h * 0.88, -d * 0.34]),
        ],
        dims,
      );

    case 'smith-machine':
    case 'squat-rack':
    case 'lat-pulldown':
    case 'kinesis-station':
      return mergeAndFit(
        [
          box(w, h * 0.08, d, P.charcoal, [0, h * 0.04, 0]),
          box(w * 0.12, h * 0.92, d * 0.18, P.charcoal, [-w * 0.42, h * 0.5, -d * 0.2]),
          box(w * 0.12, h * 0.92, d * 0.18, P.charcoal, [w * 0.42, h * 0.5, -d * 0.2]),
          box(w * 0.96, h * 0.08, d * 0.2, P.salmon, [0, h * 0.94, -d * 0.2]),
          box(w * 0.98, h * 0.06, d * 0.08, P.metalLight, [0, h * 0.54, 0]),
        ],
        dims,
      );

    case 'badminton-court':
    case 'tennis-court':
      return mergeAndFit(
        [
          box(0.1, 0.03, 0.1, P.white, [-w * 0.48, 0.015, -d * 0.48]),
          box(0.1, 0.03, 0.1, P.white, [w * 0.48, 0.015, d * 0.48]),
          box(w * 0.94, h * 0.65, 0.04, P.charcoalSoft, [0, h * 0.6, 0]),
          box(w * 0.96, h * 0.08, 0.05, P.white, [0, h * 0.94, 0]),
        ],
        dims,
      );

    case 'swim-lane':
      return mergeAndFit(
        [
          box(w, h * 0.45, 0.14, P.salmon, [0, h * 0.5, -d * 0.46]),
          box(w, h * 0.45, 0.14, P.white, [0, h * 0.5, d * 0.46]),
        ],
        dims,
      );

    case 'planter-tree':
      return mergeAndFit(
        [
          box(w * 0.72, h * 0.28, d * 0.72, P.charcoal, [0, h * 0.14, 0]),
          box(w * 0.14, h * 0.42, d * 0.14, P.wood, [0, h * 0.45, 0]),
          box(w, h * 0.42, d, P.foliage, [0, h * 0.79, 0]),
        ],
        dims,
      );

    default:
      return mergeAndFit(
        [
          box(w, h * 0.78, d, P.charcoal, [0, h * 0.39, 0]),
          box(w * 0.92, h * 0.22, d * 0.92, P.salmon, [0, h * 0.89, 0]),
        ],
        dims,
      );
  }
}

// ============================================================================
// BỘ NHỚ ĐỆM HÌNH HỌC VÀ API CÔNG KHAI
// ============================================================================

const geometryCache = new Map<string, THREE.BufferGeometry>();

const geometryOverrides = new Map<ItemKind, THREE.BufferGeometry>();
const geometryListeners = new Set<() => void>();
let geometryRevision = 0;

/** Tăng số phiên bản hình học và báo cho các listener. */
function notifyGeometryChange(): void {
  geometryRevision += 1;
  for (const listener of geometryListeners) listener();
}

/**
 * Đăng ký listener cho useSyncExternalStore để các lô instanced dựng lại khi mô hình bị thay; trả về hàm hủy.
 *
 * useSyncExternalStore subscription so instanced batches rebuild when a model is swapped.
 */
export function subscribeItemGeometries(listener: () => void): () => void {
  geometryListeners.add(listener);
  return () => {
    geometryListeners.delete(listener);
  };
}

/** Số phiên bản hiện tại của hình học đồ vật. */
export function getItemGeometryRevision(): number {
  return geometryRevision;
}

/**
 * Thay hình học bản chi tiết cao của một loại đồ vật (ví dụ bằng mô hình .glb); bản thấp và bộ dựng thủ tục vẫn
 * là phương án dự phòng.
 *
 * Replace the high-detail geometry of an item kind (for example with a model
 * loaded from a .glb). Low detail proxies and the procedural builder stay
 * available as the fallback.
 */
export function registerItemGeometryOverride(
  kind: ItemKind,
  geometry: THREE.BufferGeometry,
): void {
  const previous = geometryOverrides.get(kind);
  if (previous && previous !== geometry) previous.dispose();
  geometry.name = `item-geom-${kind}-override`;
  geometryOverrides.set(kind, geometry);
  notifyGeometryChange();
}

/** Bỏ bản hình học thay thế của một loại đồ vật (có thể chỉ bỏ nếu đúng hình học đã đăng ký). */
export function unregisterItemGeometryOverride(
  kind: ItemKind,
  geometry?: THREE.BufferGeometry,
): void {
  const current = geometryOverrides.get(kind);
  if (!current || (geometry && current !== geometry)) return;
  current.dispose();
  geometryOverrides.delete(kind);
  notifyGeometryChange();
}

/** Loại đồ vật có đang dùng hình học thay thế không. */
export function hasItemGeometryOverride(kind: ItemKind): boolean {
  return geometryOverrides.has(kind);
}

/** Lấy hình học của một loại đồ vật theo mức chi tiết (có cache, ưu tiên bản thay thế ở mức cao). */
export function getItemGeometry(
  kind: ItemKind,
  detail: ItemDetailLevel = 'high',
): THREE.BufferGeometry {
  if (detail === 'high') {
    const override = geometryOverrides.get(kind);
    if (override) return override;
  }
  const key = `${kind}:${detail}`;
  const cached = geometryCache.get(key);
  if (cached) {
    return cached;
  }

  const builder = HIGH_DETAIL_BUILDERS[kind];
  let geometry: THREE.BufferGeometry;
  if (detail === 'low' || !builder) {
    bevelEnabled = false;
    try {
      geometry = buildLowDetailGeometry(kind);
    } finally {
      bevelEnabled = true;
    }
  } else {
    geometry = builder();
    if (getGeometryTriangleCount(geometry) > ITEM_HIGH_DETAIL_TRIANGLE_BUDGET) {
      // Quá nhiều bộ phận nên không đủ ngân sách để vát cạnh: quay về dùng hộp phẳng cho loại này.
      geometry.dispose();
      bevelEnabled = false;
      try {
        geometry = builder();
      } finally {
        bevelEnabled = true;
      }
    }
  }
  geometry.name = `item-geom-${kind}-${detail}`;
  geometryCache.set(key, geometry);
  return geometry;
}

/** Đếm số tam giác của một hình học. */
export function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) {
    return Math.floor(index.count / 3);
  }
  const pos = geometry.getAttribute('position');
  return pos ? Math.floor(pos.count / 3) : 0;
}

/** Xóa cache hình học (giải phóng bộ nhớ). */
export function clearItemGeometryCache(): void {
  for (const geom of geometryCache.values()) {
    geom.dispose();
  }
  geometryCache.clear();
  for (const geom of geometryOverrides.values()) {
    geom.dispose();
  }
  geometryOverrides.clear();
}

/** Dựng sẵn hình học mức cao và thấp của mọi loại đồ vật. */
export function warmAllItemGeometries(): void {
  for (const kind of ALL_ITEM_KINDS) {
    getItemGeometry(kind, 'high');
    getItemGeometry(kind, 'low');
  }
}

// ============================================================================
// INSTANCING VÀ CÁC HÀM TRỢ GIÚP TRẠNG THÁI
// ============================================================================

/** Trạng thái đã gắn dữ liệu thật của một đồ vật: hiển thị không và trạng thái. */
export interface ResolvedItemBindingState {
  visible: boolean;
  status: string;
}

/** Bản đồ trạng thái đồ vật theo id (object hoặc Map). */
export type ResolvedItemsMap =
  | Record<string, ResolvedItemBindingState>
  | Map<string, ResolvedItemBindingState>;

/** Một đồ vật trong nhóm theo loại: nút đồ vật và tầng chứa nó. */
export interface GroupedItemEntry {
  item: ItemNode;
  level: LevelNode | null;
}

/** Màu tô của đồ vật theo trạng thái (mặc định, nổi bật, bảo trì, hỏng, đã loại). */
export const ITEM_STATUS_COLORS = {
  default: '#ffffff',
  highlight: '#ffe0d6',
  maintenance: '#eab308',
  broken: '#ef4444',
  retired: '#6b7280',
} as const;

/** Tra trạng thái dữ liệu thật của một đồ vật theo id. */
export function lookupResolvedItem(
  resolvedItems: ResolvedItemsMap | undefined,
  itemId: string,
): ResolvedItemBindingState | undefined {
  if (!resolvedItems) return undefined;
  if (resolvedItems instanceof Map) {
    return resolvedItems.get(itemId);
  }
  return resolvedItems[itemId];
}

/**
 * Màu của một instance: nổi bật khi được chọn hoặc rê, màu cảnh báo khi bảo trì/hỏng/đã loại, còn lại màu mặc
 * định.
 */
export function resolveItemInstanceColor(
  status: string | undefined,
  isSelected: boolean,
  isHovered: boolean,
): string {
  if (isSelected || isHovered) {
    return ITEM_STATUS_COLORS.highlight;
  }
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'maintenance') {
    return ITEM_STATUS_COLORS.maintenance;
  }
  if (normalized === 'broken') {
    return ITEM_STATUS_COLORS.broken;
  }
  if (normalized === 'retired') {
    return ITEM_STATUS_COLORS.retired;
  }
  return ITEM_STATUS_COLORS.default;
}

/** Instance có hiển thị không: ẩn khi dữ liệu thật báo ẩn hoặc khi chỉ xem một tầng khác. */
export function isItemInstanceVisible(
  entry: GroupedItemEntry,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
  resolvedState: ResolvedItemBindingState | undefined,
): boolean {
  if (resolvedState && resolvedState.visible === false) {
    return false;
  }
  if (levelMode === 'solo' && focusLevel !== 'ALL' && entry.level) {
    if (entry.level.code !== focusLevel) {
      return false;
    }
  }
  return true;
}

/** Tính ma trận của một instance (vị trí theo độ cao tầng, xoay Y; ẩn thì co về 0). */
export function computeItemInstanceMatrix(
  entry: GroupedItemEntry,
  levelMode: LevelMode,
  visible: boolean,
  target: THREE.Matrix4 = new THREE.Matrix4(),
): THREE.Matrix4 {
  const { item, level } = entry;
  const levelY = level ? getLevelWorldY(level, levelMode) : 0;
  const worldY = levelY + item.position[1];

  tempPosition.set(item.position[0], worldY, item.position[2]);
  tempEuler.set(0, item.rotationY, 0);
  tempQuaternion.setFromEuler(tempEuler);

  if (!visible) {
    tempScale.set(0, 0, 0);
  } else {
    const baseDims = DEFAULT_ITEM_DIMENSIONS[item.kind];
    const sx = (item.dimensions[0] / baseDims[0]) * (item.scale?.[0] ?? 1);
    const sy = (item.dimensions[1] / baseDims[1]) * (item.scale?.[1] ?? 1);
    const sz = (item.dimensions[2] / baseDims[2]) * (item.scale?.[2] ?? 1);
    tempScale.set(sx, sy, sz);
  }

  return target.compose(tempPosition, tempQuaternion, tempScale);
}

/** Nhóm các đồ vật của cảnh theo loại. */
export function groupItemsByKind(scene: SceneDoc): Map<ItemKind, GroupedItemEntry[]> {
  const groups = new Map<ItemKind, GroupedItemEntry[]>();
  for (const kind of ALL_ITEM_KINDS) {
    groups.set(kind, []);
  }
  for (const item of allItems(scene)) {
    const list = groups.get(item.kind);
    const entry: GroupedItemEntry = {
      item,
      level: levelOf(scene, item.id),
    };
    if (list) {
      list.push(entry);
    } else {
      groups.set(item.kind, [entry]);
    }
  }
  return groups;
}

