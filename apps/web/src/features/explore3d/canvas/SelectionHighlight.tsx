/* eslint-disable react-refresh/only-export-components */
import { context as r3fContext } from '@react-three/fiber';
import { useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SceneDoc, Vec3 } from '../scene/schema';
import { worldBox, type WorldBox } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getExploreUiAccent, useDocumentTheme } from '../renderers/materials';
import { useExploreStore, type LevelMode } from '../state/exploreStore';

/** Props của khung tô sáng: cảnh. */
export interface SelectionHighlightProps {
  scene?: SceneDoc;
}

/** Mô tả khung tô sáng: vị trí, tỉ lệ và hộp bao. */
export interface HighlightFrameSpec {
  position: Vec3;
  scale: Vec3;
  box: WorldBox;
}

/** Tính khung tô sáng cho một nút theo chế độ tầng (không có nút hoặc hộp bao thì null). */
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
 * Dựng hình khung đơn vị dùng lại cho mọi lần chọn/rê: vòng đáy đôi và các góc ở đỉnh, chỉ tốn 1–2 draw call và
 * không cấp phát hình học lúc chạy.
 *
 * Builds a reusable unit architectural bounding frame (x: -0.5..0.5, y: 0..1, z: -0.5..0.5)
 * with double base ring at y = 0 and corner brackets at y = 1 so selection + hover cost
 * only 1-2 draw calls and zero runtime geometry allocations.
 */
export function buildUnitHighlightFrameGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];

  // Thêm bốn cạnh hình chữ nhật trong mặt phẳng XZ tại độ cao y.
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

/** Khung tô sáng đối tượng đang chọn và đang rê chuột (vật liệu theo màu nhấn của theme). */
export function SelectionHighlight({ scene = SOL_CENTER_SCENE }: SelectionHighlightProps) {
  const r3fStore = useContext(r3fContext);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);
  const levelMode = useExploreStore(s => s.levelMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const theme = useDocumentTheme();

  // Tạo hình học và vật liệu một lần cho mỗi theme.
  const resources = useMemo(() => {
    const uiAccent = getExploreUiAccent(theme);
    const geometry = buildUnitHighlightFrameGeometry();
    const selectedMaterial = new THREE.LineBasicMaterial({
      name: 'sol-selection-highlight-mat',
      color: uiAccent.accent,
      transparent: true,
      opacity: 0.95,
    });
    const hoveredMaterial = new THREE.LineBasicMaterial({
      name: 'sol-hover-highlight-mat',
      color: uiAccent.hover,
      transparent: true,
      opacity: 0.55,
    });
    return { geometry, selectedMaterial, hoveredMaterial };
  }, [theme]);

  useEffect(() => {
    return () => {
      resources.geometry.dispose();
      resources.selectedMaterial.dispose();
      resources.hoveredMaterial.dispose();
    };
  }, [resources]);

  // Khung của đối tượng đang chọn.
  const selectedFrame = useMemo(
    () => computeHighlightFrame(scene, selectedId, levelMode),
    [scene, selectedId, levelMode],
  );

  // Khung của đối tượng đang rê (không trùng với đối tượng đang chọn).
  const hoveredFrame = useMemo(() => {
    if (!hoveredId || hoveredId === selectedId) return null;
    return computeHighlightFrame(scene, hoveredId, levelMode);
  }, [scene, hoveredId, selectedId, levelMode]);

  useEffect(() => {
    r3fStore?.getState().invalidate();
  }, [selectedFrame, hoveredFrame, walkMode, r3fStore]);

  if (walkMode || (!selectedFrame && !hoveredFrame)) {
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
