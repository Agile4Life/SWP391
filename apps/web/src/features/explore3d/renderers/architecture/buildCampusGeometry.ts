import * as THREE from 'three';

import type { ExploreTheme } from '../materials';

export interface CampusBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const CAMPUS_BOUNDS: CampusBounds = {
  minX: -40,
  maxX: 52,
  minZ: -20,
  maxZ: 30,
};

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

/**
 * Helper to add a detailed 3D car (sedan / SUV / sports coupe / EV) at (cx, y=0, cz)
 * rotated by `ry` radians (ry=0 means car faces +Z, ry=Math.PI faces -Z, ry=Math.PI/2 faces +X).
 */
function addCar3D(
  parts: ColoredPart[],
  cx: number,
  cz: number,
  ry: number,
  bodyColor: string,
  variant: 'sedan' | 'suv' | 'coupe' = 'sedan',
): void {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const tx = (lx: number, lz: number) => cx + lx * cos + lz * sin;
  const tz = (lx: number, lz: number) => cz - lx * sin + lz * cos;

  const width = variant === 'suv' ? 1.92 : variant === 'coupe' ? 1.88 : 1.82;
  const length = variant === 'suv' ? 4.45 : variant === 'coupe' ? 4.25 : 4.35;
  const chassisH = variant === 'suv' ? 0.56 : variant === 'coupe' ? 0.44 : 0.48;
  const cabinH = variant === 'suv' ? 0.52 : variant === 'coupe' ? 0.38 : 0.44;
  const cabinL = variant === 'suv' ? 2.55 : variant === 'coupe' ? 1.85 : 2.15;
  const cabinOffsetZ = variant === 'suv' ? -0.22 : variant === 'coupe' ? -0.15 : -0.12;

  pushBox(parts, width * 0.94, 0.06, length * 0.92, cx, 0.08, cz, '#0d1016', 0, ry, 0);
  pushBox(parts, width, chassisH, length, cx, 0.24 + chassisH * 0.5, cz, bodyColor, 0, ry, 0);
  pushBox(
    parts,
    width * 0.96,
    0.14,
    0.16,
    tx(0, length * 0.5),
    0.26,
    tz(0, length * 0.5),
    '#1c222d',
    0,
    ry,
    0,
  );
  pushBox(
    parts,
    width * 0.96,
    0.16,
    0.16,
    tx(0, -length * 0.5),
    0.27,
    tz(0, -length * 0.5),
    '#181d26',
    0,
    ry,
    0,
  );

  const cabinY = 0.24 + chassisH + cabinH * 0.48;
  pushBox(
    parts,
    width * 0.84,
    cabinH,
    cabinL,
    tx(0, cabinOffsetZ),
    cabinY,
    tz(0, cabinOffsetZ),
    '#1b2536',
    0,
    ry,
    0,
  );
  pushBox(
    parts,
    width * 0.78,
    0.07,
    cabinL * 0.82,
    tx(0, cabinOffsetZ),
    cabinY + cabinH * 0.5,
    tz(0, cabinOffsetZ),
    bodyColor,
    0,
    ry,
    0,
  );

  for (const side of [-1, 1]) {
    pushBox(
      parts,
      0.34,
      0.1,
      0.08,
      tx(side * (width * 0.34), length * 0.5 + 0.02),
      0.34 + chassisH * 0.35,
      tz(side * (width * 0.34), length * 0.5 + 0.02),
      '#fef3c7',
      0,
      ry,
      0,
    );
    pushBox(
      parts,
      0.38,
      0.09,
      0.08,
      tx(side * (width * 0.33), -length * 0.5 - 0.02),
      0.36 + chassisH * 0.38,
      tz(side * (width * 0.33), -length * 0.5 - 0.02),
      '#ef4444',
      0,
      ry,
      0,
    );
  }

  pushBox(
    parts,
    width * 0.42,
    0.18,
    0.07,
    tx(0, length * 0.5 + 0.02),
    0.32 + chassisH * 0.2,
    tz(0, length * 0.5 + 0.02),
    '#11151d',
    0,
    ry,
    0,
  );

  const wheelX = width * 0.48;
  const wheelZ = length * 0.31;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushBox(
        parts,
        0.24,
        0.52,
        0.52,
        tx(sx * wheelX, sz * wheelZ),
        0.26,
        tz(sx * wheelX, sz * wheelZ),
        '#12151c',
        0,
        ry,
        0,
      );
      pushBox(
        parts,
        0.26,
        0.3,
        0.3,
        tx(sx * wheelX, sz * wheelZ),
        0.26,
        tz(sx * wheelX, sz * wheelZ),
        '#9ca3af',
        0,
        ry,
        0,
      );
    }
  }
}

/**
 * Helper to add a detailed 3D scooter / motorbike at (mx, y=0, mz) rotated by `ry`.
 */
function addMotorbike3D(
  parts: ColoredPart[],
  mx: number,
  mz: number,
  ry: number,
  bodyColor: string,
): void {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const tx = (lx: number, lz: number) => mx + lx * cos + lz * sin;
  const tz = (lx: number, lz: number) => mz - lx * sin + lz * cos;

  pushBox(parts, 0.14, 0.42, 0.42, tx(0, -0.56), 0.21, tz(0, -0.56), '#141820', 0, ry, 0);
  pushBox(parts, 0.14, 0.42, 0.42, tx(0, 0.58), 0.21, tz(0, 0.58), '#141820', 0, ry, 0);
  pushBox(parts, 0.42, 0.36, 1.18, tx(0, -0.1), 0.42, tz(0, -0.1), bodyColor, 0, ry, 0);
  pushBox(parts, 0.38, 0.14, 0.72, tx(0, -0.22), 0.66, tz(0, -0.22), '#1e222b', 0, ry, 0);
  pushBox(parts, 0.4, 0.68, 0.24, tx(0, 0.42), 0.58, tz(0, 0.42), bodyColor, -0.2, ry, 0);
  pushBox(parts, 0.68, 0.08, 0.1, tx(0, 0.38), 0.95, tz(0, 0.38), '#cbd5e1', 0, ry, 0);
  pushBox(parts, 0.2, 0.14, 0.14, tx(0, 0.46), 0.96, tz(0, 0.46), '#fef3c7', 0, ry, 0);
  pushBox(parts, 0.18, 0.1, 0.08, tx(0, -0.7), 0.58, tz(0, -0.7), '#ef4444', 0, ry, 0);
}

function addCampusTree(
  parts: ColoredPart[],
  x: number,
  z: number,
  scale = 1,
  withPlanter = true,
): void {
  if (withPlanter) {
    pushBox(parts, 1.9 * scale, 0.34, 1.9 * scale, x, 0.17, z, '#363d4a');
    pushBox(parts, 1.55 * scale, 0.38, 1.55 * scale, x, 0.19, z, '#2b4230');
  }
  const trunkH = 2.1 * scale;
  pushCylinder(parts, 0.14 * scale, 0.21 * scale, trunkH, x, trunkH * 0.5, z, '#5c4028', 8);
  pushCylinder(
    parts,
    1.15 * scale,
    1.35 * scale,
    1.4 * scale,
    x,
    trunkH + 0.55 * scale,
    z,
    '#2d5a3c',
    9,
  );
  pushCylinder(
    parts,
    0.85 * scale,
    1.1 * scale,
    1.25 * scale,
    x + 0.12 * scale,
    trunkH + 1.45 * scale,
    z - 0.1 * scale,
    '#3b724c',
    9,
  );
  pushCylinder(
    parts,
    0.42 * scale,
    0.78 * scale,
    0.95 * scale,
    x - 0.08 * scale,
    trunkH + 2.2 * scale,
    z + 0.08 * scale,
    '#4d8a5e',
    8,
  );
}

function addStreetLamp(
  parts: ColoredPart[],
  x: number,
  z: number,
  armDirX: number,
  armDirZ: number,
  height = 5.2,
): void {
  pushCylinder(parts, 0.16, 0.22, 0.36, x, 0.18, z, '#2c3340', 8);
  pushCylinder(parts, 0.07, 0.1, height, x, height * 0.5, z, '#3f4756', 8);
  const armLen = 1.15;
  const ax = x + armDirX * (armLen * 0.5);
  const az = z + armDirZ * (armLen * 0.5);
  const armW = Math.abs(armDirX) > 0.5 ? armLen : 0.12;
  const armD = Math.abs(armDirZ) > 0.5 ? armLen : 0.12;
  pushBox(parts, armW, 0.1, armD, ax, height - 0.05, az, '#4b5563');
  const lx = x + armDirX * (armLen * 0.88);
  const lz = z + armDirZ * (armLen * 0.88);
  pushBox(parts, 0.36, 0.08, 0.36, lx, height - 0.12, lz, '#fde68a');
}

function addBollardLight(parts: ColoredPart[], x: number, z: number): void {
  pushCylinder(parts, 0.09, 0.1, 0.72, x, 0.36, z, '#2b313d', 8);
  pushCylinder(parts, 0.095, 0.095, 0.16, x, 0.8, z, '#f6b399', 8);
  pushCylinder(parts, 0.1, 0.1, 0.06, x, 0.91, z, '#1f242d', 8);
}

/**
 * Builds the entire exterior SÖL Campus 3D world as a single merged vertex-colored BufferGeometry.
 * Positioned so that from the default overview camera ([46, 36, 48] -> [4, 2, 0]),
 * the Main Entrance Gate, Guard Booth, Boom Barriers, Zebra Crosswalk, Monument Sign,
 * Solar Car & EV Parking Court, Covered Motorbike & Bicycle Pavilion, and Reflection Fountain
 * are all 100% visible in the central foreground without being covered by the left LevelSwitcher HUD.
 */
export function buildCampusGeometry(theme: ExploreTheme): THREE.BufferGeometry {
  const parts: ColoredPart[] = [];
  const isLight = theme === 'light';

  const roadColor = isLight ? '#384150' : '#161b24';
  const parkingAsphalt = isLight ? '#434d5e' : '#1b212c';
  const walkwayStone = isLight ? '#d8d2c7' : '#252b37';
  const curbStone = isLight ? '#b8b1a6' : '#3a4252';
  const lineWhite = isLight ? '#f8fafc' : '#cbd5e1';
  const lineAmber = '#f59e0b';
  const salmon = '#f07654';
  const salmonBright = '#ff8b6b';
  const darkSteel = '#1f2531';
  const midSteel = '#333c4d';
  const warmWood = '#8c5838';

  // =========================================================================
  // 1. FRONT BOULEVARD ROAD, CURBS, LANE MARKINGS & ZEBRA CROSSWALK
  // =========================================================================
  pushBox(parts, 92, 0.05, 5.6, 6, 0.01, 26.6, roadColor);
  pushBox(parts, 92, 0.12, 0.28, 6, 0.06, 23.75, curbStone);
  pushBox(parts, 92, 0.12, 0.28, 6, 0.06, 29.45, curbStone);

  // Dashed center lane dividers along the boulevard (gap at Main Gate x = 2..14)
  for (let x = -36; x <= 48; x += 4.2) {
    if (x >= 1.5 && x <= 14.5) continue;
    pushBox(parts, 2.1, 0.06, 0.14, x, 0.04, 26.6, lineAmber);
  }

  // Main Entrance Driveway & Porte-Cochère Drop-Off Loop (x = 1.5..14.0, z = 16.0..24.0)
  pushBox(parts, 12.6, 0.055, 8.2, 7.8, 0.02, 20.1, parkingAsphalt);
  // Central landscaped island separating Entry (East x=10.6) & Exit (West x=5.0) lanes
  pushBox(parts, 1.35, 0.16, 4.6, 7.8, 0.08, 22.1, curbStone);
  pushBox(parts, 0.95, 0.22, 4.1, 7.8, 0.11, 22.1, '#2d5a3c');

  // VIP Pedestrian Promenade connecting Porte-Cochère to L1 Main Lobby doors (x = -1.5..6.5, z = 15.8..20.2)
  pushBox(parts, 8.4, 0.07, 4.4, 2.5, 0.035, 17.8, walkwayStone);
  pushBox(parts, 0.22, 0.08, 4.4, -1.55, 0.042, 17.8, salmon);
  pushBox(parts, 0.22, 0.08, 4.4, 6.55, 0.042, 17.8, salmon);

  // Pedestrian Zebra Crosswalk across the Main Gate throat (x = 3.2..12.4, z = 24.45)
  for (let x = 3.4; x <= 12.2; x += 0.88) {
    pushBox(parts, 0.48, 0.065, 1.85, x, 0.04, 24.45, lineWhite);
  }

  // Directional lane arrows on Entry (+X lane at x=10.5) and Exit (-X lane at x=5.1)
  pushBox(parts, 0.32, 0.065, 1.4, 10.5, 0.04, 22.2, lineWhite);
  pushBox(parts, 0.32, 0.065, 1.4, 5.1, 0.04, 22.2, lineWhite);

  // =========================================================================
  // 2. MAIN ENTRANCE GATE ("CỔNG CHÀO SÖL"), GUARD BOOTH & BOOM BARRIERS
  //    Centered at x = 7.8, z = 23.2 — 100% clear of the left LevelSwitcher HUD!
  // =========================================================================
  const gateX = 7.8;
  const gateZ = 23.2;
  // West (x = 1.9) & East (x = 13.7) monumental stone/charcoal gate piers
  pushBox(parts, 1.35, 4.8, 1.15, gateX - 5.9, 2.4, gateZ, darkSteel);
  pushBox(parts, 1.35, 4.8, 1.15, gateX + 5.9, 2.4, gateZ, darkSteel);
  pushBox(parts, 0.18, 4.2, 1.22, gateX - 5.9, 2.3, gateZ, salmon);
  pushBox(parts, 0.18, 4.2, 1.22, gateX + 5.9, 2.3, gateZ, salmon);
  pushBox(parts, 1.65, 0.42, 1.45, gateX - 5.9, 0.21, gateZ, curbStone);
  pushBox(parts, 1.65, 0.42, 1.45, gateX + 5.9, 0.21, gateZ, curbStone);

  // Overhead Gate Archway Span (spanning x = 1.0 .. 14.6 at y = 4.35 .. 5.25)
  pushBox(parts, 13.8, 0.92, 1.35, gateX, 4.72, gateZ, darkSteel);
  pushBox(parts, 12.2, 0.08, 1.1, gateX, 4.24, gateZ, warmWood);
  pushBox(parts, 14.1, 0.16, 1.5, gateX, 5.24, gateZ, salmon);

  // Security Guard Booth on the central island (x = 7.8, z = 22.0)
  pushBox(parts, 1.18, 2.35, 1.75, gateX, 1.25, 22.0, midSteel);
  pushBox(parts, 1.24, 0.95, 1.45, gateX, 1.58, 22.0, '#38bdf8');
  pushBox(parts, 1.48, 0.18, 2.05, gateX, 2.48, 22.0, darkSteel);
  pushBox(parts, 1.52, 0.07, 2.1, gateX, 2.58, 22.0, salmon);

  // Automated Boom Barrier #1 (West Exit Lane at x = 3.05, z = 22.1 — closed horizontal bar)
  pushBox(parts, 0.38, 1.08, 0.38, gateX - 4.75, 0.56, 22.1, salmon);
  pushBox(parts, 0.42, 0.14, 0.42, gateX - 4.75, 1.12, 22.1, darkSteel);
  for (let seg = 0; seg < 6; seg += 1) {
    pushBox(
      parts,
      0.52,
      0.09,
      0.09,
      gateX - 4.3 + seg * 0.52,
      0.96,
      22.1,
      seg % 2 === 0 ? '#f8fafc' : '#ef4444',
    );
  }

  // Automated Boom Barrier #2 (East Entry Lane at x = 12.55, z = 22.1 — raised 38° welcoming car!)
  pushBox(parts, 0.38, 1.08, 0.38, gateX + 4.75, 0.56, 22.1, salmon);
  pushBox(parts, 0.42, 0.14, 0.42, gateX + 4.75, 1.12, 22.1, darkSteel);
  pushBox(parts, 3.1, 0.09, 0.09, gateX + 3.45, 1.88, 22.1, '#f8fafc', 0, 0, -0.62);
  // RFID Card Reader Pedestal
  pushBox(parts, 0.22, 1.15, 0.22, gateX + 1.05, 0.58, 23.1, darkSteel);
  pushBox(parts, 0.24, 0.22, 0.08, gateX + 1.05, 1.06, 23.15, '#34d399');

  // Arriving white sports coupe entering through the East Gate lane (x = 10.45, z = 21.1)
  addCar3D(parts, gateX + 2.65, 21.1, Math.PI, '#f8fafc', 'coupe');

  // =========================================================================
  // 3. ROADSIDE MONUMENT TOTEM PYLON SIGN (x = 14.8, z = 23.8)
  // =========================================================================
  pushBox(parts, 3.1, 0.36, 1.1, 14.8, 0.18, 23.8, curbStone);
  pushBox(parts, 2.75, 3.6, 0.52, 14.8, 1.98, 23.8, darkSteel);
  pushBox(parts, 2.85, 0.18, 0.62, 14.8, 3.84, 23.8, salmon);
  pushBox(parts, 0.16, 3.6, 0.58, 13.4, 1.98, 23.8, salmon);
  pushBox(parts, 0.16, 3.6, 0.58, 16.2, 1.98, 23.8, salmon);

  // =========================================================================
  // 4. L1 PORTE-COCHÈRE MAIN LOBBY CANOPY (x = -1.5 .. +11.5, z = 15.8 .. 19.4)
  // =========================================================================
  pushBox(parts, 13.2, 0.38, 3.7, 5.0, 3.88, 17.65, darkSteel);
  pushBox(parts, 12.4, 0.08, 3.3, 5.0, 3.66, 17.65, warmWood);
  pushBox(parts, 13.35, 0.14, 3.82, 5.0, 4.1, 17.65, salmon);
  for (const colX of [-0.6, 10.6]) {
    pushBox(parts, 0.32, 3.8, 0.32, colX, 1.85, 19.0, midSteel, 0.14, 0, 0);
    pushBox(parts, 0.32, 3.8, 0.32, colX, 1.85, 18.1, midSteel, -0.14, 0, 0);
    pushBox(parts, 0.65, 0.28, 1.35, colX, 0.14, 18.55, curbStone);
  }
  pushBox(parts, 5.6, 3.2, 0.75, 2.5, 1.6, 16.25, '#38bdf8');
  pushBox(parts, 5.8, 0.18, 0.88, 2.5, 3.25, 16.25, salmon);

  // =========================================================================
  // 5. EXECUTIVE CAR PARKING LOT ("BÃI ĐỖ XE Ô TÔ") + SOLAR CARPORTS + EV CHARGERS
  //    5A. Primary Front-East Car & EV Parking Court (x = 16.2 .. 30.8, z = 16.8 .. 23.2)
  //        Front-and-center in the default overview camera!
  // =========================================================================
  pushBox(parts, 14.8, 0.055, 6.4, 23.5, 0.022, 20.0, parkingAsphalt);
  pushBox(parts, 14.8, 0.12, 0.24, 23.5, 0.06, 16.75, curbStone);

  const eastCarStallXs = [18.0, 20.8, 23.6, 26.4, 29.2];
  for (let i = 0; i <= eastCarStallXs.length; i += 1) {
    const lineX = 16.6 + i * 2.8;
    pushBox(parts, 0.12, 0.06, 4.8, lineX, 0.038, 19.35, lineWhite);
  }
  for (let i = 0; i < eastCarStallXs.length; i += 1) {
    const sx = eastCarStallXs[i]!;
    pushBox(parts, 1.85, 0.12, 0.22, sx, 0.06, 17.3, i < 3 ? '#10b981' : lineAmber);
    if (i < 3) {
      pushBox(parts, 1.1, 0.058, 0.7, sx, 0.036, 20.85, '#10b981');
    }
  }

  // Architectural Setback Solar Carport Canopy (z = 16.7 .. 19.0) so all 4 3D cars & EV badges are 100% visible!
  pushBox(parts, 14.4, 0.18, 2.35, 23.6, 3.15, 17.85, darkSteel, 0.08, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    pushBox(parts, 2.65, 0.06, 2.1, 18.0 + i * 2.8, 3.26, 17.85, '#1d3557', 0.08, 0, 0);
  }
  pushBox(parts, 14.5, 0.12, 0.16, 23.6, 3.04, 19.05, salmon);
  for (const colX of [17.0, 21.4, 25.8, 30.2]) {
    pushBox(parts, 0.26, 3.1, 0.26, colX, 1.55, 16.95, midSteel);
  }

  // 4 EV Fast-Charging Supercharger Pedestals along z = 16.9
  for (const evX of [18.0, 20.8, 23.6, 26.4]) {
    pushBox(parts, 0.46, 1.48, 0.32, evX, 0.74, 16.88, '#f8fafc');
    pushBox(parts, 0.34, 0.55, 0.36, evX, 0.95, 16.88, '#111827');
    pushBox(parts, 0.08, 1.25, 0.35, evX - 0.19, 0.78, 16.88, '#10b981');
    pushBox(parts, 0.48, 0.1, 0.36, evX, 1.45, 16.88, salmon);
  }

  // 4 Detailed 3D Cars in Front-East Car & EV Parking Court (1 stall left open to show EV badge & lines!)
  addCar3D(parts, 18.0, 20.1, Math.PI, '#f8fafc', 'suv');
  addCar3D(parts, 20.8, 20.1, Math.PI, '#f07654', 'coupe');
  addCar3D(parts, 26.4, 20.1, Math.PI, '#38bdf8', 'sedan');
  addCar3D(parts, 29.2, 20.1, Math.PI, '#10b981', 'suv');

  // =========================================================================
  //    5B. Front-West & West Wing Car Parking Court (x = -23.5 .. -5.2, z = 16.8 .. 23.2 & x = -36..-25)
  // =========================================================================
  pushBox(parts, 18.2, 0.05, 6.4, -14.4, 0.02, 20.0, parkingAsphalt);
  pushBox(parts, 18.2, 0.12, 0.24, -14.4, 0.06, 16.75, curbStone);
  const westStallXs = [-21.2, -18.4, -15.6, -12.8, -10.0, -7.2];
  for (let i = 0; i <= westStallXs.length; i += 1) {
    pushBox(parts, 0.12, 0.06, 4.8, -22.6 + i * 2.8, 0.038, 19.35, lineWhite);
  }
  pushBox(parts, 17.2, 0.18, 2.35, -14.2, 3.15, 17.85, darkSteel, 0.08, 0, 0);
  for (let i = 0; i < 6; i += 1) {
    pushBox(parts, 2.65, 0.06, 2.1, westStallXs[i]!, 3.26, 17.85, '#1d3557', 0.08, 0, 0);
  }
  pushBox(parts, 17.3, 0.12, 0.16, -14.2, 3.04, 19.05, salmon);
  addCar3D(parts, -21.2, 20.1, Math.PI, '#e2e8f0', 'suv');
  addCar3D(parts, -18.4, 20.1, Math.PI, '#3b82f6', 'sedan');
  addCar3D(parts, -15.6, 20.1, Math.PI, '#f59e0b', 'coupe');
  addCar3D(parts, -10.0, 20.1, Math.PI, '#94a3b8', 'suv');

  // West Wing Perpendicular Car Parking (x = -36.5 .. -24.8, z = -12.0 .. +15.0)
  pushBox(parts, 11.8, 0.05, 28.0, -30.6, 0.018, 2.0, parkingAsphalt);
  pushBox(parts, 5.2, 0.18, 21.0, -33.6, 3.15, 1.5, darkSteel, 0, 0, -0.08);
  for (let i = 0; i < 7; i += 1) {
    pushBox(parts, 4.8, 0.06, 2.75, -33.6, 3.26, -7.5 + i * 3.0, '#1d3557', 0, 0, -0.08);
    pushBox(parts, 4.6, 0.06, 0.12, -33.5, 0.038, -9.0 + i * 3.0, lineWhite);
  }
  addCar3D(parts, -33.4, -7.5, Math.PI / 2, '#f8fafc', 'suv');
  addCar3D(parts, -33.4, -4.5, Math.PI / 2, '#ef4444', 'coupe');
  addCar3D(parts, -33.4, 1.5, Math.PI / 2, '#64748b', 'sedan');
  addCar3D(parts, -33.4, 7.5, Math.PI / 2, '#f59e0b', 'suv');

  // =========================================================================
  // 6. COVERED MOTORBIKE & BICYCLE PARKING PAVILION ("NHÀ ĐỂ XE MÁY & XE ĐẠP")
  //    Located at South-East Plaza (x = 31.4 .. 43.4, z = 17.0 .. 23.0) — 100% visible!
  // =========================================================================
  const motoCenterX = 37.4;
  pushBox(parts, 12.2, 0.055, 5.8, motoCenterX, 0.024, 20.1, parkingAsphalt);
  pushBox(parts, 12.4, 0.12, 0.22, motoCenterX, 0.06, 17.15, curbStone);

  for (let i = 0; i <= 10; i += 1) {
    const bx = 32.4 + i * 1.0;
    pushBox(parts, 0.07, 0.06, 2.1, bx, 0.038, 18.55, lineWhite);
    pushBox(parts, 0.07, 0.06, 2.1, bx, 0.038, 21.45, lineWhite);
  }

  // Translucent Blue-Gray Polycarbonate & Steel Shelter Canopy over North Motorbike Row
  pushBox(parts, 11.4, 0.14, 2.35, motoCenterX, 2.82, 18.3, darkSteel, 0.06, 0, 0);
  pushBox(parts, 11.0, 0.06, 2.1, motoCenterX, 2.91, 18.3, '#38bdf8', 0.06, 0, 0);
  pushBox(parts, 11.5, 0.1, 0.14, motoCenterX, 2.74, 19.5, salmon);
  for (const colX of [32.2, 35.7, 39.2, 42.6]) {
    pushBox(parts, 0.2, 2.75, 0.2, colX, 1.38, 17.35, midSteel);
    pushBox(parts, 0.2, 2.65, 0.2, colX, 1.32, 19.4, midSteel);
  }

  const motoColors = [
    '#f8fafc',
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#e2e8f0',
    '#f07654',
    '#38bdf8',
    '#a855f7',
    '#94a3b8',
    '#fb7185',
    '#facc15',
  ];
  for (let i = 0; i < 8; i += 1) {
    addMotorbike3D(parts, 32.9 + i * 1.0, 18.55, 0, motoColors[i % motoColors.length]!);
  }
  for (let i = 0; i < 6; i += 1) {
    addMotorbike3D(
      parts,
      32.9 + i * 1.0,
      21.45,
      Math.PI,
      motoColors[(i + 4) % motoColors.length]!,
    );
  }

  // Dedicated Bicycle Parking Rack on the East side of the shelter (x = 40.2 .. 42.4, z = 21.45)
  pushBox(parts, 2.4, 0.08, 0.9, 41.3, 0.05, 21.45, midSteel);
  for (let b = 0; b < 5; b += 1) {
    const bx = 40.4 + b * 0.45;
    pushBox(parts, 0.05, 0.55, 0.55, bx, 0.3, 21.45, '#cbd5e1');
    pushBox(parts, 0.06, 0.46, 0.46, bx + 0.1, 0.25, 21.1, '#111827');
    pushBox(parts, 0.06, 0.46, 0.46, bx + 0.1, 0.25, 21.8, '#111827');
    pushBox(
      parts,
      0.07,
      0.34,
      0.68,
      bx + 0.1,
      0.48,
      21.45,
      b % 2 === 0 ? salmonBright : '#38bdf8',
    );
  }

  // =========================================================================
  // 7. REFLECTION WATER FOUNTAIN, PLAZA BENCHES & SÖL FLAGPOLES
  // =========================================================================
  // Tiered Architectural Water Fountain at Central Forecourt (x = 0.2, z = 20.8)
  pushBox(parts, 3.2, 0.42, 3.2, 0.2, 0.21, 20.8, curbStone);
  pushBox(parts, 2.75, 0.38, 2.75, 0.2, 0.26, 20.8, '#0ea5e9');
  pushBox(parts, 1.55, 0.65, 1.55, 0.2, 0.52, 20.8, darkSteel);
  pushBox(parts, 1.25, 0.72, 1.25, 0.2, 0.58, 20.8, '#38bdf8');
  pushCylinder(parts, 0.28, 0.38, 1.35, 0.2, 1.15, 20.8, salmon, 10);
  pushCylinder(parts, 0.18, 0.48, 0.65, 0.2, 1.95, 20.8, '#bae6fd', 10);

  // 4 Timber-and-Stone Plaza Benches flanking the promenade
  for (const [bx, bz] of [
    [-2.4, 17.8],
    [12.4, 17.8],
    [-2.4, 20.2],
    [14.8, 18.2],
  ] as const) {
    pushBox(parts, 1.65, 0.44, 0.56, bx, 0.22, bz, curbStone);
    pushBox(parts, 1.72, 0.08, 0.62, bx, 0.46, bz, warmWood);
  }

  // 3 Tall SÖL Flagpoles with Salmon/Charcoal Pennant Banners (x = 13.8, z = 17.2..20.8)
  for (let f = 0; f < 3; f += 1) {
    const fz = 17.2 + f * 1.8;
    pushCylinder(parts, 0.16, 0.22, 0.32, 13.8, 0.16, fz, curbStone, 8);
    pushCylinder(parts, 0.05, 0.08, 6.8, 13.8, 3.4, fz, '#e2e8f0', 8);
    pushBox(parts, 1.15, 0.68, 0.05, 14.42, 6.15, fz, f === 1 ? salmon : '#1e293b');
    pushBox(parts, 0.28, 0.68, 0.06, 14.92, 6.15, fz, salmonBright);
  }

  // =========================================================================
  // 8. GROUND-LEVEL SIGNBOARD FRAMES (Parking & Tennis Arena)
  // =========================================================================
  // Front-East Car & EV Parking Signboard Frame on Canopy Header (x = 23.6, z = 19.02)
  pushBox(parts, 5.5, 1.0, 0.22, 23.6, 3.62, 19.02, darkSteel);
  pushBox(parts, 5.65, 0.1, 0.28, 23.6, 4.15, 19.02, salmon);

  // Front-West Car Parking Signboard Frame on Canopy Header (x = -14.2, z = 19.02)
  pushBox(parts, 5.5, 1.0, 0.22, -14.2, 3.62, 19.02, darkSteel);
  pushBox(parts, 5.65, 0.1, 0.28, -14.2, 4.15, 19.02, salmon);

  // Covered Motorbike & Bicycle Shelter Signboard Frame on Canopy Header (x = 37.4, z = 19.45)
  pushBox(parts, 5.1, 0.96, 0.22, motoCenterX, 3.38, 19.45, darkSteel);
  pushBox(parts, 5.25, 0.1, 0.28, motoCenterX, 3.88, 19.45, salmon);

  // =========================================================================
  // 9. PERIMETER ARCHITECTURAL FENCE, HEDGES, STREETLAMPS, BOLLARDS & TREES
  // =========================================================================
  for (let x = -36; x <= 48; x += 4.0) {
    if (x >= 1.2 && x <= 14.4) continue; // opening for Main Gate at x = 7.8
    pushBox(parts, 0.42, 1.45, 0.42, x, 0.72, 23.5, curbStone);
    pushBox(parts, 0.48, 0.1, 0.48, x, 1.48, 23.5, salmon);
    if (x + 4.0 <= 48 && !(x < 1.2 && x + 4.0 >= 1.2)) {
      pushBox(parts, 3.6, 0.42, 0.28, x + 2.0, 0.21, 23.5, curbStone);
      pushBox(parts, 3.5, 0.52, 0.55, x + 2.0, 0.58, 23.15, '#2b5438');
      pushBox(parts, 3.6, 0.07, 0.08, x + 2.0, 1.05, 23.5, midSteel);
      pushBox(parts, 3.6, 0.07, 0.08, x + 2.0, 1.32, 23.5, midSteel);
    }
  }

  const streetLamps: ReadonlyArray<readonly [number, number, number, number]> = [
    [-32, 23.9, 0, 1],
    [-22, 23.9, 0, 1],
    [-12, 23.9, 0, 1],
    [1.2, 23.9, 0, 1],
    [14.4, 23.9, 0, 1],
    [24, 23.9, 0, 1],
    [34, 23.9, 0, 1],
    [44, 23.9, 0, 1],
    [-25, 14.0, 1, 0],
    [-25, 2.0, 1, 0],
    [-25, -10.0, 1, 0],
  ];
  for (const [lx, lz, dx, dz] of streetLamps) {
    addStreetLamp(parts, lx, lz, dx, dz, 5.2);
  }

  const bollards: ReadonlyArray<readonly [number, number]> = [
    [-1.8, 16.8],
    [-1.8, 18.8],
    [-1.8, 20.8],
    [11.8, 16.8],
    [11.8, 18.8],
    [11.8, 20.8],
    [15.8, 17.2],
    [15.8, 20.0],
    [15.8, 22.4],
    [31.0, 17.2],
    [31.0, 20.0],
    [31.0, 22.4],
  ];
  for (const [bx, bz] of bollards) {
    addBollardLight(parts, bx, bz);
  }

  const campusTrees: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-25.5, 22.2, 1.05, true],
    [-25.5, 16.8, 0.95, true],
    [-3.6, 22.0, 0.9, true],
    [15.6, 21.8, 0.95, true],
    [31.0, 22.0, 0.9, true],
    [44.8, 21.5, 1.05, true],
    [47.5, 14.0, 1.1, true],
    [47.5, 4.0, 1.05, true],
    [47.5, -6.0, 1.1, true],
    [47.5, -14.5, 1.0, true],
    [-37.5, 16.0, 1.1, true],
    [-37.5, 6.0, 1.0, true],
    [-37.5, -4.0, 1.05, true],
    [-37.5, -14.0, 1.1, true],
    [-18.0, -17.8, 1.0, true],
    [-6.0, -17.8, 1.05, true],
    [8.0, -17.8, 1.0, true],
    [20.0, -17.8, 1.1, true],
  ];
  for (const [tx, tz, scale, planter] of campusTrees) {
    addCampusTree(parts, tx, tz, scale, planter);
  }

  return mergeColoredParts(parts);
}

interface SignQuadSpec {
  readonly center: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly rotY: number;
  readonly bandIndex: number; // 0..7 from top to bottom of the 8-band atlas
  readonly isRooftop?: boolean;
}

const SIGN_SPECS: readonly SignQuadSpec[] = [
  // Band 0: Rooftop South Sky-Sign (facing +Z South, anchored on RF South Parapet)
  { center: [1.5, 11.12, 16.24], width: 15.8, height: 1.72, rotY: 0, bandIndex: 0, isRooftop: true },
  // Band 1: Rooftop East Sky-Sign (facing +X East toward default camera, anchored on RF East Parapet)
  {
    center: [22.24, 11.12, -0.5],
    width: 14.8,
    height: 1.72,
    rotY: Math.PI / 2,
    bandIndex: 1,
    isRooftop: true,
  },
  // Band 2: Main Entrance Gate Archway Sign at x = 7.8, z = 23.2 (front +Z and rear -Z)
  { center: [7.8, 4.72, 23.91], width: 12.6, height: 0.78, rotY: 0, bandIndex: 2 },
  { center: [7.8, 4.72, 22.49], width: 12.6, height: 0.78, rotY: Math.PI, bandIndex: 2 },
  // Band 3: L1 Porte-Cochère Main Lobby Canopy Sign (facing +Z South at x = 5.0, z = 19.58)
  { center: [5.0, 3.88, 19.58], width: 11.2, height: 0.56, rotY: 0, bandIndex: 3 },
  // Band 4: Roadside Monument Totem Sign at x = 14.8, z = 23.8 (front +Z and rear -Z)
  { center: [14.8, 2.15, 24.08], width: 2.55, height: 2.8, rotY: 0, bandIndex: 4 },
  { center: [14.8, 2.15, 23.52], width: 2.55, height: 2.8, rotY: Math.PI, bandIndex: 4 },
  // Band 5: Executive Car Parking & EV Supercharger Signs (Front-East x=23.6 & Front-West x=-14.2)
  { center: [23.6, 3.62, 19.16], width: 5.3, height: 0.86, rotY: 0, bandIndex: 5 },
  { center: [-14.2, 3.62, 19.16], width: 5.3, height: 0.86, rotY: 0, bandIndex: 5 },
  // Band 6: Covered Motorbike & Bicycle Parking Sign at x = 37.4, z = 19.59 (facing +Z South)
  { center: [37.4, 3.38, 19.59], width: 4.9, height: 0.82, rotY: 0, bandIndex: 6 },
  // Band 7: Outdoor Tennis Arena North Scoreboard Sign at x = 34.65, y = 3.15, z = -14.62 (facing +Z South)
  { center: [34.65, 3.15, -14.62], width: 4.5, height: 1.32, rotY: 0, bandIndex: 7 },
];

/**
 * Builds a single UV-mapped BufferGeometry containing all 3D signage faces across the campus,
 * mapped to the 8 horizontal bands of `createCampusSignageTexture`.
 */
export function buildCampusSignageGeometry(
  rooftopOffsetY = 0,
  showRooftopSigns = true,
): THREE.BufferGeometry {
  const activeSpecs = SIGN_SPECS.filter(s => showRooftopSigns || !s.isRooftop);
  const quadCount = activeSpecs.length;
  const positions = new Float32Array(quadCount * 4 * 3);
  const normals = new Float32Array(quadCount * 4 * 3);
  const uvs = new Float32Array(quadCount * 4 * 2);
  const indices = new Uint16Array(quadCount * 6);

  for (let i = 0; i < quadCount; i += 1) {
    const spec = activeSpecs[i]!;
    const cx = spec.center[0];
    const cy = spec.center[1] + (spec.isRooftop ? rooftopOffsetY : 0);
    const cz = spec.center[2];
    const hw = spec.width * 0.5;
    const hh = spec.height * 0.5;
    const cos = Math.cos(spec.rotY);
    const sin = Math.sin(spec.rotY);

    const corners: ReadonlyArray<readonly [number, number]> = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];

    const v0 = 1 - (spec.bandIndex + 1) / 8 + 0.008;
    const v1 = 1 - spec.bandIndex / 8 - 0.008;
    const cornerUvs: ReadonlyArray<readonly [number, number]> = [
      [0.01, v0],
      [0.99, v0],
      [0.99, v1],
      [0.01, v1],
    ];

    for (let c = 0; c < 4; c += 1) {
      const [lx, ly] = corners[c]!;
      const wx = cx + lx * cos;
      const wy = cy + ly;
      const wz = cz - lx * sin;

      const vIdx = i * 4 + c;
      positions[vIdx * 3] = wx;
      positions[vIdx * 3 + 1] = wy;
      positions[vIdx * 3 + 2] = wz;

      normals[vIdx * 3] = sin;
      normals[vIdx * 3 + 1] = 0;
      normals[vIdx * 3 + 2] = cos;

      uvs[vIdx * 2] = cornerUvs[c]![0];
      uvs[vIdx * 2 + 1] = cornerUvs[c]![1];
    }

    const baseV = i * 4;
    const baseI = i * 6;
    indices[baseI] = baseV;
    indices[baseI + 1] = baseV + 1;
    indices[baseI + 2] = baseV + 2;
    indices[baseI + 3] = baseV;
    indices[baseI + 4] = baseV + 2;
    indices[baseI + 5] = baseV + 3;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Generates a single 1024x2048 CanvasTexture atlas with 8 crisp illuminated architectural signage bands.
 * Safe in headless/unit-test environments where 2D canvas context may return null.
 */
export function createCampusSignageTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bands: ReadonlyArray<{
    readonly badge: string;
    readonly title: string;
    readonly subtitle: string;
    readonly accent: string;
  }> = [
    {
      badge: 'SÖL',
      title: 'SÖL FITNESS & WELLNESS',
      subtitle: 'FLAGSHIP SPORTS · AQUATICS · RECOVERY · ROOFTOP ZEN',
      accent: '#f07654',
    },
    {
      badge: 'SÖL',
      title: 'SÖL CENTER · FLAGSHIP CLUB',
      subtitle: '5 LEVELS · OLYMPIC POOL · TENNIS ARENA · VIP LOUNGE',
      accent: '#f07654',
    },
    {
      badge: 'GATE 01',
      title: 'CỔNG CHÍNH · SÖL MAIN GATE',
      subtitle: '← SẢNH CHÍNH L1   |   WELCOME · AN NINH 24/7   |   BÃI ĐỖ XE & SẠC EV →',
      accent: '#f59e0b',
    },
    {
      badge: 'LOBBY L1',
      title: 'SÖL SANCTUARY · SẢNH CHÍNH',
      subtitle: 'RECEPTION · MEMBERSHIP · PRO SHOP · GYM ARENA',
      accent: '#f07654',
    },
    {
      badge: 'SÖL MAP',
      title: 'SÖL DIRECTORY',
      subtitle: 'RF ZEN · L2 VIP · L1 GYM · B1 AQUA · OUT TENNIS',
      accent: '#38bdf8',
    },
    {
      badge: 'P · Ô TÔ',
      title: 'BÃI ĐỖ XE Ô TÔ · EV CHARGING',
      subtitle: 'SOLAR CARPORT · 24/7 SECURITY · SUPERCHARGE 150kW',
      accent: '#10b981',
    },
    {
      badge: 'P · XE MÁY',
      title: 'NHÀ ĐỂ XE MÁY & XE ĐẠP',
      subtitle: 'COVERED SHELTER · SMART CARD ACCESS · 24/7 CAMERA',
      accent: '#38bdf8',
    },
    {
      badge: 'SÖL OPEN',
      title: 'SÖL TENNIS ARENA · 6–4 · 7–5',
      subtitle: 'COURTS 01–02 · ITF PRO HARD COURT · LED FLOODLIGHTS',
      accent: '#10b981',
    },
  ];

  const bandH = 256;
  for (let i = 0; i < bands.length; i += 1) {
    const b = bands[i]!;
    const y0 = i * bandH;

    ctx.fillStyle = '#0f141d';
    ctx.fillRect(0, y0, 1024, bandH);

    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(14, y0 + 14, 996, bandH - 28);

    ctx.fillStyle = b.accent;
    ctx.fillRect(36, y0 + 42, 168, bandH - 84);

    ctx.fillStyle = '#0b0f17';
    ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.badge, 120, y0 + bandH * 0.5);

    ctx.fillStyle = '#fff8f3';
    ctx.font = '800 50px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(b.title, 232, y0 + 122);

    ctx.fillStyle = '#fbd0c0';
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(b.subtitle, 232, y0 + 188);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
