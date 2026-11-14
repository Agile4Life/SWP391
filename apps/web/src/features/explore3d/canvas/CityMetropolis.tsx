import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMPUS_FLAGPOLE_ANCHORS } from '../renderers/architecture/buildCampusGeometry';
import { buildCityMetropolis } from '../renderers/architecture/buildCityMetropolis';
import { useDocumentTheme, useExploreMaterials } from '../renderers/materials';
import { useExploreStore } from '../state/exploreStore';
import { CityTraffic } from './CityTraffic';

const NOOP_RAYCAST = () => null;

/** Surrounding skyline, road grid, metro viaduct, plus wind-animated campus flags. */
export function CityMetropolis() {
  const theme = useDocumentTheme();
  const tier = useExploreStore(s => s.tier);
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const materials = useExploreMaterials(theme);
  const city = useMemo(() => buildCityMetropolis(theme, tier), [theme, tier]);
  const visible = levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'L1' || focusLevel === 'OUT';

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: 'sol-city-glass',
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.7,
        envMapIntensity: 1.4,
      }),
    [],
  );
  const emissiveMat = useMemo(
    () => new THREE.MeshBasicMaterial({ name: 'sol-city-emissive', vertexColors: true, toneMapped: false }),
    [],
  );
  useEffect(() => () => glassMat.dispose(), [glassMat]);
  useEffect(() => () => emissiveMat.dispose(), [emissiveMat]);

  const castShadows = tier !== 'low';
  return (
    <group name="sol-city-metropolis" visible={visible}>
      <mesh name="sol-city-opaque" geometry={city.opaqueGeometry} material={materials.vertexColored} receiveShadow castShadow={castShadows} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-metal" geometry={city.metalGeometry} material={materials.vertexColored} receiveShadow raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-glass" geometry={city.glassGeometry} material={glassMat} raycast={NOOP_RAYCAST} />
      <mesh name="sol-city-emissive" geometry={city.emissiveGeometry} material={emissiveMat} raycast={NOOP_RAYCAST} />
      <CityTraffic />
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
          roughness: 0.7,
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
      for (let i = 0; i < pos.count; i += 1) {
        const x = f.base[i * 3]!;
        const k = x / f.a.width;
        pos.setZ(i, Math.sin(x * 5 - t * 4 + f.a.z) * 0.1 * k);
        pos.setY(i, f.base[i * 3 + 1]! + Math.sin(x * 3 - t * 3) * 0.03 * k);
      }
      pos.needsUpdate = true;
      f.geom.computeVertexNormals();
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
