import * as THREE from 'three';
import type { QualityTier } from '../../state/exploreStore';
import type { ExploreTheme } from '../materials';

export type TrafficAxis = 'EW' | 'NS';

export interface TrafficSignalAnchor {
  readonly id: string;
  readonly intersectionId: string;
  readonly axis: TrafficAxis;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

export interface BoulevardBannerAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly side: 1 | -1;
}

export interface CityMetropolisGeometries {
  readonly opaqueGeometry: THREE.BufferGeometry;
  readonly metalGeometry: THREE.BufferGeometry;
  readonly glassGeometry: THREE.BufferGeometry;
  readonly emissiveGeometry: THREE.BufferGeometry;
  readonly beaconAnchors: ReadonlyArray<readonly [number, number, number]>;
  readonly trafficSignalAnchors: ReadonlyArray<TrafficSignalAnchor>;
  readonly boulevardBannerAnchors: ReadonlyArray<BoulevardBannerAnchor>;
}

interface ColoredPart {
  readonly geometry: THREE.BufferGeometry;
  readonly color: string;
  readonly hdrScale?: number;
}

interface CityBuckets {
  opaque: ColoredPart[];
  metal: ColoredPart[];
  glass: ColoredPart[];
  emissive: ColoredPart[];
}

function seededRandom(seed: number): () => number {
  let t = (seed | 0) + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function transformGeom(
  geom: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
    const quat = new THREE.Quaternion().setFromEuler(euler);
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    geom.applyMatrix4(mat);
  } else {
    geom.translate(x, y, z);
  }
  return geom;
}

function pushBox(
  target: ColoredPart[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: string,
  rx = 0,
  ry = 0,
  rz = 0,
  hdrScale = 1,
): void {
  if (w <= 0 || h <= 0 || d <= 0) return;
  const geom = transformGeom(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  target.push({ geometry: geom, color, hdrScale });
}

function pushCylinder(
  target: ColoredPart[],
  rTop: number,
  rBottom: number,
  h: number,
  x: number,
  y: number,
  z: number,
  color: string,
  radialSegments = 8,
  rx = 0,
  ry = 0,
  rz = 0,
  hdrScale = 1,
): void {
  if (h <= 0) return;
  const geom = transformGeom(
    new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments),
    x,
    y,
    z,
    rx,
    ry,
    rz,
  );
  target.push({ geometry: geom, color, hdrScale });
}

function mergeCityParts(parts: readonly ColoredPart[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    const fallback = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const pos = fallback.getAttribute('position');
    const colors = new Float32Array(pos.count * 3).fill(1);
    fallback.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return fallback;
  }

  let totalVertices = 0;
  let totalIndices = 0;

  for (const { geometry } of parts) {
    const pos = geometry.getAttribute('position');
    const idx = geometry.getIndex();
    totalVertices += pos.count;
    totalIndices += idx ? idx.count : pos.count;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const colors = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  const tmpColor = new THREE.Color();
  let vOffset = 0;
  let iOffset = 0;

  for (const { geometry, color, hdrScale = 1 } of parts) {
    tmpColor.set(color);
    const r = tmpColor.r * hdrScale;
    const g = tmpColor.g * hdrScale;
    const b = tmpColor.b * hdrScale;

    const pos = geometry.getAttribute('position');
    const norm = geometry.getAttribute('normal');
    const uvAttr = geometry.getAttribute('uv');
    const idx = geometry.getIndex();

    for (let i = 0; i < pos.count; i += 1) {
      const base3 = (vOffset + i) * 3;
      const base2 = (vOffset + i) * 2;
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);

      positions[base3] = px;
      positions[base3 + 1] = py;
      positions[base3 + 2] = pz;

      if (norm) {
        normals[base3] = norm.getX(i);
        normals[base3 + 1] = norm.getY(i);
        normals[base3 + 2] = norm.getZ(i);
      } else {
        normals[base3 + 1] = 1;
      }

      if (uvAttr) {
        uvs[base2] = uvAttr.getX(i);
        uvs[base2 + 1] = uvAttr.getY(i);
      } else {
        uvs[base2] = px * 0.05;
        uvs[base2 + 1] = (py + pz) * 0.05;
      }

      colors[base3] = r;
      colors[base3 + 1] = g;
      colors[base3 + 2] = b;
    }

    if (idx) {
      for (let i = 0; i < idx.count; i += 1) {
        indices[iOffset + i] = idx.getX(i) + vOffset;
      }
      iOffset += idx.count;
    } else {
      for (let i = 0; i < pos.count; i += 1) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += pos.count;
    }

    vOffset += pos.count;
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

const FOLIAGE_TONES_DAY = ['#2d4d2c', '#3b5e34', '#496e3d', '#345531'] as const;
const FOLIAGE_TONES_DUSK = ['#1e3120', '#273c26', '#2e452a', '#213522'] as const;

function foliageBlob(rand: () => number, radius: number, segments = 8): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(radius, segments, 6);
  const pos = geom.getAttribute('position');
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      Math.sin((x / radius) * 3.1 + p1) * Math.cos((z / radius) * 2.7 + p2) * 0.16 +
      Math.sin((y / radius) * 4.1 + p1) * 0.08;
    const k = 1 + n;
    pos.setXYZ(i, x * k, y * k * 0.84, z * k);
  }
  geom.computeVertexNormals();
  return geom;
}

function addCityTree(
  opaque: ColoredPart[],
  x: number,
  z: number,
  scale: number,
  isLight: boolean,
  withPlanter = true,
): void {
  const rand = seededRandom(Math.round(x * 137 + z * 919));
  if (withPlanter) {
    pushBox(opaque, 1.8 * scale, 0.28, 1.8 * scale, x, 0.14, z, isLight ? '#8a857e' : '#323844');
    pushBox(opaque, 1.45 * scale, 0.3, 1.45 * scale, x, 0.16, z, '#231c15');
  }
  const trunkH = (2.2 + rand() * 0.65) * scale;
  pushCylinder(opaque, 0.1 * scale, 0.18 * scale, trunkH, x, trunkH * 0.5, z, '#453629', 6);
  const tones = isLight ? FOLIAGE_TONES_DAY : FOLIAGE_TONES_DUSK;
  const crownY = trunkH + 0.75 * scale;
  const blobCount = 4;
  for (let i = 0; i < blobCount; i += 1) {
    const ang = (i / (blobCount - 1)) * Math.PI * 2 + rand() * 0.5;
    const dist = i === 0 ? 0 : (0.55 + rand() * 0.3) * scale;
    const r = (i === 0 ? 1.05 : 0.72 + rand() * 0.25) * scale;
    const geom = foliageBlob(rand, r, 7);
    geom.translate(
      x + Math.cos(ang) * dist,
      crownY + (i === 0 ? 0.35 : (rand() - 0.5) * 0.45) * scale,
      z + Math.sin(ang) * dist,
    );
    opaque.push({ geometry: geom, color: tones[Math.floor(rand() * tones.length)]! });
  }
}

function addBoulevardStreetLamp(
  buckets: CityBuckets,
  x: number,
  z: number,
  rotY: number,
  doubleArm: boolean,
  isLight: boolean,
): void {
  const steel = isLight ? '#384152' : '#262d3a';
  const hdr = isLight ? 0.65 : 6.2;
  const lumColor = isLight ? '#fff7e6' : '#ffd296';

  pushCylinder(buckets.metal, 0.18, 0.24, 0.4, x, 0.2, z, steel, 6);
  pushCylinder(buckets.metal, 0.08, 0.13, 6.2, x, 3.1, z, steel, 6);

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const dirs = doubleArm ? [1, -1] : [1];
  for (const s of dirs) {
    const ax = x + s * cos * 0.8;
    const az = z - s * sin * 0.8;
    pushBox(buckets.metal, 1.6, 0.09, 0.12, ax, 6.12, az, steel, 0, rotY, 0);
    const lx = x + s * cos * 1.45;
    const lz = z - s * sin * 1.45;
    pushBox(buckets.emissive, 0.44, 0.08, 0.28, lx, 6.04, lz, lumColor, 0, rotY, 0, hdr);
  }
}

function addSignalGantry(
  buckets: CityBuckets,
  anchors: TrafficSignalAnchor[],
  id: string,
  intersectionId: string,
  axis: TrafficAxis,
  x: number,
  z: number,
  rotY: number,
  isLight: boolean,
): void {
  const darkSteel = isLight ? '#2c3442' : '#1b212b';
  // Vertical mast on intersection corner
  pushCylinder(buckets.metal, 0.16, 0.22, 5.9, x, 2.95, z, darkSteel, 8);
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  // Cantilever mast arm reaching 5.4m out over the traffic lanes
  const armCenter = 2.7;
  pushBox(
    buckets.metal,
    5.4,
    0.16,
    0.16,
    x + cos * armCenter,
    5.72,
    z - sin * armCenter,
    darkSteel,
    0,
    rotY,
    0,
  );
  // Signal housing boxes along the cantilever arm
  for (const offset of [2.4, 4.4]) {
    const hx = x + cos * offset;
    const hz = z - sin * offset;
    pushBox(buckets.metal, 0.92, 0.34, 0.26, hx, 5.56, hz, '#11151c', 0, rotY, 0);
    anchors.push({
      id: `${id}-${offset === 2.4 ? 'a' : 'b'}`,
      intersectionId,
      axis,
      position: [hx, 5.56, hz],
      rotationY: rotY,
    });
  }
}

interface TowerSpec {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly ring: 'inner' | 'mid' | 'horizon';
  readonly style: 'curtain-stepped' | 'chamfered-twin' | 'diagrid-crown' | 'residential-terrace';
  readonly facadeTone: string;
  readonly glassTone: string;
  readonly rotY?: number;
}

const STONE_DAY = ['#b8afa3', '#a69d91', '#8e887f', '#c9c0b3', '#747880', '#968b7e'] as const;
const STONE_DUSK = ['#2e333d', '#383d47', '#262b35', '#3e424c', '#202630', '#333640'] as const;
const GLASS_DAY = ['#5c768a', '#647c8e', '#536c7d', '#6e7e86', '#4a6478'] as const;
const GLASS_DUSK = ['#192534', '#1d2b3b', '#14202e', '#212d3c', '#182433'] as const;
const WINDOW_DAY_TINTS = ['#364859', '#405366', '#4c5f70', '#334252'] as const;
const WINDOW_DUSK_WARM = ['#ffcf8c', '#ffe2ad', '#ffb86e', '#d6e8ff', '#fff0d1'] as const;

function addSkyscraper(
  buckets: CityBuckets,
  beaconAnchors: Array<readonly [number, number, number]>,
  spec: TowerSpec,
  seed: number,
  isLight: boolean,
  detailLevel: 'full' | 'medium' | 'silhouette',
): void {
  const rand = seededRandom(seed);
  const { x, z, w, d, h, facadeTone, glassTone } = spec;
  const mullionTone = isLight ? '#4f5763' : '#2a313d';
  const darkSlate = isLight ? '#38404d' : '#161b23';
  const hdrWindow = isLight ? 0.55 : 2.55;
  const hdrCrown = isLight ? 0.8 : 3.2;

  // Grounded stone/granite podium (first 7.5m..11m or 22% height)
  const podiumH = Math.min(11.5, Math.max(5.5, h * 0.18));
  pushBox(buckets.opaque, w, podiumH, d, x, podiumH * 0.5, z, facadeTone);
  // Dark recessed ground-floor retail band + warm arcade lighting
  const retailH = Math.min(3.8, podiumH * 0.52);
  pushBox(buckets.glass, w + 0.14, retailH, d + 0.14, x, retailH * 0.5 + 0.2, z, glassTone);
  if (!isLight || detailLevel === 'full') {
    const retailGlow = isLight ? '#4b5563' : '#ffcf94';
    const retailScale = isLight ? 0.45 : 2.9;
    pushBox(buckets.emissive, w * 0.78, retailH * 0.58, d + 0.22, x, retailH * 0.5 + 0.2, z, retailGlow, 0, 0, 0, retailScale);
    pushBox(buckets.emissive, w + 0.22, retailH * 0.58, d * 0.78, x, retailH * 0.5 + 0.2, z, retailGlow, 0, 0, 0, retailScale);
  }
  // Podium cornice collar
  pushBox(buckets.metal, w + 0.45, 0.48, d + 0.45, x, podiumH + 0.1, z, mullionTone);

  if (detailLevel === 'silhouette') {
    // Clean horizon skyscraper silhouette + upper setback + glowing horizon office bands
    const shaftH = h - podiumH;
    const midW = w * 0.86;
    const midD = d * 0.86;
    pushBox(buckets.glass, midW, shaftH * 0.76, midD, x, podiumH + shaftH * 0.38, z, glassTone);
    const upperW = midW * 0.76;
    const upperD = midD * 0.76;
    const upperY = podiumH + shaftH * 0.76;
    pushBox(buckets.glass, upperW, shaftH * 0.24, upperD, x, upperY + shaftH * 0.12, z, glassTone);
    pushBox(buckets.opaque, upperW + 0.4, 0.8, upperD + 0.4, x, h + 0.4, z, darkSlate);

    if (!isLight) {
      // Sparse glowing horizontal window strips on distant horizon towers
      const bandCount = Math.max(2, Math.min(6, Math.floor(shaftH / 16)));
      for (let b = 0; b < bandCount; b += 1) {
        const by = podiumH + 6 + (b + 0.5) * ((shaftH * 0.72) / bandCount);
        const col = WINDOW_DUSK_WARM[Math.floor(rand() * WINDOW_DUSK_WARM.length)]!;
        const bw = midW * (0.45 + rand() * 0.4);
        const bd = midD * (0.45 + rand() * 0.4);
        pushBox(buckets.emissive, bw, 1.35, midD + 0.16, x + (rand() - 0.5) * (midW - bw) * 0.5, by, z, col, 0, 0, 0, 2.2);
        pushBox(buckets.emissive, midW + 0.16, 1.35, bd, x, by, z + (rand() - 0.5) * (midD - bd) * 0.5, col, 0, 0, 0, 2.2);
      }
      pushBox(buckets.emissive, upperW * 0.88, 0.45, upperD * 0.88, x, h + 0.9, z, '#f5d0a9', 0, 0, 0, 2.6);
    }

    if (h >= 120) {
      pushCylinder(buckets.metal, 0.08, 0.25, 11, x, h + 6.0, z, mullionTone, 5);
      beaconAnchors.push([x, h + 11.6, z]);
    }
    return;
  }

  // Main shaft (2-tier stepped tower for architectural variety)
  const mainRatio = spec.style === 'residential-terrace' ? 0.62 : 0.72;
  const shaft1H = (h - podiumH) * mainRatio;
  const shaft2H = h - podiumH - shaft1H;
  const sw1 = w * 0.88;
  const sd1 = d * 0.88;
  const sw2 = spec.style === 'chamfered-twin' ? sw1 * 0.72 : sw1 * 0.78;
  const sd2 = spec.style === 'chamfered-twin' ? sd1 * 0.72 : sd1 * 0.78;

  const y1Start = podiumH;
  const y2Start = y1Start + shaft1H;

  // Reflective curtain-wall glazing cores
  pushBox(buckets.glass, sw1, shaft1H, sd1, x, y1Start + shaft1H * 0.5, z, glassTone);
  pushBox(buckets.glass, sw2, shaft2H, sd2, x, y2Start + shaft2H * 0.5, z, glassTone);

  // Structural corner piers & architectural vertical mullions (metal & precast ribs)
  const finMat = spec.style === 'residential-terrace' ? buckets.opaque : buckets.metal;
  const finColor = spec.style === 'residential-terrace' ? facadeTone : mullionTone;
  const pierSize = 0.65;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushBox(
        finMat,
        pierSize,
        shaft1H,
        pierSize,
        x + sx * (sw1 * 0.5 - pierSize * 0.35),
        y1Start + shaft1H * 0.5,
        z + sz * (sd1 * 0.5 - pierSize * 0.35),
        finColor,
      );
      pushBox(
        finMat,
        pierSize * 0.85,
        shaft2H,
        pierSize * 0.85,
        x + sx * (sw2 * 0.5 - pierSize * 0.3),
        y2Start + shaft2H * 0.5,
        z + sz * (sd2 * 0.5 - pierSize * 0.3),
        finColor,
      );
    }
  }

  // Mid-face vertical aluminum fins (gives strong specular breaks under golden-hour & dusk lighting)
  const finStepsX = detailLevel === 'full' ? 3 : 2;
  for (let i = 1; i < finStepsX; i += 1) {
    const fx = x - sw1 * 0.5 + (i / finStepsX) * sw1;
    pushBox(buckets.metal, 0.24, shaft1H, sd1 + 0.16, fx, y1Start + shaft1H * 0.5, z, mullionTone);
  }
  const finStepsZ = detailLevel === 'full' ? 3 : 2;
  for (let i = 1; i < finStepsZ; i += 1) {
    const fz = z - sd1 * 0.5 + (i / finStepsZ) * sd1;
    pushBox(buckets.metal, sw1 + 0.16, shaft1H, 0.24, x, y1Start + shaft1H * 0.5, fz, mullionTone);
  }

  // Horizontal structural floor spandrel bands & terrace ledge
  const floorStep = detailLevel === 'full' ? 4.2 : 6.2;
  for (let fy = y1Start + floorStep; fy < y2Start - 1.5; fy += floorStep) {
    pushBox(buckets.opaque, sw1 + 0.22, 0.34, sd1 + 0.22, x, fy, z, facadeTone);
  }
  // Setback sky-terrace parapet + greenery on inner residential buildings
  pushBox(buckets.opaque, sw1 + 0.35, 0.65, sd1 + 0.35, x, y2Start + 0.2, z, facadeTone);
  if (spec.style === 'residential-terrace' && detailLevel === 'full') {
    const shrubTone = isLight ? '#385c34' : '#223821';
    pushBox(buckets.opaque, sw1 * 0.9, 0.55, 0.8, x, y2Start + 0.65, z + sd1 * 0.44, shrubTone);
    pushBox(buckets.opaque, 0.8, 0.55, sd1 * 0.9, x + sw1 * 0.44, y2Start + 0.65, z, shrubTone);
  }
  for (let fy = y2Start + floorStep; fy < h - 1.2; fy += floorStep) {
    pushBox(buckets.opaque, sw2 + 0.2, 0.32, sd2 + 0.2, x, fy, z, facadeTone);
  }

  // Coherent grouped illuminated window bays (not a noisy grid!)
  const storyH = 3.8;
  const stories1 = Math.max(2, Math.floor((shaft1H - 1.5) / storyH));
  const stories2 = Math.max(1, Math.floor((shaft2H - 1.5) / storyH));
  const winColorPool = isLight ? WINDOW_DAY_TINTS : WINDOW_DUSK_WARM;
  const maxLitBands = detailLevel === 'full' ? 22 : 12;
  let emitted = 0;

  for (let s = 0; s < stories1 && emitted < maxLitBands; s += 1) {
    const occupancy = rand();
    if (occupancy > (isLight ? 0.52 : 0.46)) continue;
    const wy = y1Start + 2.0 + s * storyH;
    const col = winColorPool[Math.floor(rand() * winColorPool.length)]!;
    const stripW = sw1 * (0.34 + rand() * 0.42);
    const stripD = sd1 * (0.34 + rand() * 0.42);
    const offX = (rand() - 0.5) * (sw1 - stripW) * 0.65;
    const offZ = (rand() - 0.5) * (sd1 - stripD) * 0.65;
    if (rand() < 0.72) {
      pushBox(buckets.emissive, stripW, 1.55, sd1 + 0.08, x + offX, wy, z, col, 0, 0, 0, hdrWindow);
    }
    if (rand() < 0.72) {
      pushBox(buckets.emissive, sw1 + 0.08, 1.55, stripD, x, wy, z + offZ, col, 0, 0, 0, hdrWindow);
    }
    emitted += 1;
  }

  for (let s = 0; s < stories2 && emitted < maxLitBands + 6; s += 1) {
    if (rand() > (isLight ? 0.45 : 0.48)) continue;
    const wy = y2Start + 2.0 + s * storyH;
    const col = winColorPool[Math.floor(rand() * winColorPool.length)]!;
    const stripW = sw2 * (0.38 + rand() * 0.4);
    const offX = (rand() - 0.5) * (sw2 - stripW) * 0.6;
    pushBox(buckets.emissive, stripW, 1.5, sd2 + 0.08, x + offX, wy, z, col, 0, 0, 0, hdrWindow);
    pushBox(buckets.emissive, sw2 + 0.08, 1.5, sd2 * 0.55, x, wy, z, col, 0, 0, 0, hdrWindow);
    emitted += 1;
  }

  // Shopfront signs along the podium so the ground floor reads as a lived-in street.
  const signPalette = ['#f07654', '#4fd1c5', '#f6c453', '#8ea7ff', '#ff5d8f'] as const;
  const signHdr = isLight ? 0.75 : 3.1;
  const signY = retailH + 1.05;
  for (const face of [0, 1, 2, 3]) {
    if (rand() > 0.8) continue;
    const alongX = face % 2 === 0;
    const sign = signPalette[Math.floor(rand() * signPalette.length)]!;
    const len = Math.min(6.5, (alongX ? w : d) * (0.22 + rand() * 0.18));
    const off = (rand() - 0.5) * ((alongX ? w : d) - len - 2);
    const sgn = face < 2 ? 1 : -1;
    if (alongX) {
      pushBox(buckets.emissive, len, 0.8, 0.14, x + off, signY, z + sgn * (d * 0.5 + 0.2), sign, 0, 0, 0, signHdr);
      pushBox(buckets.metal, len + 0.3, 0.1, 1.1, x + off, retailH + 0.2, z + sgn * (d * 0.5 + 0.55), mullionTone);
    } else {
      pushBox(buckets.emissive, 0.14, 0.8, len, x + sgn * (w * 0.5 + 0.2), signY, z + off, sign, 0, 0, 0, signHdr);
      pushBox(buckets.metal, 1.1, 0.1, len + 0.3, x + sgn * (w * 0.5 + 0.55), retailH + 0.2, z + off, mullionTone);
    }
  }

  // Balconies with glass rails and split-system condensers on mid-rise residential faces.
  if (detailLevel === 'full') {
    const acTone = isLight ? '#d9dde2' : '#69717d';
    const balconyCount = spec.style === 'residential-terrace' ? stories1 : Math.floor(stories1 / 3);
    for (let sIdx = 1; sIdx < balconyCount; sIdx += 1) {
      const by = y1Start + 0.6 + sIdx * (spec.style === 'residential-terrace' ? storyH : storyH * 3);
      const bw = sw1 * (0.18 + rand() * 0.12);
      const bx = x + (rand() - 0.5) * (sw1 - bw) * 0.8;
      const sideSgn = rand() > 0.5 ? 1 : -1;
      pushBox(buckets.opaque, bw, 0.18, 1.5, bx, by, z + sideSgn * (sd1 * 0.5 + 0.7), facadeTone);
      pushBox(buckets.glass, bw, 0.95, 0.06, bx, by + 0.55, z + sideSgn * (sd1 * 0.5 + 1.43), glassTone);
      if (rand() > 0.4) {
        pushBox(buckets.opaque, 0.75, 0.52, 0.42, bx + bw * 0.3, by + 0.35, z + sideSgn * (sd1 * 0.5 + 0.3), acTone);
      }
    }
  }

  // Rooftop mechanical penthouse, cooling louvered units, helipad / spire + beacon
  pushBox(buckets.opaque, sw2 + 0.65, 1.15, sd2 + 0.65, x, h + 0.55, z, darkSlate);
  const pentW = sw2 * 0.56;
  const pentD = sd2 * 0.56;
  const pentH = Math.min(4.6, 2.2 + h * 0.02);
  pushBox(buckets.metal, pentW, pentH, pentD, x - sw2 * 0.1, h + 1.1 + pentH * 0.5, z, mullionTone);
  // Rooftop condensers and a water tank break up the skyline silhouette.
  const roofTone = isLight ? '#9aa1aa' : '#4a525e';
  for (let r = 0; r < 3; r += 1) {
    pushBox(
      buckets.metal, 1.9, 0.9, 1.4,
      x + (rand() - 0.5) * sw2 * 0.7, h + 1.65, z + (rand() - 0.5) * sd2 * 0.7, roofTone,
    );
  }
  pushCylinder(buckets.opaque, 1.1, 1.1, 2.2, x + sw2 * 0.28, h + 2.2, z - sd2 * 0.25, isLight ? '#7b6a58' : '#3a3530', 10);
  // Illuminated architectural crown strip on prestige towers
  if (spec.style === 'diagrid-crown' || h >= 72) {
    const crownColor = isLight ? '#b89476' : '#f4cbb4';
    pushBox(buckets.emissive, sw2 + 0.72, 0.34, sd2 + 0.72, x, h + 0.95, z, crownColor, 0, 0, 0, hdrCrown);
  }
  // Helipad pad on medium/tall landmark towers
  if (detailLevel === 'full' && h >= 68 && h <= 140 && rand() > 0.5) {
    const padY = h + 1.16;
    const padSize = Math.min(sw2, sd2) * 0.55;
    pushCylinder(buckets.opaque, padSize * 0.5, padSize * 0.5, 0.25, x + sw2 * 0.14, padY, z, '#2c323d', 12);
    pushBox(buckets.emissive, padSize * 0.42, 0.06, 0.32, x + sw2 * 0.14, padY + 0.14, z, '#e2e8f0', 0, 0, 0, isLight ? 0.9 : 2.1);
    pushBox(buckets.emissive, 0.32, 0.06, padSize * 0.52, x + sw2 * 0.14 - padSize * 0.18, padY + 0.14, z, '#e2e8f0', 0, 0, 0, isLight ? 0.9 : 2.1);
    pushBox(buckets.emissive, 0.32, 0.06, padSize * 0.52, x + sw2 * 0.14 + padSize * 0.18, padY + 0.14, z, '#e2e8f0', 0, 0, 0, isLight ? 0.9 : 2.1);
  }

  // Spire & red aviation obstruction beacon anchor on tall towers
  if (h >= 78) {
    const spireH = 9 + (h - 78) * 0.08;
    const spireX = x - sw2 * 0.12;
    pushCylinder(buckets.metal, 0.06, 0.26, spireH, spireX, h + 1.1 + pentH + spireH * 0.5, z, '#9aa2ad', 6);
    beaconAnchors.push([spireX, h + 1.1 + pentH + spireH + 0.15, z]);
  }
}

function addElevatedMetroViaductAndStation(
  buckets: CityBuckets,
  isLight: boolean,
  tier: QualityTier,
): void {
  const deckY = 9.2;
  const viaductZ = -56.5;
  const spanLength = tier === 'low' ? 440 : 840;
  const concrete = isLight ? '#aba499' : '#2f3542';
  const darkConcrete = isLight ? '#857f76' : '#20252f';
  const steel = isLight ? '#556070' : '#2c3442';
  const canopyGlass = isLight ? '#7fa0b5' : '#243a4d';
  const stationGlow = isLight ? '#cbd5e1' : '#ffe4be';
  const hdrStation = isLight ? 0.8 : 2.8;

  // Main prestressed concrete box-girder viaduct deck spanning East-West along z = -56.5
  pushBox(buckets.opaque, spanLength, 1.35, 8.2, 0, deckY - 0.68, viaductZ, darkConcrete);
  pushBox(buckets.opaque, spanLength, 0.35, 9.4, 0, deckY + 0.16, viaductZ, concrete);
  // Translucent acoustic side parapets
  pushBox(buckets.glass, spanLength, 0.95, 0.14, 0, deckY + 0.78, viaductZ - 4.58, canopyGlass);
  pushBox(buckets.glass, spanLength, 0.95, 0.14, 0, deckY + 0.78, viaductZ + 4.58, canopyGlass);
  // Twin steel running rails (north track z = -58.4, south track z = -54.6)
  for (const trackZ of [-58.8, -58.0, -55.0, -54.2]) {
    pushBox(buckets.metal, spanLength, 0.16, 0.14, 0, deckY + 0.4, trackZ, '#94a3b8');
  }

  // Tapered hammerhead concrete piers placed cleanly between avenue carriageways
  const pierXs = [
    -380, -335, -290, -210, -180, -120, -88, -32, 0, 32, 92, 128, 195, 232, 300, 345, 385,
  ];
  for (const px of pierXs) {
    if (Math.abs(px) > spanLength * 0.5) continue;
    pushCylinder(buckets.opaque, 0.95, 1.25, deckY - 1.3, px, (deckY - 1.3) * 0.5, viaductZ, darkConcrete, 8);
    pushBox(buckets.opaque, 3.0, 1.15, 7.2, px, deckY - 1.6, viaductZ, concrete);
    pushBox(buckets.opaque, 3.2, 0.42, 3.2, px, 0.21, viaductZ, darkConcrete);
  }

  // Architectural "SÖL Center" Elevated Skytrain Station (x = -18..+26, z = -56.5)
  const stX = 4;
  const stW = 44;
  // Island & side concourse platforms
  pushBox(buckets.opaque, stW, 0.45, 12.6, stX, deckY + 0.48, viaductZ, concrete);
  // Curved sculptural steel arch ribs & gullwing roof canopy
  pushBox(buckets.metal, stW + 2.5, 0.36, 13.6, stX, deckY + 5.25, viaductZ, steel);
  pushBox(buckets.glass, stW + 1.2, 0.14, 12.2, stX, deckY + 5.45, viaductZ, canopyGlass);
  pushBox(buckets.emissive, stW - 2.0, 0.18, 0.38, stX, deckY + 4.96, viaductZ + 5.1, stationGlow, 0, 0, 0, hdrStation);
  pushBox(buckets.emissive, stW - 2.0, 0.18, 0.38, stX, deckY + 4.96, viaductZ - 5.1, stationGlow, 0, 0, 0, hdrStation);
  // SÖL Salmon architectural accent stripe on the station fascia facing campus
  pushBox(buckets.emissive, stW * 0.72, 0.22, 0.18, stX, deckY + 5.26, viaductZ + 6.82, '#f07654', 0, 0, 0, isLight ? 1.0 : 2.3);

  for (let rx = stX - 18; rx <= stX + 18; rx += 9) {
    pushBox(buckets.metal, 0.32, 4.9, 0.32, rx, deckY + 2.8, viaductZ + 6.0, steel);
    pushBox(buckets.metal, 0.32, 4.9, 0.32, rx, deckY + 2.8, viaductZ - 6.0, steel);
  }
  // Escalator / Glass Bridge Concourse connecting Station South side to North Boulevard sidewalk (z = -50.2)
  pushBox(buckets.metal, 7.6, 3.2, 4.4, 21.5, deckY - 0.8, -51.4, steel);
  pushBox(buckets.glass, 7.2, 2.7, 4.0, 21.5, deckY - 0.8, -51.4, canopyGlass);
  pushBox(buckets.metal, 4.2, 9.0, 4.4, 23.0, 4.5, -49.6, steel);
  pushBox(buckets.glass, 3.8, 8.4, 4.0, 23.0, 4.5, -49.6, canopyGlass);
}

function addRoadNetworkAndSouthPark(
  buckets: CityBuckets,
  signalAnchors: TrafficSignalAnchor[],
  bannerAnchors: BoulevardBannerAnchor[],
  isLight: boolean,
  tier: QualityTier,
): void {
  const asphalt = isLight ? '#384150' : '#161b24';
  const sidewalk = isLight ? '#ccc5ba' : '#252b37';
  const curb = isLight ? '#aca59a' : '#384050';
  const grass = isLight ? '#48623d' : '#1e2c20';
  const stripeWhite = isLight ? '#f1f5f9' : '#b8c4d4';
  const stripeAmber = '#e89d20';
  const water = isLight ? '#355f78' : '#132838';
  const timber = '#7c4e32';
  const steel = isLight ? '#323a48' : '#1e2430';
  const gridSpan = tier === 'low' ? 460 : 840;

  // =========================================================================
  // 1. SOUTH GRAND BOULEVARD (Splices seamlessly onto x=-40 and x=+52 at z=23.8..29.4)
  // =========================================================================
  const westWingW = gridSpan * 0.5 - 40.02;
  const westCenterX = -40.02 - westWingW * 0.5;
  pushBox(buckets.opaque, westWingW, 0.06, 5.6, westCenterX, 0.005, 26.6, asphalt);
  pushBox(buckets.opaque, westWingW, 0.12, 0.28, westCenterX, 0.06, 23.75, curb);
  pushBox(buckets.opaque, westWingW, 0.12, 0.28, westCenterX, 0.06, 29.45, curb);

  const eastWingW = gridSpan * 0.5 - 52.02;
  const eastCenterX = 52.02 + eastWingW * 0.5;
  pushBox(buckets.opaque, eastWingW, 0.06, 5.6, eastCenterX, 0.005, 26.6, asphalt);
  pushBox(buckets.opaque, eastWingW, 0.12, 0.28, eastCenterX, 0.06, 23.75, curb);
  pushBox(buckets.opaque, eastWingW, 0.12, 0.28, eastCenterX, 0.06, 29.45, curb);

  // Full Southbound Carriageway (+X Eastbound RHT, z = 32.15..38.75) across entire boulevard
  pushBox(buckets.opaque, gridSpan, 0.06, 6.6, 0, 0.005, 35.45, asphalt);
  pushBox(buckets.opaque, gridSpan, 0.12, 0.28, 0, 0.06, 32.1, curb);
  pushBox(buckets.opaque, gridSpan, 0.12, 0.28, 0, 0.06, 38.8, curb);
  // Bus Lay-by pocket (x = 16..34, z = 38.8..40.5)
  pushBox(buckets.opaque, 18, 0.06, 1.8, 25, 0.005, 39.7, asphalt);

  // Landscaped Central Median Segments (broken cleanly at intersections x = -255, -152, -60.5, +70.5, +162, +265)
  const medianIntervals: ReadonlyArray<readonly [number, number]> = [
    [-380, -264],
    [-246, -161],
    [-143, -69],
    [-52, 62],
    [79, 153],
    [171, 256],
    [274, 380],
  ];
  for (const [x0, x1] of medianIntervals) {
    if (Math.abs(x0) > gridSpan * 0.5 && Math.abs(x1) > gridSpan * 0.5) continue;
    const len = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    pushBox(buckets.opaque, len, 0.18, 2.35, cx, 0.09, 30.8, curb);
    pushBox(buckets.opaque, len - 0.8, 0.24, 1.75, cx, 0.12, 30.8, grass);
  }

  // Median Double-Arm Streetlamps + Trees + Boulevard Banners
  for (let x = -168; x <= 186; x += 22) {
    const inIntersection =
      Math.abs(x + 152) < 10 ||
      Math.abs(x + 60.5) < 10 ||
      Math.abs(x - 70.5) < 10 ||
      Math.abs(x - 162) < 10;
    if (inIntersection) continue;
    addBoulevardStreetLamp(buckets, x, 30.8, Math.PI / 2, true, isLight);
    if (Math.abs(x) <= 92 && Math.abs(x - 8) > 10) {
      bannerAnchors.push({
        id: `banner-${x}`,
        x,
        y: 4.5,
        z: 30.8,
        side: x >= 0 ? 1 : -1,
      });
    }
    if (Math.abs(x) <= 130 && Math.abs(x - 8) > 12) {
      addCityTree(buckets.opaque, x + 10.5, 30.8, 0.82, isLight, false);
    }
  }

  // Boulevard Dashed Lane Stripes & Eastbound Lane Lines
  for (let x = -220; x <= 230; x += 5.0) {
    const inInter =
      Math.abs(x + 152) < 7.5 ||
      Math.abs(x + 60.5) < 7.5 ||
      Math.abs(x - 70.5) < 7.5 ||
      Math.abs(x - 162) < 7.5;
    if (inInter) continue;
    if (x < -40 || x > 52) {
      pushBox(buckets.opaque, 2.2, 0.04, 0.12, x, 0.036, 26.6, stripeWhite);
    }
    pushBox(buckets.opaque, 2.2, 0.04, 0.12, x, 0.036, 35.45, stripeWhite);
  }

  // =========================================================================
  // 2. NORTH BOULEVARD (z = -48.5..-38.5) & WEST / EAST CROSS AVENUES
  // =========================================================================
  pushBox(buckets.opaque, gridSpan, 0.06, 10.0, 0, 0.005, -43.5, asphalt);
  pushBox(buckets.opaque, gridSpan, 0.12, 0.28, 0, 0.06, -38.45, curb);
  pushBox(buckets.opaque, gridSpan, 0.12, 0.28, 0, 0.06, -48.55, curb);
  // Amber center divider along North Boulevard
  for (const [x0, x1] of medianIntervals) {
    if (Math.abs(x0) > gridSpan * 0.5 && Math.abs(x1) > gridSpan * 0.5) continue;
    pushBox(buckets.opaque, x1 - x0, 0.05, 0.16, (x0 + x1) * 0.5, 0.036, -43.5, stripeAmber);
  }

  // North-South Avenues (West x=-60.5, East x=+70.5, Outer -152, +162, -255, +265)
  const nsAvenues = tier === 'low' ? [-152, -60.5, 70.5, 162] : [-255, -152, -60.5, 70.5, 162, 265];
  for (const ax of nsAvenues) {
    pushBox(buckets.opaque, 12.0, 0.06, gridSpan, ax, 0.006, 0, asphalt);
    pushBox(buckets.opaque, 0.16, 0.04, gridSpan, ax, 0.038, 0, stripeAmber);
    // Dashed lane dividers on each carriageway
    for (let z = -190; z <= 190; z += 5.5) {
      if (Math.abs(z - 31) < 9 || Math.abs(z + 43.5) < 9 || Math.abs(z - 74) < 9 || Math.abs(z + 132) < 9) {
        continue;
      }
      pushBox(buckets.opaque, 0.12, 0.04, 2.2, ax - 3.0, 0.036, z, stripeWhite);
      pushBox(buckets.opaque, 0.12, 0.04, 2.2, ax + 3.0, 0.036, z, stripeWhite);
    }
  }

  // Outer East-West Grid Arterials (z = -235, -132, +74, +168)
  const ewArterials = tier === 'low' ? [-132, 74] : [-235, -132, 74, 168];
  for (const az of ewArterials) {
    pushBox(buckets.opaque, gridSpan, 0.06, 11.0, 0, 0.005, az, asphalt);
    pushBox(buckets.opaque, gridSpan, 0.04, 0.16, 0, 0.036, az, stripeAmber);
  }

  // Signalized Intersections & Crosswalks around SÖL Campus Corners
  const mainIntersections: ReadonlyArray<{ id: string; x: number; z: number }> = [
    { id: 'int-sw', x: -60.5, z: 31.2 },
    { id: 'int-se', x: 70.5, z: 31.2 },
    { id: 'int-nw', x: -60.5, z: -43.5 },
    { id: 'int-ne', x: 70.5, z: -43.5 },
  ];
  for (const inter of mainIntersections) {
    // 4-leg Zebra Crosswalks
    for (let i = -2; i <= 2; i += 1) {
      const zOff = i * 1.15;
      pushBox(buckets.opaque, 2.2, 0.04, 0.52, inter.x - 8.2, 0.04, inter.z + zOff, stripeWhite);
      pushBox(buckets.opaque, 2.2, 0.04, 0.52, inter.x + 8.2, 0.04, inter.z + zOff, stripeWhite);
    }
    for (let i = -3; i <= 3; i += 1) {
      const xOff = i * 1.15;
      pushBox(buckets.opaque, 0.52, 0.04, 2.2, inter.x + xOff, 0.04, inter.z - 8.6, stripeWhite);
      pushBox(buckets.opaque, 0.52, 0.04, 2.2, inter.x + xOff, 0.04, inter.z + 8.6, stripeWhite);
    }
    // EW Traffic Signal (controls East-West lanes)
    addSignalGantry(buckets, signalAnchors, `${inter.id}-ew`, inter.id, 'EW', inter.x - 7.5, inter.z + 8.6, 0, isLight);
    // NS Traffic Signal (controls North-South lanes)
    addSignalGantry(buckets, signalAnchors, `${inter.id}-ns`, inter.id, 'NS', inter.x + 7.5, inter.z - 8.6, Math.PI / 2, isLight);
  }

  // Sidewalks Framing West (-54.4..-45.05) and East (+58.05..+64.4) Edges of Campus
  pushBox(buckets.opaque, 9.3, 0.14, 62.2, -49.75, 0.03, -7.4, sidewalk);
  pushBox(buckets.opaque, 6.3, 0.14, 62.2, 61.25, 0.03, -7.4, sidewalk);
  // North Rear Service Promenade (z = -38.4..-30.05)
  pushBox(buckets.opaque, 103, 0.14, 8.3, 6.5, 0.03, -34.25, sidewalk);

  // Avenue Trees flanking West, East & North Promenades
  for (let z = -26; z <= 22; z += 12) {
    addCityTree(buckets.opaque, -51.8, z, 0.95, isLight);
    addCityTree(buckets.opaque, 61.8, z, 0.95, isLight);
    addBoulevardStreetLamp(buckets, -53.2, z + 6, 0, false, isLight);
    addBoulevardStreetLamp(buckets, 63.4, z + 6, Math.PI, false, isLight);
  }
  for (let x = -38; x <= 48; x += 14) {
    addCityTree(buckets.opaque, x, -34.5, 0.92, isLight);
  }

  // =========================================================================
  // 3. SOUTH LINEAR ESPLANADE PARK, REFLECTING CANAL, BUS SHELTER & CAFE (z=38.8..68.5)
  //    Strictly low-rise (max H <= 5.2m) to keep Hero Camera sightline [46,36,48] 100% open!
  // =========================================================================
  // Esplanade Granite Sidewalk
  pushBox(buckets.opaque, 118, 0.16, 8.2, 5, 0.04, 43.0, sidewalk);
  // Park Lawns Flanking the Canal
  pushBox(buckets.opaque, 118, 0.12, 21.0, 5, 0.02, 57.6, grass);
  // Park Jogging Track Loop (running cleanly parallel to South Boulevard)
  pushBox(buckets.opaque, 112, 0.08, 2.2, 5, 0.05, 48.2, isLight ? '#8f5f52' : '#4a3531');
  pushBox(buckets.opaque, 112, 0.08, 2.2, 5, 0.05, 64.8, isLight ? '#8f5f52' : '#4a3531');

  // Reflecting Urban Canal (x = -34..+46, z = 51.6..58.6)
  pushBox(buckets.opaque, 82, 0.36, 7.6, 6, 0.12, 55.1, curb);
  pushBox(buckets.glass, 80.2, 0.24, 6.0, 6, 0.18, 55.1, water);
  // Arched Timber-Steel Footbridge across the Canal at x = 6.5 (aligned with Main Gate!)
  pushBox(buckets.metal, 4.4, 0.32, 8.4, 6.5, 0.62, 55.1, steel);
  pushBox(buckets.opaque, 3.8, 0.14, 8.2, 6.5, 0.78, 55.1, timber);
  for (const bx of [4.6, 8.4]) {
    pushBox(buckets.metal, 0.12, 0.92, 8.2, bx, 1.24, 55.1, steel);
  }

  // Modern Glass Transit Bus Shelter (x = 24.5, z = 40.9, height 3.1m — clear below camera ray!)
  pushBox(buckets.metal, 9.2, 0.14, 2.4, 24.5, 2.95, 40.9, steel);
  pushBox(buckets.glass, 9.0, 0.06, 2.2, 24.5, 3.04, 40.9, isLight ? '#8bb0c6' : '#2a4156');
  pushBox(buckets.glass, 8.6, 2.45, 0.08, 24.5, 1.5, 42.0, isLight ? '#8bb0c6' : '#2a4156');
  pushBox(buckets.opaque, 4.8, 0.42, 0.6, 24.5, 0.46, 41.3, timber);
  // Backlit Digital Transit Route Totem (blooms softly at dusk)
  pushBox(buckets.metal, 1.25, 2.65, 0.36, 19.6, 1.48, 41.2, steel);
  pushBox(buckets.emissive, 0.92, 1.85, 0.42, 19.6, 1.55, 41.2, isLight ? '#d8e6f0' : '#ffcf9e', 0, 0, 0, isLight ? 0.9 : 2.8);

  // Metro South Underpass Glass Entrance Pavilion (x = 44.5, z = 43.2, height 3.8m)
  pushBox(buckets.opaque, 6.8, 0.95, 5.2, 44.5, 0.48, 43.2, curb);
  pushBox(buckets.metal, 6.6, 3.2, 4.8, 44.5, 2.1, 43.2, steel);
  pushBox(buckets.glass, 6.2, 2.75, 4.4, 44.5, 2.0, 43.2, isLight ? '#86abc2' : '#263c52');
  pushBox(buckets.emissive, 5.8, 0.24, 0.25, 44.5, 3.35, 40.76, '#f07654', 0, 0, 0, isLight ? 1.0 : 3.1);

  // Esplanade Park Café Kiosk & Timber Patio (x = -20, z = 43.6, height 3.4m)
  pushBox(buckets.opaque, 12.0, 0.18, 6.8, -20, 0.14, 44.0, timber);
  pushBox(buckets.opaque, 5.6, 3.2, 3.6, -22, 1.8, 43.2, isLight ? '#383d46' : '#1b2029');
  pushBox(buckets.metal, 6.6, 0.2, 4.8, -22, 3.45, 43.4, steel);
  pushBox(buckets.emissive, 4.8, 2.1, 3.2, -22, 1.4, 43.2, isLight ? '#4a5568' : '#ffd59a', 0, 0, 0, isLight ? 0.7 : 2.6);
  // Café patio tables & architectural umbrellas
  for (const [tx, tz] of [
    [-16.2, 42.8],
    [-16.2, 45.2],
    [-18.4, 45.6],
    [-25.6, 44.8],
  ] as const) {
    pushCylinder(buckets.metal, 0.04, 0.05, 2.4, tx, 1.35, tz, steel, 6);
    pushCylinder(buckets.opaque, 0.15, 1.15, 0.36, tx, 2.55, tz, '#d8c8b6', 8);
    pushCylinder(buckets.opaque, 0.48, 0.48, 0.08, tx, 0.92, tz, timber, 8);
  }

  // Linear Park Trees & Benches
  const parkTrees: ReadonlyArray<readonly [number, number, number]> = [
    [-40, 41.2, 1.0],
    [-31, 41.2, 0.92],
    [-9, 41.2, 1.05],
    [13, 41.2, 0.98],
    [35, 41.2, 1.02],
    [52, 41.2, 0.95],
    [-42, 60.5, 1.12],
    [-28, 61.5, 1.18],
    [-14, 60.2, 1.05],
    [0, 61.0, 1.15],
    [18, 60.8, 1.1],
    [34, 61.4, 1.2],
    [48, 60.5, 1.05],
  ];
  for (const [tx, tz, sc] of parkTrees) {
    addCityTree(buckets.opaque, tx, tz, sc, isLight, Math.abs(tz - 41.2) < 1);
  }
}

function generateDistrictTowers(tier: QualityTier, isLight: boolean): TowerSpec[] {
  const rand = seededRandom(20261114);
  const stones = isLight ? STONE_DAY : STONE_DUSK;
  const glasses = isLight ? GLASS_DAY : GLASS_DUSK;
  const pickStone = () => stones[Math.floor(rand() * stones.length)]!;
  const pickGlass = () => glasses[Math.floor(rand() * glasses.length)]!;
  const styles: ReadonlyArray<TowerSpec['style']> = [
    'curtain-stepped',
    'chamfered-twin',
    'diagrid-crown',
    'residential-terrace',
  ];
  const pickStyle = () => styles[Math.floor(rand() * styles.length)]!;

  const specs: TowerSpec[] = [];

  // Curated Signature North Skyline CBD (frames the backdrop behind SÖL Fitness Center!)
  const signatureNorthCBD: ReadonlyArray<Omit<TowerSpec, 'facadeTone' | 'glassTone'>> = [
    { x: -34, z: -96, w: 26, d: 24, h: 118, ring: 'mid', style: 'diagrid-crown' },
    { x: 0, z: -102, w: 30, d: 26, h: 158, ring: 'mid', style: 'curtain-stepped' },
    { x: 38, z: -94, w: 24, d: 24, h: 132, ring: 'mid', style: 'chamfered-twin' },
    { x: -96, z: -86, w: 26, d: 22, h: 92, ring: 'inner', style: 'curtain-stepped' },
    { x: -116, z: -112, w: 28, d: 26, h: 138, ring: 'mid', style: 'diagrid-crown' },
    { x: 108, z: -84, w: 24, d: 22, h: 86, ring: 'inner', style: 'residential-terrace' },
    { x: 124, z: -110, w: 28, d: 24, h: 146, ring: 'mid', style: 'curtain-stepped' },
    // Mixed-use inner blocks just across North Viaduct (z = -84..-116)
    { x: -24, z: -78, w: 19, d: 17, h: 42, ring: 'inner', style: 'residential-terrace' },
    { x: 8, z: -78, w: 21, d: 17, h: 48, ring: 'inner', style: 'curtain-stepped' },
    { x: 38, z: -76, w: 18, d: 16, h: 36, ring: 'inner', style: 'residential-terrace' },
  ];
  for (const s of signatureNorthCBD) {
    specs.push({ ...s, facadeTone: pickStone(), glassTone: pickGlass() });
  }

  // West & East District Inner & Mid-Rise Urban Blocks (flanking West Ave x=-60.5 & East Ave x=+70.5)
  const sideParcels: ReadonlyArray<readonly [number, number, number, number, number, 'inner' | 'mid']> = [
    // West side across West Ave (-135..-80)
    [-92, -32, 22, 20, 44, 'inner'],
    [-92, 0, 20, 22, 56, 'inner'],
    [-92, 48, 22, 22, 34, 'inner'],
    [-122, -26, 24, 22, 78, 'mid'],
    [-122, 12, 24, 22, 68, 'mid'],
    [-122, 52, 24, 20, 52, 'inner'],
    [-98, 96, 26, 24, 88, 'mid'],
    [-128, 98, 26, 26, 114, 'mid'],
    // East side across East Ave (+90..+145)
    [98, -32, 22, 20, 52, 'inner'],
    [102, 0, 22, 22, 64, 'inner'],
    [104, 48, 20, 18, 32, 'inner'],
    [132, -24, 24, 22, 86, 'mid'],
    [134, 14, 24, 22, 74, 'mid'],
    [134, 52, 22, 20, 46, 'inner'],
    [106, 98, 24, 24, 72, 'mid'],
    [136, 102, 26, 24, 96, 'mid'],
    // South District behind the Linear Park (z >= 96, low-stepped in front of camera so overview [46,36,48] is unobstructed)
    [-36, 98, 22, 20, 38, 'inner'],
    [4, 98, 24, 20, 44, 'inner'],
    [44, 98, 22, 20, 34, 'inner'],
    [-40, 134, 26, 24, 78, 'mid'],
    [2, 136, 28, 24, 94, 'mid'],
    [44, 136, 24, 24, 68, 'mid'],
    [-94, 136, 26, 24, 104, 'mid'],
    [104, 138, 26, 24, 88, 'mid'],
  ];
  for (const [x, z, w, d, h, ring] of sideParcels) {
    specs.push({
      x,
      z,
      w,
      d,
      h,
      ring,
      style: pickStyle(),
      facadeTone: pickStone(),
      glassTone: pickGlass(),
    });
  }

  // Mid-North & Outer CBD Financial Towers (z = -155..-220)
  const midNorthCenters: ReadonlyArray<readonly [number, number, number]> = [
    [-202, -96, 112],
    [-196, -158, 148],
    [-124, -172, 168],
    [-76, -168, 128],
    [-24, -174, 192],
    [32, -168, 174],
    [88, -172, 142],
    [138, -166, 158],
    [206, -154, 134],
    [208, -96, 106],
    [-204, 14, 94],
    [-204, 88, 108],
    [210, 14, 96],
    [210, 92, 118],
  ];
  for (const [x, z, h] of midNorthCenters) {
    if (tier === 'low' && Math.abs(x) > 170) continue;
    specs.push({
      x,
      z,
      w: 24 + Math.round(rand() * 8),
      d: 22 + Math.round(rand() * 8),
      h: Math.round(h * (0.9 + rand() * 0.22)),
      ring: 'mid',
      style: pickStyle(),
      facadeTone: pickStone(),
      glassTone: pickGlass(),
    });
  }

  // Far Horizon 360° Skyline Ring (240m..460m radius, scaled smoothly by QualityTier)
  const horizonCount = tier === 'high' ? 56 : tier === 'medium' ? 32 : 16;
  for (let i = 0; i < horizonCount; i += 1) {
    const angle = (i / horizonCount) * Math.PI * 2 + rand() * 0.08;
    const radius = 265 + rand() * 195;
    const tx = Math.round(Math.cos(angle) * radius);
    const tz = Math.round(Math.sin(angle) * radius);
    // Avoid landing directly inside arterial strips
    const onNS = [-255, -152, -60.5, 70.5, 162, 265].some(ax => Math.abs(tx - ax) < 16);
    const onEW = [-235, -132, -56.5, -43.5, 31, 74, 168].some(az => Math.abs(tz - az) < 16);
    if (onNS || onEW) continue;

    // Taller supertalls clustered in the iconic North/NW skyline arc
    const northBias = tz < -100 ? 1.35 : 0.92;
    const h = Math.round((72 + rand() * 135) * northBias);
    specs.push({
      x: tx,
      z: tz,
      w: Math.round(22 + rand() * 14),
      d: Math.round(20 + rand() * 14),
      h,
      ring: 'horizon',
      style: 'curtain-stepped',
      facadeTone: pickStone(),
      glassTone: pickGlass(),
    });
  }

  return specs;
}

export interface CityCollider {
  readonly x: number;
  readonly z: number;
  readonly hw: number;
  readonly hd: number;
  readonly h: number;
}

let colliderCache: readonly CityCollider[] | null = null;

/** Footprints of the non-horizon towers; the camera is pushed out of them so it never sits inside a building. */
export function getCityColliders(): readonly CityCollider[] {
  colliderCache ??= generateDistrictTowers('high', true)
    .filter(t => t.ring !== 'horizon')
    .map(t => ({ x: t.x, z: t.z, hw: t.w / 2, hd: t.d / 2, h: t.h }));
  return colliderCache;
}

const metropolisCache = new Map<string, CityMetropolisGeometries>();


/** SÖL Beacon: a slender landmark mast beside the campus that gives the gym a taller silhouette. */
function addSolBeacon(
  buckets: CityBuckets,
  beaconAnchors: Array<readonly [number, number, number]>,
  x: number,
  z: number,
  isLight: boolean,
): void {
  const steel = isLight ? '#3a4352' : '#222a36';
  const glass = isLight ? '#7fa0b5' : '#1d3347';
  const salmon = '#f07654';
  const hdr = isLight ? 1.1 : 4.0;
  pushBox(buckets.opaque, 7.5, 0.9, 7.5, x, 0.45, z, isLight ? '#a69d91' : '#2e333d');
  pushBox(buckets.metal, 5.6, 0.5, 5.6, x, 1.15, z, steel);
  const shaftH = 38;
  // Four lattice legs that taper toward the crown.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushCylinder(buckets.metal, 0.16, 0.34, shaftH, x + sx * 1.3, 1.4 + shaftH / 2, z + sz * 1.3, steel, 8, sz * 0.012, 0, -sx * 0.012);
    }
  }
  // Cross bracing rings + glass elevator core with salmon light ribbons.
  for (let y = 4; y < shaftH; y += 4.5) {
    const k = 1 - y / (shaftH * 1.5);
    pushBox(buckets.metal, 3.0 * k + 0.4, 0.16, 3.0 * k + 0.4, x, 1.4 + y, z, steel);
  }
  pushBox(buckets.glass, 1.7, shaftH - 6, 1.7, x, 1.4 + (shaftH - 6) / 2 + 2, z, glass);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushBox(buckets.emissive, 0.12, shaftH - 8, 0.12, x + sx * 0.95, 1.4 + (shaftH - 8) / 2 + 3, z + sz * 0.95, salmon, 0, 0, 0, hdr);
    }
  }
  // Observation ring and crown halo.
  pushCylinder(buckets.metal, 3.1, 2.4, 1.1, x, 1.4 + shaftH - 5, z, steel, 16);
  pushCylinder(buckets.glass, 2.7, 2.7, 1.3, x, 1.4 + shaftH - 3.7, z, glass, 16);
  pushCylinder(buckets.emissive, 3.2, 3.2, 0.18, x, 1.4 + shaftH - 5.6, z, salmon, 24, 0, 0, 0, hdr);
  pushCylinder(buckets.metal, 0.06, 0.3, 14, x, 1.4 + shaftH + 6, z, '#9aa2ad', 6);
  beaconAnchors.push([x, 1.4 + shaftH + 13.2, z]);
}


export interface GymCrownGeometries {
  readonly opaqueGeometry: THREE.BufferGeometry;
  readonly metalGeometry: THREE.BufferGeometry;
  readonly glassGeometry: THREE.BufferGeometry;
  readonly emissiveGeometry: THREE.BufferGeometry;
}

const gymCrownCache = new Map<ExploreTheme, GymCrownGeometries>();

/** Top of the penthouse walls: RF elevation 11.26 m + RF height 3.9 m. */
const GYM_ROOF_Y = 15.16;

/**
 * The gym's weather roof: a glazed steel canopy that floats just above the penthouse walls on
 * slender columns, so the building reads as one tall covered volume (~1.3x the old height)
 * while the translucent panels still let the cutaway interior show from above.
 */
export function buildGymCrown(theme: ExploreTheme): GymCrownGeometries {
  const cached = gymCrownCache.get(theme);
  if (cached) return cached;
  const isLight = theme === 'light';
  const b: CityBuckets = { opaque: [], metal: [], glass: [], emissive: [] };
  const base = GYM_ROOF_Y;
  const lift = 0.95;
  const roofY = base + lift;
  const steel = isLight ? '#353d4b' : '#1c222c';
  const glass = isLight ? '#9fc0d4' : '#3b5a72';
  const salmon = '#f07654';
  const hdrLed = isLight ? 1.2 : 4.2;
  const x0 = -23.2;
  const x1 = 23.2;
  const z0 = -17.2;
  const z1 = 17.2;
  const w = x1 - x0;
  const d = z1 - z0;

  // Glass roof deck with a steel grid of beams (every ~5.8 m along X, ~5.7 m along Z).
  pushBox(b.glass, w, 0.12, d, 0, roofY, 0, glass);
  const nx = 8;
  const nz = 6;
  for (let i = 0; i <= nx; i += 1) {
    pushBox(b.metal, 0.24, 0.34, d + 0.2, x0 + (i / nx) * w, roofY + 0.06, 0, steel);
  }
  for (let j = 0; j <= nz; j += 1) {
    pushBox(b.metal, w + 0.2, 0.3, 0.22, 0, roofY + 0.04, z0 + (j / nz) * d, steel);
  }
  // Deep fascia with a salmon LED line all round.
  pushBox(b.metal, w + 0.6, 0.55, 0.3, 0, roofY + 0.1, z0 - 0.15, steel);
  pushBox(b.metal, w + 0.6, 0.55, 0.3, 0, roofY + 0.1, z1 + 0.15, steel);
  pushBox(b.metal, 0.3, 0.55, d + 0.6, x0 - 0.15, roofY + 0.1, 0, steel);
  pushBox(b.metal, 0.3, 0.55, d + 0.6, x1 + 0.15, roofY + 0.1, 0, steel);
  pushBox(b.emissive, w + 0.7, 0.09, 0.1, 0, roofY - 0.2, z0 - 0.33, salmon, 0, 0, 0, hdrLed);
  pushBox(b.emissive, w + 0.7, 0.09, 0.1, 0, roofY - 0.2, z1 + 0.33, salmon, 0, 0, 0, hdrLed);
  pushBox(b.emissive, 0.1, 0.09, d + 0.7, x0 - 0.33, roofY - 0.2, 0, salmon, 0, 0, 0, hdrLed);
  pushBox(b.emissive, 0.1, 0.09, d + 0.7, x1 + 0.33, roofY - 0.2, 0, salmon, 0, 0, 0, hdrLed);
  // Columns carry the roof from the penthouse parapet; they stand in the wall line.
  const colXs = [x0 + 0.4, x0 + w * 0.25, 0, x0 + w * 0.75, x1 - 0.4];
  const colZs = [z0 + 0.4, z1 - 0.4];
  for (const cx of colXs) {
    for (const cz of colZs) pushBox(b.metal, 0.36, lift + 0.1, 0.36, cx, base + lift / 2, cz, steel);
  }
  for (const cz of [-5.2, 5.2]) {
    pushBox(b.metal, 0.36, lift + 0.1, 0.36, x0 + 0.4, base + lift / 2, cz, steel);
    pushBox(b.metal, 0.36, lift + 0.1, 0.36, x1 - 0.4, base + lift / 2, cz, steel);
  }

  const result: GymCrownGeometries = {
    opaqueGeometry: mergeCityParts(b.opaque),
    metalGeometry: mergeCityParts(b.metal),
    glassGeometry: mergeCityParts(b.glass),
    emissiveGeometry: mergeCityParts(b.emissive),
  };
  gymCrownCache.set(theme, result);
  return result;
}

/**
 * Generates the entire 360° AAA surrounding metropolis around SÖL Campus as 4
 * batched BufferGeometry buckets (`opaque`, `metal`, `glass`, `emissive`), cached
 * per `(theme, tier)` for instant zero-hitch theme toggling.
 */
export function buildCityMetropolis(
  theme: ExploreTheme,
  tier: QualityTier = 'high',
): CityMetropolisGeometries {
  const cacheKey = `${theme}:${tier}`;
  const cached = metropolisCache.get(cacheKey);
  if (cached) return cached;

  const isLight = theme === 'light';
  const buckets: CityBuckets = {
    opaque: [],
    metal: [],
    glass: [],
    emissive: [],
  };
  const beaconAnchors: Array<readonly [number, number, number]> = [];
  const trafficSignalAnchors: TrafficSignalAnchor[] = [];
  const boulevardBannerAnchors: BoulevardBannerAnchor[] = [];

  addRoadNetworkAndSouthPark(buckets, trafficSignalAnchors, boulevardBannerAnchors, isLight, tier);
  addElevatedMetroViaductAndStation(buckets, isLight, tier);
  addSolBeacon(buckets, beaconAnchors, -34, -25, isLight);

  const towers = generateDistrictTowers(tier, isLight);
  towers.forEach((spec, idx) => {
    const detailLevel: 'full' | 'medium' | 'silhouette' =
      spec.ring === 'horizon'
        ? 'silhouette'
        : spec.ring === 'inner' && tier !== 'low'
          ? 'full'
          : tier === 'high' && idx % 2 === 0
            ? 'full'
            : 'medium';
    addSkyscraper(buckets, beaconAnchors, spec, 9001 + idx * 73, isLight, detailLevel);
  });

  const result: CityMetropolisGeometries = {
    opaqueGeometry: mergeCityParts(buckets.opaque),
    metalGeometry: mergeCityParts(buckets.metal),
    glassGeometry: mergeCityParts(buckets.glass),
    emissiveGeometry: mergeCityParts(buckets.emissive),
    beaconAnchors,
    trafficSignalAnchors,
    boulevardBannerAnchors,
  };

  metropolisCache.set(cacheKey, result);
  return result;
}
