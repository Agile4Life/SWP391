import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityMetropolisGeometries } from '../renderers/architecture/buildCityMetropolis';
import { useExploreStore } from '../state/exploreStore';

const NOOP = () => null;
const CYCLE = 24; // seconds: 10 green, 2 yellow per axis

type Light = 'red' | 'yellow' | 'green';
function phaseFor(axis: 'EW' | 'NS', t: number): Light {
  const k = (t + (axis === 'NS' ? CYCLE / 2 : 0)) % CYCLE;
  if (k < 10) return 'green';
  if (k < 12) return 'yellow';
  return 'red';
}
const LAMP_RGB: Record<Light, [number, number, number]> = {
  red: [5, 0.25, 0.2],
  yellow: [5, 3.2, 0.2],
  green: [0.3, 5, 1.2],
};
const DIM = 0.06;

/** Signal lamps that cycle red/yellow/green; instanced, recoloured only on phase change. */
function TrafficSignals({ city }: { city: CityMetropolisGeometries }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lamps = useMemo(() => {
    const out: { axis: 'EW' | 'NS'; slot: 0 | 1 | 2; pos: THREE.Vector3 }[] = [];
    for (const a of city.trafficSignalAnchors) {
      const nx = Math.sin(a.rotationY);
      const nz = Math.cos(a.rotationY);
      const dx = Math.cos(a.rotationY);
      const dz = -Math.sin(a.rotationY);
      for (const face of [1, -1]) {
        for (const slot of [0, 1, 2] as const) {
          const o = (slot - 1) * 0.27;
          out.push({
            axis: a.axis,
            slot,
            pos: new THREE.Vector3(
              a.position[0] + dx * o + nx * face * 0.15,
              a.position[1],
              a.position[2] + dz * o + nz * face * 0.15,
            ),
          });
        }
      }
    }
    return out;
  }, [city]);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.1, 8, 6), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const last = useRef('');
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    lamps.forEach((l, i) => mesh.setMatrixAt(i, m.makeTranslation(l.pos.x, l.pos.y, l.pos.z)));
    mesh.instanceMatrix.needsUpdate = true;
    last.current = '';
  }, [lamps]);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const key = `${phaseFor('EW', t)}${phaseFor('NS', t)}`;
    if (key === last.current) return;
    last.current = key;
    const order: Light[] = ['red', 'yellow', 'green'];
    lamps.forEach((l, i) => {
      const on = phaseFor(l.axis, t) === order[l.slot];
      const rgb = LAMP_RGB[order[l.slot]!];
      const k = on ? 1 : DIM;
      mesh.setColorAt(i, c.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k, THREE.LinearSRGBColorSpace));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  if (lamps.length === 0) return null;
  return <instancedMesh key={lamps.length} ref={ref} args={[geometry, material, lamps.length]} frustumCulled={false} raycast={NOOP} />;
}

function Banners({ city }: { city: CityMetropolisGeometries }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.05, 2.3, 0.95), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e0846c', roughness: 0.6, emissive: '#6b2a1c', emissiveIntensity: 0.25 }),
    [],
  );
  const anchors = city.boulevardBannerAnchors;
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    anchors.forEach((a, i) => mesh.setMatrixAt(i, m.makeTranslation(a.x + 0.25, a.y, a.z + a.side * 0.75)));
    mesh.instanceMatrix.needsUpdate = true;
  }, [anchors]);
  if (anchors.length === 0) return null;
  return <instancedMesh key={anchors.length} ref={ref} args={[geometry, material, anchors.length]} castShadow raycast={NOOP} />;
}

/** Aviation beacons on supertalls pulse. */
function Beacons({ city }: { city: CityMetropolisGeometries }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.7, 8, 6), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff2a20', toneMapped: false }), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const anchors = city.beaconAnchors;
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    anchors.forEach((a, i) => mesh.setMatrixAt(i, m.makeTranslation(a[0], a[1], a[2])));
    mesh.instanceMatrix.needsUpdate = true;
  }, [anchors]);
  useFrame(({ clock }) => {
    const k = 0.15 + 4.5 * Math.max(0, Math.sin(clock.elapsedTime * 2.2)) ** 3;
    material.color.setRGB(k, k * 0.08, k * 0.06, THREE.LinearSRGBColorSpace);
  });
  if (anchors.length === 0) return null;
  return <instancedMesh key={anchors.length} ref={ref} args={[geometry, material, anchors.length]} frustumCulled={false} raycast={NOOP} />;
}

interface Walker {
  axis: 'x' | 'z';
  fixed: number;
  dir: 1 | -1;
  speed: number;
  offset: number;
}
const WALK_SPAN = 120;
const WALK_LINES: readonly { axis: 'x' | 'z'; fixed: number }[] = [
  { axis: 'x', fixed: 41.3 },
  { axis: 'x', fixed: 42.6 },
  { axis: 'x', fixed: 21.6 },
  { axis: 'z', fixed: -64.8 },
  { axis: 'z', fixed: 75.6 },
];
const CLOTHES = ['#d9826a', '#2f3b52', '#e8e2d4', '#5a7d62', '#1f2530', '#b24a3c', '#7f8fa6', '#caa24a'];

/** Pedestrians strolling the sidewalks; two instanced meshes (body + head) with a gait bob. */
function Pedestrians() {
  const tier = useExploreStore(s => s.tier);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legARef = useRef<THREE.InstancedMesh>(null);
  const legBRef = useRef<THREE.InstancedMesh>(null);
  const count = tier === 'low' ? 15 : 45;
  const walkers = useMemo<Walker[]>(() => {
    const out: Walker[] = [];
    for (let i = 0; i < count; i += 1) {
      const line = WALK_LINES[i % WALK_LINES.length]!;
      out.push({
        axis: line.axis,
        fixed: line.fixed + (((i * 13) % 7) - 3) * 0.12,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 1.1 + ((i * 7) % 5) * 0.12,
        offset: (i * 53) % (WALK_SPAN * 2),
      });
    }
    return out;
  }, [count]);
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.21, 0.5, 3, 8), []);
  const legGeo = useMemo(() => new THREE.CapsuleGeometry(0.075, 0.62, 2, 6), []);
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#232a36', roughness: 0.85 }), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.15, 8, 6), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c58f6d', roughness: 0.7 }), []);
  useEffect(() => () => { bodyGeo.dispose(); headGeo.dispose(); bodyMat.dispose(); headMat.dispose(); legGeo.dispose(); legMat.dispose(); }, [bodyGeo, headGeo, bodyMat, headMat, legGeo, legMat]);
  useEffect(() => {
    const mesh = bodyRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    walkers.forEach((_, i) => mesh.setColorAt(i, c.set(CLOTHES[i % CLOTHES.length]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [walkers]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const axisX = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const axisZ = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(({ clock }) => {
    const b = bodyRef.current;
    const h = headRef.current;
    const la = legARef.current;
    const lb = legBRef.current;
    if (!b || !h || !la || !lb) return;
    const t = clock.elapsedTime;
    walkers.forEach((w, i) => {
      const s = (((w.offset + t * w.speed) % (WALK_SPAN * 2)) + WALK_SPAN * 2) % (WALK_SPAN * 2) - WALK_SPAN;
      const along = s * w.dir + (w.axis === 'x' ? 0 : 0);
      const bob = Math.abs(Math.sin(t * 5.2 + i)) * 0.05;
      const x = w.axis === 'x' ? along : w.fixed;
      const z = w.axis === 'x' ? w.fixed : along;
      b.setMatrixAt(i, m.makeTranslation(x, 1.15 + bob, z));
      h.setMatrixAt(i, m.makeTranslation(x, 1.72 + bob, z));
      // Legs swing about the horizontal axis perpendicular to the walking direction.
      const swing = Math.sin(t * 5.2 + i) * 0.55 * (w.dir === 1 ? -1 : 1) * (w.axis === 'x' ? 1 : -1);
      const axis = w.axis === 'x' ? axisZ : axisX;
      [la, lb].forEach((leg, k) => {
        q.setFromAxisAngle(axis, k === 0 ? swing : -swing);
        v.set(0, -0.36, 0).applyQuaternion(q);
        v.x += x + (w.axis === 'x' ? 0 : (k === 0 ? 0.1 : -0.1));
        v.y += 0.9 + bob;
        v.z += z + (w.axis === 'x' ? (k === 0 ? 0.1 : -0.1) : 0);
        leg.setMatrixAt(i, m.compose(v, q, one));
      });
    });
    la.instanceMatrix.needsUpdate = true;
    lb.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh key={`b${count}`} ref={bodyRef} args={[bodyGeo, bodyMat, count]} frustumCulled={false} castShadow raycast={NOOP} />
      <instancedMesh key={`la${count}`} ref={legARef} args={[legGeo, legMat, count]} frustumCulled={false} raycast={NOOP} />
      <instancedMesh key={`lb${count}`} ref={legBRef} args={[legGeo, legMat, count]} frustumCulled={false} raycast={NOOP} />
      <instancedMesh key={`h${count}`} ref={headRef} args={[headGeo, headMat, count]} frustumCulled={false} raycast={NOOP} />
    </>
  );
}


const COMMUTERS = 14;
const PLATFORM_Y = 9.2 + 0.48 + 0.23;

/** Passengers waiting on the elevated metro platform; they sway slightly and shuffle in place. */
function Commuters() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.21, 0.5, 3, 8), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.15, 8, 6), []);
  const legGeo = useMemo(() => new THREE.CapsuleGeometry(0.13, 0.62, 2, 6), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c58f6d', roughness: 0.7 }), []);
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#232a36', roughness: 0.85 }), []);
  useEffect(() => () => { bodyGeo.dispose(); headGeo.dispose(); legGeo.dispose(); bodyMat.dispose(); headMat.dispose(); legMat.dispose(); }, [bodyGeo, headGeo, legGeo, bodyMat, headMat, legMat]);
  const spots = useMemo(
    () => Array.from({ length: COMMUTERS }, (_, i) => ({
      x: -17 + ((i * 2.9) % 42) + (i % 3) * 0.4,
      z: -56.5 + (i % 2 === 0 ? -3.6 : 3.6) + ((i * 7) % 5) * 0.12,
    })),
    [],
  );
  useEffect(() => {
    const mesh = bodyRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    spots.forEach((_, i) => mesh.setColorAt(i, c.set(CLOTHES[i % CLOTHES.length]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spots]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const b = bodyRef.current;
    const h = headRef.current;
    const l = legRef.current;
    if (!b || !h || !l) return;
    const t = clock.elapsedTime;
    spots.forEach((sp, i) => {
      const sway = Math.sin(t * 0.8 + i * 1.7) * 0.04;
      b.setMatrixAt(i, m.makeTranslation(sp.x + sway, PLATFORM_Y + 1.15, sp.z));
      h.setMatrixAt(i, m.makeTranslation(sp.x + sway, PLATFORM_Y + 1.72, sp.z));
      l.setMatrixAt(i, m.makeTranslation(sp.x, PLATFORM_Y + 0.5, sp.z));
    });
    b.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, COMMUTERS]} frustumCulled={false} castShadow raycast={NOOP} />
      <instancedMesh ref={headRef} args={[headGeo, headMat, COMMUTERS]} frustumCulled={false} raycast={NOOP} />
      <instancedMesh ref={legRef} args={[legGeo, legMat, COMMUTERS]} frustumCulled={false} raycast={NOOP} />
    </>
  );
}

export function CityLife({ city }: { city: CityMetropolisGeometries }) {
  return (
    <>
      <TrafficSignals city={city} />
      <Banners city={city} />
      <Beacons city={city} />
      <Pedestrians />
      <Commuters />
    </>
  );
}
