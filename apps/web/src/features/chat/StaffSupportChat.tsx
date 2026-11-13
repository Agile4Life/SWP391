import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { useI18n } from '../../shared/i18n';
import { escalateSupportTicket, getSupportInbox, getSupportMessages, getSupportTicket, sendSupportMessage, updateSupportStatus, type SupportMessage, type SupportTicket } from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import type { ChatConnection } from './chatRealtime';
import type { ChatError } from './chatMessages';
import { ChatComposer } from './ChatComposer';
import { HeaderAction, SupportHeader, SupportTranscript } from './SupportChatParts';
import { SUPPORT_MESSAGE_MAX, SUPPORT_STATUS_LABEL, isAccessDenied, supportBubbles, supportError, uniqueMessages } from './supportChat';
import '../member/member-support.css';
import './support-chat.css';

type Status = SupportTicket['status'];
const STATUSES = Object.keys(SUPPORT_STATUS_LABEL) as Status[];
const TRANSITIONS: Record<Status, Status[]> = { open: ['open', 'in_progress', 'resolved'], in_progress: ['open', 'in_progress', 'resolved', 'closed'], resolved: ['in_progress', 'resolved', 'closed'], closed: ['closed'] };

/**
 * Hộp thư phiếu hỗ trợ của lễ tân trong khung Tin nhắn: danh sách phiếu như danh sách hội thoại,
 * mở một phiếu để trả lời bằng ô soạn tin, đổi trạng thái hoặc chuyển cấp lên quản lý.
 */
export function StaffSupportChat({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [filter, setFilter] = useState<'' | Status>('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<ChatError | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<ChatError | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ChatError | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState('');
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const alive = useRef(false);
  const selection = useRef<number | null>(null);
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const listQuery = useRef<{ page: number; filter: '' | Status }>({ page: 0, filter: '' });
  const busyRef = useRef(false);
  const sendKeys = useRef(new Map<number, { text: string; key: string }>());

  useEffect(() => { alive.current = true; return () => { alive.current = false; selection.current = null; }; }, []);

  const loadList = useCallback(async (background = false) => {
    const { page: target, filter: status } = listQuery.current;
    const generation = ++listGeneration.current;
    const current = () => alive.current && generation === listGeneration.current;
    if (!background) setLoading(true);
    try {
      let result = await getSupportInbox(target, status);
      if (!current()) return;
      const last = Math.max(0, result.totalPages - 1);
      if (target > last) {
        // Trang hiện tại không còn (phiếu vừa được xử lý xong): lùi về trang cuối rồi đọc lại.
        listQuery.current = { page: last, filter: status }; setPage(last);
        result = await getSupportInbox(last, status);
        if (!current()) return;
      }
      setTickets(result.content); setPages(result.totalPages); setListError(null);
    } catch (cause) { if (current()) setListError(supportError(cause)); }
    finally { if (current()) setLoading(false); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: number, silent = false) => {
    const generation = ++detailGeneration.current;
    const current = () => alive.current && selection.current === id && generation === detailGeneration.current;
    if (!silent) { setDetailLoading(true); setDetailError(null); setAccessDenied(false); }
    try {
      const [result, history] = await Promise.all([getSupportTicket(id), getSupportMessages(id)]);
      if (current()) { setTicket(result); setMessages(uniqueMessages(history)); setDetailError(null); setAccessDenied(false); }
    } catch (cause) {
      if (current()) { setDetailError(supportError(cause)); setAccessDenied(isAccessDenied(cause)); if (!silent) { setTicket(null); setMessages([]); } }
    } finally { if (current()) setDetailLoading(false); }
  }, []);

  // Realtime: danh sách phiếu (phiếu mới, đổi trạng thái) và phiếu đang mở (tin nhắn mới của hội viên).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false, running = false, dirty = false;
    const invalidate = () => {
      if (disposed || !alive.current || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      if (!timer) timer = setTimeout(async () => { timer = undefined; running = true; await loadList(true); running = false; if (dirty) { dirty = false; invalidate(); } }, 80);
    };
    const stop = subscribeSupport(invalidate, state => { if (!disposed && alive.current) { setConnection(state); if (state === 'connected') invalidate(); } });
    return () => { disposed = true; stop(); clearTimeout(timer); };
  }, [loadList]);
  useEffect(() => {
    if (selected === null) return;
    const id = selected;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false, running = false, dirty = false;
    const invalidate = () => {
      if (disposed || !alive.current || selection.current !== id || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      if (!timer) timer = setTimeout(async () => { timer = undefined; running = true; await loadDetail(id, true); running = false; if (dirty) { dirty = false; invalidate(); } }, 80);
    };
    void loadDetail(id);
    const stop = subscribeSupport(invalidate, state => { if (state === 'connected') invalidate(); }, id);
    return () => { disposed = true; stop(); clearTimeout(timer); };
  }, [selected, loadDetail]);

  function open(item: SupportTicket) {
    detailGeneration.current++;
    selection.current = item.id;
    setTicket(item); setMessages([]); setDetailError(null); setAccessDenied(false); setActionError(null); setPending(null);
    setDetailLoading(true); setEscalating(false); setReason(''); setSelected(item.id);
  }
  function close() {
    selection.current = null; detailGeneration.current++;
    setSelected(null); setTicket(null); setMessages([]); setActionError(null); setPending(null); setEscalating(false); setReason('');
    void loadList(true);
  }
  function changeQuery(nextPage: number, nextFilter: '' | Status) {
    listQuery.current = { page: nextPage, filter: nextFilter };
    setPage(nextPage); setFilter(nextFilter);
    void loadList();
  }

  // Lễ tân chỉ xử lý phiếu chưa chuyển cấp; sau khi chuyển lên quản lý thì chỉ đọc.
  const canAct = !!ticket && !ticket.escalatedAt;
  const canEscalate = canAct && (ticket!.status === 'open' || ticket!.status === 'in_progress');
  const draft = selected != null ? drafts[selected] ?? '' : '';

  async function act(operation: () => Promise<unknown>, onDone?: () => void) {
    if (!ticket || busyRef.current || detailLoading || accessDenied) return;
    const id = ticket.id;
    busyRef.current = true; setBusy(true); setActionError(null);
    try {
      await operation();
      if (!alive.current) return;
      onDone?.();
      void loadList(true);
      if (selection.current === id) await loadDetail(id, true);
    } catch (cause) { if (alive.current) setActionError(supportError(cause)); }
    finally { busyRef.current = false; if (alive.current) { setBusy(false); setPending(null); } }
  }
  function send() {
    if (!ticket || !canAct || ticket.status === 'closed') return;
    const id = ticket.id, text = draft.trim();
    if (!text || text.length > SUPPORT_MESSAGE_MAX) return;
    let attempt = sendKeys.current.get(id);
    if (!attempt || attempt.text !== text) { attempt = { text, key: crypto.randomUUID() }; sendKeys.current.set(id, attempt); }
    const key = attempt.key;
    setPending(text);
    void act(() => sendSupportMessage(id, text, key), () => {
      sendKeys.current.delete(id);
      setDrafts(values => values[id] === draft ? { ...values, [id]: '' } : values);
    });
  }
  function changeStatus(status: Status) {
    if (!ticket || status === ticket.status) return;
    void act(() => updateSupportStatus(ticket.id, status));
  }
  function submitEscalation(event: FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (!ticket || !canEscalate || !text || text.length > 500) return;
    void act(() => escalateSupportTicket(ticket.id, text), () => { setEscalating(false); setReason(''); });
  }

  const bubbles = useMemo(() => supportBubbles(ticket, messages, false), [ticket, messages]);
  const memberName = (item: SupportTicket) => item.memberName || t(`Hội viên #${item.memberId}`, `Member #${item.memberId}`);
  const connectionText = connection === 'reconnecting' ? t('Mất kết nối trực tiếp · đang thử lại', 'Live connection lost · reconnecting') : connection === 'connected' ? t('Cập nhật trực tiếp', 'Live updates') : t('Tự động đồng bộ phiếu', 'Auto-syncing tickets');

  if (selected === null) {
    return <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
      <SupportHeader onBack={onBack} active={active} title={t('Hộp thư hỗ trợ', 'Support inbox')} subtitle={connectionText}>
        <HeaderAction label={t('Làm mới', 'Refresh')} disabled={loading} onClick={() => void loadList()}>
          <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </HeaderAction>
      </SupportHeader>
      <div className="support-chat__categories" role="radiogroup" aria-label={t('Lọc theo trạng thái', 'Filter by status')}>
        {(['', ...STATUSES] as const).map(value => <button key={value || 'all'} type="button" role="radio" aria-checked={filter === value} className={`support-chat__chip${filter === value ? ' is-selected' : ''}`} onClick={() => changeQuery(0, value)}>
          {value ? t(...SUPPORT_STATUS_LABEL[value]) : t('Tất cả', 'All')}</button>)}
      </div>
      <div className="direct-chat__transcript support-chat__tickets" role="region" aria-label={t('Phiếu hỗ trợ', 'Support tickets')} aria-busy={loading}>
        {loading ? <LoadingSkeleton label={t('Đang tải phiếu hỗ trợ…', 'Loading support tickets…')} count={4} />
          : listError ? <div role="alert" className="direct-chat__error"><p>{t(listError)}</p><button type="button" className="direct-chat__link" onClick={() => void loadList()}>{t('Thử lại', 'Retry')}</button></div>
            : tickets.length === 0 ? <p className="direct-chat__empty">{t('Không có phiếu hỗ trợ phù hợp.', 'No matching support tickets.')}</p>
              : <ul className="support-chat__ticket-list">{tickets.map(item => {
                const pair = SUPPORT_STATUS_LABEL[item.status];
                return <li key={item.id}><button type="button" data-support-ticket={item.id} className="direct-chat__person" onClick={() => open(item)}>
                  <span className="direct-chat__person-info">
                    <strong data-i18n-managed>#{item.id} · {item.subject}</strong>
                    <span className="direct-chat__person-sub"><small data-i18n-managed className="direct-chat__preview">{memberName(item)} · {formatCenterDate(item.createdAt)}{item.assignedToName ? ` · ${item.assignedToName}` : ''}</small></span>
                  </span>
                  <span className="support-chat__badges">
                    <span className={`support-chat__pill support-chat__pill--${item.status}`}>{pair ? t(...pair) : item.status}</span>
                    {item.escalatedAt && <span className="support-chat__pill support-chat__pill--escalated">{t('Đã chuyển quản lý', 'Escalated')}</span>}
                  </span>
                </button></li>;
              })}</ul>}
        {!loading && !listError && pages > 1 && <nav className="direct-chat__pagination" aria-label={t('Trang phiếu hỗ trợ', 'Support ticket pages')}>
          <button type="button" className="direct-chat__link" disabled={page === 0} onClick={() => changeQuery(page - 1, filter)}>{t('Trước', 'Previous')}</button><span>{page + 1}/{pages}</span>
          <button type="button" className="direct-chat__link" disabled={page + 1 >= pages} onClick={() => changeQuery(page + 1, filter)}>{t('Sau', 'Next')}</button>
        </nav>}
      </div>
    </section>;
  }

  const pair = ticket ? SUPPORT_STATUS_LABEL[ticket.status] : null;
  const closed = ticket?.status === 'closed';
  return <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
    <SupportHeader onBack={close} active={active} title={ticket ? memberName(ticket) : `#${selected}`} subtitle={ticket ? `#${ticket.id} · ${pair ? t(...pair) : ticket.status}${ticket.assignedToName ? ` · ${ticket.assignedToName}` : ''}` : t('Đang tải phiếu…', 'Loading ticket…')}>
      {canEscalate && <HeaderAction label={t('Chuyển lên quản lý', 'Escalate to management')} disabled={busy || detailLoading} onClick={() => { setReason(''); setActionError(null); setEscalating(true); }}>
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </HeaderAction>}
    </SupportHeader>
    {detailError && <div role="alert" className="direct-chat__error"><p>{t(detailError)}</p>{!accessDenied && <button type="button" className="direct-chat__link" onClick={() => void loadDetail(selected)}>{t('Thử lại', 'Retry')}</button>}</div>}
    {ticket && <div className="support-chat__toolbar"><p className="support-chat__ticketbar" title={ticket.subject}><span className="support-chat__ticketbar-subject">{ticket.subject}</span>
      {ticket.escalatedAt && <span className="support-chat__pill support-chat__pill--escalated">{t('Đã chuyển quản lý', 'Escalated')}</span>}</p></div>}
    {ticket?.escalatedAt && <p role="status" data-testid="escalation-info" className="direct-chat__muted support-chat__note">
      {t('Đã chuyển lên quản lý', 'Escalated to management')}{ticket.escalatedByName ? ` · ${ticket.escalatedByName}` : ''} · {formatCenterDateTime(ticket.escalatedAt)}{ticket.escalationReason ? ` — ${ticket.escalationReason}` : ''}. {t('Quản lý đang xử lý, lễ tân chỉ xem.', 'A manager is handling it; the front desk can only view.')}</p>}
    {canAct && ticket && !closed && <div className="support-chat__categories" role="radiogroup" aria-label={t('Trạng thái phiếu', 'Ticket status')}>
      {STATUSES.filter(value => TRANSITIONS[ticket.status].includes(value)).map(value => <button key={value} type="button" role="radio" aria-checked={ticket.status === value} className={`support-chat__chip${ticket.status === value ? ' is-selected' : ''}`} disabled={busy || detailLoading} onClick={() => changeStatus(value)}>{t(...SUPPORT_STATUS_LABEL[value])}</button>)}
    </div>}
    <SupportTranscript label={t('Lịch sử hỗ trợ', 'Support history')} bubbles={bubbles} pending={pending} loading={detailLoading && messages.length === 0} fallbackName={t('Hội viên', 'Member')}
      empty={<p className="direct-chat__empty">{t('Chưa có tin nhắn.', 'No messages yet.')}</p>} />
    {closed
      ? <div className="direct-chat__compose support-chat__closed"><p className="direct-chat__muted">{t('Phiếu đã đóng, không thể gửi thêm tin nhắn.', 'This ticket is closed. No further messages can be sent.')}</p></div>
      : canAct
        ? <ChatComposer id="staff-support-message" label={t('Trả lời hội viên', 'Reply to member')} value={draft} onChange={value => { setDrafts(values => ({ ...values, [selected]: value })); setActionError(null); }} onSubmit={send}
          disabled={detailLoading || accessDenied || !ticket} sending={busy && !!pending} failed={!!actionError && !!draft} maxLength={SUPPORT_MESSAGE_MAX} placeholder={t('Nhập nội dung phản hồi…', 'Enter your reply…')}
          error={actionError ? t(actionError) : null} />
        : actionError ? <p role="alert" className="direct-chat__error">{t(actionError)}</p> : null}
    {escalating && ticket && <Modal title={t(`Chuyển lên quản lý · Phiếu #${ticket.id}`, `Escalate to management · Ticket #${ticket.id}`)} busy={busy} onClose={() => { if (!busy) setEscalating(false); }}>
      <form className="member-support-compose" onSubmit={submitEscalation}>
        <p className="member-support-context">{t('Sau khi chuyển, Quản lý sẽ xử lý phiếu này.', 'Once escalated, a manager will handle this ticket.')}</p>
        <label className="portal-label" htmlFor="staff-support-escalation">{t('Lý do chuyển lên quản lý', 'Reason for escalation')}</label>
        <textarea id="staff-support-escalation" className="portal-textarea" rows={3} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} />
        {actionError && <p role="alert" className="member-support-error">{t(actionError)}</p>}
        <div className="form-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setEscalating(false)}>{t('Hủy', 'Cancel')}</button><button type="submit" className="btn-primary" disabled={busy || !reason.trim()}>{busy ? t('Đang chuyển…', 'Escalating…') : t('Chuyển lên quản lý', 'Escalate to management')}</button></div>
      </form>
    </Modal>}
  </section>;
}
