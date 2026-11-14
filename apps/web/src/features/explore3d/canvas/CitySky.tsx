import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATION_X, metroPosition } from '../renderers/architecture/metroMotion';
import { useDocumentTheme } from '../renderers/materials';
import { createWaterSurfaceMaterial } from '../renderers/surfaceDetail';

const NOOP = () => null;

interface MeshPart {
  geom: THREE.BufferGeometry;
  r: number;
  g: number;
  b: number;
}

function mergeMeshParts(parts: readonly MeshPart[]): THREE.BufferGeometry {
  const nonIdx = parts.map(p => {
    const g = p.geom.index ? p.geom.toNonIndexed() : p.geom;
    if (g !== p.geom) p.geom.dispose();
    return { ...p, geom: g };
  });
  const total = nonIdx.reduce((n, p) => n + p.geom.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const { geom, r, g, b } of nonIdx) {
    const count = geom.getAttribute('position').count;
    pos.set(geom.getAttribute('position').array, o * 3);
    nor.set(geom.getAttribute('normal').array, o * 3);
    for (let i = 0; i < count; i += 1) {
      const c3 = (o + i) * 3;
      col[c3] = r;
      col[c3 + 1] = g;
      col[c3 + 2] = b;
    }
    o += count;
    geom.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

const CAR_LEN = 13;
const CARS = 4;

function buildTrain(glow: boolean, bright: number): THREE.BufferGeometry {
  const parts: MeshPart[] = [];
  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number,
  ) => {
    const gObj = new THREE.BoxGeometry(w, h, d);
    gObj.translate(x, y, z);
    parts.push({ geom: gObj, r, g, b });
  };
  const addCyl = (
    rTop: number,
    rBot: number,
    h: number,
    seg: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    r: number,
    g: number,
    b: number,
  ) => {
    const gObj = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    if (rx !== 0) gObj.rotateX(rx);
    gObj.translate(x, y, z);
    parts.push({ geom: gObj, r, g, b });
  };

  for (let c = 0; c < CARS; c += 1) {
    const cx = (c - (CARS - 1) / 2) * CAR_LEN;
    const isFront = c === CARS - 1;
    const isRear = c === 0;

    if (glow) {
      addBox(CAR_LEN - 1.6, 0.82, 3.14, cx, 2.18, 0, 1.0 * bright, 0.92 * bright, 0.78 * bright);
      addBox(2.2, 0.18, 3.16, cx, 2.76, 0, 0.95 * bright, 0.65 * bright, 0.25 * bright);
      addBox(CAR_LEN - 0.4, 0.14, 3.16, cx, 1.05, 0, 0.95 * bright, 0.48 * bright, 0.35 * bright);

      if (isFront) {
        addBox(0.12, 0.22, 0.55, cx + CAR_LEN * 0.5 + 0.95, 1.15, 0.92, 4.2 * bright, 3.8 * bright, 2.9 * bright);
        addBox(0.12, 0.22, 0.55, cx + CAR_LEN * 0.5 + 0.95, 1.15, -0.92, 4.2 * bright, 3.8 * bright, 2.9 * bright);
        addBox(0.85, 0.75, 2.65, cx + CAR_LEN * 0.5 + 0.32, 2.3, 0, 0.7 * bright, 0.85 * bright, 1.1 * bright);
      }
      if (isRear) {
        addBox(0.12, 0.18, 0.62, cx - CAR_LEN * 0.5 - 0.95, 1.15, 0.92, 4.0 * bright, 0.15 * bright, 0.08 * bright);
        addBox(0.12, 0.18, 0.62, cx - CAR_LEN * 0.5 - 0.95, 1.15, -0.92, 4.0 * bright, 0.15 * bright, 0.08 * bright);
      }
    } else {
      addBox(CAR_LEN - 0.5, 3.15, 3.02, cx, 1.95, 0, 0.88, 0.90, 0.93);
      addBox(CAR_LEN - 0.35, 0.52, 3.06, cx, 0.48, 0, 0.13, 0.14, 0.18);
      addBox(3.4, 0.42, 1.85, cx - 2.8, 3.65, 0, 0.75, 0.78, 0.82);
      addBox(3.4, 0.42, 1.85, cx + 2.8, 3.65, 0, 0.75, 0.78, 0.82);

      if (isFront) {
        const noseShape = new THREE.Shape();
        noseShape.moveTo(0, 0.45);
        noseShape.lineTo(1.35, 0.55);
        noseShape.lineTo(1.38, 1.25);
        noseShape.lineTo(0.65, 2.75);
        noseShape.lineTo(0, 3.52);
        noseShape.closePath();
        const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
          depth: 2.88,
          bevelEnabled: true,
          bevelThickness: 0.08,
          bevelSize: 0.06,
          bevelSegments: 3,
        });
        noseGeo.translate(0, 0, -1.44);
        noseGeo.rotateY(Math.PI / 2);
        noseGeo.translate(cx + CAR_LEN * 0.5 - 0.1, 0, 0);
        parts.push({ geom: noseGeo, r: 0.88, g: 0.90, b: 0.93 });
      }
      if (isRear) {
        const tailShape = new THREE.Shape();
        tailShape.moveTo(0, 0.45);
        tailShape.lineTo(1.35, 0.55);
        tailShape.lineTo(1.38, 1.25);
        tailShape.lineTo(0.65, 2.75);
        tailShape.lineTo(0, 3.52);
        tailShape.closePath();
        const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
          depth: 2.88,
          bevelEnabled: true,
          bevelThickness: 0.08,
          bevelSize: 0.06,
          bevelSegments: 3,
        });
        tailGeo.translate(0, 0, -1.44);
        tailGeo.rotateY(-Math.PI / 2);
        tailGeo.translate(cx - CAR_LEN * 0.5 + 0.1, 0, 0);
        parts.push({ geom: tailGeo, r: 0.88, g: 0.90, b: 0.93 });
      }

      for (const bx of [cx - 3.8, cx + 3.8]) {
        addBox(2.2, 0.22, 2.5, bx, 0.42, 0, 0.20, 0.22, 0.26);
        for (const side of [-1.15, 1.15]) {
          for (const wx of [bx - 0.72, bx + 0.72]) {
            addCyl(0.42, 0.42, 0.14, 12, wx, 0.42, side, Math.PI / 2, 0.45, 0.48, 0.52);
          }
        }
      }

      if (c < CARS - 1) {
        const gx = cx + CAR_LEN * 0.5;
        addBox(0.72, 2.85, 2.65, gx, 1.95, 0, 0.12, 0.13, 0.15);
        addBox(0.82, 0.12, 2.72, gx, 3.42, 0, 0.18, 0.20, 0.24);
      }
    }
  }

  return mergeMeshParts(parts);
}

const DECK_Y = 9.2 + 0.5;
const TRACKS = [
  { z: -58.4, dir: 1, speed: 15, phase: 0 },
  { z: -54.6, dir: -1, speed: 13, phase: 30 },
] as const;
/** Two metro trainsets shuttling along the elevated viaduct. */
function Metro({ isLight }: { isLight: boolean }) {
  const bodyGeo = useMemo(() => buildTrain(false, 1), []);
  const glowGeo = useMemo(() => buildTrain(true, isLight ? 0.9 : 3.2), [isLight]);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55, envMapIntensity: 1.3 }),
    [],
  );
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  useEffect(() => () => { bodyGeo.dispose(); bodyMat.dispose(); glowMat.dispose(); }, [bodyGeo, bodyMat, glowMat]);
  useEffect(() => () => glowGeo.dispose(), [glowGeo]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    TRACKS.forEach((tr, i) => {
      const g = groups.current[i];
      if (!g) return;
      const s = metroPosition(clock.elapsedTime + tr.phase, tr.speed, STATION_X * tr.dir);
      g.position.set(s * tr.dir, DECK_Y, tr.z);
      g.rotation.y = tr.dir === 1 ? 0 : Math.PI;
    });
  });
  return (
    <>
      {TRACKS.map((tr, i) => (
        <group key={tr.z} ref={el => { groups.current[i] = el; }}>
          <mesh geometry={bodyGeo} material={bodyMat} castShadow raycast={NOOP} frustumCulled={false} />
          <mesh geometry={glowGeo} material={glowMat} raycast={NOOP} frustumCulled={false} />
        </group>
      ))}
    </>
  );
}

const BIRDS = 28;

/** A loose flock circling high over the campus in daylight. */
function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0.35, -1.3, 0.25, -0.1, -0.5, 0, -0.35, 0, 0, 0.35, 0.5, 0, -0.35, 1.3, 0.25, -0.1], 3),
    );
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#262626', side: THREE.DoubleSide }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < BIRDS; i += 1) {
      const r = 45 + (i % 7) * 12;
      const w = 0.07 + (i % 5) * 0.012;
      const a = t * w + i * 2.4;
      p.set(10 + Math.cos(a) * r, 42 + (i % 9) * 4 + Math.sin(t * 0.5 + i) * 1.5, Math.sin(a) * r);
      q.setFromAxisAngle(up, -a);
      sc.set(1.4, 0.3 + Math.abs(Math.sin(t * 7 + i * 1.7)) * 0.9, 1.4);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, BIRDS]} frustumCulled={false} raycast={NOOP} />;
}


const WATER = { x: 6, z: 55.1, w: 80.2, d: 6.0, y: 0.27 };
const DUCKS = 7;

/** Animated canal water surface with drifting mallards inside the south-park basin. */
function CanalLife({ isLight }: { isLight: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const waterGeo = useMemo(() => new THREE.PlaneGeometry(WATER.w, WATER.d).rotateX(-Math.PI / 2), []);
  const waterBundle = useMemo(() => createWaterSurfaceMaterial('sol-canal-water', isLight), [isLight]);
  const bodyGeo = useMemo(() => new THREE.SphereGeometry(0.21, 8, 6).scale(1.38, 0.66, 0.88), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.095, 8, 6), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d2c5', roughness: 0.78 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#274e3b', roughness: 0.65 }), []);
  useEffect(() => () => waterBundle.material.dispose(), [waterBundle]);
  useEffect(() => () => { waterGeo.dispose(); bodyGeo.dispose(); headGeo.dispose(); bodyMat.dispose(); headMat.dispose(); }, [waterGeo, bodyGeo, headGeo, bodyMat, headMat]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    waterBundle.setTime(t);
    const bd = bodyRef.current;
    const hd = headRef.current;
    if (!bd || !hd) return;
    for (let i = 0; i < DUCKS; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      const along = ((((i * 11.3 + t * 0.6 * dir) % (WATER.w - 4)) + (WATER.w - 4)) % (WATER.w - 4)) - (WATER.w - 4) / 2;
      const z = WATER.z + ((i % 3) - 1) * 1.3 + Math.sin(t * 0.9 + i) * 0.15;
      const bob = Math.sin(t * 2 + i) * 0.015;
      q.setFromAxisAngle(up, dir === 1 ? 0 : Math.PI);
      sc.setScalar(1);
      p.set(WATER.x + along, WATER.y + 0.04 + bob, z);
      bd.setMatrixAt(i, m.compose(p, q, sc));
      p.set(WATER.x + along + dir * 0.23, WATER.y + 0.21 + bob, z);
      hd.setMatrixAt(i, m.compose(p, q, sc));
    }
    bd.instanceMatrix.needsUpdate = true;
    hd.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh geometry={waterGeo} material={waterBundle.material} position={[WATER.x, WATER.y, WATER.z]} receiveShadow raycast={NOOP} />
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, DUCKS]} frustumCulled={false} castShadow raycast={NOOP} />
      <instancedMesh ref={headRef} args={[headGeo, headMat, DUCKS]} frustumCulled={false} raycast={NOOP} />
    </>
  );
}

export function CitySky() {
  const isLight = useDocumentTheme() === 'light';
  return (
    <>
      <Metro isLight={isLight} />
      <CanalLife isLight={isLight} />
      {isLight && <Birds />}
    </>
  );
}
