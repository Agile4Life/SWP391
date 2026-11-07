/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getExploreThemePalette,
  useDocumentTheme,
  useExploreMaterials,
} from '../renderers/materials';
import { useExploreStore } from '../state/exploreStore';

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

export function Environment() {
  const theme = useDocumentTheme();
  const palette = getExploreThemePalette(theme);
  const materials = useExploreMaterials(theme);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const levelMode = useExploreStore(s => s.levelMode);
  const invalidate = useThree(s => s.invalidate);

  const plazaY =
    levelMode === 'exploded'
      ? -10.82
      : focusLevel === 'B1'
        ? -4.82
        : PLAZA_BOUNDS.y;
  const showEntranceWalkway = levelMode !== 'exploded' && focusLevel !== 'B1';

  useEffect(() => {
    invalidate();
  }, [theme, plazaY, showEntranceWalkway, invalidate]);

  const plazaWidth = PLAZA_BOUNDS.maxX - PLAZA_BOUNDS.minX;
  const plazaDepth = PLAZA_BOUNDS.maxZ - PLAZA_BOUNDS.minZ;
  const plazaCenterX = (PLAZA_BOUNDS.minX + PLAZA_BOUNDS.maxX) * 0.5;
  const plazaCenterZ = (PLAZA_BOUNDS.minZ + PLAZA_BOUNDS.maxZ) * 0.5;

  const walkwayWidth = ENTRANCE_WALKWAY_BOUNDS.maxX - ENTRANCE_WALKWAY_BOUNDS.minX;
  const walkwayDepth = ENTRANCE_WALKWAY_BOUNDS.maxZ - ENTRANCE_WALKWAY_BOUNDS.minZ;
  const walkwayCenterX =
    (ENTRANCE_WALKWAY_BOUNDS.minX + ENTRANCE_WALKWAY_BOUNDS.maxX) * 0.5;
  const walkwayCenterZ =
    (ENTRANCE_WALKWAY_BOUNDS.minZ + ENTRANCE_WALKWAY_BOUNDS.maxZ) * 0.5;

  const gridGeometry = useMemo(() => buildPlazaGridGeometry(), []);

  useEffect(() => {
    return () => {
      gridGeometry.dispose();
    };
  }, [gridGeometry]);

  return (
    <>
      <color attach="background" args={[palette.canvasBg]} />
      <fog attach="fog" args={[palette.fogColor, 85, 195]} />

      <group name="sol-plaza-environment">
        {/* Ground Plaza Plane [-45..58] X, [-30..30] Z */}
        <mesh
          position={[plazaCenterX, plazaY, plazaCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={materials.plazaGround}
          receiveShadow
        >
          <planeGeometry args={[plazaWidth, plazaDepth]} />
        </mesh>

        {/* Subtle Architectural Grid Lines */}
        <lineSegments
          position={[0, plazaY + 0.008, 0]}
          geometry={gridGeometry}
          material={materials.plazaGrid}
        />

        {/* Salmon Entrance Walkway at South Facade (z = 16..22) */}
        {showEntranceWalkway && (
          <mesh
            position={[walkwayCenterX, ENTRANCE_WALKWAY_BOUNDS.y, walkwayCenterZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={materials.plazaWalkway}
            receiveShadow
          >
            <planeGeometry args={[walkwayWidth, walkwayDepth]} />
          </mesh>
        )}
      </group>
    </>
  );
}

export default Environment;
