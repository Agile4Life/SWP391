/* eslint-disable react-refresh/only-export-components */
import { Bvh } from '@react-three/drei';
import { useEffect, type ReactNode } from 'react';
import { useExploreStore } from '../state/exploreStore';

/** Props của lớp chọn: các thành phần con. */
export interface PickingProps {
  children?: ReactNode;
}

/** Bấm ra ngoài mọi đối tượng thì bỏ trạng thái rê chuột. */
export function handleCanvasPointerMissed(): void {
  const state = useExploreStore.getState();
  if (state.hoveredId !== null) {
    state.setHoveredId(null);
  }
}

/** Lớp chọn: đổi con trỏ chuột thành bàn tay khi đang rê lên đối tượng và trả về auto khi gỡ. */
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
