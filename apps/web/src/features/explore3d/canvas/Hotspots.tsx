/* eslint-disable react-refresh/only-export-components */
import { context as r3fContext, useFrame, useThree } from '@react-three/fiber';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { useI18n } from '../../../shared/i18n';
import type { HotspotNode, LevelCode, SceneDoc, Vec3 } from '../scene/schema';
import { allHotspots, hotspotsOfLevel, levelOf, zoneOf } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore, type LevelMode } from '../state/exploreStore';

export const MAX_ACTIVE_HOTSPOTS = 0;

export interface HotspotsProps {
  scene?: SceneDoc;
  showLabels?: boolean;
}

export function computeHotspotWorldPosition(
  scene: SceneDoc,
  hotspot: HotspotNode,
  levelMode: LevelMode,
): Vec3 {
  const level = levelOf(scene, hotspot.id);
  const extraY = level && levelMode === 'exploded' ? level.explodedOffset : 0;
  return [hotspot.position[0], hotspot.position[1] + extraY, hotspot.position[2]];
}

export function getVisibleHotspots(
  scene: SceneDoc,
  focusLevel: LevelCode | 'ALL',
  selectedId: string | null,
  hoveredId: string | null,
  showLabels = false,
): HotspotNode[] {
  if (!showLabels) {
    return [];
  }

  if (focusLevel !== 'ALL') {
    return hotspotsOfLevel(scene, focusLevel).slice(0, 1);
  }

  const selectedZoneId = zoneOf(scene, selectedId)?.id ?? null;
  const hoveredZoneId = zoneOf(scene, hoveredId)?.id ?? null;

  const all = allHotspots(scene);
  if (!selectedId && !hoveredId) {
    return [];
  }

  const prioritized: HotspotNode[] = [];
  for (const hs of all) {
    const isDirectMatch = hs.id === selectedId || hs.id === hoveredId;
    const isZoneMatch =
      (selectedZoneId !== null && hs.parentId === selectedZoneId) ||
      (hoveredZoneId !== null && hs.parentId === hoveredZoneId);

    if (isDirectMatch || isZoneMatch) {
      prioritized.push(hs);
    }
  }

  return prioritized.slice(0, 1);
}

function ProjectedHotspot({
  position,
  children,
}: {
  position: Vec3;
  children: ReactNode;
}) {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);
  const size = useThree(s => s.size);
  const walkMode = useExploreStore(s => s.walkMode);
  const tourActive = useExploreStore(s => s.tourActive);
  const elRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const projVec = useMemo(() => new THREE.Vector3(), []);
  const worldVec = useMemo(() => new THREE.Vector3(), []);

  const updateTransform = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    worldVec.set(position[0], position[1], position[2]);
    if (walkMode && camera.position.distanceTo(worldVec) > 16) {
      el.style.display = 'none';
      return;
    }
    projVec.copy(worldVec).project(camera);
    if (projVec.z > 1 || projVec.z < -1) {
      el.style.display = 'none';
      return;
    }
    const x = (projVec.x * 0.5 + 0.5) * size.width;
    const y = (-(projVec.y * 0.5) + 0.5) * size.height;
    el.style.display = 'block';
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;

    const pinW = el.offsetWidth || 168;
    const pinH = el.offsetHeight || 32;
    const halfW = pinW * 0.5;
    const halfH = pinH * 0.5;
    const isDesktop = size.width >= 760;
    const bottomSafe = isDesktop
      ? walkMode || tourActive
        ? 106
        : 64
      : walkMode || tourActive
        ? 136
        : 98;
    const hitsTopHud = y - halfH < 52;
    const hitsBottomHud = y + halfH > size.height - bottomSafe;
    const hitsLeftHud =
      isDesktop &&
      x - halfW < 126 &&
      y + halfH > 54 &&
      y - halfH < size.height - 54;
    const hitsCanvasEdge = x - halfW < 8 || x + halfW > size.width - 8;

    if (hitsTopHud || hitsBottomHud || hitsLeftHud || hitsCanvasEdge) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    } else {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    }
  }, [camera, position, projVec, worldVec, size.height, size.width, walkMode, tourActive]);

  useLayoutEffect(() => {
    const target = gl.domElement.parentElement;
    if (!target) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;top:0;left:0;z-index:10;pointer-events:none;will-change:transform;';
    target.appendChild(el);
    elRef.current = el;
    const root = createRoot(el);
    rootRef.current = root;
    return () => {
      elRef.current = null;
      rootRef.current = null;
      el.remove();
      queueMicrotask(() => {
        root.unmount();
      });
    };
  }, [gl.domElement]);

  useLayoutEffect(() => {
    rootRef.current?.render(<>{children}</>);
    updateTransform();
  });

  useFrame(() => {
    updateTransform();
  });

  return null;
}

export function Hotspots({ scene = SOL_CENTER_SCENE, showLabels = false }: HotspotsProps) {
  const { t } = useI18n();
  const r3fStore = useContext(r3fContext);

  const focusLevel = useExploreStore(s => s.focusLevel);
  const levelMode = useExploreStore(s => s.levelMode);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);

  const visibleHotspots = useMemo(
    () => getVisibleHotspots(scene, focusLevel, selectedId, hoveredId, showLabels),
    [scene, focusLevel, selectedId, hoveredId, showLabels],
  );

  if (visibleHotspots.length === 0) {
    return null;
  }

  const handleHotspotClick = (hotspot: HotspotNode) => {
    const state = useExploreStore.getState();
    if (hotspot.action.type === 'focus-level') {
      state.setFocusLevel(hotspot.action.level);
    } else {
      state.selectNode(hotspot.id);
    }
    r3fStore?.getState().invalidate();
  };

  const handlePointerEnter = (hotspotId: string) => {
    const state = useExploreStore.getState();
    if (state.hoveredId !== hotspotId) {
      state.setHoveredId(hotspotId);
      r3fStore?.getState().invalidate();
    }
  };

  const handlePointerLeave = (hotspotId: string) => {
    const state = useExploreStore.getState();
    if (state.hoveredId === hotspotId) {
      state.setHoveredId(null);
      r3fStore?.getState().invalidate();
    }
  };

  return (
    <group name="sol-hotspots">
      {visibleHotspots.map(hotspot => {
        const position = computeHotspotWorldPosition(scene, hotspot, levelMode);
        const isSelected = selectedId === hotspot.id;
        const isHovered = hoveredId === hotspot.id;
        const titleText = t(hotspot.title);
        const ctaText = t(hotspot.action.ctaLabel);

        const pinButton = (
          <button
            type="button"
            className={`explore3d-hotspot-pin${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
            data-testid={`explore3d-hotspot-${hotspot.id}`}
            data-hotspot-id={hotspot.id}
            aria-label={`${titleText} — ${ctaText}`}
            aria-pressed={isSelected}
            onClick={e => {
              e.stopPropagation();
              handleHotspotClick(hotspot);
            }}
            onMouseEnter={() => handlePointerEnter(hotspot.id)}
            onMouseLeave={() => handlePointerLeave(hotspot.id)}
            style={{
              minHeight: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.28rem 0.65rem',
              borderRadius: '999px',
              border: isSelected
                ? '1.5px solid var(--explore-accent-hover, #e1aa98)'
                : '1px solid var(--explore-border-accent, rgba(206, 145, 128, 0.55))',
              background: isSelected
                ? 'var(--explore-accent, #ce9180)'
                : 'var(--explore-surface, rgba(32, 32, 32, 0.88))',
              color: isSelected
                ? 'var(--explore-on-accent, #202020)'
                : 'var(--explore-ink, #faf9f6)',
              fontSize: '0.73rem',
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: 'var(--explore-shadow, 0 6px 18px rgba(0, 0, 0, 0.28))',
              backdropFilter: 'blur(10px)',
              pointerEvents: 'auto',
            }}
          >
            <span
              className="explore3d-hotspot-dot"
              aria-hidden="true"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: isSelected ? '#202020' : '#ce9180',
                flexShrink: 0,
              }}
            />
            {hotspot.badge && (
              <span
                className="explore3d-hotspot-badge"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: isSelected ? '#202020' : '#ce9180',
                }}
              >
                {hotspot.badge}
              </span>
            )}
            <span className="explore3d-hotspot-title">{titleText}</span>
          </button>
        );

        const hasR3fStore = Boolean(r3fStore as unknown);
        if (hasR3fStore) {
          return (
            <group key={hotspot.id} position={position} name={`hotspot-${hotspot.id}`}>
              <ProjectedHotspot position={position}>{pinButton}</ProjectedHotspot>
            </group>
          );
        }

        return (
          <group key={hotspot.id} position={position} name={`hotspot-${hotspot.id}`}>
            {pinButton}
          </group>
        );
      })}
    </group>
  );
}

export default Hotspots;
