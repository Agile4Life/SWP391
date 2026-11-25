import { useEffect } from 'react';
import { getNotifications } from '../member/notificationsApi';
import { toast } from '../../shared/ui/toast';
import { createReceptionAlertTracker } from './receptionAlerts';

/** Tái sử dụng thông báo lưu ở server; toast chỉ báo việc mới, không đánh dấu đã đọc/đã xử lý. */
export function useReceptionAlerts(role: string, userId: string | number) {
  useEffect(() => {
    if (role !== 'STAFF' && role !== 'RECEPTIONIST') return;
    const track = createReceptionAlertTracker();
    let active = true, busy = false;
    const refresh = async () => {
      if (!active || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const page = await getNotifications();
        if (!active) return;
        const fresh = track(page.content);
        if (fresh.length) {
          toast(fresh[0].title);
          window.dispatchEvent(new Event('member-notifications-changed'));
        }
      } catch {
        // Giữ mốc khi API lỗi; chuông hiện có chịu trách nhiệm hiển thị lỗi và thử lại.
      } finally { busy = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [role, userId]);
}
