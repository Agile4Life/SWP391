import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCenterDate } from '../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useI18n } from '../../shared/i18n';
import { closeSupportTicket, createSupportTicket, getMySupportTickets, getSupportMessages, getSupportTicket, sendSupportMessage, type SupportMessage, type SupportTicket } from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import type { ChatConnection } from './chatRealtime';
import type { ChatError } from './chatMessages';
import { ChatComposer } from './ChatComposer';
import { SupportHeader, SupportIcon, SupportTranscript } from './SupportChatParts';
import {
  SUPPORT_CATEGORIES, SUPPORT_MESSAGE_MAX, SUPPORT_STATUS_LABEL, buildSubject, categoryOf, displaySubject, isAccessDenied,
  localizedSubject, supportBubbles, supportError, uniqueMessages, type SupportCategory,
} from './supportChat';
import './support-chat.css';

const NEW_DRAFT = 'new';

/**
 * Hỗ trợ & Khiếu nại của hội viên dưới dạng một cuộc trò chuyện với lễ tân.
 * Tin nhắn đầu tiên tạo phiếu (loại yêu cầu chọn bằng chip phía trên ô soạn), các tin sau gửi vào phiếu đang mở.
 */
export function MemberSupportChat({ onBack, active = true, ticketId }: { onBack: () => void; active?: boolean; ticketId?: number | null }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ticketsError, setTicketsError] = useState<ChatError | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<ChatError | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [category, setCategory] = useState<SupportCategory>('Gói tập');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ChatError | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [showTickets, setShowTickets] = useState(false);
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<ChatError | null>(null);
  const alive = useRef(false);
  const selection = useRef<number | null>(null);
  const listRequest = useRef(0);
  const messagesRequest = useRef(0);
  const firstLoad = useRef(true);
  const requestedTicketId = useRef<number | null>(ticketId ?? null);
  const ticketsRef = useRef<SupportTicket[]>([]);
  const loadingMoreRef = useRef(false);
  const sendingIds = useRef(new Set<string>());
  const closingIds = useRef(new Set<number>());
  const messageKeys = useRef(new Map<number, { text: string; key: string }>());

  const draftKey = selectedId == null ? NEW_DRAFT : String(selectedId);
  const draft = drafts[draftKey] ?? '';
  // Gán nội dung nháp của phiếu hiện tại (mỗi phiếu có nháp riêng) và xóa lỗi gửi.
  const setDraft = (value: string) => { setDrafts(previous => ({ ...previous, [draftKey]: value })); setSendError(null); };
  const ticket = selectedId == null ? null : detail ?? tickets.find(item => item.id === selectedId) ?? null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; selection.current = null; };
  }, []);

  // Chọn một phiếu (hoặc null để tạo mới): hủy các lần tải cũ và đặt lại trạng thái.
  const selectTicket = useCallback((next: SupportTicket | null) => {
    messagesRequest.current++;
    const nextId = next?.id ?? null;
    const nextKey = nextId == null ? NEW_DRAFT : String(nextId);
    selection.current = nextId;
    setMessages([]); setMessagesError(null); setAccessDenied(false); setSendError(null); setCloseError(null); setPending(null);
    setSending(sendingIds.current.has(nextKey));
    setClosing(nextId != null && closingIds.current.has(nextId));
    setMessagesLoading(next != null);
    setDetail(next); setSelectedId(nextId); setShowTickets(false);
  }, []);

  // Tải một trang phiếu của hội viên (nối thêm hoặc thay danh sách), chỉ kết quả của lần gọi mới nhất được dùng.
  const loadTickets = useCallback(async (targetPage: number, append = false) => {
    if (append && loadingMoreRef.current) return;
    const request = ++listRequest.current;
    // Lần gọi này còn hiệu lực không (component còn sống và chưa có lần gọi mới hơn).
    const current = () => alive.current && request === listRequest.current;
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); }
    else { loadingMoreRef.current = false; setLoadingMore(false); if (firstLoad.current) setTicketsLoading(true); }
    try {
      const result = await getMySupportTickets(targetPage);
      if (!current()) return;
      setTickets(previous => {
        const next = append ? [...previous, ...result.content.filter(item => !previous.some(old => old.id === item.id))] : result.content;
        ticketsRef.current = next;
        return next;
      });
      setPage(targetPage); setTotalPages(result.totalPages); setTicketsError(null);
      if (firstLoad.current) {
        firstLoad.current = false;
        const requested = requestedTicketId.current;
        const matched = requested != null ? result.content.find(item => item.id === requested) : undefined;
        if (matched) {
          selectTicket(matched);
        } else if (requested != null) {
          const targetTicket = await getSupportTicket(requested).catch(() => null);
          if (alive.current && targetTicket) {
            setTickets(previous => {
              const next = [targetTicket, ...previous.filter(item => item.id !== targetTicket.id)];
              ticketsRef.current = next;
              return next;
            });
            selectTicket(targetTicket);
          } else if (alive.current && result.content[0] && selection.current == null) {
            selectTicket(result.content[0]);
          }
        } else if (result.content[0] && selection.current == null) {
          // Mở thẳng phiếu gần nhất để hội viên thấy phản hồi ngay, giống mở một cuộc trò chuyện.
          selectTicket(result.content[0]);
        }
      }
    } catch (cause) { if (current()) setTicketsError(supportError(cause)); }
    finally {
      if (append) {
        loadingMoreRef.current = false;
        if (alive.current) setLoadingMore(false);
      }
      if (current()) setTicketsLoading(false);
    }
  }, [selectTicket]);
  useEffect(() => { void loadTickets(0); }, [loadTickets]);

  // Khi người dùng bấm thông báo tới một ticketId cụ thể sau khi đã mở trang.
  useEffect(() => {
    requestedTicketId.current = ticketId ?? null;
    if (ticketId == null || firstLoad.current || selection.current === ticketId) return;
    const matched = ticketsRef.current.find(item => item.id === ticketId);
    if (matched) {
      selectTicket(matched);
      return;
    }
    void getSupportTicket(ticketId).then(targetTicket => {
      if (!alive.current || requestedTicketId.current !== ticketId) return;
      setTickets(previous => {
        const next = [targetTicket, ...previous.filter(item => item.id !== targetTicket.id)];
        ticketsRef.current = next;
        return next;
      });
      selectTicket(targetTicket);
    }).catch(() => {});
  }, [ticketId, selectTicket]);

  // Tải tin nhắn của một phiếu (silent thì không hiện trạng thái tải).
  const loadMessages = useCallback(async (id: number, silent = false) => {
    const request = ++messagesRequest.current;
    // Lần gọi này còn hiệu lực không (đúng phiếu đang chọn và chưa có lần gọi mới hơn).
    const current = () => alive.current && selection.current === id && request === messagesRequest.current;
    if (!silent) { setMessagesLoading(true); setMessagesError(null); setAccessDenied(false); }
    try {
      const result = await getSupportMessages(id);
      if (current()) { setMessages(uniqueMessages(result)); setMessagesError(null); setAccessDenied(false); }
    } catch (cause) {
      if (current()) { setMessagesError(supportError(cause)); setAccessDenied(isAccessDenied(cause)); }
    } finally { if (current()) setMessagesLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // Kênh realtime toàn bộ phiếu của hội viên: luôn cập nhật danh sách phiếu ngay cả khi đang ở màn Yêu cầu mới hoặc Phiếu của tôi.
  useEffect(() => {
    let disposed = false, running = false, dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const live = () => !disposed && alive.current;
    async function refreshList() {
      timer = undefined;
      if (!live() || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      running = true;
      await loadTickets(0);
      running = false;
      if (dirty && live()) { dirty = false; scheduleList(); }
    }
    function scheduleList() {
      if (!live() || timer) return;
      timer = setTimeout(() => { void refreshList(); }, 80);
    }
    const unsubscribe = subscribeSupport(scheduleList, state => {
      if (live() && selection.current == null) setConnection(state);
    });
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); };
  }, [loadTickets]);

  // Phản hồi của lễ tân và đổi trạng thái phiếu đến qua realtime; luôn đọc lại dữ liệu chuẩn từ máy chủ.
  useEffect(() => {
    if (selectedId == null) return;
    const id = selectedId;
    let disposed = false, running = false, dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Kết nối còn dùng được không (chưa hủy và vẫn đang chọn đúng phiếu).
    const live = () => !disposed && alive.current && selection.current === id;
    // Làm mới tin nhắn và thông tin phiếu; nếu đang chạy thì đánh dấu để chạy lại một lần nữa.
    async function refresh() {
      timer = undefined;
      if (!live() || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      running = true;
      const [, latest] = await Promise.all([loadMessages(id, true), getSupportTicket(id).then(value => value, () => null)]);
      if (live() && latest) { setDetail(latest); setTickets(previous => previous.map(item => item.id === id ? latest : item)); }
      running = false;
      if (dirty && live()) { dirty = false; schedule(); }
    }
    // Hẹn làm mới sau 80ms để gộp nhiều thông báo realtime liên tiếp.
    function schedule() {
      if (!live() || timer) return;
      timer = setTimeout(() => { void refresh(); }, 80);
    }
    const unsubscribe = subscribeSupport(schedule, state => { if (live()) setConnection(state); }, id);
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); };
  }, [selectedId, loadMessages, connectionAttempt]);

  // Gửi tin nhắn (tạo phiếu mới khi chưa chọn phiếu, tối đa SUPPORT_MESSAGE_MAX ký tự), không gửi khi phiếu đã đóng hoặc bị từ chối truy cập.
  async function send() {
    const text = draft.trim();
    const targetId = selectedId;
    const key = draftKey;
    if (!text || text.length > SUPPORT_MESSAGE_MAX || sendingIds.current.has(key)) return;
    if (targetId != null && (!ticket || ticket.status === 'closed' || accessDenied)) return;
    sendingIds.current.add(key); setSending(true); setSendError(null);
    try {
      if (targetId == null) {
        const created = await createSupportTicket(buildSubject(category, text), text);
        if (!alive.current) return;
        setDrafts(previous => ({ ...previous, [key]: '' }));
        setTickets(previous => [created, ...previous.filter(item => item.id !== created.id)]);
        if (selection.current === null) selectTicket(created);
        return;
      }
      let attempt = messageKeys.current.get(targetId);
      if (!attempt || attempt.text !== text) { attempt = { text, key: crypto.randomUUID() }; messageKeys.current.set(targetId, attempt); }
      setPending(text);
      await sendSupportMessage(targetId, text, attempt.key);
      if (!alive.current) return;
      messageKeys.current.delete(targetId);
      setDrafts(previous => previous[key] === draft ? { ...previous, [key]: '' } : previous);
      if (selection.current === targetId) await loadMessages(targetId, true);
    } catch (cause) {
      if (alive.current && selection.current === targetId) setSendError(supportError(cause));
    } finally {
      sendingIds.current.delete(key);
      if (alive.current && selection.current === targetId) { setSending(false); setPending(null); }
    }
  }

  // Hội viên đóng phiếu hỗ trợ của mình.
  async function closeTicket() {
    if (!ticket || closingIds.current.has(ticket.id)) return;
    const targetId = ticket.id;
    closingIds.current.add(targetId);
    setClosing(true);
    setCloseError(null);
    try {
      const updated = await closeSupportTicket(targetId);
      if (!alive.current) return;
      setTickets(list => list.map(item => item.id === updated.id ? { ...item, status: updated.status } : item));
      if (selection.current === targetId) setDetail(updated);
    } catch (error) {
      if (alive.current && selection.current === targetId) setCloseError(supportError(error));
    } finally {
      closingIds.current.delete(targetId);
      if (alive.current && selection.current === targetId) setClosing(false);
    }
  }

  // Các bong bóng chat dựng từ phiếu và tin nhắn (hội viên là "tôi").
  const bubbles = useMemo(() => supportBubbles(ticket, messages, true), [ticket, messages]);
  const closed = ticket?.status === 'closed';
  const newMode = selectedId == null;
  const statusPair = ticket ? SUPPORT_STATUS_LABEL[ticket.status] : null;
  const subtitle = ticket
    ? `#${ticket.id} · ${statusPair ? t(...statusPair) : ticket.status}${ticket.escalatedAt ? ` · ${t('Quản lý đang xem xét', 'Under manager review')}` : ''}`
    : t('Gửi yêu cầu tới lễ tân và theo dõi phản hồi', 'Send requests to the front desk and follow replies');
  const composerBlocked = ticketsLoading || (!newMode && (messagesLoading || accessDenied || (!!ticketsError && !ticket)));
  const label = connection === 'reconnecting' ? t('Mất kết nối trực tiếp · đang thử lại', 'Live connection lost · reconnecting') : null;
  // Thử kết nối lại realtime và đồng bộ lại tin nhắn của phiếu đang xem.
  const retryConnection = () => {
    setConnection('connecting');
    setConnectionAttempt(n => n + 1);
    if (selectedId != null) void loadMessages(selectedId, true);
    else void loadTickets(0);
  };

  return <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
    <SupportHeader onBack={onBack} active={active} title={t('Hỗ trợ & Khiếu nại', 'Support & Tickets')} subtitle={subtitle} />
    {label && <p role="status" className="support-chat__connection"><span>{label}</span><button type="button" className="direct-chat__link" onClick={retryConnection}>{t('Thử lại', 'Retry')}</button></p>}
    {ticketsError && <div role="alert" className="direct-chat__error"><p>{t(ticketsError)}</p><button type="button" className="direct-chat__link" onClick={() => void loadTickets(0)}>{t('Thử lại', 'Retry')}</button></div>}
    <div className="support-chat__toolbar">
      <p className="support-chat__ticketbar" title={ticket && !showTickets ? localizedSubject(ticket.subject, t) : undefined}>
        {showTickets ? <span className="support-chat__ticketbar-subject">{t('Phiếu của tôi', 'My tickets')}</span>
          : ticket ? <><span className="support-chat__ticketbar-subject">{displaySubject(ticket.subject)}</span>
            <span className={`support-chat__pill support-chat__pill--${ticket.status}`}>{statusPair ? t(...statusPair) : ticket.status}</span></>
            : <span className="support-chat__ticketbar-subject">{t('Yêu cầu mới', 'New request')}</span>}
      </p>
      <div className="support-chat__tools">
        {(!newMode || showTickets) && (
          <button type="button" data-i18n-managed className="support-chat__tool" aria-label={t('Yêu cầu mới', 'New request')} title={t('Yêu cầu mới', 'New request')} onClick={() => selectTicket(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        )}
        <button type="button" data-i18n-managed className="support-chat__tool" aria-pressed={showTickets} aria-label={t('Phiếu của tôi', 'My tickets')} title={t('Phiếu của tôi', 'My tickets')} disabled={ticketsLoading && tickets.length === 0} onClick={() => setShowTickets(value => !value)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
        </button>
      </div>
    </div>
    {showTickets
      ? <div className="direct-chat__transcript support-chat__tickets" role="region" aria-label={t('Phiếu của tôi', 'My tickets')}>
        {tickets.length === 0
          ? <p className="direct-chat__empty">{t('Bạn chưa có phiếu hỗ trợ nào.', 'You have no support tickets yet.')}</p>
          : <ul className="support-chat__ticket-list">{tickets.map(item => {
            const itemStatus = SUPPORT_STATUS_LABEL[item.status];
            const categoryItem = SUPPORT_CATEGORIES.find(entry => entry.value === categoryOf(item.subject))!;
            return <li key={item.id}><button type="button" data-support-ticket={item.id} className={`direct-chat__person${item.id === selectedId ? ' is-selected' : ''}`} aria-current={item.id === selectedId ? 'true' : undefined} onClick={() => selectTicket(item)}>
              <span className="direct-chat__person-info">
                <strong data-i18n-managed>#{item.id} · {displaySubject(item.subject)}</strong>
                <span className="direct-chat__person-sub"><small className="direct-chat__preview">{t(categoryItem.vi, categoryItem.en)} · {formatCenterDate(item.createdAt)}</small></span>
              </span>
              <span className={`support-chat__pill support-chat__pill--${item.status}`}>{itemStatus ? t(...itemStatus) : item.status}</span>
            </button></li>;
          })}</ul>}
        {page + 1 < totalPages && <button type="button" className="direct-chat__older direct-chat__link" disabled={ticketsLoading || loadingMore} aria-busy={loadingMore || undefined} onClick={() => void loadTickets(page + 1, true)}>{loadingMore ? t('Đang tải…', 'Loading…') : t('Tải thêm phiếu', 'Load more tickets')}</button>}
      </div>
      : <>
        {messagesError && !newMode && <div role="alert" className="direct-chat__error"><p>{t(messagesError)}</p>{!accessDenied && <button type="button" className="direct-chat__link" onClick={() => void loadMessages(selectedId!)}>{t('Thử lại', 'Retry')}</button>}</div>}
        {ticketsLoading ? <div className="direct-chat__transcript"><LoadingSkeleton label={t('Đang tải hỗ trợ…', 'Loading support…')} count={3} /></div>
          : <SupportTranscript label={t('Lịch sử hỗ trợ', 'Support history')} bubbles={bubbles} pending={pending} loading={!newMode && messagesLoading && messages.length === 0} fallbackName={t('Nhân viên', 'Staff')}
            empty={newMode
              ? <div className="direct-chat__empty direct-chat__ai-intro"><span className="direct-chat__avatar direct-chat__avatar--support" aria-hidden="true"><SupportIcon /></span></div>
              : <p className="direct-chat__empty">{t('Chưa có tin nhắn. Hãy bắt đầu trao đổi.', 'No messages yet. Start a conversation.')}</p>} />}
      </>}
    {!showTickets && (closed
      ? <div className="direct-chat__compose support-chat__closed"><p className="direct-chat__muted">{t('Phiếu đã đóng, không thể gửi thêm tin nhắn.', 'This ticket is closed. No further messages can be sent.')}</p>
        <button type="button" className="direct-chat__link" onClick={() => selectTicket(null)}>{t('Gửi yêu cầu mới', 'Send a new request')}</button></div>
      : <>
        {ticket && (ticket.status === 'open' || ticket.status === 'resolved') && <div className="support-chat__closed">
          {ticket.status === 'resolved' && <p className="direct-chat__muted">{t('Lễ tân đã giải quyết yêu cầu. Phiếu tự đóng sau 72 giờ nếu bạn không phản hồi.', 'The front desk resolved this request. It closes automatically after 72 hours without a reply.')}</p>}
          {closeError && <p role="alert" className="direct-chat__error">{t(closeError)}</p>}
          <button type="button" className="direct-chat__link" disabled={closing} onClick={() => void closeTicket()}>
            {closing ? t('Đang đóng…', 'Closing…') : ticket.status === 'resolved' ? t('Xác nhận đã giải quyết', 'Confirm resolved') : t('Rút yêu cầu', 'Withdraw request')}
          </button>
        </div>}
        {newMode && <div className="support-chat__categories" role="radiogroup" aria-label={t('Loại yêu cầu', 'Request category')}>
          {SUPPORT_CATEGORIES.map(item => <button key={item.value} type="button" role="radio" aria-checked={category === item.value} className={`support-chat__chip${category === item.value ? ' is-selected' : ''}`} disabled={sending} onClick={() => setCategory(item.value)}>{t(item.vi, item.en)}</button>)}
        </div>}
        <ChatComposer id="support-message" label={newMode ? t('Nội dung yêu cầu', 'Request details') : t('Tin nhắn cho lễ tân', 'Message to the front desk')} value={draft} onChange={setDraft} onSubmit={() => void send()}
          disabled={composerBlocked} sending={sending} failed={!!sendError} maxLength={SUPPORT_MESSAGE_MAX}
          placeholder={newMode ? t('Mô tả vấn đề của bạn…', 'Describe your issue…') : t('Nhập nội dung phản hồi…', 'Enter your reply…')}
          error={sendError ? `${t(sendError)} ${t('Nội dung đã được giữ lại; bạn có thể gửi lại.', 'Your message was kept; you can retry.')}` : null} />
      </>)}
  </section>;
}
