/* eslint-disable react-refresh/only-export-components */
import { context as r3fContext, useFrame, useThree } from '@react-three/fiber';
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
  WALK_FOV_DEG,
  WALK_SPEED_MPS,
  computeInitialWalkPose,
  getWalkObstaclesForLevel,
  resolveWalkCollision2D,
  rotateWalkPose,
  stepContinuousWalkPose3D,
  type WalkPose,
} from '../camera/cameraMath';
import type { LevelCode, Vec2 } from '../scene/schema';
import { wallsOfLevel } from '../scene/selectors';
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

function WalkFrameLoop({
  poseRef,
  headlampRef,
  keysRef,
  targetLookRef,
  velocityRef,
}: {
  poseRef: MutableRefObject<WalkPose | null>;
  headlampRef: MutableRefObject<THREE.PointLight | null>;
  keysRef: MutableRefObject<Set<string>>;
  targetLookRef: MutableRefObject<{ targetYaw: number; targetPitch: number }>;
  velocityRef: MutableRefObject<{ vx: number; vz: number }>;
}) {
  useFrame((state, delta) => {
    const currentPose = poseRef.current;
    if (!currentPose) return;

    const dt = Math.min(delta, 0.1);
    if (dt <= 0) return;

    const keys = keysRef.current;
    const isSearching = useExploreStore.getState().searchOpen;

    // 1. Process continuous keyboard turn / pitch
    let turnInput = 0;
    let pitchInput = 0;
    if (!isSearching) {
      turnInput =
        (keys.has('arrowright') || keys.has('e') ? 1 : 0) -
        (keys.has('arrowleft') || keys.has('q') ? 1 : 0);
      pitchInput =
        (keys.has('r') || keys.has('pageup') ? 1 : 0) -
        (keys.has('f') || keys.has('pagedown') ? 1 : 0);
    }

    if (turnInput !== 0) {
      targetLookRef.current.targetYaw += turnInput * 2.2 * dt;
    }
    if (pitchInput !== 0) {
      targetLookRef.current.targetPitch += pitchInput * 1.4 * dt;
      targetLookRef.current.targetPitch = Math.max(
        -0.75,
        Math.min(0.75, targetLookRef.current.targetPitch),
      );
    }

    // Exponential yaw & pitch damping
    const lookDamp = 1 - Math.exp(-dt * 24);
    const smoothedYaw =
      currentPose.yaw +
      (targetLookRef.current.targetYaw - currentPose.yaw) * lookDamp;
    const currentPitch = currentPose.pitch ?? 0;
    const smoothedPitch =
      currentPitch +
      (targetLookRef.current.targetPitch - currentPitch) * lookDamp;

    // 2. Process continuous translation inputs & exponential velocity damping
    let forwardInput = 0;
    let strafeInput = 0;
    if (!isSearching) {
      forwardInput =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      strafeInput =
        (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    }

    const sprint = keys.has('shift') ? 1.55 : 1.0;
    const targetSpeed = WALK_SPEED_MPS * sprint;

    let desiredVx = 0;
    let desiredVz = 0;
    if (forwardInput !== 0 || strafeInput !== 0) {
      const moveX = Math.sin(smoothedYaw) * forwardInput + Math.cos(smoothedYaw) * strafeInput;
      const moveZ = -Math.cos(smoothedYaw) * forwardInput + Math.sin(smoothedYaw) * strafeInput;
      const moveLen = Math.hypot(moveX, moveZ);
      if (moveLen > 1e-4) {
        desiredVx = (moveX / moveLen) * targetSpeed;
        desiredVz = (moveZ / moveLen) * targetSpeed;
      }
    }

    const accelDamp = 1 - Math.exp(-dt * 15);
    velocityRef.current.vx += (desiredVx - velocityRef.current.vx) * accelDamp;
    velocityRef.current.vz += (desiredVz - velocityRef.current.vz) * accelDamp;

    if (
      forwardInput === 0 &&
      strafeInput === 0 &&
      Math.hypot(velocityRef.current.vx, velocityRef.current.vz) < 0.02
    ) {
      velocityRef.current.vx = 0;
      velocityRef.current.vz = 0;
    }

    const dispX = velocityRef.current.vx * dt;
    const dispZ = velocityRef.current.vz * dt;

    // 3. Unified continuous 3D walk + zero-stick wall slide + elevation-locked stair solver
    const stepped = stepContinuousWalkPose3D(
      SOL_CENTER_SCENE,
      currentPose,
      dispX,
      dispZ,
      smoothedYaw,
      smoothedPitch,
    );

    const posX = stepped.pose.position[0];
    const posZ = stepped.pose.position[2];
    const targetY = stepped.targetEyeY;

    // Vertical spring damping (~40ms response) for silky-smooth tread climbing without jitter
    const vDamp = 1 - Math.exp(-dt * 24);
    const posY = currentPose.position[1] + (targetY - currentPose.position[1]) * vDamp;

    if (stepped.pose.levelCode !== currentPose.levelCode) {
      // Synchronize floor pill in store without resetting camera pose or losing momentum
      useExploreStore.getState().syncWalkLevel(stepped.pose.levelCode);
    }

    const candidatePose: WalkPose = {
      levelCode: stepped.pose.levelCode,
      position: [posX, posY, posZ],
      yaw: smoothedYaw,
      pitch: smoothedPitch,
    };

    // 5. Commit updated pose to ref
    poseRef.current = candidatePose;

    // 6. Update Three.js camera & headlamp directly at 60+ FPS
    const cam = state.camera;
    cam.position.set(posX, posY, posZ);

    const cosP = Math.cos(smoothedPitch);
    const sinP = Math.sin(smoothedPitch);
    const lookDist = 5.0;
    cam.lookAt(
      posX + Math.sin(smoothedYaw) * cosP * lookDist,
      posY + sinP * lookDist,
      posZ - Math.cos(smoothedYaw) * cosP * lookDist,
    );

    if (
      'fov' in cam &&
      typeof (cam as THREE.PerspectiveCamera).updateProjectionMatrix === 'function'
    ) {
      const persp = cam as THREE.PerspectiveCamera;
      if (Math.abs(persp.fov - WALK_FOV_DEG) > 0.1) {
        persp.fov = WALK_FOV_DEG;
        persp.updateProjectionMatrix();
      }
    }

    if (headlampRef.current) {
      headlampRef.current.position.set(posX, posY + 0.35, posZ);
    }

    // Keep invalidating while moving or damping
    const isMoving =
      Math.hypot(velocityRef.current.vx, velocityRef.current.vz) > 0.001 ||
      forwardInput !== 0 ||
      strafeInput !== 0 ||
      turnInput !== 0 ||
      pitchInput !== 0 ||
      Math.abs(targetLookRef.current.targetYaw - smoothedYaw) > 0.001 ||
      Math.abs(targetLookRef.current.targetPitch - smoothedPitch) > 0.001 ||
      Math.abs(targetY - posY) > 0.005;

    if (isMoving) {
      state.invalidate();
    }
  });

  return null;
}

function WalkSceneOverlay({
  children,
  headlampRef,
  poseRef,
  keysRef,
  targetLookRef,
  velocityRef,
}: {
  children: ReactNode;
  headlampRef: MutableRefObject<THREE.PointLight | null>;
  poseRef: MutableRefObject<WalkPose | null>;
  keysRef: MutableRefObject<Set<string>>;
  targetLookRef: MutableRefObject<{ targetYaw: number; targetPitch: number }>;
  velocityRef: MutableRefObject<{ vx: number; vz: number }>;
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
    <>
      <WalkFrameLoop
        poseRef={poseRef}
        headlampRef={headlampRef}
        keysRef={keysRef}
        targetLookRef={targetLookRef}
        velocityRef={velocityRef}
      />
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
    </>
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
  fontSize: '0.75rem',
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
  const targetLookRef = useRef<{ targetYaw: number; targetPitch: number }>({
    targetYaw: 0,
    targetPitch: 0,
  });
  const velocityRef = useRef<{ vx: number; vz: number }>({ vx: 0, vz: 0 });
  const pointerLockedRef = useRef<boolean>(false);
  const pointerDragRef = useRef<{
    x: number;
    y: number;
    startYaw: number;
    startPitch: number;
    moved: boolean;
  } | null>(null);

  const prevFocusLevelRef = useRef<LevelCode | 'ALL'>(focusLevel);
  const prevSelectedIdRef = useRef<string | null>(selectedId);

  const commitWalkPose = useCallback(
    (nextPose: WalkPose) => {
      poseRef.current = nextPose;
      targetLookRef.current.targetYaw = nextPose.yaw;
      targetLookRef.current.targetPitch = nextPose.pitch ?? 0;
      velocityRef.current = { vx: 0, vz: 0 };

      const state = r3fStore?.getState();
      if (state?.camera) {
        state.camera.position.set(nextPose.position[0], nextPose.position[1], nextPose.position[2]);
        const cosP = Math.cos(nextPose.pitch ?? 0);
        const sinP = Math.sin(nextPose.pitch ?? 0);
        const lookDist = 5.0;
        state.camera.lookAt(
          nextPose.position[0] + Math.sin(nextPose.yaw) * cosP * lookDist,
          nextPose.position[1] + sinP * lookDist,
          nextPose.position[2] - Math.cos(nextPose.yaw) * cosP * lookDist,
        );
        if (
          'fov' in state.camera &&
          typeof (state.camera as THREE.PerspectiveCamera).updateProjectionMatrix === 'function'
        ) {
          const persp = state.camera as THREE.PerspectiveCamera;
          if (Math.abs(persp.fov - WALK_FOV_DEG) > 0.1) {
            persp.fov = WALK_FOV_DEG;
            persp.updateProjectionMatrix();
          }
        }
        if (headlampRef.current) {
          headlampRef.current.position.set(
            nextPose.position[0],
            nextPose.position[1] + 0.35,
            nextPose.position[2],
          );
        }
        state.invalidate();
      }
    },
    [r3fStore],
  );

  const nudgePoseByInput = useCallback(
    (forward: number, strafe: number, turnDeg: number, pitchDeg: number) => {
      const currentPose = poseRef.current;
      if (!currentPose) return;

      if (turnDeg !== 0 || pitchDeg !== 0) {
        const radYaw = (turnDeg * Math.PI) / 180;
        const radPitch = (pitchDeg * Math.PI) / 180;
        targetLookRef.current.targetYaw += radYaw;
        targetLookRef.current.targetPitch = Math.max(
          -0.75,
          Math.min(0.75, targetLookRef.current.targetPitch + radPitch),
        );
        const rotated = rotateWalkPose(currentPose, radYaw, radPitch);
        if (forward === 0 && strafe === 0) {
          commitWalkPose(rotated);
          return;
        }
        poseRef.current = rotated;
      }

      const activePose = poseRef.current ?? currentPose;
      const moveX =
        Math.sin(activePose.yaw) * forward + Math.cos(activePose.yaw) * strafe;
      const moveZ =
        -Math.cos(activePose.yaw) * forward + Math.sin(activePose.yaw) * strafe;
      const moveLen = Math.hypot(moveX, moveZ);
      const stepMeters = WALK_SPEED_MPS * 0.28;
      const dispX = moveLen > 1e-4 ? (moveX / moveLen) * stepMeters : 0;
      const dispZ = moveLen > 1e-4 ? (moveZ / moveLen) * stepMeters : 0;

      const stepped = stepContinuousWalkPose3D(
        SOL_CENTER_SCENE,
        activePose,
        dispX,
        dispZ,
        activePose.yaw,
        activePose.pitch ?? 0,
      );
      if (stepped.pose.levelCode !== activePose.levelCode) {
        useExploreStore.getState().syncWalkLevel(stepped.pose.levelCode);
      }
      commitWalkPose(stepped.pose);
    },
    [commitWalkPose],
  );

  // Initialize walk pose when entering walkMode or switching level externally
  useEffect(() => {
    if (!walkMode) {
      poseRef.current = null;
      pressedKeysRef.current.clear();
      pointerDragRef.current = null;
      velocityRef.current = { vx: 0, vz: 0 };
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
      }
      return;
    }

    const activeLevel: LevelCode = focusLevel === 'ALL' ? 'L1' : focusLevel;

    // If this effect was triggered by an internal portal transition:
    // If poseRef is already on activeLevel and selectedId has not changed, do NOT reinitialize!
    if (
      poseRef.current &&
      poseRef.current.levelCode === activeLevel &&
      selectedId === prevSelectedIdRef.current
    ) {
      prevFocusLevelRef.current = focusLevel;
      return;
    }

    prevFocusLevelRef.current = focusLevel;
    prevSelectedIdRef.current = selectedId;

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

  // Keyboard controls, pointer lock / drag 360° look, wheel step, and floor teleport click
  useEffect(() => {
    if (!walkMode) return;

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
        if (document.pointerLockElement) {
          try {
            document.exitPointerLock?.();
          } catch {
            // ignore
          }
          return;
        }
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
        pressedKeysRef.current.add(key);
        r3fStore?.getState()?.invalidate();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      pressedKeysRef.current.delete(key);
      r3fStore?.getState()?.invalidate();
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
          startYaw: targetLookRef.current.targetYaw,
          startPitch: targetLookRef.current.targetPitch,
          moved: false,
        };
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag) return;

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

      targetLookRef.current.targetYaw = drag.startYaw + deltaYaw;
      targetLookRef.current.targetPitch = Math.max(
        -0.75,
        Math.min(0.75, drag.startPitch + deltaPitch),
      );
      r3fStore?.getState()?.invalidate();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      pointerDragRef.current = null;
      if (!drag) return;

      if (!drag.moved) {
        const canvas = event.target as HTMLElement;
        if (
          canvas &&
          canvas.tagName === 'CANVAS' &&
          document.pointerLockElement !== canvas &&
          typeof canvas.requestPointerLock === 'function'
        ) {
          try {
            void canvas.requestPointerLock();
          } catch {
            // ignore
          }
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement) {
        const sens = 0.0022;
        targetLookRef.current.targetYaw += event.movementX * sens;
        targetLookRef.current.targetPitch = Math.max(
          -0.75,
          Math.min(0.75, targetLookRef.current.targetPitch - event.movementY * sens),
        );
        r3fStore?.getState()?.invalidate();
      }
    };

    const handlePointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement !== null;
    };

    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.tagName !== 'CANVAS') return;
      const currentPose = poseRef.current;
      if (!currentPose) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const stepMeters = 1.05 * direction;
      const dispX = Math.sin(currentPose.yaw) * stepMeters;
      const dispZ = -Math.cos(currentPose.yaw) * stepMeters;

      const stepped = stepContinuousWalkPose3D(
        SOL_CENTER_SCENE,
        currentPose,
        dispX,
        dispZ,
        currentPose.yaw,
        currentPose.pitch ?? 0,
      );
      if (stepped.pose.levelCode !== currentPose.levelCode) {
        useExploreStore.getState().syncWalkLevel(stepped.pose.levelCode);
      }
      commitWalkPose(stepped.pose);
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
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('scms:explore3d-floor-click', handleFloorTeleportEvent);
    };
  }, [walkMode, setWalkMode, commitWalkPose, stepWalkFloor, switchWalkFloor, r3fStore]);

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
          background: 'var(--explore-accent)',
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
      <WalkSceneOverlay
        headlampRef={headlampRef}
        poseRef={poseRef}
        keysRef={pressedKeysRef}
        targetLookRef={targetLookRef}
        velocityRef={velocityRef}
      >
        {hudContent}
      </WalkSceneOverlay>
    );
  }

  return hudContent;
}

export default WalkController;
