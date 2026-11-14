import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useExploreStore } from '../state/exploreStore';

interface Lane {
  /** Fixed coordinate across the lane (z for EW lanes, x for NS lanes). */
  readonly fixed: number;
  readonly axis: 'EW' | 'NS';
  /** +1 / -1 travel direction along the lane axis. */
  readonly dir: 1 | -1;
  readonly speed: number;
  readonly cars: number;
}

const SPAN = 400;
const LANES: readonly Lane[] = [
  { axis: 'EW', fixed: 34.1, dir: 1, speed: 7.5, cars: 14 },
  { axis: 'EW', fixed: 36.9, dir: 1, speed: 9.5, cars: 12 },
  { axis: 'EW', fixed: 24.9, dir: -1, speed: 8, cars: 12 },
  { axis: 'EW', fixed: 28.1, dir: -1, speed: 10, cars: 12 },
  { axis: 'NS', fixed: -62.2, dir: 1, speed: 8.5, cars: 10 },
  { axis: 'NS', fixed: -58.8, dir: -1, speed: 8.5, cars: 10 },
  { axis: 'NS', fixed: 68.8, dir: 1, speed: 9, cars: 10 },
  { axis: 'NS', fixed: 72.2, dir: -1, speed: 9, cars: 10 },
];
const BODY_COLORS = ['#f4f4f2', '#c8372d', '#25395c', '#1b1d22', '#9aa1a9', '#d9a03a', '#3f6b4e', '#e8e3d6'];

function buildCarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const col = new Float32Array(g.getAttribute('position').count * 3).fill(c);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  add(4.2, 0.6, 1.8, 0, 0.55, 0, 1);
  add(1.9, 0.5, 1.55, -0.2, 1.08, 0, 0.1);
  add(1.2, 0.08, 1.5, -0.2, 1.36, 0, 1);
  add(0.1, 0.22, 1.5, 2.1, 0.48, 0, 0.9);
  for (const wx of [-1.3, 1.3]) for (const wz of [-0.82, 0.82]) add(0.7, 0.7, 0.24, wx, 0.35, wz, 0.02);
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
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

function buildLightsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (x: number, z: number, r: number, g: number, b: number) => {
    const geo = new THREE.BoxGeometry(0.08, 0.16, 0.34).toNonIndexed();
    geo.translate(x, 0.62, z);
    const col = new Float32Array(geo.getAttribute('position').count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = r; col[i + 1] = g; col[i + 2] = b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  };
  for (const z of [-0.62, 0.62]) { add(2.12, z, 4, 3.6, 2.6); add(-2.1, z, 3.5, 0.1, 0.05); }
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.getAttribute('position').array, o * 3);
    col.set(g.getAttribute('color').array, o * 3);
    o += g.getAttribute('position').count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Instanced cars looping along the boulevard and the two avenues. */
export function CityTraffic() {
  const tier = useExploreStore(s => s.tier);
  const ref = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const scale = tier === 'low' ? 0.5 : 1;
  const cars = useMemo(() => {
    const out: { lane: Lane; offset: number }[] = [];
    for (const lane of LANES) {
      const n = Math.max(2, Math.round(lane.cars * scale));
      for (let i = 0; i < n; i += 1) out.push({ lane, offset: (i / n) * SPAN * 2 + ((i * 37) % 11) });
    }
    return out;
  }, [scale]);
  const geometry = useMemo(() => buildCarGeometry(), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.45, envMapIntensity: 1.2 }),
    [],
  );
  const lightsGeo = useMemo(() => buildLightsGeometry(), []);
  const lightsMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  useEffect(() => () => { lightsGeo.dispose(); lightsMat.dispose(); }, [lightsGeo, lightsMat]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    cars.forEach((_, i) => mesh.setColorAt(i, c.set(BODY_COLORS[(i * 5) % BODY_COLORS.length]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    cars.forEach(({ lane, offset }, i) => {
      const s = ((((offset + t * lane.speed) % (SPAN * 2)) + SPAN * 2) % (SPAN * 2)) - SPAN;
      const along = s * lane.dir;
      if (lane.axis === 'EW') {
        p.set(along, 0, lane.fixed);
        q.setFromAxisAngle(up, lane.dir === 1 ? 0 : Math.PI);
      } else {
        p.set(lane.fixed, 0, along);
        q.setFromAxisAngle(up, lane.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      }
      m.compose(p, q, one);
      mesh.setMatrixAt(i, m);
      lightsRef.current?.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (lightsRef.current) lightsRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        key={cars.length}
        ref={ref}
        args={[geometry, material, cars.length]}
        frustumCulled={false}
        castShadow
        raycast={() => null}
      />
      <instancedMesh key={`l${cars.length}`} ref={lightsRef} args={[lightsGeo, lightsMat, cars.length]} frustumCulled={false} raycast={() => null} />
    </>
  );
}
