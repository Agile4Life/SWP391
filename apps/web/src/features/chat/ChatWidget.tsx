import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sessionIdentityKey, useCurrentUser } from '../../shared/api/useCurrentUser';
import { announceFloatingPanel, useCloseWhenOtherPanelOpens } from '../../shared/lib/floatingPanels';
import type { ChatRealtimeFeed } from './ChatPage';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { CHAT_UNREAD_EVENT, getChatUnreadCount, type ChatContact } from './chatApi';
import { subscribeChat, type ChatConnection } from './chatRealtime';
import { getSupportInbox } from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import { SUPPORT_UNREAD_EVENT } from './supportChat';
import { useDraggableWidget } from './useDraggableWidget';
import { useI18n } from '../../shared/i18n';
import './chat-widget.css';

// Khung hội thoại (danh sách, hội thoại, SÖL AI) chỉ tải khi mở widget lần đầu.
const ChatPage = lazy(() => import('./ChatPage').then(module => ({ default: module.ChatPage })));

/** Ảnh đại diện nhỏ trên nút chat nổi; tự rơi về hình bóng mặc định khi ảnh lỗi. */
function MiniAvatar({ peer, index }: { peer?: ChatContact; index: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(peer?.avatarUrl && failedUrl !== peer.avatarUrl);
  return (
    <span className={`chat-widget__mini-avatar is-slot-${index}`}>
      {showImage ? (
        <img src={peer!.avatarUrl!} alt="" onError={() => setFailedUrl(peer!.avatarUrl ?? null)} />
      ) : (
        <svg viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="13.5" r="6" fill="currentColor" />
          <path d="M7 31.5c1.8-5.5 5.8-8.2 11-8.2s9.2 2.7 11 8.2" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

/**
 * Nút chat nổi: khách xem được khung rỗng, quản lý dùng bản riêng, các vai trò khác dùng bản có kết nối
 * realtime; vai trò không hợp lệ thì không hiển thị.
 */
export function ChatWidget() {
  const user = useCurrentUser();
  const allowed = !user || ['MEMBER', 'STAFF', 'COACH'].includes(user.role);
  if (!allowed) return null;
  const identity = sessionIdentityKey(user);
  return user
    ? <SignedInChatWidget key={identity} role={user.role} />
    : <ChatShell key={identity} unread={0} feed={null} onOpen={() => {}} />;
}

/** Widget giữ một kết nối realtime duy nhất: vừa cập nhật badge chưa đọc, vừa báo cho khung chat tải lại. */
function SignedInChatWidget({ role }: { role: string }) {
  const [chatUnread, setChatUnread] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const [tick, setTick] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const hasSupportInbox = role === 'STAFF';
  // Tải lại số tin chưa đọc (bao gồm phiếu khiếu nại chưa đọc đối với lễ tân).
  const refreshUnread = useCallback(() => {
    void getChatUnreadCount().then(data => setChatUnread(data.count)).catch(() => {});
    if (hasSupportInbox) {
      void getSupportInbox(0, '', false)
        .then(result => {
          const count = Array.isArray(result?.content) ? result.content.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0) : 0;
          setSupportUnread(count);
        })
        .catch(() => {});
    }
  }, [hasSupportInbox]);
  useEffect(() => subscribeChat(() => { setTick(n => n + 1); refreshUnread(); }, setConnection), [refreshUnread, attempt]);
  useEffect(() => {
    if (!hasSupportInbox) return;
    return subscribeSupport(() => { setTick(n => n + 1); refreshUnread(); }, () => {});
  }, [hasSupportInbox, refreshUnread, attempt]);
  useEffect(() => {
    refreshUnread();
    // Nhận số chưa đọc phát từ nơi khác trong ứng dụng.
    const onCount = (event: Event) => setChatUnread((event as CustomEvent<number>).detail);
    const onSupportCount = (event: Event) => setSupportUnread((event as CustomEvent<number>).detail);
    window.addEventListener(CHAT_UNREAD_EVENT, onCount);
    window.addEventListener(SUPPORT_UNREAD_EVENT, onSupportCount);
    return () => {
      window.removeEventListener(CHAT_UNREAD_EVENT, onCount);
      window.removeEventListener(SUPPORT_UNREAD_EVENT, onSupportCount);
    };
  }, [refreshUnread]);
  const feed: ChatRealtimeFeed = { connection, tick, reconnect: () => setAttempt(n => n + 1) };
  return <ChatShell unread={chatUnread + supportUnread} feed={feed} onOpen={refreshUnread} onRefresh={() => { setTick(n => n + 1); refreshUnread(); }} />;
}

/** Vỏ của nút chat nổi: nút kèm số chưa đọc, panel chat có thể kéo, mở rộng, đóng bằng Esc hoặc bấm ra ngoài. */
function ChatShell({ unread, feed, onOpen, onRefresh }: { unread: number; feed: ChatRealtimeFeed | null; onOpen: () => void; onRefresh?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [peers, setPeers] = useState<ChatContact[]>([]);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const {
    widgetRef, panelRef: panel, widgetStyle, panelStyle, dragging,
    onTriggerPointerDown, onPanelPointerDown, consumeDragClick,
  } = useDraggableWidget({ open, expanded });
  useCloseWhenOtherPanelOpens('chat', () => setOpen(false));

  useEffect(() => {
    // Mở chat: đóng các panel nổi khác, làm mới số chưa đọc.
    const onOpenChat = () => {
      setVisited(true);
      announceFloatingPanel('chat');
      onOpen();
      setOpen(true);
    };
    window.addEventListener('scms:open-chat', onOpenChat);
    return () => window.removeEventListener('scms:open-chat', onOpenChat);
  }, [onOpen]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    // Đóng panel và trả focus về nút mở.
    const close = () => { setOpen(false); trigger.current?.focus(); };
    // Nhấn Esc thì đóng panel; bỏ qua nếu đang mở hộp thoại <dialog open> bên trên.
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        close();
      }
    };
    // Bấm ra ngoài panel và nút mở thì đóng panel.
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, panel]);

  const label = unread > 0 ? t(`Tin nhắn · ${unread} chưa đọc`, `Messages · ${unread} unread`) : t('Tin nhắn', 'Messages');
  return <div data-i18n-managed ref={widgetRef} className={`chat-widget${dragging ? ' is-dragging' : ''}`} style={widgetStyle} data-liquid-glass-ignore="">
    <button
      ref={trigger}
      type="button"
      data-i18n-managed
      className={`chat-widget__trigger${open ? ' is-open' : ''}`}
      title={label}
      aria-label={open ? t('Đóng tin nhắn', 'Close messages') : t(`Mở ${label.toLowerCase()}`, `Open ${label.toLowerCase()}`)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="sol-direct-chat"
      onPointerDown={onTriggerPointerDown}
      onClick={() => {
        if (consumeDragClick()) return;
        setVisited(true);
        if (!open) { announceFloatingPanel('chat'); onOpen(); }
        setOpen(value => !value);
      }}
    >
      <span className="chat-widget__trigger-main" aria-hidden="true">
        <span className="chat-widget__trigger-icon">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="3" x2="9.218" y2="10.083" />
            <polygon points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" />
          </svg>
          {unread > 0 && <span className="chat-widget__badge">{unread > 99 ? '99+' : unread}</span>}
        </span>
        <span className="chat-widget__trigger-label">{t('Tin nhắn', 'Messages')}</span>
      </span>
      <span className="chat-widget__trigger-avatars" aria-hidden="true">
        {[0, 1, 2].map(index => (
          <MiniAvatar key={peers[index]?.id ?? `slot-${index}`} peer={peers[index]} index={index} />
        ))}
      </span>
    </button>
    {visited && <section ref={panel} id="sol-direct-chat" className={`chat-widget__panel${expanded ? ' is-expanded' : ''}`} role="dialog" aria-label={t("Tin nhắn SÖL", "SÖL messages")} hidden={!open} style={panelStyle} onPointerDown={onPanelPointerDown}>
      <header className="chat-widget__header">
        <div className="chat-widget__header-title">
          <strong>{t("Tin nhắn", "Messages")}</strong>
        </div>
        <div className="chat-widget__header-actions">
          <button
            type="button"
            data-i18n-managed className="chat-widget__icon-btn"
            aria-label={expanded ? t('Thu nhỏ cửa sổ tin nhắn', 'Collapse messages window') : t('Mở rộng cửa sổ tin nhắn', 'Expand messages window')}
            aria-pressed={expanded}
            title={expanded ? t('Thu nhỏ', 'Collapse') : t('Mở rộng', 'Expand')}
            onClick={() => { setExpanded(v => !v); onRefresh?.(); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button ref={closeButton} type="button" data-i18n-managed className="chat-widget__close" aria-label={t('Đóng cửa sổ tin nhắn', 'Close messages window')} title={t('Đóng cửa sổ tin nhắn', 'Close messages window')} onClick={() => { setOpen(false); trigger.current?.focus(); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>
      {feed ? <Suspense fallback={<div className="chat-widget__loading"><LoadingSkeleton label={t("Đang mở tin nhắn…", "Opening messages…")} count={4} /></div>}>
        <ChatPage embedded visible={open} realtime={feed} onPeersChange={setPeers} />
      </Suspense> : <div className="chat-widget__login"><p>{t("Đăng nhập để trao đổi với lễ tân, huấn luyện viên và trợ lý SÖL AI.", "Sign in to chat with receptionists, coaches and SÖL AI.")}</p><Link to="/login" className="btn-primary">{t("Đăng nhập để nhắn tin", "Sign in to send messages")}</Link></div>}
    </section>}
  </div>;
}
