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
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.21, 0.85, 3, 8), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.15, 8, 6), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c58f6d', roughness: 0.7 }), []);
  useEffect(() => () => { bodyGeo.dispose(); headGeo.dispose(); bodyMat.dispose(); headMat.dispose(); }, [bodyGeo, headGeo, bodyMat, headMat]);
  useEffect(() => {
    const mesh = bodyRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    walkers.forEach((_, i) => mesh.setColorAt(i, c.set(CLOTHES[i % CLOTHES.length]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [walkers]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const b = bodyRef.current;
    const h = headRef.current;
    if (!b || !h) return;
    const t = clock.elapsedTime;
    walkers.forEach((w, i) => {
      const s = (((w.offset + t * w.speed) % (WALK_SPAN * 2)) + WALK_SPAN * 2) % (WALK_SPAN * 2) - WALK_SPAN;
      const along = s * w.dir + (w.axis === 'x' ? 0 : 0);
      const bob = Math.abs(Math.sin(t * 5.2 + i)) * 0.05;
      const x = w.axis === 'x' ? along : w.fixed;
      const z = w.axis === 'x' ? w.fixed : along;
      b.setMatrixAt(i, m.makeTranslation(x, 0.85 + bob, z));
      h.setMatrixAt(i, m.makeTranslation(x, 1.62 + bob, z));
    });
    b.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh key={`b${count}`} ref={bodyRef} args={[bodyGeo, bodyMat, count]} frustumCulled={false} castShadow raycast={NOOP} />
      <instancedMesh key={`h${count}`} ref={headRef} args={[headGeo, headMat, count]} frustumCulled={false} raycast={NOOP} />
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
    </>
  );
}
