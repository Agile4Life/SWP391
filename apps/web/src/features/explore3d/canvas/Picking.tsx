/* eslint-disable react-refresh/only-export-components */
import { Bvh } from '@react-three/drei';
import { useEffect, type ReactNode } from 'react';
import { useExploreStore } from '../state/exploreStore';

export interface PickingProps {
  children?: ReactNode;
}

export function handleCanvasPointerMissed(): void {
  const state = useExploreStore.getState();
  if (state.hoveredId !== null) {
    state.setHoveredId(null);
  }
}

export function Picking({ children }: PickingProps) {
  const hoveredId = useExploreStore(s => s.hoveredId);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.cursor = hoveredId ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hoveredId]);

  return <Bvh firstHitOnly>{children}</Bvh>;
}

export default Picking;
