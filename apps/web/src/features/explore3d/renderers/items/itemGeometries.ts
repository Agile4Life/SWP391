import * as THREE from 'three';
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

export type ItemDetailLevel = 'high' | 'low';

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
  'stair-core': [3.6, 3.8, 4.2],
  'elevator-core': [2.6, 3.8, 2.6],
  'planter-tree': [1.4, 2.6, 1.4],
};

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempColor = new THREE.Color();

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
  return geom;
}

function box(
  w: number,
  h: number,
  d: number,
  colorHex: string,
  pos: Vec3 = [0, h * 0.5, 0],
  rot?: Vec3,
): THREE.BufferGeometry {
  return paintGeometry(new THREE.BoxGeometry(w, h, d), colorHex, pos, rot);
}

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

function mergeAndFit(parts: THREE.BufferGeometry[], targetDimensions: Vec3): THREE.BufferGeometry {
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
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const part of parts) {
    const posAttr = part.getAttribute('position');
    const normAttr = part.getAttribute('normal');
    const colAttr = part.getAttribute('color');
    const vCount = posAttr.count;

    for (let i = 0; i < vCount; i++) {
      const dst = (vOffset + i) * 3;
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
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

// ============================================================================
// HIGH-DETAIL ITEM BUILDERS (36 recognizable silhouettes, <= 900 tris each)
// ============================================================================

function buildTreadmill(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Deck base & running belt
      box(0.92, 0.14, 1.94, P.charcoal, [0, 0.07, 0]),
      box(0.68, 0.04, 1.66, P.charcoalDeep, [0, 0.15, 0.08]),
      // Side salmon step rails
      box(0.09, 0.05, 1.72, P.salmon, [-0.41, 0.155, 0.05]),
      box(0.09, 0.05, 1.72, P.salmon, [0.41, 0.155, 0.05]),
      // Front motor hood
      box(0.94, 0.24, 0.42, P.charcoalSoft, [0, 0.18, -0.76]),
      // Left & right angled uprights
      box(0.09, 1.18, 0.12, P.charcoal, [-0.42, 0.72, -0.68], [0.16, 0, 0]),
      box(0.09, 1.18, 0.12, P.charcoal, [0.42, 0.72, -0.68], [0.16, 0, 0]),
      // Side handrails
      box(0.07, 0.07, 0.72, P.metal, [-0.42, 1.12, -0.38], [0.12, 0, 0]),
      box(0.07, 0.07, 0.72, P.metal, [0.42, 1.12, -0.38], [0.12, 0, 0]),
      // Console bridge & touchscreen
      box(0.96, 0.14, 0.28, P.charcoalSoft, [0, 1.24, -0.62]),
      box(0.62, 0.34, 0.08, P.charcoal, [0, 1.34, -0.64], [-0.42, 0, 0]),
      box(0.54, 0.26, 0.03, P.screen, [0, 1.35, -0.61], [-0.42, 0, 0]),
      box(0.54, 0.04, 0.04, P.salmon, [0, 1.44, -0.66], [-0.42, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS.treadmill,
  );
}

function buildUprightBike(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Stabilizer feet
      box(0.64, 0.07, 0.12, P.charcoal, [0, 0.035, -0.48]),
      box(0.64, 0.07, 0.12, P.charcoal, [0, 0.035, 0.48]),
      box(0.14, 0.07, 0.96, P.charcoal, [0, 0.035, 0]),
      // Flywheel shroud & crank housing
      cyl(0.28, 0.28, 0.18, P.charcoalSoft, [0, 0.38, -0.1], [0, 0, Math.PI / 2], 10),
      box(0.2, 0.48, 0.56, P.charcoal, [0, 0.34, 0.04], [-0.2, 0, 0]),
      box(0.21, 0.08, 0.44, P.salmon, [0, 0.42, 0.02], [-0.2, 0, 0]),
      // Pedals
      box(0.14, 0.04, 0.18, P.charcoalDeep, [-0.18, 0.24, -0.05]),
      box(0.14, 0.04, 0.18, P.charcoalDeep, [0.18, 0.46, -0.14]),
      // Seat post & ergonomic saddle
      box(0.08, 0.62, 0.08, P.metal, [0, 0.66, 0.28], [0.22, 0, 0]),
      box(0.26, 0.09, 0.32, P.charcoalDeep, [0, 0.96, 0.34]),
      // Handlebar mast, dual horns & display
      box(0.08, 0.88, 0.09, P.charcoal, [0, 0.72, -0.34], [-0.18, 0, 0]),
      box(0.56, 0.06, 0.06, P.metal, [0, 1.14, -0.38]),
      box(0.06, 0.18, 0.24, P.charcoalDeep, [-0.25, 1.2, -0.28], [0.3, 0, 0]),
      box(0.06, 0.18, 0.24, P.charcoalDeep, [0.25, 1.2, -0.28], [0.3, 0, 0]),
      box(0.32, 0.22, 0.06, P.screen, [0, 1.22, -0.4], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['upright-bike'],
  );
}

function buildElliptical(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base frame rails
      box(0.88, 0.08, 1.98, P.charcoal, [0, 0.04, 0]),
      // Rear drive drum
      cyl(0.38, 0.38, 0.28, P.charcoalSoft, [0, 0.44, 0.56], [0, 0, Math.PI / 2], 10),
      cyl(0.24, 0.24, 0.3, P.salmon, [0, 0.44, 0.56], [0, 0, Math.PI / 2], 8),
      // Foot pedal tracks & oversized foot pads
      box(0.1, 0.06, 1.35, P.metal, [-0.26, 0.24, 0.1], [0.08, 0, 0]),
      box(0.1, 0.06, 1.35, P.metal, [0.26, 0.24, 0.1], [-0.05, 0, 0]),
      box(0.2, 0.07, 0.44, P.charcoalDeep, [-0.26, 0.3, 0.12]),
      box(0.2, 0.07, 0.44, P.charcoalDeep, [0.26, 0.26, -0.04]),
      // Central console tower
      box(0.18, 1.28, 0.22, P.charcoal, [0, 0.72, -0.68], [-0.16, 0, 0]),
      box(0.48, 0.3, 0.08, P.screen, [0, 1.44, -0.74], [-0.42, 0, 0]),
      box(0.5, 0.05, 0.09, P.salmon, [0, 1.58, -0.78], [-0.42, 0, 0]),
      // Dual moving stride arms
      box(0.06, 1.32, 0.08, P.metal, [-0.36, 0.92, -0.46], [0.18, 0, 0]),
      box(0.06, 1.32, 0.08, P.metal, [0.36, 0.92, -0.54], [-0.14, 0, 0]),
      box(0.08, 0.28, 0.08, P.charcoalDeep, [-0.36, 1.48, -0.34]),
      box(0.08, 0.28, 0.08, P.charcoalDeep, [0.36, 1.48, -0.62]),
    ],
    DEFAULT_ITEM_DIMENSIONS.elliptical,
  );
}

function buildSmithMachine(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Left and right base runners
      box(0.14, 0.1, 1.52, P.charcoal, [-0.82, 0.05, 0]),
      box(0.14, 0.1, 1.52, P.charcoal, [0.82, 0.05, 0]),
      box(1.78, 0.08, 0.14, P.charcoal, [0, 0.05, -0.66]),
      // Main vertical columns & angled rear braces
      box(0.12, 2.18, 0.12, P.charcoal, [-0.82, 1.12, -0.18]),
      box(0.12, 2.18, 0.12, P.charcoal, [0.82, 1.12, -0.18]),
      box(0.1, 2.16, 0.1, P.charcoalSoft, [-0.82, 1.1, -0.58], [0.18, 0, 0]),
      box(0.1, 2.16, 0.1, P.charcoalSoft, [0.82, 1.1, -0.58], [0.18, 0, 0]),
      // Top crossbeam & salmon header badge
      box(1.84, 0.14, 0.24, P.charcoal, [0, 2.16, -0.26]),
      box(0.92, 0.08, 0.26, P.salmon, [0, 2.16, -0.26]),
      // Twin chrome guide rods
      cyl(0.025, 0.025, 2.04, P.metalLight, [-0.72, 1.08, -0.02], undefined, 6),
      cyl(0.025, 0.025, 2.04, P.metalLight, [0.72, 1.08, -0.02], undefined, 6),
      // Guided Olympic barbell & weight plates
      cyl(0.028, 0.028, 2.18, P.metalLight, [0, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [-0.94, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [0.94, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.16, 0.16, 0.06, P.salmon, [-1.02, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      cyl(0.16, 0.16, 0.06, P.salmon, [1.02, 1.15, -0.02], [0, 0, Math.PI / 2], 8),
      // Side plate storage pegs
      box(0.22, 0.05, 0.05, P.metal, [-0.96, 0.65, -0.45]),
      box(0.22, 0.05, 0.05, P.metal, [0.96, 0.65, -0.45]),
    ],
    DEFAULT_ITEM_DIMENSIONS['smith-machine'],
  );
}

function buildLatPulldown(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base runners
      box(1.1, 0.08, 1.44, P.charcoal, [0, 0.04, 0]),
      // Enclosed weight stack tower
      box(0.68, 2.08, 0.36, P.charcoalSoft, [0, 1.06, -0.52]),
      box(0.46, 1.56, 0.24, P.charcoalDeep, [0, 0.96, -0.5]),
      box(0.48, 0.08, 0.28, P.salmon, [0, 1.24, -0.5]),
      // Overhead dual pulley boom
      box(0.24, 0.12, 0.96, P.charcoal, [0, 2.12, -0.18]),
      cyl(0.09, 0.09, 0.06, P.salmon, [0, 2.08, 0.22], [0, 0, Math.PI / 2], 8),
      // Wide lat bar suspended below boom
      cyl(0.022, 0.022, 1.24, P.metalLight, [0, 1.82, 0.22], [0, 0, Math.PI / 2], 8),
      box(0.18, 0.05, 0.05, P.charcoalDeep, [-0.66, 1.78, 0.22], [0, 0, 0.35]),
      box(0.18, 0.05, 0.05, P.charcoalDeep, [0.66, 1.78, 0.22], [0, 0, -0.35]),
      // Seat post, seat pad & thigh hold-down rollers
      box(0.12, 0.44, 0.12, P.charcoal, [0, 0.24, 0.28]),
      box(0.38, 0.08, 0.44, P.charcoalDeep, [0, 0.48, 0.3]),
      cyl(0.08, 0.08, 0.48, P.charcoalDeep, [0, 0.66, 0.12], [0, 0, Math.PI / 2], 8),
      box(0.08, 0.22, 0.26, P.metal, [0, 0.58, -0.02]),
    ],
    DEFAULT_ITEM_DIMENSIONS['lat-pulldown'],
  );
}

function buildSquatRack(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Lifting platform base (oak center + rubber wings)
      box(1.66, 0.06, 1.74, P.charcoalDeep, [0, 0.03, 0]),
      box(0.86, 0.065, 1.72, P.wood, [0, 0.033, 0]),
      // 4 heavy uprights
      box(0.1, 2.22, 0.1, P.charcoal, [-0.62, 1.14, -0.56]),
      box(0.1, 2.22, 0.1, P.charcoal, [0.62, 1.14, -0.56]),
      box(0.1, 2.22, 0.1, P.charcoal, [-0.62, 1.14, 0.26]),
      box(0.1, 2.22, 0.1, P.charcoal, [0.62, 1.14, 0.26]),
      // Top crossbeams & pull-up bar
      box(0.1, 0.12, 0.92, P.charcoal, [-0.62, 2.2, -0.15]),
      box(0.1, 0.12, 0.92, P.charcoal, [0.62, 2.2, -0.15]),
      box(1.34, 0.14, 0.12, P.salmon, [0, 2.2, -0.56]),
      cyl(0.026, 0.026, 1.28, P.metal, [0, 2.18, 0.26], [0, 0, Math.PI / 2], 8),
      // Safety spotter arms
      box(0.08, 0.07, 0.92, P.metal, [-0.62, 0.88, -0.15]),
      box(0.08, 0.07, 0.92, P.metal, [0.62, 0.88, -0.15]),
      // Olympic barbell + bumper plates
      cyl(0.026, 0.026, 1.68, P.metalLight, [0, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [-0.74, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.22, 0.22, 0.08, P.charcoalDeep, [0.74, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.18, 0.18, 0.06, P.salmon, [-0.81, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
      cyl(0.18, 0.18, 0.06, P.salmon, [0.81, 1.38, 0.28], [0, 0, Math.PI / 2], 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['squat-rack'],
  );
}

function buildDumbbellRack(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Left, center, right A-frame legs
    box(0.1, 0.88, 0.72, P.charcoal, [-1.18, 0.44, 0]),
    box(0.1, 0.88, 0.72, P.charcoal, [0, 0.44, 0]),
    box(0.1, 0.88, 0.72, P.charcoal, [1.18, 0.44, 0]),
    // Upper and lower shelf rails
    box(2.52, 0.07, 0.28, P.charcoalSoft, [0, 0.78, -0.08], [0.18, 0, 0]),
    box(2.52, 0.07, 0.32, P.charcoalSoft, [0, 0.42, 0.08], [0.18, 0, 0]),
    box(2.54, 0.03, 0.04, P.salmon, [0, 0.81, 0.06]),
    box(2.54, 0.03, 0.04, P.salmon, [0, 0.45, 0.23]),
  ];

  // 6 dumbbell pairs across top & bottom shelves
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + i * 0.4;
    // Top dumbbell
    parts.push(box(0.12, 0.12, 0.32, P.charcoalDeep, [x - 0.07, 0.86, -0.08]));
    parts.push(box(0.12, 0.12, 0.32, P.charcoalDeep, [x + 0.07, 0.86, -0.08]));
    // Bottom heavier dumbbell
    parts.push(box(0.14, 0.14, 0.36, P.charcoalDeep, [x, 0.52, 0.08]));
    parts.push(box(0.06, 0.06, 0.38, P.metalLight, [x, 0.52, 0.08]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['dumbbell-rack']);
}

function buildAdjustableBench(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // H-frame steel base
      box(0.68, 0.06, 0.12, P.charcoal, [0, 0.03, -0.56]),
      box(0.54, 0.06, 0.12, P.charcoal, [0, 0.03, 0.56]),
      box(0.1, 0.07, 1.24, P.charcoal, [0, 0.04, 0]),
      // Vertical support posts
      box(0.09, 0.38, 0.09, P.charcoal, [0, 0.22, 0.32]),
      box(0.09, 0.38, 0.09, P.charcoal, [0, 0.22, -0.22]),
      // Seat pad
      box(0.34, 0.08, 0.38, P.charcoalDeep, [0, 0.44, 0.36], [-0.12, 0, 0]),
      // Inclined backrest pad + salmon trim
      box(0.36, 0.09, 0.82, P.charcoalDeep, [0, 0.64, -0.22], [0.46, 0, 0]),
      box(0.38, 0.03, 0.83, P.salmon, [0, 0.62, -0.23], [0.46, 0, 0]),
      // Adjustment prop bar
      box(0.06, 0.42, 0.05, P.metal, [0, 0.44, -0.34], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['adjustable-bench'],
  );
}

function buildKinesisStation(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base platform
      box(2.34, 0.08, 1.48, P.charcoal, [0, 0.04, 0]),
      // Architectural wood-and-charcoal vertical wall core
      box(2.28, 2.16, 0.24, P.charcoalSoft, [0, 1.12, -0.56]),
      box(1.42, 2.08, 0.06, P.wood, [0, 1.12, -0.42]),
      box(1.44, 0.08, 0.08, P.salmon, [0, 2.12, -0.41]),
      // Left & right weight towers
      box(0.38, 2.1, 0.32, P.charcoal, [-0.92, 1.1, -0.52]),
      box(0.38, 2.1, 0.32, P.charcoal, [0.92, 1.1, -0.52]),
      // Upper 3D pulley arms
      box(0.07, 0.07, 0.92, P.metalLight, [-0.88, 1.96, -0.02], [0.1, -0.18, 0]),
      box(0.07, 0.07, 0.92, P.metalLight, [0.88, 1.96, -0.02], [0.1, 0.18, 0]),
      cyl(0.08, 0.08, 0.06, P.salmon, [-0.78, 1.92, 0.4], [0, 0, Math.PI / 2], 8),
      cyl(0.08, 0.08, 0.06, P.salmon, [0.78, 1.92, 0.4], [0, 0, Math.PI / 2], 8),
      // Mid 3D pulley arms
      box(0.07, 0.07, 0.78, P.metal, [-0.96, 1.16, -0.08], [0, -0.25, 0]),
      box(0.07, 0.07, 0.78, P.metal, [0.96, 1.16, -0.08], [0, 0.25, 0]),
      // Lower pulley arms
      box(0.07, 0.07, 0.68, P.metal, [-0.86, 0.32, -0.14]),
      box(0.07, 0.07, 0.68, P.metal, [0.86, 0.32, -0.14]),
      // Central touch display
      box(0.44, 0.56, 0.05, P.screen, [0, 1.42, -0.38]),
    ],
    DEFAULT_ITEM_DIMENSIONS['kinesis-station'],
  );
}

function buildInbodyAnalyzer(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Scale base platform + 4 metallic foot electrodes
      cyl(0.42, 0.44, 0.09, P.charcoalSoft, [0, 0.045, 0.12], undefined, 10),
      box(0.14, 0.02, 0.32, P.metalLight, [-0.14, 0.095, 0.14]),
      box(0.14, 0.02, 0.32, P.metalLight, [0.14, 0.095, 0.14]),
      // Sleek clinical column
      box(0.18, 1.16, 0.16, P.white, [0, 0.64, -0.28], [-0.1, 0, 0]),
      box(0.2, 0.48, 0.18, P.charcoal, [0, 0.3, -0.24], [-0.1, 0, 0]),
      // Articulated left & right hand-electrode arms
      box(0.32, 0.05, 0.06, P.metal, [-0.24, 0.96, -0.28], [0, 0, -0.2]),
      box(0.32, 0.05, 0.06, P.metal, [0.24, 0.96, -0.28], [0, 0, 0.2]),
      cyl(0.032, 0.032, 0.28, P.charcoalDeep, [-0.38, 0.94, -0.12], [1.1, 0, 0], 8),
      cyl(0.032, 0.032, 0.28, P.charcoalDeep, [0.38, 0.94, -0.12], [1.1, 0, 0], 8),
      // Clinical display head
      box(0.38, 0.3, 0.07, P.charcoal, [0, 1.22, -0.34], [-0.38, 0, 0]),
      box(0.32, 0.22, 0.03, P.screenGlow, [0, 1.23, -0.31], [-0.38, 0, 0]),
      box(0.38, 0.04, 0.08, P.salmon, [0, 1.34, -0.38], [-0.38, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['inbody-analyzer'],
  );
}

function buildBoxingRing(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Raised ring platform apron & canvas mat
    box(5.5, 0.44, 5.5, P.charcoal, [0, 0.22, 0]),
    box(5.28, 0.06, 5.28, P.charcoalSoft, [0, 0.46, 0]),
    // Center SÖL emblem square on canvas
    box(1.8, 0.02, 1.8, P.salmon, [0, 0.495, 0]),
    box(1.4, 0.022, 1.4, P.charcoalDeep, [0, 0.498, 0]),
    // Corner posts (4 corners)
    cyl(0.09, 0.09, 1.15, P.salmon, [-2.55, 1.02, -2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.white, [2.55, 1.02, 2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.charcoalDeep, [-2.55, 1.02, 2.55], undefined, 8),
    cyl(0.09, 0.09, 1.15, P.charcoalDeep, [2.55, 1.02, -2.55], undefined, 8),
  ];

  // 3 horizontal rope tiers around all 4 sides
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

function buildHeavyBag(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Weighted floor base legs
      box(0.86, 0.07, 0.12, P.charcoal, [0, 0.035, -0.36]),
      box(0.12, 0.07, 0.86, P.charcoal, [0, 0.035, 0]),
      // Vertical steel stanchion & overhead arm
      box(0.11, 2.22, 0.11, P.charcoal, [0, 1.14, -0.36]),
      box(0.1, 0.1, 0.56, P.charcoal, [0, 2.22, -0.12]),
      // Swivel chain & heavy leather punching bag
      cyl(0.03, 0.03, 0.28, P.metalLight, [0, 2.04, 0.1], undefined, 6),
      cyl(0.22, 0.22, 1.26, P.charcoalDeep, [0, 1.28, 0.1], undefined, 10),
      cyl(0.226, 0.226, 0.22, P.salmon, [0, 1.42, 0.1], undefined, 10),
    ],
    DEFAULT_ITEM_DIMENSIONS['heavy-bag'],
  );
}

function buildSpeedBag(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base plate & upright post
      cyl(0.36, 0.38, 0.08, P.charcoal, [0, 0.04, 0], undefined, 10),
      box(0.1, 2.0, 0.1, P.charcoal, [0, 1.04, -0.24]),
      box(0.1, 0.1, 0.42, P.metal, [0, 1.88, -0.06]),
      // Circular wooden rebound drum board
      cyl(0.34, 0.34, 0.05, P.wood, [0, 1.78, 0.08], undefined, 12),
      // Teardrop speed bag
      sphere(0.13, P.salmon, [0, 1.56, 0.08], [0.85, 1.35, 0.85], 8, 6),
    ],
    DEFAULT_ITEM_DIMENSIONS['speed-bag'],
  );
}

function buildBadmintonCourt(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Subtle corner boundary pins so bounding box matches court footprint [5.6, 1.55, 5.2]
      box(0.08, 0.02, 0.08, P.white, [-2.76, 0.01, -2.56]),
      box(0.08, 0.02, 0.08, P.white, [2.76, 0.01, -2.56]),
      box(0.08, 0.02, 0.08, P.white, [-2.76, 0.01, 2.56]),
      box(0.08, 0.02, 0.08, P.white, [2.76, 0.01, 2.56]),
      // Net posts & weighted bases at x = ±2.72, z = 0
      cyl(0.18, 0.2, 0.08, P.charcoal, [-2.6, 0.04, 0], undefined, 8),
      cyl(0.18, 0.2, 0.08, P.charcoal, [2.6, 0.04, 0], undefined, 8),
      cyl(0.035, 0.035, 1.52, P.charcoal, [-2.6, 0.78, 0], undefined, 8),
      cyl(0.035, 0.035, 1.52, P.charcoal, [2.6, 0.78, 0], undefined, 8),
      cyl(0.042, 0.042, 0.08, P.salmon, [-2.6, 1.51, 0], undefined, 8),
      cyl(0.042, 0.042, 0.08, P.salmon, [2.6, 1.51, 0], undefined, 8),
      // Stretched mesh net & crisp white top tape
      box(5.16, 0.72, 0.025, P.charcoalSoft, [0, 1.12, 0]),
      box(5.2, 0.06, 0.035, P.white, [0, 1.5, 0]),
      box(5.18, 0.03, 0.03, P.salmon, [0, 0.76, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['badminton-court'],
  );
}

function buildTennisCourt(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Baseline corner markers so bounding box spans [9.5, 1.1, 22.0]
      box(0.12, 0.03, 0.12, P.white, [-4.68, 0.015, -10.94]),
      box(0.12, 0.03, 0.12, P.white, [4.68, 0.015, -10.94]),
      box(0.12, 0.03, 0.12, P.white, [-4.68, 0.015, 10.94]),
      box(0.12, 0.03, 0.12, P.white, [4.68, 0.015, 10.94]),
      // Heavy tennis net posts at x = ±4.35, z = 0
      cyl(0.06, 0.06, 1.07, P.charcoal, [-4.35, 0.535, 0], undefined, 8),
      cyl(0.06, 0.06, 1.07, P.charcoal, [4.35, 0.535, 0], undefined, 8),
      cyl(0.07, 0.07, 0.08, P.salmon, [-4.35, 1.05, 0], undefined, 8),
      cyl(0.07, 0.07, 0.08, P.salmon, [4.35, 1.05, 0], undefined, 8),
      // Tennis net body, white top band, and center strap
      box(8.64, 0.88, 0.035, P.charcoalDeep, [0, 0.48, 0]),
      box(8.7, 0.07, 0.05, P.white, [0, 0.94, 0]),
      box(0.07, 0.92, 0.055, P.white, [0, 0.48, 0]),
      // Umpire chair at x = 4.55, z = 0
      box(0.5, 1.04, 0.56, P.charcoal, [4.48, 0.52, 0]),
      box(0.46, 0.06, 0.44, P.wood, [4.48, 0.82, 0]),
      box(0.46, 0.24, 0.06, P.salmon, [4.68, 0.96, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['tennis-court'],
  );
}

function buildSwimLane(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // End wall stainless anchor brackets
    box(0.18, 0.22, 0.18, P.metalLight, [-12.4, 0.18, -1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [12.4, 0.18, -1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [-12.4, 0.18, 1.65]),
    box(0.18, 0.22, 0.18, P.metalLight, [12.4, 0.18, 1.65]),
    // Tension cables along z = ±1.65
    box(24.8, 0.03, 0.03, P.charcoal, [0, 0.18, -1.65]),
    box(24.8, 0.03, 0.03, P.charcoal, [0, 0.18, 1.65]),
  ];

  // Segmented wave-quelling float cylinders (salmon 5m turn zones, white mid-pool)
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

function buildStartingBlock(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Anchor pedestal base & angled stainless column
      box(0.56, 0.08, 0.56, P.metalLight, [0, 0.04, 0]),
      box(0.24, 0.54, 0.28, P.charcoalSoft, [0, 0.32, 0.06], [-0.18, 0, 0]),
      // Non-slip angled top deck & adjustable track-start kick wedge
      box(0.72, 0.08, 0.74, P.charcoalDeep, [0, 0.62, 0], [0.16, 0, 0]),
      box(0.52, 0.12, 0.14, P.salmon, [0, 0.7, 0.24], [-0.35, 0, 0]),
      // Front backstroke grab handles
      box(0.64, 0.04, 0.04, P.metalLight, [0, 0.42, -0.34]),
      box(0.04, 0.22, 0.14, P.metal, [-0.28, 0.48, -0.28]),
      box(0.04, 0.22, 0.14, P.metal, [0.28, 0.48, -0.28]),
    ],
    DEFAULT_ITEM_DIMENSIONS['starting-block'],
  );
}

function buildYogaMat(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Outer charcoal perimeter & inner salmon cork surface
      box(0.8, 0.018, 1.85, P.charcoal, [0, 0.009, 0]),
      box(0.74, 0.016, 1.78, P.salmon, [0, 0.02, 0]),
      // Center alignment line & rolled towel at top
      box(0.02, 0.006, 1.5, P.charcoalDeep, [0, 0.03, 0.04]),
      cyl(0.022, 0.022, 0.52, P.white, [0, 0.032, -0.74], [0, 0, Math.PI / 2], 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['yoga-mat'],
  );
}

function buildMeditationBolster(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Woven floor zabuton mat
      cyl(0.32, 0.32, 0.04, P.woodLight, [0, 0.02, 0], undefined, 10),
      // Plump cylindrical zafu bolster cushion
      cyl(0.24, 0.25, 0.18, P.terracotta, [0, 0.13, 0], undefined, 12),
      cyl(0.21, 0.24, 0.06, P.salmon, [0, 0.24, 0], undefined, 12),
      // Singing bowl accent
      cyl(0.06, 0.04, 0.05, P.metalLight, [0.22, 0.06, 0.18], undefined, 8),
    ],
    DEFAULT_ITEM_DIMENSIONS['meditation-bolster'],
  );
}

function buildReceptionDesk(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Salmon recessed LED toe-kick base
    box(5.16, 0.08, 1.36, P.salmon, [0, 0.04, 0]),
    // Main charcoal counter body
    box(5.32, 0.96, 1.48, P.charcoal, [0, 0.54, 0]),
    // Travertine stone transaction top & lower work counter
    box(5.4, 0.1, 0.64, P.stone, [0, 1.08, 0.46]),
    box(5.1, 0.06, 0.82, P.charcoalSoft, [0, 0.86, -0.26]),
    // Dual POS computer screens
    box(0.48, 0.3, 0.05, P.screen, [-1.2, 1.04, -0.1], [0.25, 0, 0]),
    box(0.48, 0.3, 0.05, P.screen, [1.2, 1.04, -0.1], [0.25, 0, 0]),
  ];

  // Architectural wood slats across the front facade
  for (let i = 0; i < 11; i++) {
    const x = -2.3 + i * 0.46;
    parts.push(box(0.14, 0.9, 0.06, P.wood, [x, 0.54, 0.75]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['reception-desk']);
}

function buildQrTurnstile(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Left and right brushed steel & charcoal gate cabinets
      box(0.24, 0.98, 1.56, P.charcoal, [-0.48, 0.49, 0]),
      box(0.24, 0.98, 1.56, P.charcoal, [0.48, 0.49, 0]),
      box(0.26, 0.06, 1.58, P.metalLight, [-0.48, 1.0, 0]),
      box(0.26, 0.06, 1.58, P.metalLight, [0.48, 1.0, 0]),
      // QR reader scanner window on right cabinet front
      box(0.18, 0.05, 0.24, P.salmonBright, [0.48, 1.04, 0.58], [0.2, 0, 0]),
      box(0.18, 0.05, 0.24, P.screenGlow, [-0.48, 1.04, 0.58], [0.2, 0, 0]),
      // Retractable glass swing wings in lane center
      box(0.32, 0.76, 0.04, P.glass, [-0.19, 0.52, 0]),
      box(0.32, 0.76, 0.04, P.glass, [0.19, 0.52, 0]),
      box(0.32, 0.05, 0.05, P.salmon, [-0.19, 0.91, 0]),
      box(0.32, 0.05, 0.05, P.salmon, [0.19, 0.91, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['qr-turnstile'],
  );
}

function buildKioskCheckin(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Weighted floor base
      box(0.76, 0.06, 0.62, P.charcoal, [0, 0.03, 0]),
      // Angled totem pedestal
      box(0.46, 0.96, 0.22, P.charcoalSoft, [0, 0.52, -0.06], [-0.12, 0, 0]),
      // Portrait interactive screen enclosure
      box(0.64, 0.78, 0.09, P.charcoalDeep, [0, 1.14, 0.02], [-0.22, 0, 0]),
      box(0.54, 0.64, 0.03, P.screen, [0, 1.15, 0.06], [-0.22, 0, 0]),
      box(0.64, 0.06, 0.1, P.salmon, [0, 1.5, -0.06], [-0.22, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['kiosk-checkin'],
  );
}

function buildCardPrinter(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Credenza cabinet
      box(1.06, 0.82, 0.74, P.charcoal, [0, 0.41, 0]),
      box(0.98, 0.7, 0.04, P.wood, [0, 0.41, 0.37]),
      box(1.1, 0.05, 0.78, P.stone, [0, 0.84, 0]),
      // Thermal RFID card printer box
      box(0.38, 0.28, 0.44, P.charcoalSoft, [-0.24, 1.0, 0]),
      box(0.22, 0.06, 0.08, P.salmon, [-0.24, 0.98, 0.23]),
      // Encoding screen & stack of SÖL passes
      box(0.42, 0.32, 0.05, P.screen, [0.24, 1.06, -0.1], [-0.2, -0.2, 0]),
      box(0.16, 0.05, 0.22, P.salmonBright, [0.22, 0.89, 0.18]),
    ],
    DEFAULT_ITEM_DIMENSIONS['card-printer'],
  );
}

function buildSupplementShelf(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Upright gondola frame + warm wood back panel
    box(1.96, 2.06, 0.1, P.charcoal, [0, 1.03, -0.32]),
    box(1.84, 1.88, 0.04, P.wood, [0, 1.0, -0.25]),
    // Top salmon lightbox header
    box(1.98, 0.2, 0.46, P.salmon, [0, 1.98, -0.12]),
    // Base plinth & 3 upper shelves
    box(1.96, 0.16, 0.74, P.charcoal, [0, 0.08, 0]),
    box(1.92, 0.05, 0.62, P.charcoalSoft, [0, 0.58, -0.04]),
    box(1.92, 0.05, 0.58, P.charcoalSoft, [0, 1.06, -0.06]),
    box(1.92, 0.05, 0.54, P.charcoalSoft, [0, 1.52, -0.08]),
  ];

  // Whey protein tubs & BCAA jars on shelves
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

function buildNutritionBoard(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Freestanding base feet & vertical steel stanchions
      box(0.16, 0.06, 0.48, P.charcoal, [-0.96, 0.03, 0]),
      box(0.16, 0.06, 0.48, P.charcoal, [0.96, 0.03, 0]),
      box(0.1, 1.86, 0.1, P.charcoal, [-0.96, 0.94, 0]),
      box(0.1, 1.86, 0.1, P.charcoal, [0.96, 0.94, 0]),
      // Framed Nutrition Facts board
      box(2.26, 1.38, 0.12, P.wood, [0, 1.18, 0]),
      box(2.12, 1.24, 0.14, P.charcoalDeep, [0, 1.18, 0]),
      // Graphic header & macro rows
      box(1.92, 0.18, 0.16, P.white, [0, 1.62, 0]),
      box(1.92, 0.1, 0.16, P.salmon, [0, 1.36, 0]),
      box(1.4, 0.08, 0.16, P.metalLight, [-0.26, 1.14, 0]),
      box(1.65, 0.08, 0.16, P.salmonBright, [-0.13, 0.94, 0]),
      box(1.1, 0.08, 0.16, P.metalLight, [-0.41, 0.74, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['nutrition-board'],
  );
}

function buildTrophyTotem(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Stone plinth & charcoal monolith column
    box(0.96, 0.18, 0.56, P.stone, [0, 0.09, 0]),
    box(0.76, 1.72, 0.34, P.charcoal, [0, 1.02, 0]),
    // Top SÖL streak emblem crown
    cyl(0.22, 0.22, 0.1, P.salmon, [0, 1.96, 0], [Math.PI / 2, 0, 0], 10),
  ];

  // Snake-grid illuminated streak cells on front face
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

function buildCoachPodium(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base platform & slanted lectern body
      box(1.34, 0.08, 0.92, P.charcoal, [0, 0.04, 0]),
      box(1.24, 0.98, 0.68, P.charcoalSoft, [0, 0.54, 0]),
      box(1.12, 0.86, 0.05, P.wood, [0, 0.54, 0.35]),
      // Angled top desk & dual tablets
      box(1.36, 0.08, 0.82, P.stone, [0, 1.06, 0], [0.16, 0, 0]),
      box(1.36, 0.04, 0.06, P.salmon, [0, 1.02, 0.41]),
      box(0.42, 0.24, 0.04, P.screen, [-0.28, 1.15, -0.06], [-0.45, 0, 0]),
      box(0.42, 0.24, 0.04, P.screenGlow, [0.28, 1.15, -0.06], [-0.45, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['coach-podium'],
  );
}

function buildConsultationPod(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Round wooden table & central pedestal
      cyl(0.42, 0.46, 0.05, P.charcoal, [0, 0.025, 0], undefined, 10),
      cyl(0.08, 0.08, 0.72, P.charcoal, [0, 0.38, 0], undefined, 8),
      cyl(0.58, 0.58, 0.06, P.wood, [0, 0.74, 0], undefined, 12),
      box(0.28, 0.03, 0.2, P.screen, [0, 0.78, 0]),
      // Left lounge chair
      box(0.56, 0.42, 0.58, P.charcoalDeep, [-0.68, 0.24, 0]),
      box(0.14, 0.46, 0.58, P.salmon, [-0.9, 0.64, 0]),
      // Right lounge chair
      box(0.56, 0.42, 0.58, P.charcoalDeep, [0.68, 0.24, 0]),
      box(0.14, 0.46, 0.58, P.salmon, [0.9, 0.64, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['consultation-pod'],
  );
}

function buildLockerBank(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Main charcoal carcass & top cornice
    box(3.16, 1.96, 0.58, P.charcoal, [0, 0.98, -0.14]),
    box(3.2, 0.08, 0.64, P.charcoalSoft, [0, 1.96, -0.12]),
    // Integrated front wooden changing bench
    box(3.08, 0.07, 0.36, P.woodLight, [0, 0.44, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [-1.36, 0.21, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [0, 0.21, 0.26]),
    box(0.1, 0.42, 0.32, P.charcoal, [1.36, 0.21, 0.26]),
  ];

  // 6 columns × 2 tiers of wood locker doors + RFID reader badges
  for (let col = 0; col < 6; col++) {
    const x = -1.25 + col * 0.5;
    // Upper door
    parts.push(box(0.44, 0.66, 0.04, P.wood, [x, 1.54, 0.16]));
    parts.push(box(0.06, 0.09, 0.05, P.salmon, [x + 0.14, 1.54, 0.17]));
    // Lower door
    parts.push(box(0.44, 0.66, 0.04, P.wood, [x, 0.82, 0.16]));
    parts.push(box(0.06, 0.09, 0.05, P.salmon, [x + 0.14, 0.82, 0.17]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['locker-bank']);
}

function buildSaunaBench(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Two-tier stepped cedar wood bench + backrest
      box(3.28, 0.44, 0.82, P.wood, [-0.42, 0.22, 0.36]),
      box(3.28, 0.86, 0.86, P.woodLight, [-0.42, 0.43, -0.44]),
      box(3.28, 0.24, 0.08, P.wood, [-0.42, 0.98, -0.82]),
      // Himalayan salt-stone heater stove on right end
      box(0.72, 0.82, 0.72, P.charcoal, [1.68, 0.41, -0.18]),
      box(0.58, 0.22, 0.58, P.salmonBright, [1.68, 0.86, -0.18]),
      box(0.82, 0.06, 0.82, P.woodLight, [1.68, 0.92, -0.18]),
    ],
    DEFAULT_ITEM_DIMENSIONS['sauna-bench'],
  );
}

function buildJacuzziTub(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Outer slatted cedar & charcoal tub enclosure
      box(3.56, 0.84, 3.16, P.charcoal, [0, 0.42, 0]),
      box(3.6, 0.1, 3.2, P.stone, [0, 0.88, 0]),
      // Inner recessed hydro-therapy water surface
      box(2.96, 0.08, 2.56, P.water, [0, 0.89, 0]),
      // Corner cushioned headrests & entry steps
      box(0.64, 0.09, 0.24, P.white, [-0.9, 0.95, -1.36]),
      box(0.64, 0.09, 0.24, P.white, [0.9, 0.95, -1.36]),
      box(1.4, 0.38, 0.44, P.wood, [0, 0.19, 1.48]),
    ],
    DEFAULT_ITEM_DIMENSIONS['jacuzzi-tub'],
  );
}

function buildLoungeSofa(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Warm timber platform base
      box(2.58, 0.16, 1.36, P.wood, [0, 0.08, 0]),
      // 3 deep seat cushions
      box(0.78, 0.24, 1.12, P.charcoalDeep, [-0.8, 0.28, 0.08]),
      box(0.78, 0.24, 1.12, P.charcoalDeep, [0, 0.28, 0.08]),
      box(0.78, 0.24, 1.12, P.charcoalDeep, [0.8, 0.28, 0.08]),
      // Backrest & wide armrests
      box(2.52, 0.46, 0.28, P.charcoal, [0, 0.62, -0.52]),
      box(0.24, 0.38, 1.32, P.charcoal, [-1.16, 0.56, 0]),
      box(0.24, 0.38, 1.32, P.charcoal, [1.16, 0.56, 0]),
      // Salmon throw pillows
      box(0.42, 0.28, 0.14, P.salmon, [-0.76, 0.54, -0.32], [0.2, 0.15, 0]),
      box(0.42, 0.28, 0.14, P.salmonBright, [0.76, 0.54, -0.32], [0.2, -0.15, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['lounge-sofa'],
  );
}

function buildJuiceBar(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Bar body + slatted front + stone counter
      box(3.76, 0.96, 1.28, P.charcoal, [0, 0.48, 0]),
      box(3.64, 0.84, 0.05, P.wood, [0, 0.48, 0.65]),
      box(3.8, 0.08, 1.38, P.stone, [0, 1.0, 0]),
      // Chilled bottle display vitrine + protein shaker blenders
      box(1.36, 0.28, 0.52, P.glass, [-1.05, 1.14, 0.16]),
      box(1.38, 0.04, 0.54, P.salmon, [-1.05, 1.29, 0.16]),
      cyl(0.12, 0.14, 0.28, P.metalLight, [0.42, 1.16, 0], undefined, 8),
      cyl(0.12, 0.14, 0.28, P.salmon, [0.86, 1.16, 0], undefined, 8),
      box(0.48, 0.26, 0.05, P.screen, [1.42, 1.15, 0.1], [0.25, 0, 0]),
    ],
    DEFAULT_ITEM_DIMENSIONS['juice-bar'],
  );
}

function buildStairCore(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  const parts: THREE.BufferGeometry[] = [
    // Central shear wall divider & mid-level landing
    box(0.24, 3.6, 2.8, P.charcoal, [0, 1.8, -0.2]),
    box(3.52, 0.22, 1.24, P.stone, [0, 1.9, -1.46]),
    // Glass safety balustrades + salmon top handrails (aligned with flight slopes)
    box(0.06, 0.95, 2.7, P.glass, [-1.68, 1.4, 0.52], [0.58, 0, 0]),
    box(0.06, 0.95, 2.7, P.glass, [1.68, 2.8, 0.52], [-0.58, 0, 0]),
    box(0.08, 0.06, 2.75, P.salmon, [-1.68, 1.88, 0.52], [0.58, 0, 0]),
    box(0.08, 0.06, 2.75, P.salmon, [1.68, 3.28, 0.52], [-0.58, 0, 0]),
  ];

  // Lower flight treads (left side, ascending from front z=+1.8 to landing z=-0.8)
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const y = 0.18 + t * 1.62;
    const z = 1.75 - t * 2.45;
    parts.push(box(1.48, 0.14, 0.36, P.wood, [-0.92, y, z]));
  }

  // Upper flight treads (right side, ascending from landing z=-0.8 to top z=+1.8)
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const y = 2.08 + t * 1.62;
    const z = -0.7 + t * 2.45;
    parts.push(box(1.48, 0.14, 0.36, P.woodLight, [0.92, y, z]));
  }

  return mergeAndFit(parts, DEFAULT_ITEM_DIMENSIONS['stair-core']);
}

function buildElevatorCore(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Base pit & roof machine cap
      box(2.58, 0.18, 2.58, P.charcoal, [0, 0.09, 0]),
      box(2.58, 0.24, 2.58, P.charcoal, [0, 3.68, 0]),
      // 4 structural steel corner columns
      box(0.18, 3.6, 0.18, P.charcoal, [-1.2, 1.88, -1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [1.2, 1.88, -1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [-1.2, 1.88, 1.2]),
      box(0.18, 3.6, 0.18, P.charcoal, [1.2, 1.88, 1.2]),
      // Panoramic glass shaft enclosure
      box(2.26, 3.4, 2.26, P.glass, [0, 1.88, 0]),
      // Internal elevator cab & brushed steel doors
      box(1.96, 2.4, 1.96, P.charcoalSoft, [0, 1.38, -0.06]),
      box(0.76, 2.15, 0.06, P.metalLight, [-0.4, 1.26, 1.18]),
      box(0.76, 2.15, 0.06, P.metalLight, [0.4, 1.26, 1.18]),
      // Salmon floor indicator header above doors
      box(1.68, 0.14, 0.08, P.salmon, [0, 2.48, 1.22]),
    ],
    DEFAULT_ITEM_DIMENSIONS['elevator-core'],
  );
}

function buildPlanterTree(): THREE.BufferGeometry {
  const P = ITEM_PALETTE;
  return mergeAndFit(
    [
      // Tapered architectural planter pot + terracotta inner rim
      cyl(0.56, 0.42, 0.68, P.charcoal, [0, 0.34, 0], undefined, 10),
      cyl(0.58, 0.56, 0.08, P.salmon, [0, 0.68, 0], undefined, 10),
      cyl(0.5, 0.5, 0.04, P.wood, [0, 0.71, 0], undefined, 8),
      // Multi-stem sculpted olive/bamboo trunks
      cyl(0.055, 0.08, 1.35, P.wood, [0, 1.34, 0], [0.06, 0, -0.05], 6),
      cyl(0.04, 0.055, 0.85, P.woodLight, [0.16, 1.62, 0.08], [0.15, 0, 0.28], 6),
      cyl(0.04, 0.055, 0.82, P.woodLight, [-0.15, 1.58, -0.08], [-0.15, 0, -0.26], 6),
      // Layered organic canopy clusters
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

// ============================================================================
// LOW-DETAIL LOD PROXY BUILDER (<= 72 triangles per item)
// ============================================================================

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
// GEOMETRY CACHE & PUBLIC API
// ============================================================================

const geometryCache = new Map<string, THREE.BufferGeometry>();

export function getItemGeometry(
  kind: ItemKind,
  detail: ItemDetailLevel = 'high',
): THREE.BufferGeometry {
  const key = `${kind}:${detail}`;
  const cached = geometryCache.get(key);
  if (cached) {
    return cached;
  }

  const builder = HIGH_DETAIL_BUILDERS[kind];
  const geometry =
    detail === 'low' ? buildLowDetailGeometry(kind) : builder ? builder() : buildLowDetailGeometry(kind);
  geometry.name = `item-geom-${kind}-${detail}`;
  geometryCache.set(key, geometry);
  return geometry;
}

export function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) {
    return Math.floor(index.count / 3);
  }
  const pos = geometry.getAttribute('position');
  return pos ? Math.floor(pos.count / 3) : 0;
}

export function clearItemGeometryCache(): void {
  for (const geom of geometryCache.values()) {
    geom.dispose();
  }
  geometryCache.clear();
}

export function warmAllItemGeometries(): void {
  for (const kind of ALL_ITEM_KINDS) {
    getItemGeometry(kind, 'high');
    getItemGeometry(kind, 'low');
  }
}

// ============================================================================
// INSTANCING & STATUS HELPERS
// ============================================================================

export interface ResolvedItemBindingState {
  visible: boolean;
  status: string;
}

export type ResolvedItemsMap =
  | Record<string, ResolvedItemBindingState>
  | Map<string, ResolvedItemBindingState>;

export interface GroupedItemEntry {
  item: ItemNode;
  level: LevelNode | null;
}

export const ITEM_STATUS_COLORS = {
  default: '#ffffff',
  highlight: '#ffe0d6',
  maintenance: '#eab308',
  broken: '#ef4444',
  retired: '#6b7280',
} as const;

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

