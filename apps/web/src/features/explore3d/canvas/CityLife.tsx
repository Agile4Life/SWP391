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
    () => new THREE.MeshStandardMaterial({ color: '#c47c6a', roughness: 0.78, emissive: '#4a1f16', emissiveIntensity: 0.12 }),
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
const CLOTHES = ['#b86f5c', '#2d3748', '#dcd6ca', '#4f6855', '#222730', '#8c443a', '#68768a', '#b08f4a'];

function mergeHumanParts(parts: readonly { geom: THREE.BufferGeometry; col?: string; colorAt?: (x: number, y: number, z: number, out: THREE.Color) => void }[]): THREE.BufferGeometry {
  const nonIdx = parts.map(p => {
    const g = p.geom.index ? p.geom.toNonIndexed() : p.geom;
    if (g !== p.geom) p.geom.dispose();
    return { ...p, geom: g };
  });
  const total = nonIdx.reduce((n, p) => n + p.geom.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const tmp = new THREE.Color();
  let o = 0;
  for (const part of nonIdx) {
    const pAttr = part.geom.getAttribute('position');
    const nAttr = part.geom.getAttribute('normal');
    pos.set(pAttr.array, o * 3);
    nor.set(nAttr.array, o * 3);
    if (part.col) tmp.set(part.col);
    for (let i = 0; i < pAttr.count; i += 1) {
      if (part.colorAt) {
        part.colorAt(pAttr.getX(i), pAttr.getY(i), pAttr.getZ(i), tmp);
      }
      const c3 = (o + i) * 3;
      col[c3] = tmp.r;
      col[c3 + 1] = tmp.g;
      col[c3 + 2] = tmp.b;
    }
    o += pAttr.count;
    part.geom.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Local forward = +X; natural neck + oval head with dark hair cap. */
function buildHeadWithHairGeometry(): THREE.BufferGeometry {
  const skin = new THREE.Color('#c69474');
  const hair = new THREE.Color('#221d1a');
  const neck = new THREE.CylinderGeometry(0.052, 0.06, 0.14, 8);
  neck.translate(0, -0.09, 0);
  const cranium = new THREE.SphereGeometry(0.112, 10, 8).scale(1.06, 1.15, 0.95);
  cranium.translate(0, 0.03, 0);
  return mergeHumanParts([
    { geom: neck, col: '#c69474' },
    {
      geom: cranium,
      colorAt: (x, y, _z, out) => {
        out.copy(y > 0.055 || x < -0.025 ? hair : skin);
      },
    },
  ]);
}

/** Local forward = +X, lateral = +-Z; subtle vertex AO so instanceColor clothes look natural. */
function buildTorsoWithArmsGeometry(): THREE.BufferGeometry {
  const chest = new THREE.CylinderGeometry(0.14, 0.115, 0.56, 10).scale(0.84, 1, 1.28);
  const shoulders = new THREE.SphereGeometry(0.14, 10, 6).scale(0.75, 0.55, 1.35);
  shoulders.translate(0, 0.24, 0);
  const armL = new THREE.CapsuleGeometry(0.048, 0.40, 2, 6);
  armL.rotateZ(-0.08);
  armL.translate(0.02, -0.02, 0.205);
  const armR = new THREE.CapsuleGeometry(0.048, 0.40, 2, 6);
  armR.rotateZ(-0.08);
  armR.translate(0.02, -0.02, -0.205);
  const shades = (geom: THREE.BufferGeometry) => ({
    geom,
    colorAt: (_x: number, y: number, _z: number, out: THREE.Color) => {
      const ao = y < -0.15 ? 0.86 : 0.98;
      out.setRGB(ao, ao, ao);
    },
  });
  return mergeHumanParts([shades(chest), shades(shoulders), shades(armL), shades(armR)]);
}

function buildStandingLegsGeometry(): THREE.BufferGeometry {
  const parts: { geom: THREE.BufferGeometry; col: string }[] = [];
  for (const sz of [-0.095, 0.095]) {
    const limb = new THREE.CylinderGeometry(0.072, 0.05, 0.72, 8);
    limb.translate(0, 0.45, sz);
    const upperShoe = new THREE.BoxGeometry(0.22, 0.065, 0.105);
    upperShoe.translate(0.035, 0.055, sz);
    const sole = new THREE.BoxGeometry(0.23, 0.03, 0.11);
    sole.translate(0.035, 0.015, sz);
    parts.push({ geom: limb, col: '#252c38' }, { geom: upperShoe, col: '#363c46' }, { geom: sole, col: '#d4d0c8' });
  }
  return mergeHumanParts(parts);
}

interface PedestrianPart {
  geom: THREE.BufferGeometry;
  limb: number; // 0: torso/head, 1: left leg, -1: right leg, 2: left arm, -2: right arm
  isClothes: number; // 1: clothes, 0: skin/hair/trousers/shoes
  col?: string;
  colorAt?: (x: number, y: number, z: number, out: THREE.Color) => void;
}

function mergePedestrianParts(parts: readonly PedestrianPart[]): THREE.BufferGeometry {
  const nonIdx = parts.map(p => {
    const g = p.geom.index ? p.geom.toNonIndexed() : p.geom;
    if (g !== p.geom) p.geom.dispose();
    return { ...p, geom: g };
  });
  const total = nonIdx.reduce((n, p) => n + p.geom.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const limb = new Float32Array(total);
  const isClothes = new Float32Array(total);
  const tmp = new THREE.Color();
  let o = 0;
  for (const part of nonIdx) {
    const pAttr = part.geom.getAttribute('position');
    const nAttr = part.geom.getAttribute('normal');
    pos.set(pAttr.array, o * 3);
    nor.set(nAttr.array, o * 3);
    if (part.col) tmp.set(part.col);
    for (let i = 0; i < pAttr.count; i += 1) {
      if (part.colorAt) {
        part.colorAt(pAttr.getX(i), pAttr.getY(i), pAttr.getZ(i), tmp);
      }
      const c3 = (o + i) * 3;
      col[c3] = tmp.r;
      col[c3 + 1] = tmp.g;
      col[c3 + 2] = tmp.b;
      limb[o + i] = part.limb;
      isClothes[o + i] = part.isClothes;
    }
    o += pAttr.count;
    part.geom.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
  out.setAttribute('aIsClothes', new THREE.BufferAttribute(isClothes, 1));
  return out;
}

function buildAnimatedPedestrianGeometry(): THREE.BufferGeometry {
  const skin = new THREE.Color('#c69474');
  const hair = new THREE.Color('#252528');

  // Head and neck
  const neck = new THREE.CylinderGeometry(0.055, 0.065, 0.14, 8);
  neck.translate(0, 1.45, 0);
  const cranium = new THREE.SphereGeometry(0.125, 10, 8).scale(0.85, 1.15, 0.95);
  cranium.translate(0, 1.58, 0);

  // Torso
  const chest = new THREE.CylinderGeometry(0.14, 0.115, 0.56, 10).scale(0.84, 1, 1.28);
  chest.translate(0, 1.10, 0);
  const shoulders = new THREE.SphereGeometry(0.14, 10, 6).scale(0.75, 0.55, 1.35);
  shoulders.translate(0, 1.34, 0);

  // Arms: short-sleeved upper arm (tinted by instance outfit) + bare skin forearm
  const sleeveL = new THREE.CapsuleGeometry(0.05, 0.16, 2, 6);
  sleeveL.rotateZ(-0.06);
  sleeveL.translate(0.01, 1.25, 0.205);
  const forearmL = new THREE.CapsuleGeometry(0.04, 0.2, 2, 6);
  forearmL.rotateZ(0.08);
  forearmL.translate(0.03, 1.04, 0.205);

  const sleeveR = new THREE.CapsuleGeometry(0.05, 0.16, 2, 6);
  sleeveR.rotateZ(-0.06);
  sleeveR.translate(0.01, 1.25, -0.205);
  const forearmR = new THREE.CapsuleGeometry(0.04, 0.2, 2, 6);
  forearmR.rotateZ(0.08);
  forearmR.translate(0.03, 1.04, -0.205);

  // Left Leg & Shoe (hip pivot at y = 0.82, z = 0.095)
  const legL = new THREE.CylinderGeometry(0.072, 0.05, 0.72, 8);
  legL.translate(0, 0.46, 0.095);
  const upperShoeL = new THREE.BoxGeometry(0.22, 0.065, 0.105);
  upperShoeL.translate(0.035, 0.065, 0.095);
  const soleL = new THREE.BoxGeometry(0.23, 0.03, 0.11);
  soleL.translate(0.035, 0.015, 0.095);

  // Right Leg & Shoe (hip pivot at y = 0.82, z = -0.095)
  const legR = new THREE.CylinderGeometry(0.072, 0.05, 0.72, 8);
  legR.translate(0, 0.46, -0.095);
  const upperShoeR = new THREE.BoxGeometry(0.22, 0.065, 0.105);
  upperShoeR.translate(0.035, 0.065, -0.095);
  const soleR = new THREE.BoxGeometry(0.23, 0.03, 0.11);
  soleR.translate(0.035, 0.015, -0.095);

  return mergePedestrianParts([
    { geom: neck, limb: 0, isClothes: 0, col: '#c69474' },
    {
      geom: cranium,
      limb: 0,
      isClothes: 0,
      colorAt: (x, y, _z, out) => {
        out.copy(y > 1.60 || x < -0.025 ? hair : skin);
      },
    },
    { geom: chest, limb: 0, isClothes: 1, col: '#dcd6ca' },
    { geom: shoulders, limb: 0, isClothes: 1, col: '#dcd6ca' },
    { geom: sleeveL, limb: 2, isClothes: 1, col: '#dcd6ca' },
    { geom: forearmL, limb: 2, isClothes: 0, col: '#c69474' },
    { geom: sleeveR, limb: -2, isClothes: 1, col: '#dcd6ca' },
    { geom: forearmR, limb: -2, isClothes: 0, col: '#c69474' },
    { geom: legL, limb: 1, isClothes: 0, col: '#252c38' },
    { geom: upperShoeL, limb: 1, isClothes: 0, col: '#363c46' },
    { geom: soleL, limb: 1, isClothes: 0, col: '#d4d0c8' },
    { geom: legR, limb: -1, isClothes: 0, col: '#252c38' },
    { geom: upperShoeR, limb: -1, isClothes: 0, col: '#363c46' },
    { geom: soleR, limb: -1, isClothes: 0, col: '#d4d0c8' },
  ]);
}

function createAnimatedPedestrianMaterial() {
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
  });

  const strideVertexShader = `
    attribute float aLimb;
    attribute float aIsClothes;
    attribute vec2 aWalkParams;
    uniform float uTime;

    void applyStride(inout vec3 pos, inout vec3 norm) {
      float strideCycle = uTime * aWalkParams.y + aWalkParams.x;
      float swingAngle = sin(strideCycle);
      float bob = abs(sin(strideCycle)) * 0.034;

      if (abs(aLimb - 1.0) < 0.2 || abs(aLimb + 1.0) < 0.2) {
        float side = aLimb > 0.0 ? 1.0 : -1.0;
        float legPhase = strideCycle + (side > 0.0 ? 0.0 : 3.14159265);
        float th = sin(legPhase) * 0.44;
        if (pos.y < 0.46) {
          vec3 kneePivot = vec3(0.0, 0.46, side * 0.095);
          float kneeBend = -max(0.0, cos(legPhase - 0.35)) * 0.52;
          vec3 kRel = pos - kneePivot;
          float ck = cos(kneeBend);
          float sk = sin(kneeBend);
          pos = kneePivot + vec3(kRel.x * ck - kRel.y * sk, kRel.x * sk + kRel.y * ck, kRel.z);
          norm.xy = vec2(norm.x * ck - norm.y * sk, norm.x * sk + norm.y * ck);
        }
        vec3 pivot = vec3(0.0, 0.82, side * 0.095);
        vec3 rel = pos - pivot;
        float cA = cos(th);
        float sA = sin(th);
        pos = pivot + vec3(rel.x * cA - rel.y * sA, rel.x * sA + rel.y * cA, rel.z);
        norm.xy = vec2(norm.x * cA - norm.y * sA, norm.x * sA + norm.y * cA);
      } else if (abs(aLimb - 2.0) < 0.2) {
        vec3 pivot = vec3(0.0, 1.34, 0.205);
        float th = -swingAngle * 0.32;
        vec3 rel = pos - pivot;
        float cA = cos(th);
        float sA = sin(th);
        pos = pivot + vec3(rel.x * cA - rel.y * sA, rel.x * sA + rel.y * cA, rel.z);
        norm.xy = vec2(norm.x * cA - norm.y * sA, norm.x * sA + norm.y * cA);
      } else if (abs(aLimb + 2.0) < 0.2) {
        vec3 pivot = vec3(0.0, 1.34, -0.205);
        float th = swingAngle * 0.32;
        vec3 rel = pos - pivot;
        float cA = cos(th);
        float sA = sin(th);
        pos = pivot + vec3(rel.x * cA - rel.y * sA, rel.x * sA + rel.y * cA, rel.z);
        norm.xy = vec2(norm.x * cA - norm.y * sA, norm.x * sA + norm.y * cA);
      }
      pos.y += bob;
    }
  `;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${strideVertexShader}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\napplyStride(transformed, objectNormal);')
      .replace(
        '#include <color_vertex>',
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
          vColor = vec4( 1.0 );
        #endif
        #ifdef USE_COLOR_ALPHA
          vColor *= color;
        #elif defined( USE_COLOR )
          vColor.rgb *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          if (aIsClothes > 0.5) {
            vColor.rgb *= instanceColor.rgb;
          }
        #endif
        #ifdef USE_BATCHING_COLOR
          vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'sol-pedestrian-stride';

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${strideVertexShader}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      'vec3 dummyNorm = vec3(0.0, 1.0, 0.0);\n#include <begin_vertex>\napplyStride(transformed, dummyNorm);',
    );
  };
  depthMat.customProgramCacheKey = () => 'sol-pedestrian-stride-depth';

  return {
    material: mat,
    depthMaterial: depthMat,
    setTime: (t: number) => {
      uTime.value = t;
    },
    dispose: () => {
      mat.dispose();
      depthMat.dispose();
    },
  };
}

/** Pedestrians strolling the sidewalks with vertex-shader walking stride and zero per-frame JS allocations. */
function Pedestrians() {
  const tier = useExploreStore(s => s.tier);
  const meshRef = useRef<THREE.InstancedMesh>(null);
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

  const geo = useMemo(() => {
    const base = buildAnimatedPedestrianGeometry();
    const walkParams = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const w = walkers[i]!;
      walkParams[i * 2 + 0] = (i * 1.83 + w.offset * 0.4) % 6.28318;
      walkParams[i * 2 + 1] = w.speed * 3.8;
    }
    base.setAttribute('aWalkParams', new THREE.InstancedBufferAttribute(walkParams, 2));
    return base;
  }, [count, walkers]);

  const bundle = useMemo(() => createAnimatedPedestrianMaterial(), []);

  useEffect(() => () => {
    geo.dispose();
    bundle.dispose();
  }, [geo, bundle]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    walkers.forEach((_, i) => mesh.setColorAt(i, c.set(CLOTHES[i % CLOTHES.length]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [walkers]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const qYaw = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const axisY = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    bundle.setTime(t);
    walkers.forEach((w, i) => {
      const s = (((w.offset + t * w.speed) % (WALK_SPAN * 2)) + WALK_SPAN * 2) % (WALK_SPAN * 2) - WALK_SPAN;
      const along = s * w.dir;
      const x = w.axis === 'x' ? along : w.fixed;
      const z = w.axis === 'x' ? w.fixed : along;
      const yaw = w.axis === 'x' ? (w.dir === 1 ? 0 : Math.PI) : (w.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      qYaw.setFromAxisAngle(axisY, yaw);
      v.set(x, 0, z);
      mesh.setMatrixAt(i, m.compose(v, qYaw, one));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={`ped-${count}`}
      ref={meshRef}
      args={[geo, bundle.material, count]}
      customDepthMaterial={bundle.depthMaterial}
      frustumCulled={false}
      castShadow
      receiveShadow
      raycast={NOOP}
    />
  );
}


const COMMUTERS = 14;
const PLATFORM_Y = 9.2 + 0.48 + 0.23;

/** Passengers waiting on the elevated metro platform; they sway slightly and face the tracks. */
function Commuters() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const bodyGeo = useMemo(() => buildTorsoWithArmsGeometry(), []);
  const headGeo = useMemo(() => buildHeadWithHairGeometry(), []);
  const legGeo = useMemo(() => buildStandingLegsGeometry(), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 }), []);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }), []);
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), []);
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
  const qYaw = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const axisY = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const b = bodyRef.current;
    const h = headRef.current;
    const l = legRef.current;
    if (!b || !h || !l) return;
    const t = clock.elapsedTime;
    spots.forEach((sp, i) => {
      const sway = Math.sin(t * 0.8 + i * 1.7) * 0.035;
      qYaw.setFromAxisAngle(axisY, sp.z < -56.5 ? -Math.PI / 2 : Math.PI / 2);
      v.set(sp.x + sway, PLATFORM_Y + 1.12, sp.z);
      b.setMatrixAt(i, m.compose(v, qYaw, one));
      v.set(sp.x + sway, PLATFORM_Y + 1.53, sp.z);
      h.setMatrixAt(i, m.compose(v, qYaw, one));
      v.set(sp.x, PLATFORM_Y, sp.z);
      l.setMatrixAt(i, m.compose(v, qYaw, one));
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
