import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SURFACE_DETAIL_PRESETS, applySurfaceDetail } from '../renderers/surfaceDetail';
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
const BODY_COLORS = ['#e8e6e1', '#262b34', '#4b5563', '#8d95a0', '#1d2d44', '#6e2c26', '#36493d', '#c5bfb4'];

interface CarPart {
  readonly geom: THREE.BufferGeometry;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly roughness: number;
  readonly metalness: number;
}

function buildCarGeometry(): THREE.BufferGeometry {
  const parts: CarPart[] = [];
  const push = (geom: THREE.BufferGeometry, r: number, g: number, b: number, roughness: number, metalness: number) => {
    const nonIdx = geom.index ? geom.toNonIndexed() : geom;
    if (nonIdx !== geom) geom.dispose();
    parts.push({ geom: nonIdx, r, g, b, roughness, metalness });
  };

  // Lower body shell facing +X (bevelled sedan silhouette)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.02, 0.25);
  bodyShape.lineTo(2.02, 0.25);
  bodyShape.lineTo(2.06, 0.42);
  bodyShape.lineTo(2.02, 0.64);
  bodyShape.lineTo(0.88, 0.78);
  bodyShape.lineTo(-1.32, 0.80);
  bodyShape.lineTo(-2.02, 0.76);
  bodyShape.lineTo(-2.04, 0.34);
  bodyShape.closePath();
  const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 1.64,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 4,
  });
  bodyGeom.translate(0, 0, -0.82);
  push(bodyGeom, 1, 1, 1, 0.26, 0.42);

  // Raked tinted greenhouse cabin
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.28, 0.78);
  cabinShape.lineTo(0.86, 0.78);
  cabinShape.lineTo(0.30, 1.31);
  cabinShape.lineTo(-0.84, 1.32);
  cabinShape.closePath();
  const cabinGeom = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 1.36,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 4,
  });
  cabinGeom.translate(0, 0, -0.68);
  push(cabinGeom, 0.11, 0.13, 0.16, 0.10, 0.65);

  // Body-colored roof cap
  const roofGeom = new THREE.BoxGeometry(1.12, 0.04, 1.34);
  roofGeom.translate(-0.26, 1.355, 0);
  push(roofGeom, 0.98, 0.98, 0.98, 0.26, 0.42);

  // Matte lower trim, front grille & rear diffuser
  const grilleGeom = new THREE.BoxGeometry(0.14, 0.22, 1.44);
  grilleGeom.translate(2.05, 0.40, 0);
  push(grilleGeom, 0.08, 0.08, 0.09, 0.78, 0.12);

  const diffuserGeom = new THREE.BoxGeometry(0.12, 0.18, 1.50);
  diffuserGeom.translate(-2.04, 0.31, 0);
  push(diffuserGeom, 0.08, 0.08, 0.09, 0.78, 0.12);

  const rockerGeom = new THREE.BoxGeometry(2.1, 0.11, 1.74);
  rockerGeom.translate(0, 0.24, 0);
  push(rockerGeom, 0.08, 0.08, 0.09, 0.80, 0.10);

  // 4 cylindrical rubber tyres & alloy hubs
  for (const wx of [-1.32, 1.32]) {
    for (const wz of [-0.82, 0.82]) {
      const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateX(Math.PI / 2);
      tyre.translate(wx, 0.34, wz);
      push(tyre, 0.05, 0.05, 0.06, 0.88, 0.04);

      const hub = new THREE.CylinderGeometry(0.20, 0.20, 0.26, 12).rotateX(Math.PI / 2);
      hub.translate(wx, 0.34, wz);
      push(hub, 0.75, 0.78, 0.82, 0.30, 0.80);
    }
  }

  const total = parts.reduce((n, p) => n + p.geom.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const surf = new Float32Array(total * 2);
  let o = 0;
  for (const { geom, r, g, b, roughness, metalness } of parts) {
    const count = geom.getAttribute('position').count;
    pos.set(geom.getAttribute('position').array, o * 3);
    nor.set(geom.getAttribute('normal').array, o * 3);
    for (let i = 0; i < count; i += 1) {
      const c3 = (o + i) * 3;
      const s2 = (o + i) * 2;
      col[c3] = r;
      col[c3 + 1] = g;
      col[c3 + 2] = b;
      surf[s2] = roughness;
      surf[s2 + 1] = metalness;
    }
    o += count;
    geom.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('surf', new THREE.BufferAttribute(surf, 2));
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
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2, envMapIntensity: 1.15 }),
        SURFACE_DETAIL_PRESETS.vehicle,
      ),
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
