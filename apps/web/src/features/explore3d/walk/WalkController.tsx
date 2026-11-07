/* eslint-disable react-refresh/only-export-components */
import { context as r3fContext, useThree } from '@react-three/fiber';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as THREE from 'three';
import { useI18n } from '../../../shared/i18n';
import {
  WALK_COLLIDER_RADIUS_M,
  WALK_EYE_HEIGHT_M,
  WALK_FOV_DEG,
  computeInitialWalkPose,
  computeStairElevationOffset,
  evaluateStairOrElevatorPortal,
  getWalkObstaclesForLevel,
  poseToViewpoint,
  resolveWalkCollision2D,
  rotateWalkPose,
  stepWalkPose,
  type WalkPose,
} from '../camera/cameraMath';
import { polygonBounds2D, type LevelCode, type Vec2 } from '../scene/schema';
import { getLevelByCode, wallsOfLevel } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';

const VERTICAL_BUILDING_FLOORS: readonly LevelCode[] = ['B1', 'L1', 'L2', 'RF'] as const;

const WALK_FLOOR_OPTIONS: readonly {
  code: LevelCode;
  shortLabel: string;
  titleVi: string;
  titleEn: string;
}[] = [
  { code: 'B1', shortLabel: 'B1', titleVi: 'Tầng hầm B1 · Hồ bơi Oasis', titleEn: 'Basement B1 · Oasis Pool' },
  { code: 'L1', shortLabel: 'L1', titleVi: 'Tầng 1 · Sảnh & Gym', titleEn: 'Level 1 · Lobby & Gym' },
  { code: 'L2', shortLabel: 'L2', titleVi: 'Tầng 2 · VIP & InBody', titleEn: 'Level 2 · VIP & InBody' },
  { code: 'RF', shortLabel: 'RF', titleVi: 'Tầng thượng RF · Yoga', titleEn: 'Rooftop RF · Yoga' },
  { code: 'OUT', shortLabel: 'OUT', titleVi: 'Ngoài trời · Sân Tennis', titleEn: 'Outdoor · Tennis Courts' },
] as const;

export function getNextVerticalWalkLevel(
  current: LevelCode,
  direction: 'up' | 'down',
): LevelCode {
  if (current === 'OUT') {
    return direction === 'down' ? 'B1' : 'L2';
  }
  const idx = VERTICAL_BUILDING_FLOORS.indexOf(current);
  if (idx === -1) return 'L1';
  if (direction === 'down') {
    return VERTICAL_BUILDING_FLOORS[Math.max(0, idx - 1)]!;
  }
  return VERTICAL_BUILDING_FLOORS[
    Math.min(VERTICAL_BUILDING_FLOORS.length - 1, idx + 1)
  ]!;
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function WalkSceneOverlay({
  children,
  headlampRef,
}: {
  children: ReactNode;
  headlampRef: MutableRefObject<THREE.PointLight | null>;
}) {
  const gl = useThree(s => s.gl);
  const rootRef = useRef<Root | null>(null);

  useLayoutEffect(() => {
    const target = gl.domElement.parentElement;
    if (!target) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:24;';
    target.appendChild(el);
    const root = createRoot(el);
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      el.remove();
      queueMicrotask(() => {
        root.unmount();
      });
    };
  }, [gl.domElement]);

  useLayoutEffect(() => {
    rootRef.current?.render(<>{children}</>);
  });

  return (
    <pointLight
      ref={headlampRef}
      name="sol-walk-headlamp"
      position={[0, 2.0, 12]}
      color="#fff4ea"
      intensity={1.35}
      distance={16}
      decay={1.35}
      castShadow={false}
    />
  );
}

const HUD_BTN_STYLE = {
  minHeight: '26px',
  minWidth: '26px',
  padding: '0.12rem 0.36rem',
  borderRadius: '999px',
  border: '1px solid var(--explore-border-accent)',
  background: 'var(--explore-chip-bg)',
  color: 'var(--explore-ink)',
  fontSize: '0.72rem',
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
} as const;

export function WalkController() {
  const { t } = useI18n();
  const r3fStore = useContext(r3fContext);

  const walkMode = useExploreStore(state => state.walkMode);
  const focusLevel = useExploreStore(state => state.focusLevel);
  const selectedId = useExploreStore(state => state.selectedId);
  const setWalkMode = useExploreStore(state => state.setWalkMode);
  const setFocusLevel = useExploreStore(state => state.setFocusLevel);
  const flyToViewpoint = useExploreStore(state => state.flyToViewpoint);

  const activeWalkLevel: LevelCode = focusLevel === 'ALL' ? 'L1' : focusLevel;
  const canGoDownFloor = activeWalkLevel !== 'B1';
  const canGoUpFloor = activeWalkLevel !== 'RF';

  const switchWalkFloor = useCallback(
    (targetLevel: LevelCode) => {
      setFocusLevel(targetLevel);
    },
    [setFocusLevel],
  );

  const stepWalkFloor = useCallback(
    (direction: 'up' | 'down') => {
      const storeLevel = useExploreStore.getState().focusLevel;
      const curr: LevelCode = storeLevel === 'ALL' ? 'L1' : storeLevel;
      const next = getNextVerticalWalkLevel(curr, direction);
      if (next !== curr) {
        setFocusLevel(next);
      }
    },
    [setFocusLevel],
  );

  const poseRef = useRef<WalkPose | null>(null);
  const headlampRef = useRef<THREE.PointLight | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastTickMsRef = useRef<number>(0);
  const pointerDragRef = useRef<{
    x: number;
    y: number;
    startYaw: number;
    startPitch: number;
    moved: boolean;
  } | null>(null);

  const commitWalkPose = useCallback(
    (nextPose: WalkPose) => {
      poseRef.current = nextPose;
      const vp = poseToViewpoint(nextPose);
      flyToViewpoint(vp);

      const state = r3fStore?.getState();
      if (state?.camera) {
        state.camera.position.set(vp.position[0], vp.position[1], vp.position[2]);
        state.camera.lookAt(vp.target[0], vp.target[1], vp.target[2]);
        if (
          'fov' in state.camera &&
          typeof state.camera.updateProjectionMatrix === 'function'
        ) {
          const persp = state.camera as THREE.PerspectiveCamera;
          if (Math.abs(persp.fov - WALK_FOV_DEG) > 0.1) {
            persp.fov = WALK_FOV_DEG;
            persp.updateProjectionMatrix();
          }
        }
        if (headlampRef.current) {
          headlampRef.current.position.set(
            vp.position[0],
            vp.position[1] + 0.35,
            vp.position[2],
          );
        }
        state.invalidate();
      }
    },
    [flyToViewpoint, r3fStore],
  );

  const nudgePoseByInput = useCallback(
    (forward: number, strafe: number, turnDeg: number, pitchDeg: number) => {
      const currentPose = poseRef.current;
      if (!currentPose) return;

      if (turnDeg !== 0 || pitchDeg !== 0) {
        const rotated = rotateWalkPose(
          currentPose,
          (turnDeg * Math.PI) / 180,
          (pitchDeg * Math.PI) / 180,
        );
        if (forward === 0 && strafe === 0) {
          commitWalkPose(rotated);
          return;
        }
        poseRef.current = rotated;
      }

      const activePose = poseRef.current ?? currentPose;
      const levelNode = getLevelByCode(SOL_CENTER_SCENE, activePose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, activePose.levelCode);
      const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, activePose.levelCode);
      const bounds = levelNode
        ? polygonBounds2D(levelNode.slabPolygon)
        : undefined;

      const nextPose = stepWalkPose(
        activePose,
        { forward, strafe, turn: 0, pitchDelta: 0 },
        0.1,
        walls,
        bounds,
        obstacles,
      );
      const portalLevel = evaluateStairOrElevatorPortal(
        SOL_CENTER_SCENE,
        activePose,
        nextPose,
      );
      if (portalLevel && portalLevel !== activePose.levelCode) {
        const stairId = `item-${portalLevel.toLowerCase()}-stairs`;
        if (SOL_CENTER_SCENE.nodes[stairId]) {
          useExploreStore.getState().selectNode(stairId);
        } else {
          switchWalkFloor(portalLevel);
        }
        return;
      }
      commitWalkPose(nextPose);
    },
    [commitWalkPose, switchWalkFloor],
  );

  // Initialize walk pose when entering walkMode or switching level
  useEffect(() => {
    if (!walkMode) {
      poseRef.current = null;
      pressedKeysRef.current.clear();
      pointerDragRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const rawInitialPose = computeInitialWalkPose(
      SOL_CENTER_SCENE,
      selectedId,
      focusLevel,
    );
    const walls = wallsOfLevel(SOL_CENTER_SCENE, rawInitialPose.levelCode);
    const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, rawInitialPose.levelCode);
    const safeXZ = resolveWalkCollision2D(
      [rawInitialPose.position[0], rawInitialPose.position[2]],
      [rawInitialPose.position[0], rawInitialPose.position[2]],
      walls,
      WALK_COLLIDER_RADIUS_M,
      obstacles,
    );
    const initialPose: WalkPose = {
      ...rawInitialPose,
      position: [safeXZ[0], rawInitialPose.position[1], safeXZ[1]],
    };
    commitWalkPose(initialPose);
  }, [walkMode, focusLevel, selectedId, commitWalkPose]);

  // Keyboard WASD + Arrows + Q/E/R/F, pointer drag 360° look, wheel step, and floor click
  useEffect(() => {
    if (!walkMode) return;

    const applyStep = (dtSec: number) => {
      if (useExploreStore.getState().searchOpen) {
        pressedKeysRef.current.clear();
        return;
      }
      const currentPose = poseRef.current;
      if (!currentPose) return;

      const keys = pressedKeysRef.current;
      const sprintMultiplier = keys.has('shift') ? 1.55 : 1;
      const forward =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const turn =
        (keys.has('arrowright') || keys.has('e') ? 1 : 0) -
        (keys.has('arrowleft') || keys.has('q') ? 1 : 0);
      const pitchDelta =
        (keys.has('r') || keys.has('pageup') ? 1 : 0) -
        (keys.has('f') || keys.has('pagedown') ? 1 : 0);

      if (forward === 0 && strafe === 0 && turn === 0 && pitchDelta === 0) return;

      const levelNode = getLevelByCode(SOL_CENTER_SCENE, currentPose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const bounds = levelNode
        ? polygonBounds2D(levelNode.slabPolygon)
        : undefined;

      const nextPose = stepWalkPose(
        currentPose,
        { forward, strafe, turn, pitchDelta },
        dtSec * sprintMultiplier,
        walls,
        bounds,
        obstacles,
      );
      const portalLevel = evaluateStairOrElevatorPortal(
        SOL_CENTER_SCENE,
        currentPose,
        nextPose,
      );
      if (portalLevel && portalLevel !== currentPose.levelCode) {
        const stairId = `item-${portalLevel.toLowerCase()}-stairs`;
        if (SOL_CENTER_SCENE.nodes[stairId]) {
          useExploreStore.getState().selectNode(stairId);
        } else {
          switchWalkFloor(portalLevel);
        }
        return;
      }
      commitWalkPose(nextPose);
    };

    const tickLoop = (nowMs: number) => {
      if (pressedKeysRef.current.size === 0) {
        rafRef.current = null;
        return;
      }
      const dtSec =
        lastTickMsRef.current > 0 ? (nowMs - lastTickMsRef.current) / 1000 : 1 / 60;
      lastTickMsRef.current = nowMs;
      applyStep(dtSec);
      rafRef.current = window.requestAnimationFrame(tickLoop);
    };

    const startLoopIfNeeded = () => {
      if (rafRef.current === null && pressedKeysRef.current.size > 0) {
        lastTickMsRef.current = performance.now();
        rafRef.current = window.requestAnimationFrame(tickLoop);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (useExploreStore.getState().searchOpen) {
        pressedKeysRef.current.clear();
        return;
      }
      if (isTypingElement(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setWalkMode(false);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === '[' || key === 'j') {
        event.preventDefault();
        stepWalkFloor('down');
        return;
      }
      if (key === ']' || key === 'u') {
        event.preventDefault();
        stepWalkFloor('up');
        return;
      }
      if (key >= '1' && key <= '5') {
        event.preventDefault();
        const opt = WALK_FLOOR_OPTIONS[Number(key) - 1];
        if (opt) {
          switchWalkFloor(opt.code);
        }
        return;
      }

      if (
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'q' ||
        key === 'e' ||
        key === 'r' ||
        key === 'f' ||
        key === 'shift' ||
        key === 'pageup' ||
        key === 'pagedown' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright'
      ) {
        event.preventDefault();
        const wasEmpty = pressedKeysRef.current.size === 0;
        pressedKeysRef.current.add(key);
        if (wasEmpty) {
          applyStep(1 / 25);
        }
        startLoopIfNeeded();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      pressedKeysRef.current.delete(key);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-testid="explore3d-walk-hud"]')) return;
      if (target.tagName === 'CANVAS') {
        const currentPose = poseRef.current;
        if (!currentPose) return;
        pointerDragRef.current = {
          x: event.clientX,
          y: event.clientY,
          startYaw: currentPose.yaw,
          startPitch: currentPose.pitch ?? 0,
          moved: false,
        };
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      const currentPose = poseRef.current;
      if (!drag || !currentPose) return;

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) return;

      const viewportW = Math.max(320, window.innerWidth);
      const viewportH = Math.max(320, window.innerHeight);
      const deltaYaw = (dx / viewportW) * Math.PI * 1.65;
      const deltaPitch = -(dy / viewportH) * Math.PI * 0.9;

      const rotated = rotateWalkPose(
        {
          ...currentPose,
          yaw: drag.startYaw,
          pitch: drag.startPitch,
        },
        deltaYaw,
        deltaPitch,
      );
      commitWalkPose(rotated);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      pointerDragRef.current = null;
      if (!drag || drag.moved) return;

      const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      if (dist > 6) return;

      const currentPose = poseRef.current;
      if (!currentPose) return;

      const viewportW = Math.max(1, window.innerWidth);
      const normalizedX = (event.clientX / viewportW - 0.5) * 2;
      const yawOffset = normalizedX * (Math.PI / 5);
      const targetYaw = currentPose.yaw + yawOffset;
      const strideMeters = 2.6;

      const levelNode = getLevelByCode(SOL_CENTER_SCENE, currentPose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const bounds = levelNode
        ? polygonBounds2D(levelNode.slabPolygon)
        : undefined;

      const fromXZ: Vec2 = [currentPose.position[0], currentPose.position[2]];
      let destXZ: Vec2 = [
        fromXZ[0] + Math.sin(targetYaw) * strideMeters,
        fromXZ[1] - Math.cos(targetYaw) * strideMeters,
      ];
      if (bounds) {
        destXZ = [
          Math.min(bounds.maxX - 0.52, Math.max(bounds.minX + 0.52, destXZ[0])),
          Math.min(bounds.maxZ - 0.52, Math.max(bounds.minZ + 0.52, destXZ[1])),
        ];
      }
      const resolvedXZ = resolveWalkCollision2D(
        fromXZ,
        destXZ,
        walls,
        WALK_COLLIDER_RADIUS_M,
        obstacles,
      );
      const baseEyeY = levelNode
        ? levelNode.elevation + WALK_EYE_HEIGHT_M
        : currentPose.position[1];
      const stairState = computeStairElevationOffset(
        SOL_CENTER_SCENE,
        currentPose.levelCode,
        resolvedXZ[0],
        resolvedXZ[1],
      );
      const nextPose: WalkPose = {
        levelCode: currentPose.levelCode,
        position: [
          resolvedXZ[0],
          Number((baseEyeY + stairState.elevationOffset).toFixed(3)),
          resolvedXZ[1],
        ],
        yaw: targetYaw,
        pitch: currentPose.pitch ?? 0,
      };
      const portalLevel = evaluateStairOrElevatorPortal(
        SOL_CENTER_SCENE,
        currentPose,
        nextPose,
      );
      if (portalLevel && portalLevel !== currentPose.levelCode) {
        const stairId = `item-${portalLevel.toLowerCase()}-stairs`;
        if (SOL_CENTER_SCENE.nodes[stairId]) {
          useExploreStore.getState().selectNode(stairId);
        } else {
          switchWalkFloor(portalLevel);
        }
        return;
      }
      commitWalkPose(nextPose);
    };

    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.tagName !== 'CANVAS') return;
      const currentPose = poseRef.current;
      if (!currentPose) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const stepMeters = 1.05 * direction;

      const levelNode = getLevelByCode(SOL_CENTER_SCENE, currentPose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const bounds = levelNode
        ? polygonBounds2D(levelNode.slabPolygon)
        : undefined;

      const fromXZ: Vec2 = [currentPose.position[0], currentPose.position[2]];
      let destXZ: Vec2 = [
        fromXZ[0] + Math.sin(currentPose.yaw) * stepMeters,
        fromXZ[1] - Math.cos(currentPose.yaw) * stepMeters,
      ];
      if (bounds) {
        destXZ = [
          Math.min(bounds.maxX - 0.52, Math.max(bounds.minX + 0.52, destXZ[0])),
          Math.min(bounds.maxZ - 0.52, Math.max(bounds.minZ + 0.52, destXZ[1])),
        ];
      }
      const resolvedXZ = resolveWalkCollision2D(
        fromXZ,
        destXZ,
        walls,
        WALK_COLLIDER_RADIUS_M,
        obstacles,
      );
      const baseEyeY = levelNode
        ? levelNode.elevation + WALK_EYE_HEIGHT_M
        : currentPose.position[1];
      const stairState = computeStairElevationOffset(
        SOL_CENTER_SCENE,
        currentPose.levelCode,
        resolvedXZ[0],
        resolvedXZ[1],
      );
      const nextPose: WalkPose = {
        ...currentPose,
        position: [
          resolvedXZ[0],
          Number((baseEyeY + stairState.elevationOffset).toFixed(3)),
          resolvedXZ[1],
        ],
      };
      const portalLevel = evaluateStairOrElevatorPortal(
        SOL_CENTER_SCENE,
        currentPose,
        nextPose,
      );
      if (portalLevel && portalLevel !== currentPose.levelCode) {
        const stairId = `item-${portalLevel.toLowerCase()}-stairs`;
        if (SOL_CENTER_SCENE.nodes[stairId]) {
          useExploreStore.getState().selectNode(stairId);
        } else {
          switchWalkFloor(portalLevel);
        }
        return;
      }
      commitWalkPose(nextPose);
    };

    const handleFloorTeleportEvent = (event: Event) => {
      const custom = event as CustomEvent<{ x?: number; z?: number }>;
      const currentPose = poseRef.current;
      if (!currentPose || !custom.detail) return;
      const { x, z } = custom.detail;
      if (typeof x !== 'number' || typeof z !== 'number') return;

      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const obstacles = getWalkObstaclesForLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const fromXZ: Vec2 = [currentPose.position[0], currentPose.position[2]];
      const resolvedXZ = resolveWalkCollision2D(
        fromXZ,
        [x, z],
        walls,
        WALK_COLLIDER_RADIUS_M,
        obstacles,
      );
      const dx = resolvedXZ[0] - fromXZ[0];
      const dz = resolvedXZ[1] - fromXZ[1];
      const nextYaw =
        Math.hypot(dx, dz) > 0.1 ? Math.atan2(dx, -dz) : currentPose.yaw;

      const nextPose: WalkPose = {
        levelCode: currentPose.levelCode,
        position: [resolvedXZ[0], currentPose.position[1], resolvedXZ[1]],
        yaw: nextYaw,
        pitch: currentPose.pitch ?? 0,
      };
      commitWalkPose(nextPose);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [walkMode, setWalkMode, commitWalkPose, stepWalkFloor, switchWalkFloor]);

  if (!walkMode) {
    return null;
  }

  const hudContent = (
    <div
      className="explore3d-walk-hud"
      data-testid="explore3d-walk-hud"
      role="status"
      aria-live="polite"
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '999px',
          background: 'var(--explore-accent, #ce9180)',
          flexShrink: 0,
        }}
      />
      <span>{t('WASD · Xoay 360°', 'WASD · Look 360°')}</span>
      <div
        role="group"
        aria-label={t('Thang máy & chuyển tầng khi đi bộ', 'Elevator and floor switcher in walk mode')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.18rem',
          padding: '0.1rem 0.22rem',
          borderRadius: '999px',
          background: 'var(--explore-segment-bg)',
        }}
      >
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-floor-down"
          disabled={!canGoDownFloor}
          onClick={() => stepWalkFloor('down')}
          aria-label={t('Xuống tầng dưới / Tầng hầm ([ / J)', 'Go down a floor ([ / J)')}
          title={t('Xuống tầng dưới / Tầng hầm ([ / J)', 'Go down a floor ([ / J)')}
          style={{
            ...HUD_BTN_STYLE,
            opacity: canGoDownFloor ? 1 : 0.4,
            cursor: canGoDownFloor ? 'pointer' : 'not-allowed',
          }}
        >
          ▼
        </button>
        {WALK_FLOOR_OPTIONS.map(opt => {
          const isCurrent = activeWalkLevel === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              className="explore3d-walk-hud__btn"
              data-testid={`walk-floor-${opt.code}`}
              aria-pressed={isCurrent}
              onClick={() => switchWalkFloor(opt.code)}
              aria-label={t(opt.titleVi, opt.titleEn)}
              title={t(opt.titleVi, opt.titleEn)}
              style={{
                ...HUD_BTN_STYLE,
                padding: '0.15rem 0.46rem',
                background: isCurrent ? 'var(--explore-accent)' : 'transparent',
                color: isCurrent ? 'var(--explore-on-accent)' : 'var(--explore-ink)',
                borderColor: isCurrent ? 'var(--explore-accent)' : 'transparent',
              }}
            >
              {opt.shortLabel}
            </button>
          );
        })}
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-floor-up"
          disabled={!canGoUpFloor}
          onClick={() => stepWalkFloor('up')}
          aria-label={t('Lên tầng trên (] / U)', 'Go up a floor (] / U)')}
          title={t('Lên tầng trên (] / U)', 'Go up a floor (] / U)')}
          style={{
            ...HUD_BTN_STYLE,
            opacity: canGoUpFloor ? 1 : 0.4,
            cursor: canGoUpFloor ? 'pointer' : 'not-allowed',
          }}
        >
          ▲
        </button>
      </div>
      <div
        role="group"
        aria-label={t('Điều hướng góc nhìn và bước đi', 'Walk and look controls')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
      >
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-turn-left"
          onClick={() => nudgePoseByInput(0, 0, -28, 0)}
          aria-label={t('Quay trái (Q)', 'Turn left (Q)')}
          title={t('Quay trái (Q / ←)', 'Turn left (Q / ←)')}
          style={HUD_BTN_STYLE}
        >
          ↶
        </button>
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-step-forward"
          onClick={() => nudgePoseByInput(1, 0, 0, 0)}
          aria-label={t('Bước tiến (W)', 'Step forward (W)')}
          title={t('Bước tiến (W / ↑)', 'Step forward (W / ↑)')}
          style={HUD_BTN_STYLE}
        >
          ↑
        </button>
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-step-back"
          onClick={() => nudgePoseByInput(-1, 0, 0, 0)}
          aria-label={t('Bước lùi (S)', 'Step back (S)')}
          title={t('Bước lùi (S / ↓)', 'Step back (S / ↓)')}
          style={HUD_BTN_STYLE}
        >
          ↓
        </button>
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-turn-right"
          onClick={() => nudgePoseByInput(0, 0, 28, 0)}
          aria-label={t('Quay phải (E)', 'Turn right (E)')}
          title={t('Quay phải (E / →)', 'Turn right (E / →)')}
          style={HUD_BTN_STYLE}
        >
          ↷
        </button>
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-look-up"
          onClick={() => nudgePoseByInput(0, 0, 0, 14)}
          aria-label={t('Nhìn lên (R)', 'Look up (R)')}
          title={t('Nhìn lên (R)', 'Look up (R)')}
          style={HUD_BTN_STYLE}
        >
          ↖
        </button>
        <button
          type="button"
          className="explore3d-walk-hud__btn"
          data-testid="walk-look-down"
          onClick={() => nudgePoseByInput(0, 0, 0, -14)}
          aria-label={t('Nhìn xuống (F)', 'Look down (F)')}
          title={t('Nhìn xuống (F)', 'Look down (F)')}
          style={HUD_BTN_STYLE}
        >
          ↙
        </button>
      </div>
      <button
        type="button"
        className="explore3d-walk-hud__exit"
        onClick={() => setWalkMode(false)}
        aria-label={t('Thoát chế độ đi bộ', 'Exit walk mode')}
      >
        Esc · {t('Thoát', 'Exit')}
      </button>
    </div>
  );

  const hasR3fStore = Boolean(r3fStore as unknown);
  if (hasR3fStore) {
    return (
      <WalkSceneOverlay headlampRef={headlampRef}>
        {hudContent}
      </WalkSceneOverlay>
    );
  }

  return hudContent;
}

export default WalkController;
