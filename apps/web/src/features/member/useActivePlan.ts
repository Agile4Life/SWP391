import { useEffect, useState } from 'react';
import { getCurrentMembership } from './membershipApi';
import { centerNowParts } from '../../shared/lib/centerTime';

export type ActivePlanState = 'loading' | 'yes' | 'no';

/**
 * Hội viên có gói tập đang hoạt động và còn hạn hay không. Lỗi mạng/API được coi là "yes" để không chặn nhầm:
 * server vẫn là nơi quyết định quyền thật.
 */
export function useActivePlan(): ActivePlanState {
  const [state, setState] = useState<ActivePlanState>('loading');
  useEffect(() => {
    let active = true;
    getCurrentMembership()
      .then((sub) => {
        if (!active) return;
        // Chỉ chặn khi server trả rõ "không có gói" (null) hoặc gói không còn hiệu lực; dữ liệu lạ không bị chặn nhầm.
        if (sub === null) { setState('no'); return; }
        if (!sub || typeof sub !== 'object') { setState('yes'); return; }
        const today = centerNowParts().date;
        const ok = typeof sub.status !== 'string' || sub.status === 'active' && (!sub.endDate || sub.endDate.slice(0, 10) >= today);
        setState(ok ? 'yes' : 'no');
      })
      .catch(() => { if (active) setState('yes'); });
    return () => { active = false; };
  }, []);
  return state;
}
