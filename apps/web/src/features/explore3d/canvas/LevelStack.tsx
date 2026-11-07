/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { LevelCode, LevelNode } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, getLevels } from '../scene/selectors';
import {
  useExploreStore,
  type LevelMode,
  type WallMode,
} from '../state/exploreStore';
import {
  buildLevelGeometry,
  CUTAWAY_WALL_HEIGHT,
  type LevelBuiltGeometry,
} from '../renderers/architecture/buildLevelGeometry';
import { useExploreMaterials, type MaterialRegistry } from '../renderers/materials';
import { useCutawayWallIds } from './Cutaway';

const Y_SETTLE_EPSILON = 0.005;
const LERP_DAMPING = 10;
const NOOP_RAYCAST = () => null;

// Shared unit box (1x1x1 centered at origin) to minimize WebGL BufferGeometry allocations
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function getGeometryBoundsTransform(geom: THREE.BufferGeometry): {
  center: [number, number, number];
  size: [number, number, number];
} {
  if (!geom.boundingBox) {
    geom.computeBoundingBox();
  }
  const box = geom.boundingBox!;
  const cx = (box.min.x + box.max.x) * 0.5;
  const cy = (box.min.y + box.max.y) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const sx = Math.max(0.01, box.max.x - box.min.x);
  const sy = Math.max(0.01, box.max.y - box.min.y);
  const sz = Math.max(0.01, box.max.z - box.min.z);
  return {
    center: [cx, cy, cz],
    size: [sx, sy, sz],
  };
}

export function computeLevelTargetY(level: LevelNode, levelMode: LevelMode): number {
  return levelMode === 'exploded'
    ? level.elevation + level.explodedOffset
    : level.elevation;
}

export function isLevelVisibleInMode(
  level: LevelNode,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
): boolean {
  if (levelMode !== 'solo' || focusLevel === 'ALL') {
    return true;
  }
  if (level.code === focusLevel) {
    return true;
  }
  if (focusLevel !== 'L1') {
    return false;
  }
  const focusedNode = getLevelByCode(SOL_CENTER_SCENE, focusLevel);
  if (!focusedNode) {
    return true;
  }
  // When focused on ground floor L1 in solo mode, keep ground-level OUT & sub-slab B1 visible while hiding upper floors
  if (level.order > focusedNode.order && level.code !== 'OUT') {
    return false;
  }
  return true;
}

export function isLevelDimmedInMode(
  level: LevelNode,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
): boolean {
  if (levelMode !== 'solo' || focusLevel === 'ALL') {
    return false;
  }
  return level.code !== focusLevel;
}

interface LevelGroupProps {
  level: LevelNode;
  built: LevelBuiltGeometry;
  materials: MaterialRegistry;
  levelMode: LevelMode;
  focusLevel: LevelCode | 'ALL';
  wallMode: WallMode;
  walkMode: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  cutawayWallIds: Set<string>;
  children?: ReactNode;
}

function LevelGroup({
  level,
  built,
  materials,
  levelMode,
  focusLevel,
  wallMode,
  walkMode,
  selectedId,
  hoveredId,
  cutawayWallIds,
  children,
}: LevelGroupProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const invalidate = useThree(s => s.invalidate);

  const targetY = computeLevelTargetY(level, levelMode);
  const visible = isLevelVisibleInMode(level, levelMode, focusLevel);
  const dimmed = isLevelDimmedInMode(level, levelMode, focusLevel);

  useEffect(() => {
    invalidate();
  }, [targetY, visible, dimmed, wallMode, walkMode, selectedId, hoveredId, invalidate]);

  useFrame((_, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    const currY = grp.position.y;
    const diff = targetY - currY;
    if (Math.abs(diff) > Y_SETTLE_EPSILON) {
      const clampedDelta = delta > 0 && delta <= 0.1 ? delta : 1 / 60;
      const step = Math.min(1, clampedDelta * LERP_DAMPING);
      grp.position.y = currY + diff * step;
      invalidate();
    } else if (currY !== targetY) {
      grp.position.y = targetY;
    }
  });

  const interiorWallScaleY =
    !walkMode && wallMode === 'down'
      ? Math.min(1, CUTAWAY_WALL_HEIGHT / Math.max(0.5, level.height))
      : 1;

  const handleZoneClick = (zoneId: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useExploreStore.getState().selectNode(zoneId);
    invalidate();
  };

  const handleZonePointerOver = (zoneId: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (useExploreStore.getState().hoveredId !== zoneId) {
      useExploreStore.getState().setHoveredId(zoneId);
      invalidate();
    }
  };

  const handleZonePointerOut = (zoneId: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (useExploreStore.getState().hoveredId === zoneId) {
      useExploreStore.getState().setHoveredId(null);
      invalidate();
    }
  };

  const slabTransform = useMemo(
    () => getGeometryBoundsTransform(built.slabGeometry),
    [built.slabGeometry],
  );
  const hasInteriorOpaque =
    (built.interiorOpaqueGeometry.getAttribute('position')?.count ?? 0) > 0;
  const hasGlassWalls =
    (built.glassWallGeometry.getAttribute('position')?.count ?? 0) > 0;
  const hasInteriorDetails =
    (built.interiorDetailsGeometry.getAttribute('position')?.count ?? 0) > 0;

  return (
    <group
      ref={groupRef}
      name={level.id}
      position={[0, level.elevation, 0]}
      visible={visible}
    >
      {/* 1. Structural Slab Base (uses shared unit box to save GPU geometries) */}
      <mesh
        geometry={SHARED_UNIT_BOX}
        position={slabTransform.center}
        scale={slabTransform.size}
        material={materials.slabBase}
        receiveShadow
        raycast={NOOP_RAYCAST}
      />

      {/* 2. Dimmed Perimeter Trim Override (normal salmon perimeter trim is merged into interiorDetailsGeometry) */}
      {dimmed && (
        <mesh
          geometry={built.slabEdgeGeometry}
          material={materials.zoneBorder}
          raycast={NOOP_RAYCAST}
        />
      )}

      {/* 3. Zone Floors & Borders */}
      {built.zoneFloorGeometries.map(zf => {
        const isHighlighted = selectedId === zf.zoneId || hoveredId === zf.zoneId;
        const zfBounds = getGeometryBoundsTransform(zf.geometry);
        return (
          <group key={zf.zoneId} name={zf.zoneId}>
            <mesh
              geometry={SHARED_UNIT_BOX}
              position={zfBounds.center}
              scale={zfBounds.size}
              material={materials.getFloorMaterial(zf.floorMaterial)}
              receiveShadow
              onClick={handleZoneClick(zf.zoneId)}
              onPointerOver={handleZonePointerOver(zf.zoneId)}
              onPointerOut={handleZonePointerOut(zf.zoneId)}
            />
            {isHighlighted && (
              <mesh
                geometry={zf.borderGeometry}
                material={materials.zoneSelectedBorder}
                raycast={NOOP_RAYCAST}
              />
            )}
          </group>
        );
      })}

      {/* 4. Exterior Walls (scaled down to cutaway height when facing camera) */}
      {built.exteriorWallsByNormal.map(extWall => {
        const isCut =
          !walkMode &&
          (wallMode === 'down' ||
            (wallMode === 'cutaway' && cutawayWallIds.has(extWall.wallId)));
        const extScaleY = isCut
          ? Math.min(1, CUTAWAY_WALL_HEIGHT / Math.max(0.5, level.height))
          : 1;
        const mat = materials.getWallMaterial(extWall.material, true);
        const wallNode = SOL_CENTER_SCENE.nodes[extWall.wallId];
        const hasOpenings =
          wallNode?.type === 'wall' && wallNode.openings.length > 0;
        if (!hasOpenings) {
          const bounds = getGeometryBoundsTransform(extWall.fullGeometry);
          const scaledHeight = bounds.size[1] * extScaleY;
          return (
            <mesh
              key={extWall.wallId}
              name={extWall.wallId}
              geometry={SHARED_UNIT_BOX}
              position={[bounds.center[0], scaledHeight * 0.5, bounds.center[2]]}
              scale={[bounds.size[0], scaledHeight, bounds.size[2]]}
              material={mat}
              receiveShadow
              raycast={NOOP_RAYCAST}
            />
          );
        }
        return (
          <mesh
            key={extWall.wallId}
            name={extWall.wallId}
            geometry={extWall.fullGeometry}
            material={mat}
            scale={[1, extScaleY, 1]}
            receiveShadow
            raycast={NOOP_RAYCAST}
          />
        );
      })}

      {/* 5. Merged Interior Opaque Walls */}
      {hasInteriorOpaque && (
        <mesh
          geometry={built.interiorOpaqueGeometry}
          material={materials.walls.concrete}
          scale={[1, interiorWallScaleY, 1]}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
      )}

      {/* 6. Merged Glass Walls & Opening Panes */}
      {hasGlassWalls && (
        <mesh
          geometry={built.glassWallGeometry}
          material={materials.walls.glass}
          scale={[1, interiorWallScaleY, 1]}
          raycast={NOOP_RAYCAST}
        />
      )}

      {/* 7. Merged Architectural & Zone Interior Furnishings, Mirrors, Racks & Floodlights */}
      {hasInteriorDetails && (
        <mesh
          geometry={built.interiorDetailsGeometry}
          material={materials.vertexColored}
          receiveShadow
          raycast={NOOP_RAYCAST}
        />
      )}

      {children}
    </group>
  );
}

export interface LevelStackProps {
  renderLevelChildren?: (level: LevelNode) => ReactNode;
}

export function LevelStack({ renderLevelChildren }: LevelStackProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const wallMode = useExploreStore(s => s.wallMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);

  const materials = useExploreMaterials();
  const cutawayWallIds = useCutawayWallIds();

  const levels = useMemo(() => getLevels(SOL_CENTER_SCENE), []);

  const builtByLevelId = useMemo(() => {
    const map = new Map<string, LevelBuiltGeometry>();
    for (const lvl of levels) {
      map.set(lvl.id, buildLevelGeometry(SOL_CENTER_SCENE, lvl.id));
    }
    return map;
  }, [levels]);

  useEffect(() => {
    return () => {
      for (const built of builtByLevelId.values()) {
        built.slabGeometry.dispose();
        built.slabEdgeGeometry.dispose();
        built.interiorOpaqueGeometry.dispose();
        built.glassWallGeometry.dispose();
        built.interiorDetailsGeometry.dispose();
        for (const zf of built.zoneFloorGeometries) {
          zf.geometry.dispose();
          zf.borderGeometry.dispose();
        }
        for (const ext of built.exteriorWallsByNormal) {
          ext.fullGeometry.dispose();
          ext.lowCutGeometry.dispose();
        }
      }
    };
  }, [builtByLevelId]);

  return (
    <group name="sol-level-stack">
      {levels.map(level => {
        const built = builtByLevelId.get(level.id);
        if (!built) return null;
        return (
          <LevelGroup
            key={level.id}
            level={level}
            built={built}
            materials={materials}
            levelMode={levelMode}
            focusLevel={focusLevel}
            wallMode={wallMode}
            walkMode={walkMode}
            selectedId={selectedId}
            hoveredId={hoveredId}
            cutawayWallIds={cutawayWallIds}
          >
            {renderLevelChildren ? renderLevelChildren(level) : null}
          </LevelGroup>
        );
      })}
    </group>
  );
}

export default LevelStack;
