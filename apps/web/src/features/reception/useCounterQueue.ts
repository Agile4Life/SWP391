import { useCallback, useEffect, useState } from 'react';
import { localizableError } from '../../shared/lib/errorMessage';
import { receptionApi, type PendingSubscriptionItem, type UnpaidCoachBooking } from './receptionApi';

/** How often the open queue looks for new requests, so the desk sees a member's request without reloading. */
const AUTO_REFRESH_MS = 30_000;

/**
 * What waits to be paid at the counter: membership requests (register, renew, upgrade) and paid 1:1 sessions.
 * Shared by the receptionist's counter page and the manager's counter tab, so both read the same queue.
 */
export function useCounterQueue(enabled = true) {
  const [pending, setPending] = useState<PendingSubscriptionItem[]>([]);
  const [unpaidPt, setUnpaidPt] = useState<UnpaidCoachBooking[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | Error | null>(null);

  // `silent` refreshes keep what is on screen: no skeleton, and a failed background refresh does not wipe the lists.
  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const [subscriptions, sessions] = await Promise.all([receptionApi.getPendingSubscriptions(), receptionApi.getUnpaidCoachBookings()]);
      setPending(subscriptions);
      setUnpaidPt(sessions);
      if (silent) setError(null);
    } catch (cause) {
      if (!silent) {
        setPending([]);
        setUnpaidPt([]);
        setError(localizableError(cause, 'Không tải được danh sách chờ thu tiền. Vui lòng thử lại.'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const refresh = () => { if (document.visibilityState !== 'hidden') void load(true); };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, load]);

  return { pending, unpaidPt, loading, error, reload: load, count: pending.length + unpaidPt.length };
}

export type CounterQueue = ReturnType<typeof useCounterQueue>;
