/* eslint-disable react-refresh/only-export-components */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

export const PERF_SAMPLE_INTERVAL_MS = 500;
const WINDOW_SIZE_FRAMES = 30;
const MAX_ACTIVE_DELTA_SEC = 0.12;
const SLOW_WINDOW_THRESHOLD_MS = 30;
const FAST_WINDOW_THRESHOLD_MS = 20;
const DOWNGRADE_CONSECUTIVE_WINDOWS = 4;
const UPGRADE_CONSECUTIVE_WINDOWS = 2;

export function getPerformanceConfig(tier: QualityTier): {
  tier: QualityTier;
  dpr: number;
  shadows: boolean;
} {
  if (tier === 'high') {
    return { tier: 'high', dpr: 2.0, shadows: true };
  }
  if (tier === 'medium') {
    return { tier: 'medium', dpr: 1.5, shadows: true };
  }
  return { tier: 'low', dpr: 1.15, shadows: false };
}

export function getNextLowerTier(currentTier: QualityTier): {
  tier: QualityTier;
  dpr: number;
} | null {
  if (currentTier === 'high') {
    return { tier: 'medium', dpr: 1.5 };
  }
  if (currentTier === 'medium') {
    return { tier: 'low', dpr: 1.15 };
  }
  return null;
}

export function getNextHigherTier(currentTier: QualityTier): {
  tier: QualityTier;
  dpr: number;
} | null {
  if (currentTier === 'low') {
    return { tier: 'medium', dpr: 1.5 };
  }
  if (currentTier === 'medium') {
    return { tier: 'high', dpr: 2.0 };
  }
  return null;
}

export function PerformanceGovernor() {
  const tier = useExploreStore(s => s.tier);
  const setDpr = useThree(s => s.setDpr);
  const config = getPerformanceConfig(tier);

  const lastPublishMsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const accumulatedDeltaSecRef = useRef<number>(0);

  const windowFramesRef = useRef<number>(0);
  const windowDeltaMsRef = useRef<number>(0);
  const consecutiveSlowWindowsRef = useRef<number>(0);
  const consecutiveFastWindowsRef = useRef<number>(0);

  useEffect(() => {
    setDpr?.(config.dpr);
  }, [setDpr, tier, config.dpr]);

  useFrame((state, delta) => {
    // Ignore demand-loop sleep/idle intervals (> 120ms) for quality tier governance
    if (delta > 0 && delta <= MAX_ACTIVE_DELTA_SEC) {
      windowFramesRef.current += 1;
      windowDeltaMsRef.current += delta * 1000;

      if (windowFramesRef.current >= WINDOW_SIZE_FRAMES) {
        const avgDeltaMs = windowDeltaMsRef.current / windowFramesRef.current;
        windowFramesRef.current = 0;
        windowDeltaMsRef.current = 0;

        if (avgDeltaMs > SLOW_WINDOW_THRESHOLD_MS) {
          consecutiveSlowWindowsRef.current += 1;
          consecutiveFastWindowsRef.current = 0;
          if (consecutiveSlowWindowsRef.current >= DOWNGRADE_CONSECUTIVE_WINDOWS) {
            consecutiveSlowWindowsRef.current = 0;
            const currentTier = useExploreStore.getState().tier;
            const next = getNextLowerTier(currentTier);
            if (next) {
              useExploreStore.getState().setQualityTier(next.tier, next.dpr);
            }
          }
        } else if (avgDeltaMs <= FAST_WINDOW_THRESHOLD_MS) {
          consecutiveFastWindowsRef.current += 1;
          consecutiveSlowWindowsRef.current = 0;
          if (consecutiveFastWindowsRef.current >= UPGRADE_CONSECUTIVE_WINDOWS) {
            consecutiveFastWindowsRef.current = 0;
            const currentTier = useExploreStore.getState().tier;
            const next = getNextHigherTier(currentTier);
            if (next) {
              useExploreStore.getState().setQualityTier(next.tier, next.dpr);
            }
          }
        } else {
          consecutiveSlowWindowsRef.current = 0;
          consecutiveFastWindowsRef.current = 0;
        }
      }
    }

    // Clamp delta to ignore demand-loop idle intervals (> 120ms) for HUD telemetry
    const activeDeltaSec = delta > 0 && delta <= MAX_ACTIVE_DELTA_SEC ? delta : 1 / 60;
    frameCountRef.current += 1;
    accumulatedDeltaSecRef.current += activeDeltaSec;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isFirstSample = lastPublishMsRef.current === 0;
    const elapsedMs = now - lastPublishMsRef.current;

    if (!isFirstSample && elapsedMs < PERF_SAMPLE_INTERVAL_MS) {
      return;
    }

    const avgDeltaSec =
      frameCountRef.current > 0
        ? accumulatedDeltaSecRef.current / frameCountRef.current
        : 1 / 60;
    const frameTimeMs = Number((avgDeltaSec * 1000).toFixed(2));
    const fps = Math.min(144, Math.max(1, Math.round(1 / Math.max(0.001, avgDeltaSec))));

    const renderInfo = state.gl.info.render;
    const memoryInfo = state.gl.info.memory;

    lastPublishMsRef.current = now;
    frameCountRef.current = 0;
    accumulatedDeltaSecRef.current = 0;

    // Update store metrics without calling invalidate()
    useExploreStore.getState().setPerfMetrics({
      fps,
      frameTimeMs,
      drawCalls: renderInfo?.calls ?? 0,
      triangles: renderInfo?.triangles ?? 0,
      geometries: memoryInfo?.geometries ?? 0,
      textures: memoryInfo?.textures ?? 0,
    });
  });

  return null;
}

export default PerformanceGovernor;
