import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiFetch } from '../../shared/api/client';

interface RealtimeSession {
  enabled: boolean;
  url: string;
  publishableKey: string;
  topic: string;
}

/** Broadcast is an invalidation hint only. Never trust it as confirmation of payment. */
export function subscribeMembershipChanges(changed: () => void, unavailable?: () => void): () => void {
  let disposed = false;
  let disabled = false;
  let connecting = false;
  let client: SupabaseClient | null = null;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  function closeClient() {
    if (!client) return;
    const active = client;
    client = null;
    void active.removeAllChannels();
    active.realtime.disconnect();
  }
  function startFallbackPolling() {
    if (disposed || pollTimer) return;
    pollTimer = setInterval(() => {
      if (!disposed && document.visibilityState !== 'hidden') changed();
    }, 4000);
  }
  async function connect() {
    if (disposed || disabled || connecting || client) return;
    connecting = true;
    try {
      const session = await apiFetch<RealtimeSession>('/memberships/subscriptions/realtime-session', { method: 'POST' });
      if (disposed) return;
      if (!session || !session.enabled || !session.url || !session.publishableKey || !session.topic) {
        disabled = true;
        startFallbackPolling();
        return;
      }
      client = createClient(session.url, session.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      client.channel(session.topic)
        .on('broadcast', { event: 'changed' }, () => { if (!disposed) changed(); })
        .subscribe(status => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') changed(); // Catch up after joining or reconnecting.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            closeClient();
            unavailable?.();
          }
        });
    } catch {
      if (!disposed) {
        closeClient();
        unavailable?.();
      }
    } finally { connecting = false; }
  }
  const retry = () => {
    if (disposed || document.visibilityState === 'hidden') return;
    if (disabled) {
      changed();
      return;
    }
    void connect();
  };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  document.addEventListener('visibilitychange', retry);
  void connect();
  return () => {
    disposed = true;
    clearInterval(pollTimer);
    window.removeEventListener('online', retry);
    window.removeEventListener('focus', retry);
    document.removeEventListener('visibilitychange', retry);
    closeClient();
  };
}
