import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemKind, LevelCode, SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore, type LevelMode } from '../state/exploreStore';
import { SURFACE_DETAIL_PRESETS, applySurfaceDetail } from '../renderers/surfaceDetail';
import { ItemGlbLoader } from './ItemGlbLoader';
import { isWalkFloorAdjacent } from './riggedInstance';
import {
  computeItemInstanceMatrix,
  getItemGeometry,
  getItemGeometryRevision,
  groupItemsByKind,
  isItemInstanceVisible,
  lookupResolvedItem,
  resolveItemInstanceColor,
  subscribeItemGeometries,
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

function isBatchItemVisible(
  entry: GroupedItemEntry,
  kind: ItemKind,
  levelMode: LevelMode,
  walkMode: boolean,
  focusLevel: LevelCode | 'ALL',
  resolved: ResolvedItemBindingState | undefined,
): boolean {
  if (levelMode === 'stacked' && entry.item.id === 'item-rf-stairs') {
    return false;
  }
  if (!walkMode && levelMode === 'stacked' && focusLevel === 'ALL' && entry.level?.code === 'B1') {
    return false;
  }
  if (
    walkMode &&
    kind !== 'stair-core' &&
    kind !== 'elevator-core' &&
    entry.level &&
    !isWalkFloorAdjacent(entry.level.code, focusLevel)
  ) {
    return false;
  }
  return isItemInstanceVisible(entry, levelMode, focusLevel, resolved);
}

interface KindInstancedBatchProps {
  kind: ItemKind;
  entries: GroupedItemEntry[];
  detail: ItemDetailLevel;
  material: THREE.MeshStandardMaterial;
  castShadow: boolean;
  receiveShadow: boolean;
  levelMode: LevelMode;
  walkMode: boolean;
  focusLevel: LevelCode | 'ALL';
  selectedId: string | null;
  hoveredId: string | null;
  resolvedItems?: ResolvedItemsMap;
  geometryRevision: number;
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
  walkMode,
  focusLevel,
  selectedId,
  hoveredId,
  resolvedItems,
  geometryRevision,
  onSelect,
  onHover,
}: KindInstancedBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const invalidate = useThree(s => s.invalidate);

  // geometryRevision changes when a GLB model replaces the procedural geometry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => getItemGeometry(kind, detail), [kind, detail, geometryRevision]);

  // Photo-scanned GLB models bring their own PBR materials (one per geometry group).
  const ownMaterials = geometry.userData.itemMaterials as THREE.Material[] | undefined;

  const hasVisibleItems = useMemo(() => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
      if (isBatchItemVisible(entry, kind, levelMode, walkMode, focusLevel, resolved)) {
        return true;
      }
    }
    return false;
  }, [entries, kind, levelMode, walkMode, focusLevel, resolvedItems]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let visibleCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
      const visible = isBatchItemVisible(entry, kind, levelMode, walkMode, focusLevel, resolved);
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
    kind,
    geometry,
    levelMode,
    walkMode,
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
    if (!isBatchItemVisible(entry, kind, levelMode, walkMode, focusLevel, resolved)) return;
    onSelect(entry.item.id, false);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const entry = entries[e.instanceId];
    if (!entry) return;
    const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
    if (!isBatchItemVisible(entry, kind, levelMode, walkMode, focusLevel, resolved)) return;
    onSelect(entry.item.id, true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const entry = entries[e.instanceId];
    if (!entry) return;
    const resolved = lookupResolvedItem(resolvedItems, entry.item.id);
    if (!isBatchItemVisible(entry, kind, levelMode, walkMode, focusLevel, resolved)) return;
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
      key={ownMaterials ? 'textured' : 'flat'}
      args={[geometry, ownMaterials ?? material, entries.length]}
      visible={hasVisibleItems}
      castShadow={
        !walkMode &&
        (castShadow || Boolean(ownMaterials)) &&
        (levelMode !== 'stacked' ||
          entries.some(e => e.level?.code === 'OUT' || e.level?.code === 'RF'))
      }
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
  const walkMode = useExploreStore(s => s.walkMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);
  const tier = useExploreStore(s => s.tier);
  const selectNode = useExploreStore(s => s.selectNode);
  const setHoveredId = useExploreStore(s => s.setHoveredId);

  const effectiveLevelMode: LevelMode = walkMode ? 'stacked' : levelMode;

  const grouped = useMemo(() => groupItemsByKind(scene), [scene]);
  const geometryRevision = useSyncExternalStore(
    subscribeItemGeometries,
    getItemGeometryRevision,
    getItemGeometryRevision,
  );

  // One instanced material for every item; each part's roughness/metalness comes
  // from the `surf` vertex attribute (chrome, powder coat, rubber, vinyl, glass).
  const sharedMaterial = useMemo(
    () =>
      applySurfaceDetail(
        new THREE.MeshStandardMaterial({
          name: 'sol-instanced-items-vertex-colored',
          color: '#ffffff',
          vertexColors: true,
          roughness: 0.5,
          metalness: 0,
          envMapIntensity: 1.15,
        }),
        SURFACE_DETAIL_PRESETS.equipment,
      ),
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
      <ItemGlbLoader />
      {Array.from(grouped.entries()).map(([kind, entries]) => {
        if (entries.length === 0 || DEDICATED_SURFACE_KINDS.has(kind)) return null;
        return (
          <KindInstancedBatch
            key={kind}
            kind={kind}
            entries={entries}
            detail={detail}
            material={sharedMaterial}
            castShadow={tier !== 'low'}
            receiveShadow={receiveShadow}
            levelMode={effectiveLevelMode}
            walkMode={walkMode}
            focusLevel={focusLevel}
            selectedId={selectedId}
            hoveredId={hoveredId}
            resolvedItems={resolvedItems}
            geometryRevision={geometryRevision}
            onSelect={handleSelect}
            onHover={setHoveredId}
          />
        );
      })}
    </group>
  );
}

export default ItemInstances;
