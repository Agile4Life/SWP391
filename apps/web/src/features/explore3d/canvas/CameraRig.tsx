import { CameraControls, type CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CAMERA_LIMITS,
  OVERVIEW_VIEWPOINT,
  clampTargetToBounds,
  computeBestViewpoint,
  computeFitViewpoint,
  computeProportionalZoomStep,
  needsTwoHopFlight,
  prefersReducedMotion,
  sanitizeCameraPose,
} from '../camera/cameraMath';
import { LEVEL_ORDER, type LevelCode, type Viewpoint } from '../scene/schema';
import { levelOf } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import {
  loadExploreSessionView,
  saveExploreSessionView,
} from '../state/deepLink';
import { useExploreStore } from '../state/exploreStore';

const BOUNDARY_BOX = new THREE.Box3(
  new THREE.Vector3(
    CAMERA_LIMITS.boundaryMin[0],
    CAMERA_LIMITS.boundaryMin[1],
    CAMERA_LIMITS.boundaryMin[2],
  ),
  new THREE.Vector3(
    CAMERA_LIMITS.boundaryMax[0],
    CAMERA_LIMITS.boundaryMax[1],
    CAMERA_LIMITS.boundaryMax[2],
  ),
);

const _restPosition = new THREE.Vector3();
const _restTarget = new THREE.Vector3();
const _currPosition = new THREE.Vector3();
const _currTarget = new THREE.Vector3();

const DEG15_RAD = (15 * Math.PI) / 180;

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const initializedRef = useRef(false);
  const lastCommandSeqRef = useRef<number>(0);
  const lastLevelRef = useRef<LevelCode | 'ALL' | null>('ALL');
  const flightTokenRef = useRef<number>(0);
  const prevWalkModeRef = useRef<boolean>(false);
  const isSanitizingRef = useRef<boolean>(false);

  const invalidate = useThree(state => state.invalidate);
  const cameraCommand = useExploreStore(state => state.cameraCommand);
  const levelMode = useExploreStore(state => state.levelMode);
  const walkMode = useExploreStore(state => state.walkMode);

  const zoomByDirection = useCallback(
    (direction: 'in' | 'out') => {
      if (useExploreStore.getState().walkMode) return;
      const controls = controlsRef.current;
      const enableTransition = !prefersReducedMotion();
      if (!controls) {
        useExploreStore.getState().zoomCamera(direction === 'in' ? 1 : -1);
        return;
      }

      controls.getPosition(_currPosition);
      controls.getTarget(_currTarget);
      const sanitized = sanitizeCameraPose(
        [_currPosition.x, _currPosition.y, _currPosition.z],
        [_currTarget.x, _currTarget.y, _currTarget.z],
      );
      const dx = sanitized.position[0] - sanitized.target[0];
      const dy = sanitized.position[1] - sanitized.target[1];
      const dz = sanitized.position[2] - sanitized.target[2];
      const currentDist = Math.hypot(dx, dy, dz);
      const nextDist = computeProportionalZoomStep(currentDist, direction);

      if (typeof controls.dollyTo === 'function') {
        void controls.dollyTo(nextDist, enableTransition);
      } else {
        const scale = currentDist > 1e-4 ? nextDist / currentDist : 1;
        const nextPose = sanitizeCameraPose(
          [
            sanitized.target[0] + dx * scale,
            sanitized.target[1] + dy * scale,
            sanitized.target[2] + dz * scale,
          ],
          sanitized.target,
        );
        void controls.setLookAt(
          nextPose.position[0],
          nextPose.position[1],
          nextPose.position[2],
          nextPose.target[0],
          nextPose.target[1],
          nextPose.target[2],
          enableTransition,
        );
      }
      invalidate();
    },
    [invalidate],
  );

  const applyViewpoint = useCallback(
    async (
      controls: CameraControlsImpl,
      vp: Viewpoint,
      fromLevel: LevelCode | 'ALL' | null,
      toLevel: LevelCode | 'ALL' | null,
      forceImmediate = false,
    ) => {
      const token = ++flightTokenRef.current;
      const enableTransition = !forceImmediate && !prefersReducedMotion();
      const clampedTarget = clampTargetToBounds(vp.target);

      const ctrlCam = (controls as unknown as { camera?: THREE.PerspectiveCamera }).camera;
      if (ctrlCam && 'fov' in ctrlCam && typeof ctrlCam.updateProjectionMatrix === 'function') {
        const nextFov = vp.fov ?? 38;
        if (Math.abs(ctrlCam.fov - nextFov) > 0.1) {
          ctrlCam.fov = nextFov;
          ctrlCam.updateProjectionMatrix();
        }
      }

      if (enableTransition && needsTwoHopFlight(fromLevel, toLevel)) {
        controls.getPosition(_currPosition);
        controls.getTarget(_currTarget);
        const midPos: [number, number, number] = [
          (_currPosition.x + vp.position[0]) * 0.5 + 8,
          Math.max(_currPosition.y, vp.position[1]) + 9,
          (_currPosition.z + vp.position[2]) * 0.5 + 8,
        ];
        const midTarget = clampTargetToBounds([
          (_currTarget.x + clampedTarget[0]) * 0.5,
          (_currTarget.y + clampedTarget[1]) * 0.5,
          (_currTarget.z + clampedTarget[2]) * 0.5,
        ]);
        invalidate();
        await controls.setLookAt(
          midPos[0],
          midPos[1],
          midPos[2],
          midTarget[0],
          midTarget[1],
          midTarget[2],
          true,
        );
        if (token !== flightTokenRef.current) return;
      }

      invalidate();
      await controls.setLookAt(
        vp.position[0],
        vp.position[1],
        vp.position[2],
        clampedTarget[0],
        clampedTarget[1],
        clampedTarget[2],
        enableTransition,
      );
      invalidate();
    },
    [invalidate],
  );

  // Restore isometric viewpoint when exiting walkMode
  useEffect(() => {
    const wasWalking = prevWalkModeRef.current;
    prevWalkModeRef.current = walkMode;
    if (!wasWalking || walkMode) return;

    const controls = controlsRef.current;
    if (!controls) return;

    const { selectedId, focusLevel, levelMode: currLevelMode } = useExploreStore.getState();
    const fallbackNodeId =
      selectedId ??
      (focusLevel !== 'ALL' ? `lvl-${focusLevel.toLowerCase()}` : null);
    const vp = fallbackNodeId
      ? computeBestViewpoint(SOL_CENTER_SCENE, fallbackNodeId, currLevelMode)
      : OVERVIEW_VIEWPOINT;
    void applyViewpoint(controls, vp, lastLevelRef.current, lastLevelRef.current);
  }, [applyViewpoint, walkMode]);

  // Configure boundary and initial camera pose on mount
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || initializedRef.current) return;
    initializedRef.current = true;

    controls.setBoundary(BOUNDARY_BOX);
    controls.smoothTime = 0.28;
    controls.draggingSmoothTime = 0.12;
    controls.dollySpeed = 1.15;
    controls.truckSpeed = 1.8;
    controls.infinityDolly = false;

    const currentCmd = useExploreStore.getState().cameraCommand;
    if (currentCmd) return;

    const saved = loadExploreSessionView();
    const sanitized = sanitizeCameraPose(
      saved ? saved.position : OVERVIEW_VIEWPOINT.position,
      saved ? saved.target : OVERVIEW_VIEWPOINT.target,
    );

    void controls.setLookAt(
      sanitized.position[0],
      sanitized.position[1],
      sanitized.position[2],
      sanitized.target[0],
      sanitized.target[1],
      sanitized.target[2],
      false,
    );
    invalidate();
  }, [invalidate]);

  // Execute store camera commands
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !cameraCommand) return;
    if (cameraCommand.seq === lastCommandSeqRef.current) return;
    lastCommandSeqRef.current = cameraCommand.seq;

    if (walkMode && cameraCommand.kind !== 'viewpoint') {
      return;
    }

    const enableTransition = !prefersReducedMotion();
    const prevLevel = lastLevelRef.current;

    if (cameraCommand.kind === 'overview') {
      lastLevelRef.current = 'ALL';
      void applyViewpoint(controls, OVERVIEW_VIEWPOINT, prevLevel, 'ALL');
      return;
    }

    if (cameraCommand.kind === 'node' && cameraCommand.nodeId) {
      const targetLvl = levelOf(SOL_CENTER_SCENE, cameraCommand.nodeId)?.code ?? 'ALL';
      const vp = computeBestViewpoint(
        SOL_CENTER_SCENE,
        cameraCommand.nodeId,
        levelMode,
      );
      lastLevelRef.current = targetLvl;
      void applyViewpoint(controls, vp, prevLevel, targetLvl);
      return;
    }

    if (cameraCommand.kind === 'fit' && cameraCommand.nodeId) {
      const targetLvl = levelOf(SOL_CENTER_SCENE, cameraCommand.nodeId)?.code ?? 'ALL';
      const vp = computeFitViewpoint(
        SOL_CENTER_SCENE,
        cameraCommand.nodeId,
        levelMode,
      );
      lastLevelRef.current = targetLvl;
      void applyViewpoint(controls, vp, prevLevel, targetLvl);
      return;
    }

    if (cameraCommand.kind === 'viewpoint' && cameraCommand.viewpoint) {
      const isEyeStep = cameraCommand.viewpoint.kind === 'eye' && walkMode;
      void applyViewpoint(
        controls,
        cameraCommand.viewpoint,
        prevLevel,
        prevLevel,
        isEyeStep,
      );
      return;
    }

    if (cameraCommand.kind === 'zoom') {
      const delta = cameraCommand.zoomDelta ?? 1;
      zoomByDirection(delta >= 0 ? 'in' : 'out');
      return;
    }

    if (cameraCommand.kind === 'nudge') {
      const [dx, dz] = cameraCommand.nudge ?? [0, 0];
      void controls.truck(dx, dz, enableTransition);
      invalidate();
    }
  }, [applyViewpoint, cameraCommand, invalidate, levelMode, walkMode, zoomByDirection]);

  // Re-frame camera when levelMode toggles between stacked and exploded
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || walkMode) return;
    const { selectedId } = useExploreStore.getState();
    if (selectedId) {
      const vp = computeBestViewpoint(SOL_CENTER_SCENE, selectedId, levelMode);
      void applyViewpoint(controls, vp, lastLevelRef.current, lastLevelRef.current);
      return;
    }
    if (levelMode === 'exploded') {
      void applyViewpoint(
        controls,
        {
          id: 'vp-exploded-overview',
          label: { vi: 'Toàn cảnh tách tầng', en: 'Exploded Overview' },
          position: [58, 48, 60],
          target: [2, 8.5, 2],
          fov: 38,
          kind: 'overview',
        },
        lastLevelRef.current,
        'ALL',
      );
    }
  }, [applyViewpoint, levelMode, walkMode]);

  // Keyboard shortcuts and custom zoom events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTypingElement(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const state = useExploreStore.getState();
      const controls = controlsRef.current;
      const enableTransition = !prefersReducedMotion();

      if (event.key === 'Escape') {
        if (state.searchOpen) {
          state.setSearchOpen(false);
        } else if (state.walkMode) {
          state.setWalkMode(false);
        } else if (state.tourActive) {
          state.stopTour();
        } else if (state.selectedId) {
          state.selectNode(null);
        }
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        state.setSearchOpen(true);
        return;
      }

      // In walk mode, WalkController owns WASD / Arrow movement
      if (state.walkMode) return;

      if (event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        if (controls) {
          void controls.rotate(-DEG15_RAD, 0, enableTransition);
          invalidate();
        }
        return;
      }

      if (event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        if (controls) {
          void controls.rotate(DEG15_RAD, 0, enableTransition);
          invalidate();
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (controls) {
          void controls.truck(0, -2.5, enableTransition);
          invalidate();
        } else {
          state.nudgeCamera(0, -2.5);
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (controls) {
          void controls.truck(0, 2.5, enableTransition);
          invalidate();
        } else {
          state.nudgeCamera(0, 2.5);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (controls) {
          void controls.truck(-2.5, 0, enableTransition);
          invalidate();
        } else {
          state.nudgeCamera(-2.5, 0);
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (controls) {
          void controls.truck(2.5, 0, enableTransition);
          invalidate();
        } else {
          state.nudgeCamera(2.5, 0);
        }
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomByDirection('in');
        return;
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomByDirection('out');
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        state.setFocusLevel('ALL');
        return;
      }

      if (event.key >= '1' && event.key <= '5') {
        event.preventDefault();
        const levelIndex = Number(event.key) - 1;
        const levelCode = LEVEL_ORDER[levelIndex];
        if (levelCode) {
          state.setFocusLevel(levelCode);
        }
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        if (state.selectedId) {
          event.preventDefault();
          state.flyToNode(state.selectedId, true);
        }
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        state.flyToOverview();
      }
    };

    const handleCustomZoom = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: 'in' | 'out' }>;
      const direction = customEvent.detail?.direction;
      if (direction === 'in' || direction === 'out') {
        zoomByDirection(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('explore3d:zoom', handleCustomZoom);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('explore3d:zoom', handleCustomZoom);
    };
  }, [invalidate, zoomByDirection]);

  const handleControlStart = useCallback(() => {
    const state = useExploreStore.getState();
    if (state.tourActive && !state.tourPaused) {
      state.pauseTour();
    }
    invalidate();
  }, [invalidate]);

  const handleInvalidate = useCallback(() => {
    invalidate();
  }, [invalidate]);

  const handleChange = useCallback(() => {
    const controls = controlsRef.current;
    if (
      controls &&
      !useExploreStore.getState().walkMode &&
      !isSanitizingRef.current
    ) {
      controls.getPosition(_currPosition);
      controls.getTarget(_currTarget);

      const posInvalid =
        !Number.isFinite(_currPosition.x) ||
        !Number.isFinite(_currPosition.y) ||
        !Number.isFinite(_currPosition.z);
      const targetInvalid =
        !Number.isFinite(_currTarget.x) ||
        !Number.isFinite(_currTarget.y) ||
        !Number.isFinite(_currTarget.z);

      const clampedTarget = clampTargetToBounds([
        _currTarget.x,
        _currTarget.y,
        _currTarget.z,
      ]);
      const targetDrifted =
        Math.abs(clampedTarget[0] - _currTarget.x) > 0.05 ||
        Math.abs(clampedTarget[1] - _currTarget.y) > 0.05 ||
        Math.abs(clampedTarget[2] - _currTarget.z) > 0.05;

      const minAllowedY = Math.max(-4.2, clampedTarget[1] - 0.15);
      const belowFloor = _currPosition.y < minAllowedY - 0.05;

      if (posInvalid || targetInvalid || targetDrifted || belowFloor) {
        const sanitized = sanitizeCameraPose(
          [_currPosition.x, _currPosition.y, _currPosition.z],
          [_currTarget.x, _currTarget.y, _currTarget.z],
        );
        isSanitizingRef.current = true;
        try {
          void controls.setLookAt(
            sanitized.position[0],
            sanitized.position[1],
            sanitized.position[2],
            sanitized.target[0],
            sanitized.target[1],
            sanitized.target[2],
            false,
          );
        } finally {
          isSanitizingRef.current = false;
        }
      }
    }
    invalidate();
  }, [invalidate]);

  const handleRest = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.getPosition(_restPosition);
    controls.getTarget(_restTarget);
    const state = useExploreStore.getState();

    let finalPos: [number, number, number] = [
      _restPosition.x,
      _restPosition.y,
      _restPosition.z,
    ];
    let finalTarget: [number, number, number] = [
      _restTarget.x,
      _restTarget.y,
      _restTarget.z,
    ];

    if (!state.walkMode) {
      const sanitized = sanitizeCameraPose(finalPos, finalTarget);
      const drifted =
        Math.hypot(
          sanitized.position[0] - finalPos[0],
          sanitized.position[1] - finalPos[1],
          sanitized.position[2] - finalPos[2],
        ) > 0.05 ||
        Math.hypot(
          sanitized.target[0] - finalTarget[0],
          sanitized.target[1] - finalTarget[1],
          sanitized.target[2] - finalTarget[2],
        ) > 0.05;

      finalPos = sanitized.position;
      finalTarget = sanitized.target;

      if (drifted && !isSanitizingRef.current) {
        isSanitizingRef.current = true;
        try {
          void controls.setLookAt(
            finalPos[0],
            finalPos[1],
            finalPos[2],
            finalTarget[0],
            finalTarget[1],
            finalTarget[2],
            false,
          );
        } finally {
          isSanitizingRef.current = false;
        }
      }
    }

    saveExploreSessionView({
      position: [
        Number(finalPos[0].toFixed(2)),
        Number(finalPos[1].toFixed(2)),
        Number(finalPos[2].toFixed(2)),
      ],
      target: [
        Number(finalTarget[0].toFixed(2)),
        Number(finalTarget[1].toFixed(2)),
        Number(finalTarget[2].toFixed(2)),
      ],
      focusLevel: state.focusLevel,
      selectedId: state.selectedId,
      levelMode: state.levelMode,
      wallMode: state.wallMode,
    });
  }, []);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={!walkMode}
      dollyToCursor={!walkMode}
      dollySpeed={1.15}
      truckSpeed={1.8}
      infinityDolly={false}
      smoothTime={0.28}
      draggingSmoothTime={0.12}
      minDistance={walkMode ? 0.1 : CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      minPolarAngle={CAMERA_LIMITS.minPolarAngle}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
      onControlStart={handleControlStart}
      onControl={handleInvalidate}
      onUpdate={handleInvalidate}
      onTransitionStart={handleInvalidate}
      onChange={handleChange}
      onRest={handleRest}
    />
  );
}

export default CameraRig;
