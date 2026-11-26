import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, apiFetch } from '../../shared/api/client';
import type { ChatRealtimeSession } from './chatApi';

/** Trạng thái kết nối realtime: đang kết nối, đã kết nối, đang kết nối lại hoặc tắt. */
export type ChatConnection = 'connecting' | 'connected' | 'reconnecting' | 'disabled';

const PERMANENT_ERROR_STATUSES = new Set([401, 403, 404]);

/** Lỗi xác thực / không có quyền / không tìm thấy tài nguyên là vĩnh viễn: dừng vòng lặp thử kết nối lại. */
function isPermanentError(cause: unknown): boolean {
  return typeof ApiError === 'function' && cause instanceof ApiError && PERMANENT_ERROR_STATUSES.has(cause.status);
}

/**
 * Đăng ký nhận thông báo realtime qua Supabase: tự gia hạn token trước khi hết hạn, kết nối lại theo cấp số nhân,
 * chuyển sang hỏi định kỳ mỗi 4 giây khi realtime tắt; trả về hàm hủy.
 * Thông báo broadcast chỉ dùng để làm mất hiệu lực dữ liệu; không bao giờ hiển thị hay tin tưởng payload của nó.
 */
export function subscribeChat(changed: () => void, status: (state: ChatConnection) => void,
  sessionPath = '/chat/realtime-session'): () => void {
  let disposed = false, disabled = false, permanentStop = false, connecting = false, failures = 0;
  let client: SupabaseClient | null = null;
  let chatToken: string | null = null;
  let hasChannel = false;
  let renewTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  // Đóng client và các kênh hiện có.
  function closeClient() {
    const previous = client;
    client = null; hasChannel = false; chatToken = null;
    if (previous) {
      void previous.removeAllChannels().catch(() => {});
      previous.realtime.disconnect();
    }
  }
  // Hỏi định kỳ 4 giây (khi tab hiện) thay cho realtime.
  function startFallbackPolling() {
    if (disposed || pollTimer) return;
    pollTimer = setInterval(() => {
      if (!disposed && document.visibilityState !== 'hidden') changed();
    }, 4000);
  }
  // Lên lịch kết nối lại với độ trễ tăng dần (tối đa 30 giây).
  function retry() {
    if (disposed || disabled || retryTimer) return;
    status('reconnecting');
    retryTimer = setTimeout(() => {
      retryTimer = undefined; closeClient(); void connect();
    }, Math.min(30_000, 3000 * 2 ** Math.min(failures++, 4)));
  }
  // Lấy phiên realtime từ backend, kiểm tra hợp lệ và đăng ký kênh; sau đó hẹn gia hạn trước khi token hết hạn 1 phút.
  async function connect() {
    if (disposed || disabled || connecting) return;
    connecting = true;
    try {
      const session = await apiFetch<ChatRealtimeSession>(sessionPath, { method: 'POST' });
      if (disposed) return;
      if (!session.enabled) {
        disabled = true;
        clearTimeout(renewTimer);
        closeClient();
        status('disabled');
        startFallbackPolling();
        return;
      }
      if (!session.url || !session.publishableKey?.startsWith('sb_publishable_') || !session.topic || !session.token || !session.expiresAt)
        throw new Error('Incomplete realtime session');
      const expires = Date.parse(session.expiresAt);
      if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error('Expired realtime session');
      chatToken = session.token;
      if (!client) client = createClient(session.url, session.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        // supabase-js vẫn gắn callback ngay cả khi không có phiên Supabase Auth.
        // Giữ JWT giới hạn quyền của chat làm nguồn sự thật khi kết nối và gửi heartbeat.
        accessToken: async () => chatToken,
      });
      const current = client;
      await current.realtime.setAuth(session.token);
      if (disposed || current !== client) return;
      if (!hasChannel) {
        hasChannel = true;
        current.channel(session.topic, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, () => { if (!disposed && current === client) changed(); })
          .subscribe(state => {
            if (disposed || current !== client) return;
            if (state === 'SUBSCRIBED') {
              failures = 0; clearTimeout(retryTimer); retryTimer = undefined;
              status('connected'); changed();
            }
            if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') retry();
          });
      }
      clearTimeout(renewTimer);
      renewTimer = setTimeout(() => { void connect(); }, Math.max(1000, expires - Date.now() - 60_000));
    } catch (cause) {
      if (disposed) return;
      if (isPermanentError(cause)) {
        disabled = true;
        permanentStop = true;
        clearTimeout(renewTimer);
        clearTimeout(retryTimer);
        retryTimer = undefined;
        clearInterval(pollTimer);
        pollTimer = undefined;
        closeClient();
        status('disabled');
        return;
      }
      retry();
    }
    finally { connecting = false; }
  }
  // Quay lại tab/mạng/focus thì làm mới dữ liệu và kết nối lại nếu cần.
  function resume() {
    if (disposed || permanentStop || document.visibilityState === 'hidden') return;
    changed();
    if (!disabled && (!client || retryTimer)) {
      clearTimeout(retryTimer); retryTimer = undefined; closeClient(); void connect();
    }
  }
  status('connecting'); void connect();
  window.addEventListener('online', resume);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
    disposed = true; clearTimeout(renewTimer); clearTimeout(retryTimer); clearInterval(pollTimer); closeClient();
    window.removeEventListener('online', resume); window.removeEventListener('focus', resume);
    document.removeEventListener('visibilitychange', resume);
  };
}
