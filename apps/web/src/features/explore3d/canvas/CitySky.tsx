import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATION_X, metroPosition } from '../renderers/architecture/metroMotion';
import { useDocumentTheme } from '../renderers/materials';

const NOOP = () => null;

interface Box {
  w: number; h: number; d: number; x: number; y: number; z: number; r: number; g: number; b: number;
}

function mergeBoxes(boxes: readonly Box[]): THREE.BufferGeometry {
  const gs = boxes.map(bx => {
    const g = new THREE.BoxGeometry(bx.w, bx.h, bx.d).toNonIndexed();
    g.translate(bx.x, bx.y, bx.z);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) { col[i * 3] = bx.r; col[i * 3 + 1] = bx.g; col[i * 3 + 2] = bx.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const total = gs.reduce((s, g) => s + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of gs) {
    pos.set(g.getAttribute('position').array, o * 3);
    nor.set(g.getAttribute('normal').array, o * 3);
    col.set(g.getAttribute('color').array, o * 3);
    o += g.getAttribute('position').count;
    g.dispose();
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
  const boxes: Box[] = [];
  for (let c = 0; c < CARS; c += 1) {
    const cx = (c - (CARS - 1) / 2) * CAR_LEN;
    if (glow) {
      boxes.push({ w: CAR_LEN - 1.4, h: 0.8, d: 3.12, x: cx, y: 2.2, z: 0, r: 1.0 * bright, g: 0.9 * bright, b: 0.7 * bright });
      boxes.push({ w: CAR_LEN - 0.4, h: 0.16, d: 3.14, x: cx, y: 1.0, z: 0, r: 0.94 * bright, g: 0.46 * bright, b: 0.33 * bright });
    } else {
      boxes.push({ w: CAR_LEN - 0.3, h: 3.2, d: 3.0, x: cx, y: 1.9, z: 0, r: 0.86, g: 0.88, b: 0.9 });
      boxes.push({ w: CAR_LEN - 0.3, h: 0.5, d: 3.04, x: cx, y: 0.45, z: 0, r: 0.12, g: 0.13, b: 0.16 });
    }
  }
  return mergeBoxes(boxes);
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


const WATER = { x: 6, z: 55.1, w: 80, d: 5.6, y: 0.33 };
const SPARKLES = 46;
const DUCKS = 7;

/** Glints and drifting ducks on the south-park canal. */
function CanalLife() {
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const sparkGeo = useMemo(() => new THREE.PlaneGeometry(0.5, 0.12).rotateX(-Math.PI / 2), []);
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.8 }), []);
  const bodyGeo = useMemo(() => new THREE.SphereGeometry(0.32, 8, 6).scale(1.35, 0.7, 0.9), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.15, 8, 6), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1ede2', roughness: 0.7 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6a4a', roughness: 0.6 }), []);
  useEffect(() => () => { sparkGeo.dispose(); sparkMat.dispose(); bodyGeo.dispose(); headGeo.dispose(); bodyMat.dispose(); headMat.dispose(); }, [sparkGeo, sparkMat, bodyGeo, bodyMat, headGeo, headMat]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sp = sparkRef.current;
    const bd = bodyRef.current;
    const hd = headRef.current;
    if (!sp || !bd || !hd) return;
    q.identity();
    for (let i = 0; i < SPARKLES; i += 1) {
      const fx = ((i * 0.6180339) % 1) * WATER.w - WATER.w / 2;
      const fz = ((i * 0.7548776) % 1) * (WATER.d - 0.8) - (WATER.d - 0.8) / 2;
      const k = Math.max(0, Math.sin(t * 1.6 + i * 2.1));
      p.set(WATER.x + fx + Math.sin(t * 0.3 + i) * 0.4, WATER.y, WATER.z + fz);
      sc.setScalar(0.2 + k * 1.1);
      sp.setMatrixAt(i, m.compose(p, q, sc));
    }
    sp.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < DUCKS; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      const along = ((((i * 11.3 + t * 0.6 * dir) % WATER.w) + WATER.w) % WATER.w) - WATER.w / 2;
      const z = WATER.z + ((i % 3) - 1) * 1.3 + Math.sin(t * 0.9 + i) * 0.15;
      const bob = Math.sin(t * 2 + i) * 0.03;
      q.setFromAxisAngle(up, dir === 1 ? 0 : Math.PI);
      sc.setScalar(1);
      p.set(WATER.x + along, WATER.y + 0.12 + bob, z);
      bd.setMatrixAt(i, m.compose(p, q, sc));
      p.set(WATER.x + along + dir * 0.38, WATER.y + 0.42 + bob, z);
      hd.setMatrixAt(i, m.compose(p, q, sc));
    }
    bd.instanceMatrix.needsUpdate = true;
    hd.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={sparkRef} args={[sparkGeo, sparkMat, SPARKLES]} frustumCulled={false} raycast={NOOP} />
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, DUCKS]} frustumCulled={false} castShadow raycast={NOOP} />
      <instancedMesh ref={headRef} args={[headGeo, headMat, DUCKS]} frustumCulled={false} raycast={NOOP} />
    </>
  );
}

const CLOUDS = 16;

/** Slow-drifting cumulus built from a few squashed spheres each; one instanced mesh. */
function Clouds({ isLight }: { isLight: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, depthWrite: false, fog: false }),
    [],
  );
  useEffect(() => { material.color.set(isLight ? '#f6f3ee' : '#566178'); }, [material, isLight]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const puffs = useMemo(() => {
    const out: { cx: number; cz: number; y: number; ox: number; oz: number; r: number }[] = [];
    for (let c = 0; c < CLOUDS; c += 1) {
      const a = (c / CLOUDS) * Math.PI * 2 + (c % 3) * 0.4;
      const rad = 260 + ((c * 97) % 380);
      const cx = Math.cos(a) * rad;
      const cz = Math.sin(a) * rad;
      const y = 190 + ((c * 31) % 80);
      for (let k = 0; k < 5; k += 1) {
        out.push({ cx, cz, y: y + (k % 2) * 4, ox: (k - 2) * 26 + ((c * 7 + k) % 5) * 3, oz: ((k * 13 + c) % 7) * 6 - 18, r: 30 + ((c + k * 5) % 4) * 8 });
      }
    }
    return out;
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const drift = (clock.elapsedTime * 1.2) % 900;
    puffs.forEach((pf, i) => {
      let x = pf.cx + pf.ox + drift;
      if (x > 560) x -= 1120;
      p.set(x, pf.y, pf.cz + pf.oz);
      sc.set(pf.r * 1.5, pf.r * 0.42, pf.r);
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, puffs.length]} frustumCulled={false} raycast={NOOP} renderOrder={-900} />;
}

export function CitySky() {
  const isLight = useDocumentTheme() === 'light';
  return (
    <>
      <Metro isLight={isLight} />
      <CanalLife />
      <Clouds isLight={isLight} />
      {isLight && <Birds />}
    </>
  );
}
