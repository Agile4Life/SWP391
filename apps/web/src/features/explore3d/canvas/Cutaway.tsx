/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevels, wallsOfLevel } from '../scene/selectors';
import { useExploreStore, type WallMode } from '../state/exploreStore';
import {
  computeExteriorWallNormal,
  type ExteriorWallBuiltRecord,
} from '../renderers/architecture/buildLevelGeometry';

export const CUTAWAY_DOT_THRESHOLD = 0.22;

export type CutawayWallDescriptor = Pick<
  ExteriorWallBuiltRecord,
  'wallId' | 'normal' | 'center'
>;

/**
 * Computes `dot(wallNormalXZ, normalize(cameraPosXZ - wallCenterXZ))`.
 */
export function computeWallCameraDot(
  wallNormalXZ: readonly [number, number],
  wallCenterXZ: readonly [number, number],
  cameraPosXZ: readonly [number, number],
): number {
  const dx = cameraPosXZ[0] - wallCenterXZ[0];
  const dz = cameraPosXZ[1] - wallCenterXZ[1];
  const dist = Math.hypot(dx, dz);
  if (dist <= 1e-5) {
    return 0;
  }
  const dirX = dx / dist;
  const dirZ = dz / dist;
  return wallNormalXZ[0] * dirX + wallNormalXZ[1] * dirZ;
}

/**
 * Returns true when an exterior wall faces the camera (`dot > 0.22`).
 */
export function isWallFacingCamera(
  wallNormalXZ: readonly [number, number],
  wallCenterXZ: readonly [number, number],
  cameraPosXZ: readonly [number, number],
  threshold: number = CUTAWAY_DOT_THRESHOLD,
): boolean {
  return computeWallCameraDot(wallNormalXZ, wallCenterXZ, cameraPosXZ) > threshold;
}

/**
 * Computes the set of exterior wall IDs that should be rendered in cutaway (low height)
 * given the current `wallMode` and camera XZ position.
 */
export function computeCutawayWallIds(
  walls: ReadonlyArray<CutawayWallDescriptor>,
  cameraPosXZ: readonly [number, number],
  wallMode: WallMode,
  threshold: number = CUTAWAY_DOT_THRESHOLD,
): Set<string> {
  const result = new Set<string>();
  if (wallMode === 'up') {
    return result;
  }
  if (wallMode === 'down') {
    for (const w of walls) {
      result.add(w.wallId);
    }
    return result;
  }
  for (const w of walls) {
    if (isWallFacingCamera(w.normal, w.center, cameraPosXZ, threshold)) {
      result.add(w.wallId);
    }
  }
  return result;
}

export function serializeWallIdSet(ids: Set<string>): string {
  if (ids.size === 0) return '';
  return Array.from(ids).sort().join('|');
}

interface CutawayStoreState {
  signature: string;
  cutawayWallIds: Set<string>;
  setCutawayWalls: (nextIds: Set<string>, nextSignature: string) => void;
}

export const useCutawayStore = create<CutawayStoreState>(set => ({
  signature: '',
  cutawayWallIds: new Set<string>(),
  setCutawayWalls: (nextIds, nextSignature) =>
    set({
      cutawayWallIds: nextIds,
      signature: nextSignature,
    }),
}));

export function collectSceneExteriorWallDescriptors(): CutawayWallDescriptor[] {
  const descriptors: CutawayWallDescriptor[] = [];
  const levels = getLevels(SOL_CENTER_SCENE);
  for (const level of levels) {
    const walls = wallsOfLevel(SOL_CENTER_SCENE, level.id);
    for (const wall of walls) {
      if (!wall.exterior) continue;
      descriptors.push({
        wallId: wall.id,
        normal: computeExteriorWallNormal(wall, level.slabPolygon),
        center: [
          (wall.start[0] + wall.end[0]) * 0.5,
          (wall.start[1] + wall.end[1]) * 0.5,
        ],
      });
    }
  }
  return descriptors;
}

export function useCutawayWallIds(): Set<string> {
  const cutawayWallIds = useCutawayStore(s => s.cutawayWallIds);
  const [localIds, setLocalIds] = useState<Set<string>>(cutawayWallIds);

  useEffect(() => {
    setLocalIds(cutawayWallIds);
  }, [cutawayWallIds]);

  return localIds;
}

export interface CutawayProps {
  walls?: ReadonlyArray<CutawayWallDescriptor>;
}

/**
 * R3F controller component that evaluates which exterior walls face the camera
 * and updates cutaway state when `wallMode` or camera direction changes,
 * calling `invalidate()` only when the cutaway wall set changes.
 */
export function Cutaway({ walls }: CutawayProps) {
  const wallMode = useExploreStore(s => s.wallMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const levelMode = useExploreStore(s => s.levelMode);
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);

  const hiddenWallIdsRef = useRef<Set<string>>(useCutawayStore.getState().cutawayWallIds);
  const lastSampleRef = useRef<{ x: number; z: number; mode: string; levelMode: string }>({
    x: Number.NaN,
    z: Number.NaN,
    mode: '',
    levelMode: '',
  });

  const descriptors = useMemo(
    () => (walls && walls.length > 0 ? walls : collectSceneExteriorWallDescriptors()),
    [walls],
  );

  // Sync immediately when wallMode, walkMode, or levelMode changes
  useEffect(() => {
    const effectiveWallMode: WallMode =
      walkMode && wallMode === 'cutaway' ? 'up' : wallMode;
    const camXZ: [number, number] = [camera.position.x, camera.position.z];
    const ids = computeCutawayWallIds(descriptors, camXZ, effectiveWallMode);
    lastSampleRef.current = {
      x: camera.position.x,
      z: camera.position.z,
      mode: effectiveWallMode,
      levelMode,
    };
    const prev = hiddenWallIdsRef.current;
    const unchanged = ids.size === prev.size && Array.from(ids).every(id => prev.has(id));
    if (!unchanged) {
      hiddenWallIdsRef.current = ids;
      useCutawayStore.getState().setCutawayWalls(ids, serializeWallIdSet(ids));
      invalidate();
    }
  }, [wallMode, walkMode, levelMode, descriptors, camera, invalidate]);

  useFrame(({ camera: frameCamera, invalidate: frameInvalidate }) => {
    const state = useExploreStore.getState();
    const effectiveWallMode: WallMode =
      state.walkMode && state.wallMode === 'cutaway' ? 'up' : state.wallMode;
    const currentLevelMode = state.levelMode;

    if (effectiveWallMode !== 'cutaway') {
      if (effectiveWallMode === 'up') {
        if (hiddenWallIdsRef.current.size > 0) {
          const cleared = new Set<string>();
          hiddenWallIdsRef.current = cleared;
          useCutawayStore.getState().setCutawayWalls(cleared, '');
          frameInvalidate();
        }
        lastSampleRef.current = {
          x: frameCamera.position.x,
          z: frameCamera.position.z,
          mode: effectiveWallMode,
          levelMode: currentLevelMode,
        };
        return;
      }

      if (
        lastSampleRef.current.mode === effectiveWallMode &&
        hiddenWallIdsRef.current.size === descriptors.length
      ) {
        return;
      }

      const downIds = computeCutawayWallIds(
        descriptors,
        [frameCamera.position.x, frameCamera.position.z],
        effectiveWallMode,
      );
      lastSampleRef.current = {
        x: frameCamera.position.x,
        z: frameCamera.position.z,
        mode: effectiveWallMode,
        levelMode: currentLevelMode,
      };
      const prevDown = hiddenWallIdsRef.current;
      const downUnchanged =
        downIds.size === prevDown.size && Array.from(downIds).every(id => prevDown.has(id));
      if (!downUnchanged) {
        hiddenWallIdsRef.current = downIds;
        useCutawayStore.getState().setCutawayWalls(downIds, serializeWallIdSet(downIds));
        frameInvalidate();
      }
      return;
    }

    const dx = frameCamera.position.x - lastSampleRef.current.x;
    const dz = frameCamera.position.z - lastSampleRef.current.z;
    if (
      lastSampleRef.current.mode === effectiveWallMode &&
      lastSampleRef.current.levelMode === currentLevelMode &&
      dx * dx + dz * dz < 0.01
    ) {
      return;
    }

    lastSampleRef.current = {
      x: frameCamera.position.x,
      z: frameCamera.position.z,
      mode: effectiveWallMode,
      levelMode: currentLevelMode,
    };

    const camXZ: [number, number] = [frameCamera.position.x, frameCamera.position.z];
    const ids = computeCutawayWallIds(descriptors, camXZ, effectiveWallMode);
    const prev = hiddenWallIdsRef.current;
    const unchanged = ids.size === prev.size && Array.from(ids).every(id => prev.has(id));
    if (!unchanged) {
      hiddenWallIdsRef.current = ids;
      useCutawayStore.getState().setCutawayWalls(ids, serializeWallIdSet(ids));
      frameInvalidate();
    }
  });

  return null;
}

export default Cutaway;
