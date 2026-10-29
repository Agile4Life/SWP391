import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiFetch } from '../../shared/api/client';

interface RealtimeSession {
  enabled: boolean;
  url: string;
  publishableKey: string;
  topic: string;
}

/** Broadcast is an invalidation hint only. Never trust it as confirmation of payment. */
export function subscribeMembershipChanges(changed: () => void, unavailable: () => void): () => void {
  let disposed = false;
  let connecting = false;
  let client: SupabaseClient | null = null;
  async function connect() {
    if (disposed || connecting || client) return;
    connecting = true;
    try {
      const session = await apiFetch<RealtimeSession>('/memberships/subscriptions/realtime-session', { method: 'POST' });
      if (disposed) return;
      if (!session.enabled) { unavailable(); return; }
      client = createClient(session.url, session.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      client.channel(session.topic)
        .on('broadcast', { event: 'changed' }, () => { if (!disposed) changed(); })
        .subscribe(status => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') changed(); // Catch up after joining or reconnecting.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') unavailable();
        });
    } catch { if (!disposed) unavailable(); }
    finally { connecting = false; }
  }
  const retry = () => { void connect(); };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  retry();
  return () => {
    disposed = true;
    window.removeEventListener('online', retry);
    window.removeEventListener('focus', retry);
    if (client) {
      void client.removeAllChannels();
      client.realtime.disconnect();
    }
  };
}
