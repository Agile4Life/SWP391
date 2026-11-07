/* eslint-disable react-refresh/only-export-components */
import { PerformanceMonitor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import { useExploreStore, type QualityTier } from '../state/exploreStore';

export const PERF_SAMPLE_INTERVAL_MS = 500;

export function getNextLowerTier(currentTier: QualityTier): {
  tier: QualityTier;
  dpr: number;
} | null {
  if (currentTier === 'high') {
    return { tier: 'medium', dpr: 1.15 };
  }
  if (currentTier === 'medium') {
    return { tier: 'low', dpr: 1.0 };
  }
  return null;
}

export function PerformanceGovernor() {
  const lastPublishMsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const accumulatedDeltaSecRef = useRef<number>(0);

  useFrame((state, delta) => {
    // Clamp delta to ignore demand-loop idle intervals (> 200ms)
    const activeDeltaSec = delta > 0 && delta <= 0.2 ? delta : 1 / 60;
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

  const handleDecline = useCallback(() => {
    const currentTier = useExploreStore.getState().tier;
    const next = getNextLowerTier(currentTier);
    if (next) {
      useExploreStore.getState().setQualityTier(next.tier, next.dpr);
    }
  }, []);

  const handleFallback = useCallback(() => {
    useExploreStore.getState().setQualityTier('low', 1.0);
  }, []);

  return <PerformanceMonitor onDecline={handleDecline} onFallback={handleFallback} />;
}

export default PerformanceGovernor;
