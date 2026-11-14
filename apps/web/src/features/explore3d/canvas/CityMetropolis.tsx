import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMPUS_FLAGPOLE_ANCHORS } from '../renderers/architecture/buildCampusGeometry';
import { buildCityMetropolis, buildGymCrown } from '../renderers/architecture/buildCityMetropolis';
import { useDocumentTheme, type ExploreTheme } from '../renderers/materials';
import {
  SURFACE_DETAIL_PRESETS,
  applyCityGlazingShader,
  applySurfaceDetail,
  createFoliageMaterialBundle,
} from '../renderers/surfaceDetail';
import { useExploreStore } from '../state/exploreStore';
import { CityLife } from './CityLife';
import { CitySky } from './CitySky';
import { CityTraffic } from './CityTraffic';

const NOOP_RAYCAST = () => null;

/** Surrounding skyline, road grid, metro viaduct, plus wind-animated campus flags. */
export function CityMetropolis() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const city = useMemo(() => buildCityMetropolis(theme, tier), [theme, tier]);
  const visible = levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'L1' || focusLevel === 'OUT';

  // Scanned-concrete / asphalt grain & surface roughness from per-vertex `surf`.
  const opaqueMat = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-city-opaque', vertexColors: true, roughness: 0.78, envMapIntensity: 1.05 }),
        SURFACE_DETAIL_PRESETS.cityOpaque,
      ),
    [],
  );
  const metalMat = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-city-metal', vertexColors: true, roughness: 0.38, metalness: 0.65, envMapIntensity: 1.5 }),
        // Relief at 80 cycles/m is sub-pixel from the locked camera distance, so skip it.
        { ...SURFACE_DETAIL_PRESETS.metal, bump: 0, albedo: 0, roughness: 0 },
      ),
    [],
  );
  useEffect(() => () => opaqueMat.dispose(), [opaqueMat]);
  useEffect(() => () => metalMat.dispose(), [metalMat]);
  // Translucent so the penthouse stays visible from above through its roof.
  const roofGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: 'sol-gym-roof-glass',
        vertexColors: true,
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        envMapIntensity: 1.4,
      }),
    [],
  );
  useEffect(() => () => roofGlassMat.dispose(), [roofGlassMat]);
  const glassMat = useMemo(
    () =>
      applyCityGlazingShader(
        new THREE.MeshStandardMaterial({
          name: 'sol-city-glass',
          vertexColors: true,
          roughness: 0.16,
          metalness: 0.62,
          envMapIntensity: 1.15,
        }),
        theme === 'light',
      ),
    [theme],
  );
  const cityFoliageBundle = useMemo(
    () => createFoliageMaterialBundle('sol-city-foliage', theme === 'light'),
    [theme],
  );
  useEffect(
    () => () => {
      cityFoliageBundle.material.dispose();
      cityFoliageBundle.depthMaterial.dispose();
      cityFoliageBundle.texture.dispose();
    },
    [cityFoliageBundle],
  );
  const emissiveMat = useMemo(
    () => new THREE.MeshBasicMaterial({ name: 'sol-city-emissive', vertexColors: true, toneMapped: false }),
    [],
  );
  useEffect(() => () => glassMat.dispose(), [glassMat]);
  useEffect(() => () => emissiveMat.dispose(), [emissiveMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    cityFoliageBundle.setTime(clock.elapsedTime);
  });

  return (
    <group name="sol-city-metropolis" visible={visible}>
      <mesh name="sol-city-opaque" geometry={city.opaqueGeometry} material={opaqueMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-metal" geometry={city.metalGeometry} material={metalMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-glass" geometry={city.glassGeometry} material={glassMat} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-emissive" geometry={city.emissiveGeometry} material={emissiveMat} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-foliage" geometry={city.foliageGeometry} material={cityFoliageBundle.material} receiveShadow raycast={NOOP_RAYCAST} />
      <GymCrown theme={theme} glassMat={roofGlassMat} emissiveMat={emissiveMat} opaqueMat={opaqueMat} metalMat={metalMat} />
      <CityTraffic />
      <CityLife city={city} />
      <CitySky />
      <Flags isLight={theme === 'light'} />
    </group>
  );
}

function Flags({ isLight }: { isLight: boolean }) {
  const invalidate = useThree(s => s.invalidate);
  const flags = useMemo(
    () =>
      CAMPUS_FLAGPOLE_ANCHORS.map(a => {
        const geom = new THREE.PlaneGeometry(a.width, a.height, 12, 3);
        geom.translate(a.width / 2, 0, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: a.variant === 'salmon' ? (isLight ? '#d9826a' : '#e8a090') : '#1e293b',
          side: THREE.DoubleSide,
          roughness: 0.82,
        });
        const base = Float32Array.from(geom.getAttribute('position').array);
        return { a, geom, mat, base };
      }),
    [isLight],
  );
  useEffect(
    () => () => {
      flags.forEach(f => {
        f.geom.dispose();
        f.mat.dispose();
      });
    },
    [flags],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const f of flags) {
      const pos = f.geom.getAttribute('position') as THREE.BufferAttribute;
      const norm = f.geom.getAttribute('normal') as THREE.BufferAttribute;
      const invW = 1 / f.a.width;
      for (let i = 0; i < pos.count; i += 1) {
        const x = f.base[i * 3]!;
        const k = x * invW;
        const phase = x * 5 - t * 4 + f.a.z;
        const sinP = Math.sin(phase);
        const cosP = Math.cos(phase);
        pos.setZ(i, sinP * 0.1 * k);
        pos.setY(i, f.base[i * 3 + 1]! + Math.sin(x * 3 - t * 3) * 0.03 * k);
        const dzdx = 0.1 * invW * (sinP + x * 5 * cosP);
        const invLen = 1 / Math.hypot(dzdx, 1);
        norm.setXYZ(i, -dzdx * invLen, 0, invLen);
      }
      pos.needsUpdate = true;
      norm.needsUpdate = true;
    }
    invalidate();
  });
  return (
    <>
      {flags.map(f => (
        <mesh key={f.a.id} geometry={f.geom} material={f.mat} position={[f.a.x, f.a.y, f.a.z]} castShadow raycast={NOOP_RAYCAST} />
      ))}
    </>
  );
}

interface GymCrownProps {
  theme: ExploreTheme;
  glassMat: THREE.Material;
  emissiveMat: THREE.Material;
  opaqueMat: THREE.Material;
  metalMat: THREE.Material;
}

/** Roof crown sits on the stacked roof slab, so it hides when levels are exploded or isolated. */
function GymCrown({ theme, glassMat, emissiveMat, opaqueMat, metalMat }: GymCrownProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const crown = useMemo(() => buildGymCrown(theme), [theme]);
  return (
    <group name="sol-gym-crown" visible={levelMode === 'stacked'}>
      <mesh geometry={crown.opaqueGeometry} material={opaqueMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.metalGeometry} material={metalMat} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.glassGeometry} material={glassMat} raycast={NOOP_RAYCAST} />
      <mesh geometry={crown.emissiveGeometry} material={emissiveMat} raycast={NOOP_RAYCAST} />
    </group>
  );
}
