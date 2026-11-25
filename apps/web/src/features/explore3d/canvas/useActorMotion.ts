import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../renderers/actors/liveActorsConfig';
import { useExploreStore } from '../state/exploreStore';

/** Có đang chạy benchmark không (theo prop hoặc tham số bench=1 trên URL). */
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

/**
 * Hook quyết định nhân vật có chuyển động không (không khi giảm chuyển động, benchmark, chế độ 2D hoặc chất
 * lượng thấp); dùng chung cho nhân vật thủ tục và có xương để cả hai dừng cùng lúc.
 */
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
    // Cập nhật khi tùy chọn giảm chuyển động của hệ điều hành đổi.
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const shouldAnimate =
    !reducedMotion && !isBenchmarkActive(benchEnabled) && viewMode === '3d' && tier !== 'low';
  return { reducedMotion, shouldAnimate };
}
