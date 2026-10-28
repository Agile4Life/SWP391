import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead, notificationDestination, type MemberNotification, type NotificationPage } from './notificationsApi';
import './notifications.css';

const category: Record<string, { icon: string; label: string }> = {
  schedule_change: { icon: '◷', label: 'Lịch học' }, class_reminder: { icon: '◷', label: 'Lịch học' },
  payment: { icon: '₫', label: 'Thanh toán' }, package_expiry: { icon: '₫', label: 'Thanh toán' },
  support_reply: { icon: '✉', label: 'Hỗ trợ' }, system: { icon: '✦', label: 'Hệ thống' },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể tải thông báo. Vui lòng thử lại.';
}

export function MemberNotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    const request = ++loadRequest.current;
    setLoading(true); setError(null);
    try {
      const [list, unread] = await Promise.all([getNotifications(page), getUnreadCount()]);
      if (request !== loadRequest.current) return;
      setData(list); setCount(unread);
    } catch (reason) { if (request === loadRequest.current) { setData(null); setError(errorMessage(reason)); } }
    finally { if (request === loadRequest.current) setLoading(false); }
  }, [page]);

  useEffect(() => {
    const refresh = () => { void load(); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      loadRequest.current++;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load]);

  async function open(item: MemberNotification) {
    if (busyRef.current || loading) return;
    busyRef.current = true;
    setBusy(true); setError(null);
    try {
      if (!item.isRead) {
        await markNotificationRead(item.id);
        setData((current) => current && ({ ...current, content: current.content.map((n) => n.id === item.id ? { ...n, isRead: true } : n) }));
        setCount((current) => Math.max(0, current - 1));
        window.dispatchEvent(new Event('member-notifications-changed'));
      }
      const destination = notificationDestination(item);
      if (destination) navigate(destination);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function readAll() {
    if (busyRef.current || loading) return;
    busyRef.current = true;
    setBusy(true); setError(null);
    try {
      await markAllNotificationsRead();
      setData((current) => current && ({ ...current, content: current.content.map((n) => ({ ...n, isRead: true })) }));
      setCount(0);
      window.dispatchEvent(new Event('member-notifications-changed'));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const hasUnread = count > 0 || Boolean(data?.content.some((item) => !item.isRead));

  return <div className="portal-container">
    <PageHeader eyebrow="Hội viên" title="Thông báo" subtitle="Cập nhật về lịch học, gói tập và dịch vụ của bạn."
      actions={<button className="notification-action" type="button" disabled={loading || busy || !hasUnread} onClick={() => void readAll()}>Đánh dấu tất cả đã đọc</button>} />
    {error && <div className="portal-alert notification-error" role="alert">{error} <button type="button" onClick={() => void load()}>Thử lại</button></div>}
    {loading ? <div className="portal-state" role="status">Đang tải thông báo…</div> : !data?.content.length && !error ?
      <div className="portal-empty"><h3>Chưa có thông báo</h3><p>Thông báo mới sẽ xuất hiện tại đây.</p></div> :
      <div className="notification-list" aria-label="Danh sách thông báo">
        {data?.content.map((item) => <button key={item.id} type="button" className={`notification-item${item.isRead ? '' : ' notification-item--unread'}`} disabled={busy} onClick={() => void open(item)}>
          <span className="notification-icon" aria-hidden="true">{category[item.type]?.icon ?? '✦'}</span>
          <span className="notification-copy"><small className="notification-category">{category[item.type]?.label ?? 'Hệ thống'}</small><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></span>
          {!item.isRead && <span className="notification-dot" aria-label="Chưa đọc" />}
        </button>)}
      </div>}
    {!loading && data && data.totalPages > 1 && <nav className="notification-pages" aria-label="Phân trang thông báo">
      <button type="button" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Trước</button>
      <span>Trang {page + 1} / {data.totalPages}</span>
      <button type="button" disabled={page + 1 >= data.totalPages || busy} onClick={() => setPage(page + 1)}>Sau</button>
    </nav>}
  </div>;
}
