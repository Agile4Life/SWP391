import * as THREE from 'three';

import type { LevelCode } from '../../scene/schema';

interface ColoredPart {
  readonly geometry: THREE.BufferGeometry;
  readonly color: string;
}

function pushBox(
  parts: ColoredPart[],
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
): void {
  const geom = new THREE.BoxGeometry(w, h, d);
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
  parts.push({ geometry: geom, color });
}

function pushCylinder(
  parts: ColoredPart[],
  rTop: number,
  rBottom: number,
  h: number,
  x: number,
  y: number,
  z: number,
  color: string,
  radialSegments = 10,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const geom = new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments);
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
  parts.push({ geometry: geom, color });
}

function mergeColoredParts(parts: readonly ColoredPart[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    empty.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(0), 3));
    empty.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
    empty.setIndex(new THREE.BufferAttribute(new Uint16Array(0), 1));
    return empty;
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
  const colors = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  const tmpColor = new THREE.Color();
  let vOffset = 0;
  let iOffset = 0;

  for (const { geometry, color } of parts) {
    tmpColor.set(color);
    const pos = geometry.getAttribute('position');
    const norm = geometry.getAttribute('normal');
    const idx = geometry.getIndex();

    for (let i = 0; i < pos.count; i += 1) {
      const base = (vOffset + i) * 3;
      positions[base] = pos.getX(i);
      positions[base + 1] = pos.getY(i);
      positions[base + 2] = pos.getZ(i);

      if (norm) {
        normals[base] = norm.getX(i);
        normals[base + 1] = norm.getY(i);
        normals[base + 2] = norm.getZ(i);
      } else {
        normals[base + 1] = 1;
      }

      colors[base] = tmpColor.r;
      colors[base + 1] = tmpColor.g;
      colors[base + 2] = tmpColor.b;
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
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function buildB1Details(parts: ColoredPart[]): void {
  const salmon = '#f07654';
  const warmWood = '#9c6644';
  const darkSteel = '#1f2531';
  const chrome = '#cbd5e1';

  // Pool is at centerX=-6.0, centerZ=-5.5, width=25 (x=-18.5..+6.5), depth=12 (z=-11.5..+0.5)
  // 1. 6 Luxury Poolside Sun Loungers along the South Pool Deck (z = 2.35, x = -17.0..+2.0)
  const loungerXs = [-17.0, -13.2, -9.4, -5.6, -1.8, 2.0];
  for (let i = 0; i < loungerXs.length; i += 1) {
    const lx = loungerXs[i]!;
    pushBox(parts, 0.78, 0.16, 1.85, lx, 0.22, 2.3, warmWood);
    pushBox(parts, 0.72, 0.09, 1.28, lx, 0.34, 2.0, '#f8fafc');
    pushBox(parts, 0.72, 0.09, 0.58, lx, 0.52, 2.88, '#f8fafc', 0.48, 0, 0);
    pushBox(parts, 0.52, 0.08, 0.22, lx, 0.64, 3.05, salmon, 0.48, 0, 0);

    if (i % 2 === 0 && i + 1 < loungerXs.length) {
      const mx = (lx + loungerXs[i + 1]!) * 0.5;
      pushCylinder(parts, 0.28, 0.28, 0.42, mx, 0.21, 2.5, warmWood, 8);
      pushCylinder(parts, 0.04, 0.05, 2.35, mx, 1.18, 2.5, chrome, 8);
      pushCylinder(parts, 0.12, 1.35, 0.38, mx, 2.38, 2.5, i === 2 ? salmon : '#fff8f3', 8);
    }
  }

  // 2. Elevated Lifeguard Chair at West Pool Deck (x = -19.6, z = -5.5)
  pushBox(parts, 0.82, 1.45, 0.82, -19.6, 0.72, -5.5, '#f8fafc');
  pushBox(parts, 0.72, 0.1, 0.68, -19.6, 1.5, -5.5, salmon);
  pushBox(parts, 0.1, 0.65, 0.72, -19.9, 1.82, -5.5, '#f8fafc');
  pushBox(parts, 0.14, 0.68, 0.18, -19.6, 1.25, -4.98, '#ef4444');

  // 3. 4 Stainless Steel Pool Ladders along North (z = -11.45) & South (z = 0.45) pool walls
  for (const [lx, lz] of [
    [-15.0, -11.45],
    [1.5, -11.45],
    [-15.0, 0.45],
    [1.5, 0.45],
  ] as const) {
    pushCylinder(parts, 0.03, 0.03, 0.95, lx - 0.24, 0.45, lz, chrome, 6);
    pushCylinder(parts, 0.03, 0.03, 0.95, lx + 0.24, 0.45, lz, chrome, 6);
    pushBox(parts, 0.52, 0.04, 0.18, lx, 0.88, lz, chrome);
  }

  // 4. North Pool Wall Towel Cabana Counter, Rinse Showers & Digital Water Temp Clock (z = -14.8)
  pushBox(parts, 2.8, 1.05, 0.68, -14.0, 0.52, -14.6, warmWood);
  pushBox(parts, 2.6, 0.32, 0.52, -14.0, 1.2, -14.6, '#f8fafc');
  pushBox(parts, 3.4, 0.95, 0.12, -6.0, 2.25, -15.65, darkSteel);
  pushBox(parts, 3.15, 0.78, 0.14, -6.0, 2.25, -15.62, '#0ea5e9');
  for (const sx of [-1.2, 1.2]) {
    pushCylinder(parts, 0.04, 0.05, 2.2, sx, 1.1, -14.8, chrome, 8);
    pushCylinder(parts, 0.16, 0.16, 0.05, sx, 2.18, -14.55, chrome, 8);
    pushBox(parts, 0.85, 0.05, 0.85, sx, 0.03, -14.5, warmWood);
  }

  // 5. Thermal Zone (x = 8..20, z = -14..4): Cold Plunge Ice Bath & 3 Heated Stone Loungers
  pushCylinder(parts, 1.15, 1.08, 0.82, 18.2, 0.41, -8.5, warmWood, 12);
  pushCylinder(parts, 0.98, 0.98, 0.85, 18.2, 0.43, -8.5, '#38bdf8', 12);
  for (const tz of [-8.5, -4.5, 2.2]) {
    pushBox(parts, 1.65, 0.42, 0.76, 10.2, 0.21, tz, '#475569');
    pushBox(parts, 1.55, 0.08, 0.7, 10.2, 0.45, tz, '#d6cfc4');
    pushBox(parts, 0.24, 0.08, 0.52, 9.6, 0.53, tz, salmon);
  }

  // 6. Locker Room (x = -20..8, z = 4..14): 4 Bench Seats, Vanity Mirror Sinks & 4 Rain Shower Stalls
  for (let i = 0; i < 4; i += 1) {
    const bx = -15 + i * 6;
    pushBox(parts, 2.6, 0.44, 0.48, bx, 0.22, 11.2, warmWood);
  }
  pushBox(parts, 7.6, 0.88, 0.68, -6.0, 0.44, 15.1, '#334155');
  pushBox(parts, 7.7, 0.07, 0.72, -6.0, 0.91, 15.1, '#f8fafc');
  pushBox(parts, 7.4, 1.25, 0.08, -6.0, 1.72, 15.52, '#bae6fd');
  pushBox(parts, 7.5, 0.08, 0.1, -6.0, 2.38, 15.52, salmon);
  for (const sx of [-8.6, -6.9, -5.1, -3.4]) {
    pushCylinder(parts, 0.22, 0.18, 0.14, sx, 0.98, 15.05, '#e2e8f0', 10);
  }
  for (let s = 0; s < 4; s += 1) {
    const sz = 5.6 + s * 2.0;
    pushBox(parts, 1.25, 2.15, 0.06, -20.6, 1.08, sz - 0.95, '#94a3b8');
    pushBox(parts, 0.06, 2.15, 1.6, -19.95, 1.08, sz, '#7dd3fc');
    pushCylinder(parts, 0.14, 0.14, 0.04, -20.8, 2.05, sz, chrome, 8);
  }
}

function buildL1Details(parts: ColoredPart[]): void {
  const salmon = '#f07654';
  const warmWood = '#9c6644';
  const darkSteel = '#1b202b';
  const midSteel = '#333c4d';
  const chrome = '#cbd5e1';

  // 1. Lobby (x = -6..10, z = 6..15): Reception Brand Backdrop Wall behind desk (x = 2.0, z = 7.4)
  pushBox(parts, 6.4, 2.85, 0.18, 2.0, 1.52, 7.4, darkSteel);
  pushBox(parts, 6.6, 0.12, 0.24, 2.0, 2.98, 7.4, salmon);
  for (let sx = -0.9; sx <= 4.9; sx += 0.35) {
    if (sx > 0.3 && sx < 3.7) continue;
    pushBox(parts, 0.12, 2.65, 0.22, sx, 1.5, 7.42, warmWood);
  }
  pushBox(parts, 2.6, 0.95, 0.24, 2.0, 1.75, 7.45, salmon);
  pushBox(parts, 2.2, 0.65, 0.26, 2.0, 1.75, 7.48, '#fff8f3');

  // Lobby Waiting Lounge Sofas & Marble Coffee Tables (x = 7.6, z = 12.8 and x = -3.4, z = 13.6)
  for (const [lx, lz] of [
    [7.6, 12.8],
    [-3.4, 13.6],
  ] as const) {
    pushBox(parts, 2.5, 0.02, 2.2, lx, 0.02, lz, '#2b3240');
    pushBox(parts, 2.0, 0.42, 0.82, lx, 0.21, lz + 0.55, '#3b4354');
    pushBox(parts, 2.0, 0.46, 0.22, lx, 0.56, lz + 0.85, '#282f3d');
    pushBox(parts, 0.4, 0.18, 0.3, lx - 0.6, 0.48, lz + 0.5, salmon);
    pushBox(parts, 0.4, 0.18, 0.3, lx + 0.6, 0.48, lz + 0.5, salmon);
    pushBox(parts, 1.1, 0.34, 0.6, lx, 0.17, lz - 0.35, '#e2e8f0');
  }

  // 2. QR Turnstile Gate Portal Arch & Glass Barriers (x = 0, z = 4.0)
  pushBox(parts, 7.6, 0.22, 0.45, 0.0, 2.85, 4.0, darkSteel);
  pushBox(parts, 7.8, 0.08, 0.52, 0.0, 2.98, 4.0, salmon);
  pushBox(parts, 1.6, 1.0, 0.08, -4.4, 0.5, 4.0, '#7dd3fc');
  pushBox(parts, 1.6, 1.0, 0.08, 4.4, 0.5, 4.0, '#7dd3fc');

  // 3. Supplement Shop (x = 10..20, z = 6..15): Activewear Apparel Rack, RTD Fridge & POS Island
  pushBox(parts, 0.65, 1.65, 2.8, 20.6, 0.82, 9.6, midSteel);
  const shirtColors = [salmon, '#f8fafc', '#1e293b', '#38bdf8', '#10b981', '#f59e0b'];
  for (let s = 0; s < 6; s += 1) {
    pushBox(parts, 0.48, 0.85, 0.28, 20.6, 1.05, 8.5 + s * 0.42, shirtColors[s]!);
  }
  // Illuminated RTD Cooler Fridge (x = 20.6, z = 13.4)
  pushBox(parts, 0.78, 2.15, 1.85, 20.6, 1.08, 13.4, darkSteel);
  pushBox(parts, 0.82, 1.75, 1.65, 20.56, 1.12, 13.4, '#38bdf8');
  for (let shelf = 0; shelf < 4; shelf += 1) {
    pushBox(parts, 0.84, 0.08, 1.55, 20.54, 0.55 + shelf * 0.38, 13.4, salmon);
  }
  // Shop Glass Showcase Island (x = 11.8, z = 12.6)
  pushBox(parts, 1.8, 0.95, 0.82, 11.8, 0.48, 12.6, warmWood);
  pushBox(parts, 1.84, 0.28, 0.86, 11.8, 1.08, 12.6, '#bae6fd');

  // 4. Standard Gym Arena (x = -20..4, z = -14..2):
  // Backlit Wall Mirrors along West wall (x = -21.82, z = -12..-1)
  for (const mz of [-11.5, -6.5, -1.5]) {
    pushBox(parts, 0.08, 2.45, 4.2, -21.82, 1.45, mz, '#94a3b8');
    pushBox(parts, 0.1, 0.08, 4.3, -21.8, 2.7, mz, salmon);
  }

  // 5 Oak & Rubber Olympic Lifting Platforms under Smith Machines & Squat Racks (z = -4.8)
  for (const px of [-17.5, -13.0, -8.5, -4.5, -1.0]) {
    pushBox(parts, 2.5, 0.04, 2.1, px, 0.02, -4.8, '#171b24');
    pushBox(parts, 1.05, 0.045, 2.1, px, 0.024, -4.8, warmWood);
  }

  // 4 Olympic Weight Plate Storage Trees between racks (z = -4.8)
  for (const tx of [-15.2, -10.8, -6.5, -2.8]) {
    pushCylinder(parts, 0.06, 0.08, 1.25, tx, 0.62, -4.8, darkSteel, 8);
    pushBox(parts, 0.62, 0.06, 0.62, tx, 0.04, -4.8, midSteel);
    pushCylinder(parts, 0.2, 0.2, 0.14, tx, 0.45, -4.8, salmon, 8);
    pushCylinder(parts, 0.16, 0.16, 0.14, tx, 0.85, -4.8, '#38bdf8', 8);
  }

  // Dual-Stack Cable Crossover Functional Tower & Kettlebell Rack at East Gym (x = 2.4, z = -8.5 & -4.8)
  pushBox(parts, 0.45, 2.35, 0.55, 2.4, 1.18, -10.0, darkSteel);
  pushBox(parts, 0.45, 2.35, 0.55, 2.4, 1.18, -7.0, darkSteel);
  pushBox(parts, 0.35, 0.18, 3.3, 2.4, 2.3, -8.5, salmon);
  pushBox(parts, 0.65, 1.05, 1.8, 2.5, 0.52, -4.8, midSteel);

  // 21m Functional Green Sprint Turf Track along South edge of Gym (x = -18.5..+2.5, z = 0.85)
  pushBox(parts, 21.0, 0.025, 1.45, -8.0, 0.015, 0.85, '#15803d');
  for (let tx = -17.5; tx <= 1.5; tx += 2.0) {
    pushBox(parts, 0.08, 0.03, 1.15, tx, 0.02, 0.85, '#f8fafc');
  }
  // Weighted Prowler Push Sled on turf track (x = -16.8, z = 0.85)
  pushBox(parts, 1.1, 0.08, 0.82, -16.8, 0.06, 0.85, darkSteel);
  pushCylinder(parts, 0.035, 0.035, 0.92, -16.3, 0.52, 0.55, salmon, 6);
  pushCylinder(parts, 0.035, 0.035, 0.92, -16.3, 0.52, 1.15, salmon, 6);
  pushCylinder(parts, 0.2, 0.2, 0.16, -16.8, 0.22, 0.85, chrome, 8);

  // 5. Boxing Zone (x = 4..20, z = -14..-4): Digital Round Scoreboard, Glove Rack & Plyo Boxes
  pushBox(parts, 2.8, 1.05, 0.14, 10.5, 2.45, -15.65, darkSteel);
  pushBox(parts, 2.6, 0.85, 0.16, 10.5, 2.45, -15.62, '#ef4444');
  pushBox(parts, 2.4, 1.65, 0.42, 16.5, 0.85, -15.4, midSteel);
  for (let g = 0; g < 4; g += 1) {
    pushBox(
      parts,
      0.28,
      0.28,
      0.28,
      15.7 + g * 0.52,
      1.25,
      -15.3,
      g % 2 === 0 ? '#ef4444' : '#f59e0b',
    );
    pushBox(parts, 0.28, 0.28, 0.28, 15.7 + g * 0.52, 0.75, -15.3, '#38bdf8');
  }
  // 3 Plyometric Jump Boxes at (x = 5.8..7.8, z = -4.8)
  pushBox(parts, 0.62, 0.48, 0.62, 5.8, 0.24, -4.8, warmWood);
  pushBox(parts, 0.62, 0.62, 0.62, 6.7, 0.31, -4.8, salmon);
  pushBox(parts, 0.62, 0.76, 0.62, 7.6, 0.38, -4.8, darkSteel);

  // 6. Badminton Hall (x = -20..-6, z = 2..15): 4 Courts at (-16.5, 5.5), (-9.8, 5.5), (-16.5, 11.6), (-9.8, 11.6)
  // 3D Nets, Top White Tapes & Net Posts for all 4 Badminton Courts
  for (const cx of [-16.5, -9.8]) {
    for (const cz of [5.5, 11.6]) {
      pushCylinder(parts, 0.03, 0.03, 1.55, cx - 2.65, 0.78, cz, darkSteel, 8);
      pushCylinder(parts, 0.03, 0.03, 1.55, cx + 2.65, 0.78, cz, darkSteel, 8);
      pushBox(parts, 5.3, 0.72, 0.025, cx, 1.14, cz, '#334155');
      pushBox(parts, 5.34, 0.05, 0.035, cx, 1.52, cz, '#f8fafc');
    }
  }
  // Umpire Chairs & Player Benches along center spine (x = -13.15)
  for (const cz of [5.5, 11.6]) {
    pushBox(parts, 0.55, 1.55, 0.55, -13.15, 0.78, cz - 0.8, darkSteel);
    pushBox(parts, 0.52, 0.1, 0.5, -13.15, 1.6, cz - 0.8, salmon);
    pushBox(parts, 0.46, 0.44, 1.65, -13.15, 0.22, cz + 1.0, warmWood);
    pushBox(parts, 0.36, 0.3, 0.52, -13.15, 0.56, cz + 0.8, salmon);
  }
  // 7. Exterior Facade Structural Columns on L1 (0..4.5m local height)
  for (const cx of [-21.8, -11.0, 0.0, 11.0, 21.8]) {
    pushBox(parts, 0.45, 4.5, 0.45, cx, 2.25, -16.15, darkSteel);
  }
  for (const cz of [-15.8, -5.0, 5.0, 15.8]) {
    pushBox(parts, 0.45, 4.5, 0.45, -22.15, 2.25, cz, darkSteel);
    pushBox(parts, 0.45, 4.5, 0.45, 22.15, 2.25, cz, darkSteel);
  }
  for (const cx of [-21.8, -12.0, -5.2, 8.8, 15.5, 21.8]) {
    pushBox(parts, 0.48, 4.5, 0.48, cx, 2.25, 16.15, darkSteel);
  }
}

function buildL2Details(parts: ColoredPart[]): void {
  const salmon = '#f07654';
  const warmWood = '#9c6644';
  const darkSteel = '#1b202b';
  const gold = '#f59e0b';
  const chrome = '#cbd5e1';

  // 1. VIP Gym (x = -20..6, z = -14..6): Smoked-Gold Mirrors, 2 VIP Lifting Platforms, Stretching Sanctuary
  for (const mz of [-10.5, -4.5, 1.5]) {
    pushBox(parts, 0.08, 2.45, 4.4, -21.82, 1.45, mz, '#cbd5e1');
    pushBox(parts, 0.1, 0.08, 4.5, -21.8, 2.7, mz, gold);
  }
  for (const px of [-16.0, -10.0]) {
    pushBox(parts, 2.8, 0.06, 2.2, px, 0.03, 1.5, darkSteel);
    pushBox(parts, 1.15, 0.065, 2.2, px, 0.033, 1.5, warmWood);
    pushCylinder(parts, 0.025, 0.025, 2.2, px, 0.26, 1.5, chrome, 8, 0, 0, Math.PI / 2);
    for (const side of [-0.82, -0.74, 0.74, 0.82]) {
      pushCylinder(
        parts,
        0.22,
        0.22,
        0.06,
        px + side,
        0.26,
        1.5,
        Math.abs(side) > 0.78 ? gold : darkSteel,
        10,
        0,
        0,
        Math.PI / 2,
      );
    }
  }
  // VIP Stretching & Mobility Mat Sanctuary with Foam Rollers at (x = -4.5..+0.5, z = 1.5)
  for (const mx of [-4.5, -2.5, -0.5]) {
    pushBox(parts, 1.1, 0.04, 2.1, mx, 0.02, 1.5, '#334155');
    pushCylinder(parts, 0.09, 0.09, 0.75, mx, 0.12, 0.7, salmon, 8, 0, 0, Math.PI / 2);
  }

  // 2. InBody 770 Suite (x = 6..20, z = -14..-2): 65" Diagnostic Screen & Posture Calibration Grid
  pushBox(parts, 2.8, 1.45, 0.1, 13.5, 1.85, -15.65, darkSteel);
  pushBox(parts, 2.6, 1.25, 0.12, 13.5, 1.85, -15.62, '#38bdf8');
  pushBox(parts, 1.8, 2.25, 0.06, 9.5, 1.25, -15.65, '#e2e8f0');

  // 3. 1:1 PT Studio (x = 6..20, z = -2..14): 12.5m Emerald Sprint Turf Track, Prowler Sled & TRX Rig
  pushBox(parts, 2.1, 0.025, 12.5, 18.4, 0.015, 6.0, '#059669');
  for (let tz = 0.5; tz <= 11.5; tz += 2.2) {
    pushBox(parts, 1.65, 0.03, 0.08, 18.4, 0.02, tz, '#f8fafc');
  }
  pushBox(parts, 0.85, 0.08, 1.1, 18.4, 0.06, 1.2, salmon);
  pushBox(parts, 0.12, 2.45, 3.6, 21.65, 1.25, 6.0, darkSteel);
  pushBox(parts, 0.16, 0.1, 3.7, 21.62, 2.42, 6.0, gold);

  // 4. Platinum Lounge (x = -20..6, z = 6..14): Sofas are at x = -15.5, -9.0, -2.5, z = 10.2; Juice Bar at [2.0, 10.2]
  for (const lx of [-15.5, -9.0, -2.5]) {
    pushBox(parts, 3.2, 0.02, 2.8, lx, 0.015, 10.8, '#272224');
    pushBox(parts, 1.35, 0.36, 0.78, lx, 0.18, 12.0, '#f8fafc');
    pushBox(parts, 1.25, 0.04, 0.68, lx, 0.37, 12.0, gold);
  }
  // 4 High Bar Stools in front of the Platinum Juice Bar (x = 0.5..3.5, z = 8.9)
  for (let s = 0; s < 4; s += 1) {
    const sx = 0.5 + s * 1.0;
    pushCylinder(parts, 0.22, 0.26, 0.06, sx, 0.03, 8.9, gold, 8);
    pushCylinder(parts, 0.04, 0.04, 0.72, sx, 0.38, 8.9, gold, 8);
    pushCylinder(parts, 0.22, 0.22, 0.1, sx, 0.76, 8.9, salmon, 10);
  }
  // Back-Bar Illuminated Bottle/Protein Display & Espresso Machine at (x = 2.0, z = 12.2)
  pushBox(parts, 4.2, 2.35, 0.52, 2.0, 1.18, 12.3, darkSteel);
  pushBox(parts, 3.9, 0.1, 0.56, 2.0, 1.65, 12.3, gold);
  pushBox(parts, 3.9, 0.1, 0.56, 2.0, 2.15, 12.3, salmon);
  pushBox(parts, 0.95, 0.48, 0.46, 2.0, 1.35, 10.2, chrome);

  // 5. Exterior Facade Structural Columns & Brise-Soleil Sun Fins on L2 (0..4.5m local height)
  for (const cx of [-21.8, -11.0, 0.0, 11.0, 21.8]) {
    pushBox(parts, 0.45, 4.5, 0.45, cx, 2.25, -16.15, darkSteel);
  }
  for (const cz of [-15.8, -5.0, 5.0, 15.8]) {
    pushBox(parts, 0.45, 4.5, 0.45, -22.15, 2.25, cz, darkSteel);
    pushBox(parts, 0.45, 4.5, 0.45, 22.15, 2.25, cz, darkSteel);
  }
  for (const cx of [-21.8, -12.0, -5.2, 8.8, 15.5, 21.8]) {
    pushBox(parts, 0.48, 4.5, 0.48, cx, 2.25, 16.15, darkSteel);
  }
  for (let fx = -20.0; fx <= 20.0; fx += 2.0) {
    if (fx > -5.5 && fx < 8.5) continue;
    pushBox(parts, 0.08, 4.2, 0.34, fx, 2.25, 16.18, warmWood);
  }
  for (let fz = -14.0; fz <= 14.0; fz += 2.0) {
    pushBox(parts, 0.34, 4.2, 0.08, 22.18, 2.25, fz, warmWood);
    pushBox(parts, 0.34, 4.2, 0.08, -22.18, 2.25, fz, warmWood);
  }
}

function buildRFDetails(parts: ColoredPart[]): void {
  const salmon = '#f07654';
  const warmWood = '#9c6644';
  const darkSteel = '#1f2531';
  const gold = '#f59e0b';

  // 1. Zen Yoga Studio (x = -16..10, z = -12..8): Instructor Stage & Sacred Brass Gong at (x = -3.5, z = -10.5)
  pushBox(parts, 5.6, 0.22, 2.0, -3.5, 0.11, -10.5, warmWood);
  pushBox(parts, 5.7, 0.05, 2.1, -3.5, 0.23, -10.5, salmon);
  pushCylinder(parts, 0.05, 0.05, 1.65, -5.3, 1.05, -10.8, warmWood, 8);
  pushCylinder(parts, 0.05, 0.05, 1.65, -3.9, 1.05, -10.8, warmWood, 8);
  pushBox(parts, 1.65, 0.08, 0.08, -4.6, 1.85, -10.8, warmWood);
  pushCylinder(parts, 0.52, 0.52, 0.06, -4.6, 1.15, -10.8, gold, 14, Math.PI / 2, 0, 0);
  pushBox(parts, 1.8, 0.03, 0.72, -2.5, 0.25, -10.3, salmon);
  pushCylinder(parts, 0.14, 0.1, 0.12, -1.3, 0.28, -10.5, gold, 8);

  // 2. Bamboo & White River-Stone Indoor Zen Garden along West Yoga Wall (x = -15.1, z = -9..+6)
  pushBox(parts, 0.95, 0.24, 15.2, -15.1, 0.12, -1.5, '#475569');
  pushBox(parts, 0.78, 0.26, 14.8, -15.1, 0.14, -1.5, '#e2e8f0');
  for (let bz = -8.2; bz <= 5.2; bz += 1.6) {
    pushCylinder(parts, 0.05, 0.06, 2.45, -15.1, 1.35, bz, '#4d7c0f', 7);
    pushCylinder(parts, 0.28, 0.35, 0.65, -15.1, 2.25, bz, '#65a30d', 7);
  }

  // 3. Matcha & Herbal Tea Ceremony Low Table at South-East Yoga Corner (x = 7.2, z = 5.4)
  pushBox(parts, 2.6, 0.03, 1.8, 7.2, 0.02, 5.4, '#d6cfc4');
  pushBox(parts, 1.55, 0.32, 0.82, 7.2, 0.16, 5.4, warmWood);
  for (const [cx, cz] of [
    [6.1, 5.4],
    [8.3, 5.4],
    [7.2, 4.6],
    [7.2, 6.2],
  ] as const) {
    pushCylinder(parts, 0.26, 0.26, 0.1, cx, 0.05, cz, salmon, 10);
  }

  // 4. Rooftop Terrace (x = 10..20, z = -14..14): Open-Air Cedar Pergola Canopy (x = 11.2..19.2, z = -6.0..+6.0)
  for (const px of [11.4, 19.0]) {
    for (const pz of [-5.8, 0.0, 5.8]) {
      pushBox(parts, 0.22, 2.95, 0.22, px, 1.48, pz, darkSteel);
    }
    pushBox(parts, 0.24, 0.2, 12.2, px, 2.95, 0.0, darkSteel);
  }
  for (let rz = -5.6; rz <= 5.6; rz += 1.0) {
    pushBox(parts, 8.2, 0.14, 0.12, 15.2, 3.08, rz, warmWood);
  }

  // 5. Tranquil Rooftop Koi Reflection Pond with Stepping Stones (x = 15.0, z = -5.2)
  pushBox(parts, 4.2, 0.28, 3.0, 15.0, 0.14, -5.2, '#334155');
  pushBox(parts, 3.8, 0.26, 2.6, 15.0, 0.16, -5.2, '#0ea5e9');
  for (const sx of [13.9, 15.0, 16.1]) {
    pushBox(parts, 0.65, 0.3, 0.65, sx, 0.16, -5.2, '#cbd5e1');
  }

  // 6. Outdoor Fire-Bowl Conversation Pit at South-East Sky Deck (x = 15.0, z = 4.6)
  pushCylinder(parts, 0.68, 0.45, 0.42, 15.0, 0.21, 4.6, darkSteel, 12);
  pushCylinder(parts, 0.48, 0.32, 0.28, 15.0, 0.46, 4.6, salmon, 10);
  pushCylinder(parts, 0.24, 0.35, 0.32, 15.0, 0.62, 4.6, gold, 8);

  // 7. Rooftop Crown Sky-Sign Frames ("SÖL FITNESS & WELLNESS" South & "SÖL CENTER" East) in RF local coords
  // South Sky-Sign Frame at x = 1.5, y = 2.12 (world y = 11.12), z = 16.02
  pushBox(parts, 18.8, 1.96, 0.42, 1.5, 2.12, 16.02, darkSteel);
  pushBox(parts, 19.1, 0.12, 0.54, 1.5, 3.14, 16.04, salmon);
  pushBox(parts, 19.1, 0.12, 0.54, 1.5, 1.1, 16.04, salmon);
  for (const sx of [-6.8, -2.5, 1.5, 5.5, 9.8]) {
    pushBox(parts, 0.26, 1.45, 0.26, sx, 0.72, 15.85, '#313949');
    pushBox(parts, 0.75, 0.1, 0.35, sx, 3.22, 16.3, '#fef08a');
  }
  // East Sky-Sign Frame at x = 22.02, y = 2.12 (world y = 11.12), z = -0.5
  pushBox(parts, 0.42, 1.82, 14.4, 22.02, 2.12, -0.5, darkSteel);
  pushBox(parts, 0.54, 0.12, 14.7, 22.04, 3.06, -0.5, salmon);
  pushBox(parts, 0.54, 0.12, 14.7, 22.04, 1.18, -0.5, salmon);
  for (const sz of [-6.2, -2.2, 1.8, 5.2]) {
    pushBox(parts, 0.26, 1.45, 0.26, 21.85, 0.72, sz, '#313949');
    pushBox(parts, 0.35, 0.1, 0.75, 22.3, 3.12, sz, '#fef08a');
  }
}

function buildOUTDetails(parts: ColoredPart[]): void {
  const salmon = '#f07654';
  const darkSteel = '#1b202b';
  const midSteel = '#333c4d';
  const warmWood = '#9c6644';

  // Tennis Court 01 is at [29.5, 0] and Court 02 is at [39.8, 0] inside [24..45, -15..15]
  // 0. 3D Tennis Nets, White Top Tapes, Center Straps & Net Posts for Courts 01 & 02
  for (const cx of [29.5, 39.8]) {
    pushCylinder(parts, 0.045, 0.045, 1.07, cx - 4.65, 0.54, 0, darkSteel, 8);
    pushCylinder(parts, 0.045, 0.045, 1.07, cx + 4.65, 0.54, 0, darkSteel, 8);
    pushBox(parts, 9.3, 0.92, 0.03, cx, 0.54, 0, '#1e293b');
    pushBox(parts, 9.34, 0.06, 0.04, cx, 1.02, 0, '#f8fafc');
    pushBox(parts, 0.06, 0.96, 0.045, cx, 0.54, 0, '#f8fafc');
  }

  // 1. 4 Tall Stadium Floodlight Towers around the Outdoor Tennis Arena
  const towers: ReadonlyArray<readonly [number, number, number, number]> = [
    [24.2, -14.8, 0.45, 9.0],
    [44.8, -14.8, -0.45, 9.0],
    [24.2, 14.8, 0.45, 9.0],
    [24.2, 0.0, 0.45, 9.0],
  ];
  for (const [tx, tz, tiltZ, h] of towers) {
    pushBox(parts, 0.72, 0.5, 0.72, tx, 0.25, tz, '#475569');
    pushCylinder(parts, 0.12, 0.21, h, tx, h * 0.5 + 0.1, tz, darkSteel, 8);
    pushBox(parts, 0.34, 0.42, 2.1, tx, h + 0.05, tz, midSteel);
    pushBox(parts, 0.22, 0.54, 2.0, tx, h + 0.05, tz, '#fef08a', 0, 0, tiltZ);
    pushBox(parts, 0.4, 0.11, 2.2, tx, h + 0.34, tz, salmon);
  }

  // 2. 2 Three-Tier Spectator Bleacher Grandstands along East Sideline (x = 44.8, z = -6.2 and z = 6.2)
  for (const bz of [-6.2, 6.2]) {
    pushBox(parts, 1.35, 0.14, 7.2, 44.8, 0.08, bz, darkSteel);
    pushBox(parts, 0.42, 0.42, 7.0, 44.35, 0.21, bz, '#cbd5e1');
    pushBox(parts, 0.42, 0.78, 7.0, 44.78, 0.39, bz, salmon);
    pushBox(parts, 0.42, 1.14, 7.0, 45.2, 0.57, bz, '#cbd5e1');
  }

  // 3. Center Spine between Court 01 & Court 02 (x = 34.65): 2 Umpire Chairs, 4 Covered Team Benches & 2 Ball Carts
  for (const uz of [-1.2, 1.2]) {
    pushBox(parts, 0.58, 1.65, 0.58, 34.65, 0.82, uz, darkSteel);
    pushBox(parts, 0.54, 0.1, 0.52, 34.65, 1.68, uz, salmon);
  }
  for (const pz of [-6.8, -3.6, 3.6, 6.8]) {
    pushBox(parts, 0.62, 0.45, 2.0, 34.65, 0.22, pz, warmWood);
    pushBox(parts, 1.05, 0.12, 2.2, 34.65, 1.95, pz, salmon);
    pushBox(parts, 0.1, 1.9, 0.1, 34.65, 0.96, pz - 0.9, darkSteel);
    pushBox(parts, 0.1, 1.9, 0.1, 34.65, 0.96, pz + 0.9, darkSteel);
    pushCylinder(parts, 0.18, 0.18, 0.52, 34.65, 0.26, pz + 1.25, '#38bdf8', 8);
  }
  for (const cz of [-9.5, 9.5]) {
    pushBox(parts, 0.46, 0.82, 0.46, 34.65, 0.41, cz, darkSteel);
    pushBox(parts, 0.42, 0.26, 0.42, 34.65, 0.72, cz, '#bef264');
  }

  // 4. Electronic Stadium Match Scoreboard at North Arena End (x = 34.65, z = -14.8)
  pushBox(parts, 4.8, 1.65, 0.24, 34.65, 3.15, -14.8, darkSteel);
  pushBox(parts, 4.5, 1.35, 0.26, 34.65, 3.15, -14.78, '#10b981');
  pushBox(parts, 4.95, 0.14, 0.32, 34.65, 4.02, -14.8, salmon);
  pushBox(parts, 0.2, 3.1, 0.2, 32.7, 1.55, -14.8, midSteel);
  pushBox(parts, 0.2, 3.1, 0.2, 36.6, 1.55, -14.8, midSteel);
}

/**
 * Builds all non-interactive architectural furnishings, mirrors, platforms, scoreboards,
 * poolside loungers, pergolas, and floodlight towers for a given level as a single
 * vertex-colored BufferGeometry (1 draw call per level).
 */
export function buildLevelInteriorDetailsGeometry(levelCode: LevelCode): THREE.BufferGeometry {
  const parts: ColoredPart[] = [];
  const trimColor = '#ce9180';
  if (levelCode === 'OUT') {
    pushBox(parts, 21.06, 0.06, 0.06, 34.5, -0.015, -15.0, trimColor);
    pushBox(parts, 21.06, 0.06, 0.06, 34.5, -0.015, 15.0, trimColor);
    pushBox(parts, 0.06, 0.06, 30.06, 24.0, -0.015, 0.0, trimColor);
    pushBox(parts, 0.06, 0.06, 30.06, 45.0, -0.015, 0.0, trimColor);
  } else {
    pushBox(parts, 44.06, 0.06, 0.06, 0.0, -0.015, -16.0, trimColor);
    pushBox(parts, 44.06, 0.06, 0.06, 0.0, -0.015, 16.0, trimColor);
    pushBox(parts, 0.06, 0.06, 32.06, -22.0, -0.015, 0.0, trimColor);
    pushBox(parts, 0.06, 0.06, 32.06, 22.0, -0.015, 0.0, trimColor);
  }
  switch (levelCode) {
    case 'B1':
      buildB1Details(parts);
      break;
    case 'L1':
      buildL1Details(parts);
      break;
    case 'L2':
      buildL2Details(parts);
      break;
    case 'RF':
      buildRFDetails(parts);
      break;
    case 'OUT':
      buildOUTDetails(parts);
      break;
  }
  return mergeColoredParts(parts);
}
