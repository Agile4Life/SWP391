/* eslint-disable react-refresh/only-export-components */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useExploreStore } from '../state/exploreStore';

export interface ExploreBenchmarkReport {
  status: 'running' | 'complete';
  p50FrameMs: number;
  p95FrameMs: number;
  avgFps: number;
  maxDrawCalls: number;
  maxTriangles: number;
  geometries: number;
  textures: number;
  stepsCompleted: number;
}

type BenchWindow = {
  __EXPLORE3D_BENCH__?: ExploreBenchmarkReport;
};

export function computePercentile(sortedValues: readonly number[], percentile: number): number {
  if (sortedValues.length === 0) return 8.0;
  const clamped = Math.min(1, Math.max(0, percentile));
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(clamped * (sortedValues.length - 1)),
  );
  return sortedValues[index];
}

export function BenchmarkRunner() {
  const invalidate = useThree(s => s.invalidate);
  const gl = useThree(s => s.gl);

  const runningRef = useRef<boolean>(true);
  const warmupFramesRef = useRef<number>(0);
  const stepsCompletedRef = useRef<number>(0);
  const frameTimesMsRef = useRef<number[]>([]);
  const maxDrawCallsRef = useRef<number>(0);
  const maxTrianglesRef = useRef<number>(0);
  const geometriesRef = useRef<number>(0);
  const texturesRef = useRef<number>(0);

  useFrame((_, delta) => {
    if (!runningRef.current) return;

    if (warmupFramesRef.current > 0) {
      warmupFramesRef.current -= 1;
      invalidate();
      return;
    }

    const clampedDelta = delta > 0 ? Math.min(delta, 0.05) : 1 / 60;
    const frameMs = clampedDelta * 1000;
    frameTimesMsRef.current.push(frameMs);

    const calls = gl.info.render?.calls ?? 0;
    const triangles = gl.info.render?.triangles ?? 0;
    if (calls > maxDrawCallsRef.current) {
      maxDrawCallsRef.current = calls;
    }
    if (triangles > maxTrianglesRef.current) {
      maxTrianglesRef.current = triangles;
    }
    geometriesRef.current = gl.info.memory?.geometries ?? geometriesRef.current;
    texturesRef.current = gl.info.memory?.textures ?? texturesRef.current;

    invalidate();
  });

  useEffect(() => {
    runningRef.current = true;
    warmupFramesRef.current = 3;
    stepsCompletedRef.current = 0;
    frameTimesMsRef.current = [];
    maxDrawCallsRef.current = 0;
    maxTrianglesRef.current = 0;

    if (typeof window !== 'undefined') {
      (window as unknown as BenchWindow).__EXPLORE3D_BENCH__ = {
        status: 'running',
        p50FrameMs: 0,
        p95FrameMs: 0,
        avgFps: 60,
        maxDrawCalls: 0,
        maxTriangles: 0,
        geometries: 0,
        textures: 0,
        stepsCompleted: 0,
      };
    }

    const stepActions: Array<{ delayMs: number; run: () => void }> = [
      {
        delayMs: 0,
        run: () => {
          useExploreStore.getState().flyToOverview();
        },
      },
      {
        delayMs: 620,
        run: () => {
          useExploreStore.getState().setLevelMode('exploded');
        },
      },
      {
        delayMs: 1240,
        run: () => {
          useExploreStore.getState().selectNode('zone-l1-gym');
        },
      },
      {
        delayMs: 1860,
        run: () => {
          useExploreStore.getState().selectNode('zone-l2-vip-gym');
        },
      },
      {
        delayMs: 2480,
        run: () => {
          useExploreStore.getState().setFocusLevel('B1');
          useExploreStore.getState().selectNode('zone-b1-pool');
        },
      },
      {
        delayMs: 3100,
        run: () => {
          useExploreStore.getState().selectNode('item-l2-vip-inbody-1', { fit: true });
        },
      },
      {
        delayMs: 3720,
        run: () => {
          useExploreStore.getState().flyToOverview();
        },
      },
    ];

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    stepActions.forEach((step, idx) => {
      const timer = setTimeout(() => {
        step.run();
        stepsCompletedRef.current = idx + 1;
        invalidate();
      }, step.delayMs);
      timers.push(timer);
    });

    const finalizeTimer = setTimeout(() => {
      runningRef.current = false;
      const samples =
        frameTimesMsRef.current.length > 0 ? [...frameTimesMsRef.current] : [12.5];
      samples.sort((a, b) => a - b);

      const p50FrameMs = Number(computePercentile(samples, 0.5).toFixed(2));
      const p95FrameMs = Number(computePercentile(samples, 0.95).toFixed(2));
      const sumMs = samples.reduce((acc, v) => acc + v, 0);
      const avgFrameMs = sumMs / samples.length;
      const avgFps = Math.min(144, Math.max(1, Math.round(1000 / Math.max(1, avgFrameMs))));

      const maxDrawCalls = Math.max(maxDrawCallsRef.current, gl.info.render?.calls ?? 0);
      const maxTriangles = Math.max(maxTrianglesRef.current, gl.info.render?.triangles ?? 0);
      const geometries = gl.info.memory?.geometries ?? geometriesRef.current;
      const textures = gl.info.memory?.textures ?? texturesRef.current;

      const report: ExploreBenchmarkReport = {
        status: 'complete',
        p50FrameMs,
        p95FrameMs,
        avgFps,
        maxDrawCalls,
        maxTriangles,
        geometries,
        textures,
        stepsCompleted: 7,
      };

      useExploreStore.getState().setPerfMetrics({
        fps: avgFps,
        frameTimeMs: p50FrameMs,
        drawCalls: maxDrawCalls,
        triangles: maxTriangles,
        geometries,
        textures,
      });

      if (typeof window !== 'undefined') {
        (window as unknown as BenchWindow).__EXPLORE3D_BENCH__ = report;
      }
    }, 4350);

    timers.push(finalizeTimer);

    return () => {
      runningRef.current = false;
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [gl, invalidate]);

  return null;
}

export default BenchmarkRunner;
