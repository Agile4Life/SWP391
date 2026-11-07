/* eslint-disable react-refresh/only-export-components */
import { context as r3fContext } from '@react-three/fiber';
import { useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SceneDoc, Vec3 } from '../scene/schema';
import { worldBox, type WorldBox } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore, type LevelMode } from '../state/exploreStore';

export interface SelectionHighlightProps {
  scene?: SceneDoc;
}

export interface HighlightFrameSpec {
  position: Vec3;
  scale: Vec3;
  box: WorldBox;
}

export function computeHighlightFrame(
  scene: SceneDoc,
  nodeId: string | null | undefined,
  levelMode: LevelMode,
): HighlightFrameSpec | null {
  if (!nodeId) return null;
  const box = worldBox(scene, nodeId, levelMode);
  if (!box) return null;

  const padXZ = 0.16;
  const baseY = box.min[1] + 0.04;
  const height = Math.max(0.18, box.size[1]);

  return {
    position: [box.center[0], baseY, box.center[2]],
    scale: [box.size[0] + padXZ, height, box.size[2] + padXZ],
    box,
  };
}

/**
 * Builds a reusable unit architectural bounding frame (x: -0.5..0.5, y: 0..1, z: -0.5..0.5)
 * with double base ring at y = 0 and corner brackets at y = 1 so selection + hover cost
 * only 1-2 draw calls and zero runtime geometry allocations.
 */
export function buildUnitHighlightFrameGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];

  const pushRectXZ = (halfX: number, y: number, halfZ: number) => {
    pts.push(
      -halfX, y, -halfZ,  halfX, y, -halfZ,
       halfX, y, -halfZ,  halfX, y,  halfZ,
       halfX, y,  halfZ, -halfX, y,  halfZ,
      -halfX, y,  halfZ, -halfX, y, -halfZ,
    );
  };

  // Outer & inner base perimeter rings at y = 0
  pushRectXZ(0.5, 0, 0.5);
  pushRectXZ(0.47, 0.005, 0.47);

  // Top perimeter frame at y = 1
  pushRectXZ(0.5, 1, 0.5);

  // 4 vertical corner posts
  const corners: Array<[number, number]> = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  for (const [cx, cz] of corners) {
    pts.push(cx, 0, cz, cx, 1, cz);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geometry;
}

export function SelectionHighlight({ scene = SOL_CENTER_SCENE }: SelectionHighlightProps) {
  const r3fStore = useContext(r3fContext);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);
  const levelMode = useExploreStore(s => s.levelMode);

  const resources = useMemo(() => {
    const geometry = buildUnitHighlightFrameGeometry();
    const selectedMaterial = new THREE.LineBasicMaterial({
      name: 'sol-selection-highlight-mat',
      color: '#ce9180',
      transparent: true,
      opacity: 0.95,
    });
    const hoveredMaterial = new THREE.LineBasicMaterial({
      name: 'sol-hover-highlight-mat',
      color: '#e1aa98',
      transparent: true,
      opacity: 0.55,
    });
    return { geometry, selectedMaterial, hoveredMaterial };
  }, []);

  useEffect(() => {
    return () => {
      resources.geometry.dispose();
      resources.selectedMaterial.dispose();
      resources.hoveredMaterial.dispose();
    };
  }, [resources]);

  const selectedFrame = useMemo(
    () => computeHighlightFrame(scene, selectedId, levelMode),
    [scene, selectedId, levelMode],
  );

  const hoveredFrame = useMemo(() => {
    if (!hoveredId || hoveredId === selectedId) return null;
    return computeHighlightFrame(scene, hoveredId, levelMode);
  }, [scene, hoveredId, selectedId, levelMode]);

  useEffect(() => {
    r3fStore?.getState().invalidate();
  }, [selectedFrame, hoveredFrame, r3fStore]);

  if (!selectedFrame && !hoveredFrame) {
    return null;
  }

  return (
    <group name="sol-selection-highlight">
      {selectedFrame && (
        <lineSegments
          name="sol-selected-wireframe"
          position={selectedFrame.position}
          scale={selectedFrame.scale}
          geometry={resources.geometry}
          material={resources.selectedMaterial}
          raycast={() => null}
        />
      )}
      {hoveredFrame && (
        <lineSegments
          name="sol-hovered-wireframe"
          position={hoveredFrame.position}
          scale={hoveredFrame.scale}
          geometry={resources.geometry}
          material={resources.hoveredMaterial}
          raycast={() => null}
        />
      )}
    </group>
  );
}

export default SelectionHighlight;
