import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemKind, LevelCode, SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore, type LevelMode } from '../state/exploreStore';
import {
  computeItemInstanceMatrix,
  getItemGeometry,
  groupItemsByKind,
  isItemInstanceVisible,
  lookupResolvedItem,
  resolveItemInstanceColor,
  type GroupedItemEntry,
  type ItemDetailLevel,
  type ResolvedItemBindingState,
  type ResolvedItemsMap,
} from '../renderers/items/itemGeometries';

export type { ResolvedItemBindingState, ResolvedItemsMap, GroupedItemEntry };

export interface ItemInstancesProps {
  scene?: SceneDoc;
  resolvedItems?: ResolvedItemsMap;
}

const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();

const DEDICATED_SURFACE_KINDS = new Set<ItemKind>([
  'badminton-court',
  'tennis-court',
  'swim-lane',
]);

const SHADOW_LANDMARK_KINDS = new Set<ItemKind>([
  'boxing-ring',
  'planter-tree',
]);

interface KindInstancedBatchProps {
  kind: ItemKind;
  entries: GroupedItemEntry[];
  detail: ItemDetailLevel;
  material: THREE.MeshStandardMaterial;
  castShadow: boolean;
  receiveShadow: boolean;
  levelMode: LevelMode;
  focusLevel: LevelCode | 'ALL';
  selectedId: string | null;
  hoveredId: string | null;
  resolvedItems?: ResolvedItemsMap;
  onSelect: (id: string, fit?: boolean) => void;
  onHover: (id: string | null) => void;
}

function KindInstancedBatch({
  kind,
  entries,
  detail,
  material,
  castShadow,
  receiveShadow,
  levelMode,
  focusLevel,
  selectedId,
  hoveredId,
  resolvedItems,
  onSelect,
  onHover,
}: KindInstancedBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const invalidate = useThree(s => s.invalidate);

  const geometry = useMemo(() => getItemGeometry(kind, detail), [kind, detail]);

  const hasVisibleItems = useMemo(() => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
      if (isItemInstanceVisible(entry, levelMode, focusLevel, resolved)) {
        return true;
      }
    }
    return false;
  }, [entries, levelMode, focusLevel, resolvedItems]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let visibleCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
      const visible = isItemInstanceVisible(entry, levelMode, focusLevel, resolved);
      if (visible) {
        visibleCount += 1;
      }

      computeItemInstanceMatrix(entry, levelMode, visible, tempMatrix);
      mesh.setMatrixAt(i, tempMatrix);

      const isSelected = selectedId === entry.item.id;
      const isHovered = hoveredId === entry.item.id;
      const hex = resolveItemInstanceColor(resolved?.status, isSelected, isHovered);
      tempColor.set(hex);
      mesh.setColorAt(i, tempColor);
    }

    mesh.count = entries.length;
    mesh.visible = visibleCount > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    if (visibleCount > 0) {
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
    invalidate();
  }, [
    entries,
    geometry,
    levelMode,
    focusLevel,
    selectedId,
    hoveredId,
    resolvedItems,
    invalidate,
  ]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const entry = entries[e.instanceId];
    if (!entry) return;
    const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
    if (!isItemInstanceVisible(entry, levelMode, focusLevel, resolved)) return;
    onSelect(entry.item.id, false);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const entry = entries[e.instanceId];
    if (!entry) return;
    const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
    if (!isItemInstanceVisible(entry, levelMode, focusLevel, resolved)) return;
    onSelect(entry.item.id, true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const entry = entries[e.instanceId];
    if (!entry) return;
    const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
    if (!isItemInstanceVisible(entry, levelMode, focusLevel, resolved)) return;
    onHover(entry.item.id);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null);
  };

  return (
    <instancedMesh
      ref={meshRef}
      name={`instanced-items-${kind}`}
      args={[geometry, material, entries.length]}
      visible={hasVisibleItems}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    />
  );
}

export function ItemInstances({
  scene = SOL_CENTER_SCENE,
  resolvedItems,
}: ItemInstancesProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);
  const tier = useExploreStore(s => s.tier);
  const selectNode = useExploreStore(s => s.selectNode);
  const setHoveredId = useExploreStore(s => s.setHoveredId);

  const grouped = useMemo(() => groupItemsByKind(scene), [scene]);

  const sharedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: 'sol-instanced-items-vertex-colored',
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.46,
        metalness: 0.32,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      sharedMaterial.dispose();
    };
  }, [sharedMaterial]);

  const detail: ItemDetailLevel = 'high';
  const receiveShadow = tier !== 'low';

  const handleSelect = (id: string, fit = false) => {
    selectNode(id, fit ? { fit: true } : undefined);
  };

  return (
    <group name="sol-item-instances">
      {Array.from(grouped.entries()).map(([kind, entries]) => {
        if (entries.length === 0 || DEDICATED_SURFACE_KINDS.has(kind)) return null;
        return (
          <KindInstancedBatch
            key={kind}
            kind={kind}
            entries={entries}
            detail={detail}
            material={sharedMaterial}
            castShadow={tier === 'high' && SHADOW_LANDMARK_KINDS.has(kind)}
            receiveShadow={receiveShadow}
            levelMode={levelMode}
            focusLevel={focusLevel}
            selectedId={selectedId}
            hoveredId={hoveredId}
            resolvedItems={resolvedItems}
            onSelect={handleSelect}
            onHover={setHoveredId}
          />
        );
      })}
    </group>
  );
}

export default ItemInstances;
