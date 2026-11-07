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
  needsTwoHopFlight,
  prefersReducedMotion,
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

  const invalidate = useThree(state => state.invalidate);
  const cameraCommand = useExploreStore(state => state.cameraCommand);
  const levelMode = useExploreStore(state => state.levelMode);
  const walkMode = useExploreStore(state => state.walkMode);

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

  // Configure boundary and initial camera pose on mount
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || initializedRef.current) return;
    initializedRef.current = true;

    controls.setBoundary(BOUNDARY_BOX);
    controls.smoothTime = 0.28;
    controls.draggingSmoothTime = 0.12;

    const currentCmd = useExploreStore.getState().cameraCommand;
    if (currentCmd) return;

    const saved = loadExploreSessionView();
    const initialPos = saved ? saved.position : OVERVIEW_VIEWPOINT.position;
    const initialTarget = clampTargetToBounds(
      saved ? saved.target : OVERVIEW_VIEWPOINT.target,
    );

    void controls.setLookAt(
      initialPos[0],
      initialPos[1],
      initialPos[2],
      initialTarget[0],
      initialTarget[1],
      initialTarget[2],
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
      void controls.dolly(delta * 4.5, enableTransition);
      invalidate();
      return;
    }

    if (cameraCommand.kind === 'nudge') {
      const [dx, dz] = cameraCommand.nudge ?? [0, 0];
      void controls.truck(dx, dz, enableTransition);
      invalidate();
    }
  }, [applyViewpoint, cameraCommand, invalidate, levelMode, walkMode]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
        if (controls) {
          void controls.dolly(4.5, enableTransition);
          invalidate();
        } else {
          state.zoomCamera(1);
        }
        return;
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        if (controls) {
          void controls.dolly(-4.5, enableTransition);
          invalidate();
        } else {
          state.zoomCamera(-1);
        }
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invalidate]);

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

  const handleRest = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.getPosition(_restPosition);
    controls.getTarget(_restTarget);
    const state = useExploreStore.getState();
    saveExploreSessionView({
      position: [
        Number(_restPosition.x.toFixed(2)),
        Number(_restPosition.y.toFixed(2)),
        Number(_restPosition.z.toFixed(2)),
      ],
      target: [
        Number(_restTarget.x.toFixed(2)),
        Number(_restTarget.y.toFixed(2)),
        Number(_restTarget.z.toFixed(2)),
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
      dollyToCursor={!walkMode}
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
      onChange={handleInvalidate}
      onRest={handleRest}
    />
  );
}

export default CameraRig;
