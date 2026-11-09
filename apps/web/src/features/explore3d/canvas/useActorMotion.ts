import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../renderers/actors/liveActorsConfig';
import { useExploreStore } from '../state/exploreStore';

export function isBenchmarkActive(benchEnabledProp?: boolean): boolean {
  if (benchEnabledProp) return true;
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bench') === '1') {
      return true;
    }
  }
  return false;
}

/** Shared by the procedural and rigged actors so both freeze together. */
export function useActorMotion(benchEnabled = false): {
  reducedMotion: boolean;
  shouldAnimate: boolean;
} {
  const viewMode = useExploreStore(s => s.viewMode);
  const tier = useExploreStore(s => s.tier);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const shouldAnimate =
    !reducedMotion && !isBenchmarkActive(benchEnabled) && viewMode === '3d' && tier !== 'low';
  return { reducedMotion, shouldAnimate };
}
