import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCenterDate } from '../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useI18n } from '../../shared/i18n';
import { createSupportTicket, getMySupportTickets, getSupportMessages, getSupportTicket, sendSupportMessage, type SupportMessage, type SupportTicket } from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import type { ChatConnection } from './chatRealtime';
import type { ChatError } from './chatMessages';
import { ChatComposer } from './ChatComposer';
import { SupportHeader, SupportIcon, SupportTranscript } from './SupportChatParts';
import {
  SUPPORT_CATEGORIES, SUPPORT_MESSAGE_MAX, SUPPORT_STATUS_LABEL, buildSubject, categoryOf, displaySubject, isAccessDenied,
  supportBubbles, supportError, uniqueMessages, type SupportCategory,
} from './supportChat';
import './support-chat.css';

const NEW_DRAFT = 'new';

/**
 * Hỗ trợ & Khiếu nại của hội viên dưới dạng một cuộc trò chuyện với lễ tân.
 * Tin nhắn đầu tiên tạo phiếu (loại yêu cầu chọn bằng chip phía trên ô soạn), các tin sau gửi vào phiếu đang mở.
 */
export function MemberSupportChat({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
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
  const alive = useRef(false);
  const selection = useRef<number | null>(null);
  const listRequest = useRef(0);
  const messagesRequest = useRef(0);
  const firstLoad = useRef(true);
  const sendingRef = useRef(false);
  const messageKeys = useRef(new Map<number, { text: string; key: string }>());

  const draftKey = selectedId == null ? NEW_DRAFT : String(selectedId);
  const draft = drafts[draftKey] ?? '';
  const setDraft = (value: string) => { setDrafts(previous => ({ ...previous, [draftKey]: value })); setSendError(null); };
  const ticket = selectedId == null ? null : detail ?? tickets.find(item => item.id === selectedId) ?? null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; selection.current = null; };
  }, []);

  const selectTicket = useCallback((next: SupportTicket | null) => {
    messagesRequest.current++;
    selection.current = next?.id ?? null;
    setMessages([]); setMessagesError(null); setAccessDenied(false); setSendError(null); setPending(null); setMessagesLoading(next != null);
    setDetail(next); setSelectedId(next?.id ?? null); setShowTickets(false);
  }, []);

  const loadTickets = useCallback(async (targetPage: number, append = false) => {
    const request = ++listRequest.current;
    const current = () => alive.current && request === listRequest.current;
    if (!append && firstLoad.current) setTicketsLoading(true);
    try {
      const result = await getMySupportTickets(targetPage);
      if (!current()) return;
      setTickets(previous => append ? [...previous, ...result.content.filter(item => !previous.some(old => old.id === item.id))] : result.content);
      setPage(targetPage); setTotalPages(result.totalPages); setTicketsError(null);
      if (firstLoad.current) {
        firstLoad.current = false;
        // Mở thẳng phiếu gần nhất để hội viên thấy phản hồi ngay, giống mở một cuộc trò chuyện.
        if (result.content[0] && selection.current == null) selectTicket(result.content[0]);
      }
    } catch (cause) { if (current()) setTicketsError(supportError(cause)); }
    finally { if (current()) setTicketsLoading(false); }
  }, [selectTicket]);
  useEffect(() => { void loadTickets(0); }, [loadTickets]);

  const loadMessages = useCallback(async (id: number, silent = false) => {
    const request = ++messagesRequest.current;
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

  // Phản hồi của lễ tân và đổi trạng thái phiếu đến qua realtime; luôn đọc lại dữ liệu chuẩn từ máy chủ.
  useEffect(() => {
    if (selectedId == null) return;
    const id = selectedId;
    let disposed = false, running = false, dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const live = () => !disposed && alive.current && selection.current === id;
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
    function schedule() {
      if (!live() || timer) return;
      timer = setTimeout(() => { void refresh(); }, 80);
    }
    const unsubscribe = subscribeSupport(schedule, state => { if (live()) setConnection(state); }, id);
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); };
  }, [selectedId, loadMessages]);

  async function send() {
    const text = draft.trim();
    if (!text || text.length > SUPPORT_MESSAGE_MAX || sendingRef.current) return;
    if (selectedId != null && (!ticket || ticket.status === 'closed' || accessDenied)) return;
    const key = draftKey;
    sendingRef.current = true; setSending(true); setSendError(null);
    try {
      if (selectedId == null) {
        const created = await createSupportTicket(buildSubject(category, text), text);
        if (!alive.current) return;
        setDrafts(previous => ({ ...previous, [key]: '' }));
        setTickets(previous => [created, ...previous.filter(item => item.id !== created.id)]);
        selectTicket(created);
        return;
      }
      const id = selectedId;
      let attempt = messageKeys.current.get(id);
      if (!attempt || attempt.text !== text) { attempt = { text, key: crypto.randomUUID() }; messageKeys.current.set(id, attempt); }
      setPending(text);
      await sendSupportMessage(id, text, attempt.key);
      if (!alive.current) return;
      messageKeys.current.delete(id);
      setDrafts(previous => previous[key] === draft ? { ...previous, [key]: '' } : previous);
      if (selection.current === id) await loadMessages(id, true);
    } catch (cause) { if (alive.current) setSendError(supportError(cause)); }
    finally {
      sendingRef.current = false;
      if (alive.current) { setSending(false); setPending(null); }
    }
  }

  const bubbles = useMemo(() => supportBubbles(ticket, messages, true), [ticket, messages]);
  const closed = ticket?.status === 'closed';
  const newMode = selectedId == null;
  const statusPair = ticket ? SUPPORT_STATUS_LABEL[ticket.status] : null;
  const subtitle = ticket
    ? `#${ticket.id} · ${statusPair ? t(...statusPair) : ticket.status}${ticket.escalatedAt ? ` · ${t('Quản lý đang xem xét', 'Under manager review')}` : ''}`
    : t('Gửi yêu cầu tới lễ tân và theo dõi phản hồi', 'Send requests to the front desk and follow replies');
  const composerBlocked = ticketsLoading || (!newMode && (messagesLoading || accessDenied || (!!ticketsError && !ticket)));
  const label = connection === 'reconnecting' ? t('Mất kết nối trực tiếp · đang thử lại', 'Live connection lost · reconnecting') : null;

  return <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
    <SupportHeader onBack={onBack} active={active} title={t('Hỗ trợ & Khiếu nại', 'Support & Tickets')} subtitle={subtitle} />
    {label && <p role="status" className="support-chat__connection">{label}</p>}
    {ticketsError && <div role="alert" className="direct-chat__error"><p>{t(ticketsError)}</p><button type="button" className="direct-chat__link" onClick={() => void loadTickets(0)}>{t('Thử lại', 'Retry')}</button></div>}
    <div className="support-chat__toolbar">
      <p className="support-chat__ticketbar" title={ticket && !showTickets ? ticket.subject : undefined}>
        {showTickets ? <span className="support-chat__ticketbar-subject">{t('Phiếu của tôi', 'My tickets')}</span>
          : ticket ? <><span className="support-chat__ticketbar-subject">{displaySubject(ticket.subject)}</span>
            <span className={`support-chat__pill support-chat__pill--${ticket.status}`}>{statusPair ? t(...statusPair) : ticket.status}</span></>
            : <span className="support-chat__ticketbar-subject">{t('Yêu cầu mới', 'New request')}</span>}
      </p>
      <div className="support-chat__tools">
        <button type="button" data-i18n-managed className="support-chat__tool" aria-pressed={showTickets} aria-label={t('Phiếu của tôi', 'My tickets')} title={t('Phiếu của tôi', 'My tickets')} disabled={ticketsLoading && tickets.length === 0} onClick={() => setShowTickets(value => !value)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
        </button>
        <button type="button" data-i18n-managed className="support-chat__tool" aria-label={t('Yêu cầu mới', 'New request')} title={t('Yêu cầu mới', 'New request')} disabled={newMode && !showTickets} onClick={() => selectTicket(null)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
        {page + 1 < totalPages && <button type="button" className="direct-chat__older direct-chat__link" disabled={ticketsLoading} onClick={() => void loadTickets(page + 1, true)}>{t('Tải thêm phiếu', 'Load more tickets')}</button>}
      </div>
      : <>
        {messagesError && !newMode && <div role="alert" className="direct-chat__error"><p>{t(messagesError)}</p>{!accessDenied && <button type="button" className="direct-chat__link" onClick={() => void loadMessages(selectedId!)}>{t('Thử lại', 'Retry')}</button>}</div>}
        {ticketsLoading ? <div className="direct-chat__transcript"><LoadingSkeleton label={t('Đang tải hỗ trợ…', 'Loading support…')} count={3} /></div>
          : <SupportTranscript label={t('Lịch sử hỗ trợ', 'Support history')} bubbles={bubbles} pending={pending} loading={!newMode && messagesLoading && messages.length === 0} fallbackName={t('Nhân viên', 'Staff')}
            empty={newMode
              ? <div className="direct-chat__empty direct-chat__ai-intro"><span className="direct-chat__avatar direct-chat__avatar--support" aria-hidden="true"><SupportIcon /></span>
                <p><strong>{t('Hỗ trợ & Khiếu nại', 'Support & Tickets')}</strong> {t('Chọn loại yêu cầu rồi nhắn nội dung. Lễ tân sẽ phản hồi ngay tại đây.', 'Pick a request type and write your message. The front desk will reply right here.')}</p></div>
              : <p className="direct-chat__empty">{t('Chưa có tin nhắn. Hãy bắt đầu trao đổi.', 'No messages yet. Start a conversation.')}</p>} />}
      </>}
    {!showTickets && (closed
      ? <div className="direct-chat__compose support-chat__closed"><p className="direct-chat__muted">{t('Phiếu đã đóng, không thể gửi thêm tin nhắn.', 'This ticket is closed. No further messages can be sent.')}</p>
        <button type="button" className="direct-chat__link" onClick={() => selectTicket(null)}>{t('Gửi yêu cầu mới', 'Send a new request')}</button></div>
      : <>
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
