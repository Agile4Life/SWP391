/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildCampusGeometry,
  buildCampusSignageGeometry,
  buildCampusVehiclesGeometry,
  createCampusSignageTexture,
} from '../renderers/architecture/buildCampusGeometry';
import {
  getExploreThemePalette,
  useDocumentTheme,
  useExploreMaterials,
} from '../renderers/materials';
import { useExploreStore } from '../state/exploreStore';
import { SURFACE_DETAIL_PRESETS, applySurfaceDetail } from '../renderers/surfaceDetail';
import { getAtmosphere } from './atmosphere';
import { PracticalLights } from './PracticalLights';
import { SkyDome } from './SkyProbe';

export const PLAZA_BOUNDS = {
  minX: -45,
  maxX: 58,
  minZ: -30,
  maxZ: 30,
  y: -0.04,
} as const;

export const ENTRANCE_WALKWAY_BOUNDS = {
  minX: -4,
  maxX: 8,
  minZ: 16,
  maxZ: 22,
  y: -0.025,
} as const;

export function buildPlazaGridGeometry(
  minX: number = PLAZA_BOUNDS.minX,
  maxX: number = PLAZA_BOUNDS.maxX,
  minZ: number = PLAZA_BOUNDS.minZ,
  maxZ: number = PLAZA_BOUNDS.maxZ,
  step = 4,
): THREE.BufferGeometry {
  const points: number[] = [];
  for (let x = minX; x <= maxX; x += step) {
    points.push(x, 0, minZ, x, 0, maxZ);
  }
  for (let z = minZ; z <= maxZ; z += step) {
    points.push(minX, 0, z, maxX, 0, z);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geom;
}

const SHARED_PLAZA_PLANE = new THREE.PlaneGeometry(1, 1);
const TERRAIN_DISC = new THREE.CircleGeometry(1000, 64);
const NOOP_RAYCAST = () => null;

export function Environment() {
  const theme = useDocumentTheme();
  const palette = getExploreThemePalette(theme);
  const materials = useExploreMaterials(theme);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const levelMode = useExploreStore(s => s.levelMode);
  const tier = useExploreStore(s => s.tier);
  const practicals = getAtmosphere(theme).practicals;
  const invalidate = useThree(s => s.invalidate);

  const plazaY =
    levelMode === 'exploded'
      ? -10.82
      : focusLevel === 'B1'
        ? -4.82
        : PLAZA_BOUNDS.y;

  const campusGeometry = useMemo(() => buildCampusGeometry(theme), [theme]);
  const vehiclesGeometry = useMemo(() => buildCampusVehiclesGeometry(theme), [theme]);
  // Clear-coated metallic paint; glass, tyres and lamps share it via vertex colours.
  const vehicleMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        name: 'sol-campus-vehicles',
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.4,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.25,
      }),
    [],
  );
  useEffect(() => () => vehiclesGeometry.dispose(), [vehiclesGeometry]);
  useEffect(() => () => vehicleMaterial.dispose(), [vehicleMaterial]);
  const castShadows = tier !== 'low';
  const showRooftopSigns =
    levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'RF';
  const showGroundCampus =
    levelMode !== 'solo' ||
    focusLevel === 'ALL' ||
    focusLevel === 'L1' ||
    focusLevel === 'OUT';
  const rooftopOffsetY = levelMode === 'exploded' ? 12.0 : 0;

  const signageGeometry = useMemo(
    () => buildCampusSignageGeometry(rooftopOffsetY, showRooftopSigns),
    [rooftopOffsetY, showRooftopSigns],
  );
  // Illuminated signage emits above 1.0 at dusk so it blooms like a lit sign.
  const signageMaterialBundle = useMemo(() => {
    const tex = createCampusSignageTexture();
    const mat = new THREE.MeshBasicMaterial({
      name: 'sol-campus-signage-atlas-mat',
      map: tex ?? undefined,
      color: tex ? '#ffffff' : '#ce9180',
      side: THREE.DoubleSide,
      toneMapped: !practicals,
    });
    if (tex && practicals) mat.color.setScalar(2.4);
    return { tex, mat };
  }, [practicals]);

  useEffect(() => {
    invalidate();
  }, [theme, plazaY, levelMode, focusLevel, practicals, tier, invalidate]);

  useEffect(() => {
    return () => {
      campusGeometry.dispose();
    };
  }, [campusGeometry]);

  useEffect(() => {
    return () => {
      signageGeometry.dispose();
    };
  }, [signageGeometry]);

  useEffect(() => {
    return () => {
      signageMaterialBundle.mat.dispose();
      signageMaterialBundle.tex?.dispose();
    };
  }, [signageMaterialBundle]);

  const plazaWidth = PLAZA_BOUNDS.maxX - PLAZA_BOUNDS.minX;
  const plazaDepth = PLAZA_BOUNDS.maxZ - PLAZA_BOUNDS.minZ;
  const plazaCenterX = (PLAZA_BOUNDS.minX + PLAZA_BOUNDS.maxX) * 0.5;
  const plazaCenterZ = (PLAZA_BOUNDS.minZ + PLAZA_BOUNDS.maxZ) * 0.5;

  const gridGeometry = useMemo(() => buildPlazaGridGeometry(), []);

  // Terrain out to the horizon so the campus sits in a world instead of a void;
  // the post haze dissolves it into the sky.
  const terrainColor = getAtmosphere(theme).terrain;
  const terrainMaterial = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({ name: 'sol-terrain', roughness: 0.92, metalness: 0 }),
        SURFACE_DETAIL_PRESETS.terrain,
      ),
    [],
  );
  useEffect(() => {
    terrainMaterial.color.set(terrainColor);
  }, [terrainMaterial, terrainColor]);
  useEffect(() => () => terrainMaterial.dispose(), [terrainMaterial]);

  useEffect(() => {
    return () => {
      gridGeometry.dispose();
    };
  }, [gridGeometry]);

  return (
    <>
      <color attach="background" args={[palette.canvasBg]} />
      {/* Sky + height haze replace the flat fog: the haze is applied in the post grade. */}
      <SkyDome theme={theme} />

      <PracticalLights
        tier={tier}
        offsetY={plazaY - PLAZA_BOUNDS.y}
        visible={practicals && showGroundCampus}
      />

      <group name="sol-plaza-environment">
        {/* Ground Plaza Plane [-45..58] X, [-30..30] Z */}
        <mesh
          position={[plazaCenterX, plazaY, plazaCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[plazaWidth, plazaDepth, 1]}
          geometry={SHARED_PLAZA_PLANE}
          material={materials.plazaGround}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        <mesh
          name="sol-terrain"
          position={[plazaCenterX, plazaY - 0.05, plazaCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={TERRAIN_DISC}
          material={terrainMaterial}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        {/* Subtle Architectural Grid Lines */}
        <lineSegments
          position={[0, plazaY + 0.008, 0]}
          geometry={gridGeometry}
          material={materials.plazaGrid}
        />

        {/* Full 3D Exterior Campus: Main Gate, Guard Booth, Car & Motorbike Parking, EV Chargers, Fountain, Canopy, Trees & Streetlamps */}
        <mesh
          name="sol-campus-architecture"
          visible={showGroundCampus}
          geometry={campusGeometry}
          material={materials.vertexColored}
          castShadow={castShadows}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
        <mesh
          name="sol-campus-vehicles"
          visible={showGroundCampus}
          geometry={vehiclesGeometry}
          material={vehicleMaterial}
          castShadow={castShadows}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />

        {/* Illuminated 3D Rooftop Sky-Signs, Gate Sign, Lobby Canopy Sign, Parking & Tennis Signs */}
        <mesh
          name="sol-campus-signage"
          visible={showGroundCampus}
          geometry={signageGeometry}
          material={signageMaterialBundle.mat}
          raycast={NOOP_RAYCAST}
        />
      </group>
    </>
  );
}

export default Environment;
