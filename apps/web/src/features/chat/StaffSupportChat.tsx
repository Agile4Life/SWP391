import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { useI18n } from '../../shared/i18n';
import { escalateSupportTicket, getSupportInbox, getSupportMessages, getSupportTicket, markSupportRead, sendSupportMessage, updateSupportStatus, type SupportMessage, type SupportTicket } from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import type { ChatError } from './chatMessages';
import { ChatComposer } from './ChatComposer';
import { HeaderAction, SupportHeader, SupportTranscript } from './SupportChatParts';
import { SUPPORT_MESSAGE_MAX, SUPPORT_STATUS_LABEL, isAccessDenied, localizedSubject, supportBubbles, supportError, uniqueMessages } from './supportChat';
import '../member/member-support.css';
import './support-chat.css';

/** Trạng thái của phiếu hỗ trợ. */
type Status = SupportTicket['status'];
const STATUSES = Object.keys(SUPPORT_STATUS_LABEL) as Status[];
const TRANSITIONS: Record<Status, Status[]> = { open: ['open', 'in_progress'], in_progress: ['open', 'in_progress', 'resolved'], resolved: ['in_progress', 'resolved', 'closed'], closed: ['closed'] };

/**
 * Hộp thư phiếu hỗ trợ của lễ tân trong khung Tin nhắn: danh sách phiếu như danh sách hội thoại,
 * mở một phiếu để trả lời bằng ô soạn tin, đổi trạng thái hoặc chuyển cấp lên quản lý.
 * Với quản lý (`manager`), API chỉ trả phiếu đã chuyển cấp; quản lý trả lời, đổi trạng thái nhưng không chuyển cấp tiếp.
 */
export function StaffSupportChat({ onBack, active = true, manager = false, split = false, onUnreadCountChange }: { onBack: () => void; active?: boolean; manager?: boolean; split?: boolean; onUnreadCountChange?: (count: number) => void }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [filter, setFilter] = useState<'' | Status>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<ChatError | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<ChatError | null>(null);
  const [readError, setReadError] = useState<ChatError | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<ChatError | null>(null);
  const [actionError, setActionError] = useState<ChatError | null>(null);
  const [escalationError, setEscalationError] = useState<ChatError | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState('');
  const alive = useRef(false);
  const activeRef = useRef(active);
  const selection = useRef<number | null>(null);
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const listQuery = useRef<{ page: number; filter: '' | Status; unreadOnly: boolean }>({ page: 0, filter: '', unreadOnly: false });
  const readCursors = useRef(new Map<number, number>());
  const detailInFlight = useRef(new Map<number, Promise<void>>());
  const detailDirty = useRef(new Set<number>());
  const listElement = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const busyIds = useRef(new Set<number>());
  const sendKeys = useRef(new Map<number, { text: string; key: string }>());

  useEffect(() => { alive.current = true; return () => { alive.current = false; selection.current = null; }; }, []);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Tải danh sách phiếu theo trang và trạng thái hiện tại; trang vượt quá thì lùi về trang cuối, chỉ lần gọi mới nhất được dùng.
  const loadList = useCallback(async (background = false) => {
    const { page: target, filter: status, unreadOnly: unread } = listQuery.current;
    const generation = ++listGeneration.current;
    // Lần gọi này còn hiệu lực không (component còn sống và chưa có lần gọi mới hơn).
    const current = () => alive.current && generation === listGeneration.current;
    if (!background) setLoading(true);
    try {
      const fetchPage = (value: number) => getSupportInbox(value, status, unread);
      let result = await fetchPage(target);
      if (!current()) return;
      const last = Math.max(0, result.totalPages - 1);
      if (target > last) {
        // Trang hiện tại không còn (phiếu vừa được xử lý xong): lùi về trang cuối rồi đọc lại.
        listQuery.current = { page: last, filter: status, unreadOnly: unread }; setPage(last);
        result = await fetchPage(last);
        if (!current()) return;
      }
      setTickets(result.content); setPages(result.totalPages); setListError(null);
      if (status === '' && !unread) {
        onUnreadCountChange?.(result.content.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0));
      }
    } catch (cause) { if (current()) setListError(supportError(cause)); }
    finally { if (current()) setLoading(false); }
  }, [onUnreadCountChange]);
  useEffect(() => { void loadList(); }, [loadList]);

  // Tải chi tiết phiếu và các tin nhắn (silent thì không hiện trạng thái tải).
  const loadDetail = useCallback(async (id: number, silent = false) => {
    // Gộp realtime/focus liên tiếp: mỗi phiếu chỉ có một lượt tải và xác nhận đọc đang chạy.
    const existing = detailInFlight.current.get(id);
    if (existing) { detailDirty.current.add(id); return existing; }
    const request = (async () => {
      do {
        detailDirty.current.delete(id);
        const generation = ++detailGeneration.current;
        const current = () => alive.current && selection.current === id && generation === detailGeneration.current;
        if (!silent) { setDetailLoading(true); setDetailError(null); setAccessDenied(false); }
        try {
          const [result, history] = await Promise.all([getSupportTicket(id), getSupportMessages(id)]);
          // Có thể vừa quay lại và mở lại cùng phiếu: bỏ kết quả cũ, vẫn chạy lượt tải đang chờ.
          if (!current()) continue;
          setTicket(result); setMessages(uniqueMessages(history)); setDetailLoading(false); setDetailError(null); setAccessDenied(false);
          // Chỉ đọc đến ảnh chụp dữ liệu vừa tải thành công; tin đến sau vẫn còn chưa đọc trên server.
          const cursor = history.reduce((last, message) => Math.max(last, message.id), 0);
          if (activeRef.current && document.visibilityState !== 'hidden' && (readCursors.current.get(id) ?? -1) < cursor) {
            try {
              await markSupportRead(id, cursor);
              readCursors.current.set(id, cursor);
              if (current()) setReadError(null);
              // Tải lại số chưa đọc thật; generation của danh sách loại kết quả cũ trước lúc xác nhận đọc.
              if (alive.current) void loadList(true);
            } catch (cause) { if (current()) setReadError(supportError(cause)); }
          }
        } catch (cause) {
          if (current()) { setDetailError(supportError(cause)); setAccessDenied(isAccessDenied(cause)); if (!silent || isAccessDenied(cause)) { setTicket(null); setMessages([]); } }
        } finally { if (current()) setDetailLoading(false); }
      } while (detailDirty.current.has(id) && alive.current && selection.current === id && activeRef.current);
    })();
    detailInFlight.current.set(id, request);
    try { await request; } finally { detailInFlight.current.delete(id); }
  }, [loadList]);

  // Realtime: danh sách phiếu (phiếu mới, đổi trạng thái) và phiếu đang mở (tin nhắn mới của hội viên).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false, running = false, dirty = false;
    // Khi có thông báo realtime: tải lại danh sách (gộp các thông báo liên tiếp, không chạy chồng).
    const invalidate = () => {
      if (disposed || !alive.current || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      if (!timer) timer = setTimeout(async () => { timer = undefined; running = true; await loadList(true); running = false; if (dirty) { dirty = false; invalidate(); } }, 80);
    };
    const stop = subscribeSupport(invalidate, state => { if (!disposed && alive.current && state === 'connected') invalidate(); });
    return () => { disposed = true; stop(); clearTimeout(timer); };
  }, [loadList]);
  useEffect(() => {
    if (selected === null || !active) return;
    const id = selected;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false, running = false, dirty = false;
    // Khi có thông báo realtime: tải lại chi tiết phiếu đang mở (gộp các thông báo liên tiếp).
    const invalidate = () => {
      if (disposed || !alive.current || selection.current !== id || document.visibilityState === 'hidden') return;
      if (running) { dirty = true; return; }
      if (!timer) timer = setTimeout(async () => { timer = undefined; running = true; await loadDetail(id, true); running = false; if (dirty) { dirty = false; invalidate(); } }, 80);
    };
    void loadDetail(id);
    const stop = subscribeSupport(invalidate, state => { if (state === 'connected') invalidate(); }, id);
    return () => { disposed = true; stop(); clearTimeout(timer); };
  }, [selected, active, manager, loadDetail]);

  useLayoutEffect(() => { if (selected === null && listElement.current) listElement.current.scrollTop = listScroll.current; }, [selected]);

  // Mở một phiếu để xem chi tiết.
  function open(item: SupportTicket) {
    listScroll.current = listElement.current?.scrollTop ?? 0;
    detailGeneration.current++;
    selection.current = item.id;
    setTicket(item); setMessages([]); setDetailError(null); setReadError(null); setAccessDenied(false);
    setSendError(null); setActionError(null); setEscalationError(null); setPending(null);
    setBusy(busyIds.current.has(item.id));
    setDetailLoading(true); setEscalating(false); setReason(''); setSelected(item.id);
  }
  // Đóng phiếu đang xem, quay về danh sách và tải lại.
  function close() {
    selection.current = null; detailGeneration.current++;
    setSelected(null); setTicket(null); setMessages([]); setReadError(null);
    setSendError(null); setActionError(null); setEscalationError(null); setPending(null);
    setBusy(false); setEscalating(false); setReason('');
    void loadList(true);
  }
  // Đổi trang hoặc bộ lọc trạng thái rồi tải lại danh sách.
  function changeQuery(nextPage: number, nextFilter: '' | Status, unread = unreadOnly) {
    listQuery.current = { page: nextPage, filter: nextFilter, unreadOnly: unread };
    setPage(nextPage); setFilter(nextFilter); setUnreadOnly(unread); listScroll.current = 0;
    void loadList();
  }

  // Lễ tân chỉ xử lý phiếu chưa chuyển cấp; sau khi chuyển lên quản lý thì lễ tân chỉ đọc, quản lý xử lý tiếp.
  const canAct = !!ticket && (manager ? !!ticket.escalatedAt : !ticket.escalatedAt);
  const canEscalate = canAct && !manager && (ticket!.status === 'open' || ticket!.status === 'in_progress');
  const draft = selected != null ? drafts[selected] ?? '' : '';

  // Thực hiện một thao tác lên phiếu (gửi, đổi trạng thái, chuyển cấp...) với khóa chống bấm đúp và tách lỗi riêng.
  async function act(kind: 'send' | 'status' | 'escalate', operation: () => Promise<unknown>, onDone?: () => void) {
    if (!ticket || busyIds.current.has(ticket.id) || detailLoading || accessDenied) return;
    const id = ticket.id;
    busyIds.current.add(id); setBusy(true);
    if (kind === 'send') setSendError(null);
    else if (kind === 'status') setActionError(null);
    else setEscalationError(null);
    try {
      await operation();
      if (!alive.current) return;
      onDone?.();
      void loadList(true);
      if (selection.current === id) await loadDetail(id, true);
    } catch (cause) {
      if (alive.current && selection.current === id) {
        const err = supportError(cause);
        if (kind === 'send') setSendError(err);
        else if (kind === 'status') setActionError(err);
        else setEscalationError(err);
      }
    } finally {
      busyIds.current.delete(id);
      if (alive.current && selection.current === id) { setBusy(false); setPending(null); }
    }
  }
  // Gửi tin nhắn trả lời; mỗi nội dung dùng một khóa riêng để gửi lại không bị trùng.
  function send() {
    if (!ticket || !canAct || ticket.status === 'closed' || busyIds.current.has(ticket.id) || detailLoading || accessDenied) return;
    const id = ticket.id, text = draft.trim();
    if (!text || text.length > SUPPORT_MESSAGE_MAX) return;
    let attempt = sendKeys.current.get(id);
    if (!attempt || attempt.text !== text) { attempt = { text, key: crypto.randomUUID() }; sendKeys.current.set(id, attempt); }
    const key = attempt.key;
    setPending(text);
    void act('send', () => sendSupportMessage(id, text, key), () => {
      sendKeys.current.delete(id);
      setDrafts(values => values[id] === draft ? { ...values, [id]: '' } : values);
    });
  }
  // Đổi trạng thái phiếu theo các chuyển đổi cho phép.
  function changeStatus(status: Status) {
    if (!ticket || status === ticket.status) return;
    const id = ticket.id;
    void act('status', () => updateSupportStatus(id, status));
  }
  // Gửi chuyển cấp khiếu nại lên quản lý kèm lý do tối đa 500 ký tự.
  function submitEscalation(event: FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (!ticket || !canEscalate || !text || text.length > 500) return;
    const id = ticket.id;
    void act('escalate', () => escalateSupportTicket(id, text), () => {
      if (selection.current === id) { setEscalating(false); setReason(''); setEscalationError(null); }
    });
  }

  // Các bong bóng chat dựng từ phiếu và tin nhắn (nhân sự là "tôi").
  const bubbles = useMemo(() => supportBubbles(ticket, messages, false), [ticket, messages]);
  // Tên hội viên của phiếu (không có tên thì hiện "Hội viên #id").
  const memberName = (item: SupportTicket) => item.memberName || t(`Hội viên #${item.memberId}`, `Member #${item.memberId}`);

  const statusFilters: Array<{ key: '' | Status; label: string }> = [
    { key: '', label: t('Tất cả', 'All') },
    { key: 'open', label: t('Đang chờ', 'Open') },
    { key: 'resolved', label: t('Đã giải quyết', 'Resolved') },
    { key: 'closed', label: t('Đã đóng', 'Closed') },
  ];

  const inboxPane = split ? (
    <div ref={listElement} className="support-split__list" role="region" aria-label={t('Phiếu hỗ trợ', 'Support tickets')} aria-busy={loading}>
      {loading ? (
        <div className="portal-card support-split__state-card">
          <LoadingSkeleton label={t('Đang tải phiếu hỗ trợ…', 'Loading support tickets…')} count={4} />
        </div>
      ) : listError ? (
        <div role="alert" className="portal-alert">
          <span>{t(listError)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadList()}>{t('Thử lại', 'Retry')}</button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="portal-card support-split__empty-card">
          <p className="support-split__empty-title">
            {manager ? t('Chưa có phiếu nào được chuyển lên.', 'No escalated tickets.') : t('Không có phiếu hỗ trợ phù hợp.', 'No matching support tickets.')}
          </p>
          <span className="support-split__empty-sub">
            {t('Hãy thử chọn trạng thái khác hoặc bấm Làm mới.', 'Try choosing a different status or click Refresh.')}
          </span>
        </div>
      ) : (
        <ul className="support-split__cards">
          {tickets.map(item => {
            const pair = SUPPORT_STATUS_LABEL[item.status];
            const unread = !!item.unreadCount;
            const isSelected = item.id === selected;
            const rawPreview = item.lastMessage ?? item.description ?? localizedSubject(item.subject, t);
            const senderPrefix = item.lastMessageMine
              ? t('Bạn: ', 'You: ')
              : item.lastMessageSenderName
                ? `${item.lastMessageSenderName}: `
                : '';
            const name = memberName(item);
            const initial = (name.trim().charAt(0) || '?').toUpperCase();
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-support-ticket={item.id}
                  className={`portal-card support-split__card${unread ? ' has-unread' : ''}${isSelected ? ' is-selected' : ''}`}
                  onClick={() => open(item)}
                >
                  <div className="support-split__card-head">
                    <div className="support-split__card-author">
                      <span className="support-split__avatar" aria-hidden="true">{initial}</span>
                      <span className="support-split__card-meta">
                        <strong data-i18n-managed className="support-split__member">{name}</strong>
                        <span data-i18n-managed className={`support-split__preview${unread ? ' is-unread' : ''}`}>
                          {senderPrefix}{rawPreview}
                        </span>
                      </span>
                    </div>
                    <span className="support-chat__badges">
                      {unread && (
                        <span className="direct-chat__unread" aria-label={t(`${item.unreadCount} tin chưa đọc`, `${item.unreadCount} unread messages`)}>
                          {item.unreadCount! > 99 ? '99+' : item.unreadCount}
                        </span>
                      )}
                      <span className={`support-chat__pill support-chat__pill--${item.status}`}>
                        {pair ? t(...pair) : item.status}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !listError && pages > 1 && (
        <nav className="direct-chat__pagination" aria-label={t('Trang phiếu hỗ trợ', 'Support ticket pages')}>
          <button type="button" className="btn-secondary btn-sm" disabled={page === 0} onClick={() => changeQuery(page - 1, filter)}>{t('Trước', 'Previous')}</button>
          <span>{page + 1}/{pages}</span>
          <button type="button" className="btn-secondary btn-sm" disabled={page + 1 >= pages} onClick={() => changeQuery(page + 1, filter)}>{t('Sau', 'Next')}</button>
        </nav>
      )}
    </div>
  ) : <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
    <SupportHeader onBack={onBack} active={active} title={manager ? t('Khiếu nại chuyển lên', 'Escalated tickets') : t('Hộp thư hỗ trợ', 'Support inbox')} subtitle={null}>
      <HeaderAction label={t('Làm mới', 'Refresh')} disabled={loading} onClick={() => void loadList()}>
        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </HeaderAction>
    </SupportHeader>
    <div className="support-chat__categories" role="radiogroup" aria-label={t('Lọc tin chưa đọc', 'Filter unread messages')}>
      <button type="button" role="radio" aria-checked={!unreadOnly && filter === ''} className={`support-chat__chip${!unreadOnly && filter === '' ? ' is-selected' : ''}`} onClick={() => changeQuery(0, '', false)}>{t('Tất cả', 'All')}</button>
      <button type="button" role="radio" aria-checked={unreadOnly} className={`support-chat__chip${unreadOnly ? ' is-selected' : ''}`} onClick={() => changeQuery(0, filter, !unreadOnly)}>{t('Chưa đọc', 'Unread')}</button>
    </div>
    <div className="support-chat__categories" role="radiogroup" aria-label={t('Lọc theo trạng thái', 'Filter by status')}>
      {STATUSES.map(value => <button key={value} type="button" role="radio" aria-checked={filter === value} className={`support-chat__chip${filter === value ? ' is-selected' : ''}`} onClick={() => changeQuery(0, filter === value ? '' : value)}>
        {t(...SUPPORT_STATUS_LABEL[value])}</button>)}
    </div>
    <div ref={listElement} className="direct-chat__transcript support-chat__tickets" role="region" aria-label={t('Phiếu hỗ trợ', 'Support tickets')} aria-busy={loading}>
      {loading ? <LoadingSkeleton label={t('Đang tải phiếu hỗ trợ…', 'Loading support tickets…')} count={4} />
        : listError ? <div role="alert" className="direct-chat__error"><p>{t(listError)}</p><button type="button" className="direct-chat__link" onClick={() => void loadList()}>{t('Thử lại', 'Retry')}</button></div>
          : tickets.length === 0 ? <p className="direct-chat__empty">{manager ? t('Chưa có phiếu nào được chuyển lên.', 'No escalated tickets.') : t('Không có phiếu hỗ trợ phù hợp.', 'No matching support tickets.')}</p>
            : <ul className="support-chat__ticket-list">{tickets.map(item => {
              const pair = SUPPORT_STATUS_LABEL[item.status];
              const unread = !!item.unreadCount;
              const rawPreview = item.lastMessage ?? item.description ?? localizedSubject(item.subject, t);
              const senderPrefix = item.lastMessageMine
                ? t('Bạn: ', 'You: ')
                : item.lastMessageSenderName
                  ? `${item.lastMessageSenderName}: `
                  : '';
              return <li key={item.id}><button type="button" data-support-ticket={item.id} className={`direct-chat__person${unread ? ' has-unread' : ''}${item.id === selected ? ' is-selected' : ''}`} onClick={() => open(item)}>
                <span className="direct-chat__person-info">
                  <strong data-i18n-managed className="support-chat__member">{memberName(item)}</strong>
                  {!manager && <span data-i18n-managed className="support-chat__subject">#{item.id} · {localizedSubject(item.subject, t)}</span>}
                  <span data-i18n-managed className={`direct-chat__preview${unread ? ' is-unread' : ''}`}>{senderPrefix}{rawPreview}</span>
                  {!manager && <time dateTime={item.lastMessageAt ?? item.createdAt}>{formatCenterDateTime(item.lastMessageAt ?? item.createdAt)}</time>}
                </span>
                <span className="support-chat__badges">
                  {unread && <span className="direct-chat__unread" aria-label={t(`${item.unreadCount} tin chưa đọc`, `${item.unreadCount} unread messages`)}>{item.unreadCount! > 99 ? '99+' : item.unreadCount}</span>}
                  <span className={`support-chat__pill support-chat__pill--${item.status}`}>{pair ? t(...pair) : item.status}</span>
                  {item.escalatedAt && !manager && <span className="support-chat__pill support-chat__pill--escalated">{t('Đã chuyển quản lý', 'Escalated')}</span>}
                </span>
              </button></li>;
            })}</ul>}
      {!loading && !listError && pages > 1 && <nav className="direct-chat__pagination" aria-label={t('Trang phiếu hỗ trợ', 'Support ticket pages')}>
        <button type="button" className="direct-chat__link" disabled={page === 0} onClick={() => changeQuery(page - 1, filter)}>{t('Trước', 'Previous')}</button><span>{page + 1}/{pages}</span>
        <button type="button" className="direct-chat__link" disabled={page + 1 >= pages} onClick={() => changeQuery(page + 1, filter)}>{t('Sau', 'Next')}</button>
      </nav>}
    </div>
  </section>;

  const pair = ticket ? SUPPORT_STATUS_LABEL[ticket.status] : null;
  const closed = ticket?.status === 'closed';
  const detailPane = selected !== null ? <section data-i18n-managed className="direct-chat__thread direct-chat__support support-chat" aria-labelledby="chat-support-title">
    <SupportHeader onBack={close} active={active} inboxBackLabel={t('Quay lại hộp thư', 'Back to inbox')} title={ticket ? memberName(ticket) : `#${selected}`} subtitle={ticket ? `#${ticket.id} · ${pair ? t(...pair) : ticket.status}${ticket.assignedToName ? ` · ${ticket.assignedToName}` : ''}` : t('Đang tải phiếu…', 'Loading ticket…')}>
      {canEscalate && <HeaderAction label={t('Chuyển lên quản lý', 'Escalate to management')} disabled={busy || detailLoading} onClick={() => { setReason(''); setEscalationError(null); setEscalating(true); }}>
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </HeaderAction>}
    </SupportHeader>
    {detailError && <div role="alert" className="direct-chat__error"><p>{t(detailError)}</p>{!accessDenied && <button type="button" className="direct-chat__link" onClick={() => void loadDetail(selected)}>{t('Thử lại', 'Retry')}</button>}</div>}
    {readError && !detailError && <div role="alert" className="direct-chat__error"><p>{t(readError)}</p><button type="button" className="direct-chat__link" onClick={() => void loadDetail(selected, true)}>{t('Thử lại', 'Retry')}</button></div>}
    {ticket && <div className="support-chat__toolbar"><p className="support-chat__ticketbar" title={localizedSubject(ticket.subject, t)}><span className="support-chat__ticketbar-subject">{localizedSubject(ticket.subject, t)}</span>
      {ticket.escalatedAt && !manager && <span className="support-chat__pill support-chat__pill--escalated">{t('Đã chuyển quản lý', 'Escalated')}</span>}</p></div>}
    {ticket?.escalatedAt && <p role="status" data-testid="escalation-info" className="direct-chat__muted support-chat__note">
      {t('Chuyển cấp', 'Escalated')}: {ticket.escalatedByName ? `${ticket.escalatedByName} · ` : ''}{formatCenterDateTime(ticket.escalatedAt)}</p>}
    {canAct && ticket && !closed && <div className="support-chat__categories" role="radiogroup" aria-label={t('Trạng thái phiếu', 'Ticket status')}>
      {STATUSES.filter(value => TRANSITIONS[ticket.status].includes(value)).map(value => <button key={value} type="button" role="radio" aria-checked={ticket.status === value} className={`support-chat__chip${ticket.status === value ? ' is-selected' : ''}`} disabled={busy || detailLoading} onClick={() => changeStatus(value)}>{t(...SUPPORT_STATUS_LABEL[value])}</button>)}
    </div>}
    {actionError && <p role="alert" className="direct-chat__error">{t(actionError)}</p>}
    <SupportTranscript label={t('Lịch sử hỗ trợ', 'Support history')} bubbles={bubbles} pending={pending} loading={detailLoading && messages.length === 0} fallbackName={t('Hội viên', 'Member')}
      empty={<p className="direct-chat__empty">{t('Chưa có tin nhắn.', 'No messages yet.')}</p>} />
    {closed
      ? <div className="direct-chat__compose support-chat__closed"><p className="direct-chat__muted">{t('Phiếu đã đóng, không thể gửi thêm tin nhắn.', 'This ticket is closed. No further messages can be sent.')}</p></div>
      : canAct
        ? <ChatComposer id="staff-support-message" label={t('Trả lời hội viên', 'Reply to member')} value={draft} onChange={value => { setDrafts(values => ({ ...values, [selected]: value })); setSendError(null); }} onSubmit={send}
          disabled={detailLoading || accessDenied || !ticket} sending={busy && !!pending} failed={!!sendError} maxLength={SUPPORT_MESSAGE_MAX} placeholder={t('Nhập nội dung phản hồi…', 'Enter your reply…')}
          error={sendError ? t(sendError) : null} />
        : null}
    {escalating && ticket && <Modal title={t(`Chuyển lên quản lý · Phiếu #${ticket.id}`, `Escalate to management · Ticket #${ticket.id}`)} busy={busy} onClose={() => { if (!busy) { setEscalating(false); setEscalationError(null); } }}>
      <form className="member-support-compose" onSubmit={submitEscalation}>
        <p className="member-support-context">{t('Sau khi chuyển, Quản lý sẽ xử lý phiếu này.', 'Once escalated, a manager will handle this ticket.')}</p>
        <label className="portal-label" htmlFor="staff-support-escalation">{t('Lý do chuyển lên quản lý', 'Reason for escalation')}</label>
        <textarea id="staff-support-escalation" className="portal-textarea" rows={3} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} />
        {escalationError && <p role="alert" className="member-support-error">{t(escalationError)}</p>}
        <div className="form-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => { setEscalating(false); setEscalationError(null); }}>{t('Hủy', 'Cancel')}</button><button type="submit" className="btn-primary" disabled={busy || !reason.trim()}>{busy ? t('Đang chuyển…', 'Escalating…') : t('Chuyển lên quản lý', 'Escalate to management')}</button></div>
      </form>
    </Modal>}
  </section> : null;

  if (split) {
    return (
      <div data-i18n-managed className={`support-split${selected !== null ? ' has-selection' : ''}`}>
        <div className="support-split__filterbar">
          <div className="portal-tabs" role="tablist" aria-label={t('Lọc theo trạng thái', 'Filter by status')} style={{ marginBottom: 0 }}>
            {statusFilters.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`portal-tab ${isActive ? 'active' : ''}`}
                  onClick={() => changeQuery(0, tab.key, false)}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn-secondary btn-sm" disabled={loading} onClick={() => void loadList()}>
            {t('Làm mới', 'Refresh')}
          </button>
        </div>
        <div className="support-split__grid">
          {inboxPane}
          <div className="support-split__detail">
            {detailPane ? (
              <div className="portal-card support-split__detail-card">
                {detailPane}
              </div>
            ) : (
              <div className="portal-card support-split__placeholder">
                <p style={{ margin: 0 }}>{t('Chọn một khiếu nại ở danh sách bên trái để xem chi tiết và phản hồi.', 'Select a ticket on the left to view details and reply.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return selected === null ? inboxPane : detailPane;
}
