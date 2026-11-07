import { Html } from '@react-three/drei';
import { context as r3fContext } from '@react-three/fiber';
import { useContext, useEffect, useRef } from 'react';
import { useI18n } from '../../../shared/i18n';
import {
  computeInitialWalkPose,
  poseToViewpoint,
  resolveWalkCollision2D,
  stepWalkPose,
  type WalkPose,
} from '../camera/cameraMath';
import { polygonBounds2D, type Vec2 } from '../scene/schema';
import { getLevelByCode, wallsOfLevel } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function WalkController() {
  const { t } = useI18n();
  const r3fStore = useContext(r3fContext);

  const walkMode = useExploreStore(state => state.walkMode);
  const focusLevel = useExploreStore(state => state.focusLevel);
  const selectedId = useExploreStore(state => state.selectedId);
  const setWalkMode = useExploreStore(state => state.setWalkMode);
  const flyToViewpoint = useExploreStore(state => state.flyToViewpoint);

  const poseRef = useRef<WalkPose | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastTickMsRef = useRef<number>(0);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize walk pose when entering walkMode or switching level
  useEffect(() => {
    if (!walkMode) {
      poseRef.current = null;
      pressedKeysRef.current.clear();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const initialPose = computeInitialWalkPose(
      SOL_CENTER_SCENE,
      selectedId,
      focusLevel,
    );
    poseRef.current = initialPose;
    flyToViewpoint(poseToViewpoint(initialPose));
  }, [walkMode, focusLevel, selectedId, flyToViewpoint]);

  // Keyboard WASD + Arrow movement and click-on-floor teleport
  useEffect(() => {
    if (!walkMode) return;

    const applyStep = (dtSec: number) => {
      const currentPose = poseRef.current;
      if (!currentPose) return;

      const keys = pressedKeysRef.current;
      const forward =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const turn =
        (keys.has('arrowright') || keys.has('e') ? 1 : 0) -
        (keys.has('arrowleft') || keys.has('q') ? 1 : 0);

      if (forward === 0 && strafe === 0 && turn === 0) return;

      const levelNode = getLevelByCode(SOL_CENTER_SCENE, currentPose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const bounds = levelNode
        ? polygonBounds2D(levelNode.slabPolygon)
        : undefined;

      const nextPose = stepWalkPose(
        currentPose,
        { forward, strafe, turn },
        dtSec,
        walls,
        bounds,
      );
      poseRef.current = nextPose;
      useExploreStore.getState().flyToViewpoint(poseToViewpoint(nextPose));
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
      if (isTypingElement(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setWalkMode(false);
        return;
      }

      const key = event.key.toLowerCase();
      if (
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'q' ||
        key === 'e' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright'
      ) {
        event.preventDefault();
        const wasEmpty = pressedKeysRef.current.size === 0;
        pressedKeysRef.current.add(key);
        if (wasEmpty) {
          applyStep(1 / 30);
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
        pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const start = pointerDownPosRef.current;
      pointerDownPosRef.current = null;
      if (!start) return;
      const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (dist > 6) return;

      const currentPose = poseRef.current;
      if (!currentPose) return;

      const viewportW = Math.max(1, window.innerWidth);
      const normalizedX = (event.clientX / viewportW - 0.5) * 2;
      const yawOffset = normalizedX * (Math.PI / 5);
      const targetYaw = currentPose.yaw + yawOffset;
      const strideMeters = 3.2;

      const levelNode = getLevelByCode(SOL_CENTER_SCENE, currentPose.levelCode);
      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
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
          Math.min(bounds.maxX - 0.5, Math.max(bounds.minX + 0.5, destXZ[0])),
          Math.min(bounds.maxZ - 0.5, Math.max(bounds.minZ + 0.5, destXZ[1])),
        ];
      }
      const resolvedXZ = resolveWalkCollision2D(fromXZ, destXZ, walls, 0.36);
      const nextPose: WalkPose = {
        levelCode: currentPose.levelCode,
        position: [resolvedXZ[0], currentPose.position[1], resolvedXZ[1]],
        yaw: targetYaw,
      };
      poseRef.current = nextPose;
      useExploreStore.getState().flyToViewpoint(poseToViewpoint(nextPose));
    };

    const handleFloorTeleportEvent = (event: Event) => {
      const custom = event as CustomEvent<{ x?: number; z?: number }>;
      const currentPose = poseRef.current;
      if (!currentPose || !custom.detail) return;
      const { x, z } = custom.detail;
      if (typeof x !== 'number' || typeof z !== 'number') return;

      const walls = wallsOfLevel(SOL_CENTER_SCENE, currentPose.levelCode);
      const fromXZ: Vec2 = [currentPose.position[0], currentPose.position[2]];
      const resolvedXZ = resolveWalkCollision2D(fromXZ, [x, z], walls, 0.36);
      const dx = resolvedXZ[0] - fromXZ[0];
      const dz = resolvedXZ[1] - fromXZ[1];
      const nextYaw =
        Math.hypot(dx, dz) > 0.1 ? Math.atan2(dx, -dz) : currentPose.yaw;

      const nextPose: WalkPose = {
        levelCode: currentPose.levelCode,
        position: [resolvedXZ[0], currentPose.position[1], resolvedXZ[1]],
        yaw: nextYaw,
      };
      poseRef.current = nextPose;
      useExploreStore.getState().flyToViewpoint(poseToViewpoint(nextPose));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [walkMode, setWalkMode]);

  if (!walkMode) {
    return null;
  }

  const hudContent = (
    <div
      className="explore3d-walk-hud"
      data-testid="explore3d-walk-hud"
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '4.75rem',
        transform: 'translateX(-50%)',
        zIndex: 24,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.55rem 1rem',
        borderRadius: '999px',
        background: 'rgba(32, 32, 32, 0.92)',
        border: '1px solid rgba(206, 145, 128, 0.42)',
        color: '#faf9f6',
        fontSize: '0.82rem',
        fontWeight: 600,
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.42)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '999px',
          background: '#ce9180',
        }}
      />
      <span>
        {t(
          'WASD / Chạm sàn để di chuyển · Esc để thoát',
          'WASD / Click floor to move · Esc to exit',
        )}
      </span>
      <button
        type="button"
        onClick={() => setWalkMode(false)}
        aria-label={t('Thoát chế độ đi bộ', 'Exit walk mode')}
        style={{
          minHeight: '30px',
          padding: '0.2rem 0.65rem',
          borderRadius: '999px',
          border: '1px solid rgba(206, 145, 128, 0.5)',
          background: 'rgba(206, 145, 128, 0.16)',
          color: '#e1aa98',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Esc · {t('Thoát', 'Exit')}
      </button>
    </div>
  );

  const hasR3fStore = Boolean(r3fStore as unknown);
  if (hasR3fStore) {
    return (
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        {hudContent}
      </Html>
    );
  }

  return hudContent;
}

export default WalkController;
