import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { ApiError } from '../../shared/api/client';
import { createSupportTicket, getMySupportTickets, getSupportMessages, sendSupportMessage, type SupportMessage, type SupportTicket } from './memberSupportApi';
import './member-support.css';

const categories = ['Gói tập', 'Thiết bị', 'Lịch học', 'Khác'] as const;
type Category = typeof categories[number];
const statusLabel: Record<SupportTicket['status'], string> = {
  open: 'Đang chờ', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đã đóng',
};

function categoryOf(subject: string): Category {
  return categories.find((category) => subject.startsWith(`[${category}] `)) ?? 'Khác';
}
function displaySubject(subject: string): string {
  return subject.replace(/^\[(Gói tập|Thiết bị|Lịch học|Khác)\] /, '');
}
function dateTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN');
}
function failure(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

export function MemberSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [category, setCategory] = useState<Category>('Gói tập');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState('');

  const loadTickets = useCallback(async (targetPage: number) => {
    setLoading(true); setListError('');
    try {
      const result = await getMySupportTickets(targetPage);
      setTickets(result.content); setTotalPages(result.totalPages); setPage(targetPage);
    } catch (error) { setListError(failure(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadTickets(0); }, [loadTickets]);

  const loadMessages = useCallback(async (id: number) => {
    setMessagesLoading(true); setMessagesError('');
    try { setMessages(await getSupportMessages(id)); }
    catch (error) { setMessagesError(failure(error)); }
    finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    setMessages([]); setDraft(''); setSendError('');
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = subject.trim();
    if (creatingRef.current || !title) return;
    const fullSubject = `[${category}] ${title}`;
    if (fullSubject.length > 150) { setFormError('Tiêu đề quá dài (tối đa 150 ký tự gồm phân loại).'); return; }
    creatingRef.current = true; setCreating(true); setFormError(''); setNotice('');
    try {
      const created = await createSupportTicket(fullSubject, description.trim());
      setSubject(''); setDescription(''); setNotice(`Đã tạo phiếu #${created.id}.`);
      await loadTickets(0);
    } catch (error) { setFormError(failure(error)); }
    finally { creatingRef.current = false; setCreating(false); }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!selected || sendingRef.current || !value || value.length > 2000 || selected.status === 'closed') return;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      await sendSupportMessage(selected.id, value);
      setDraft('');
      await loadMessages(selected.id);
    } catch (error) { setSendError(failure(error)); }
    finally { sendingRef.current = false; setSending(false); }
  }

  return <div className="portal-container member-support">
    <PageHeader eyebrow="Hội viên" title="Hỗ trợ & khiếu nại" subtitle="Kết nối trực tiếp với đội ngũ SÖL qua từng phiếu hỗ trợ." />
    <div className="member-support-grid">
      <section className="portal-card" aria-labelledby="support-create-title">
        <div className="portal-card-header"><h2 id="support-create-title" className="portal-card-title">Gửi yêu cầu</h2></div>
        <form onSubmit={(event) => void submitTicket(event)} className="member-support-form">
          <label className="portal-label" htmlFor="support-category">Loại yêu cầu</label>
          <Select id="support-category" className="portal-select" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <label className="portal-label" htmlFor="support-subject">Tiêu đề</label>
          <input id="support-subject" className="portal-input" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={138} placeholder="Tóm tắt vấn đề" />
          <label className="portal-label" htmlFor="support-description">Nội dung</label>
          <textarea id="support-description" className="portal-textarea" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Mô tả để chúng tôi hỗ trợ nhanh hơn" />
          {formError && <p role="alert" className="member-support-error">{formError}</p>}
          {notice && <p role="status" className="member-support-notice">{notice}</p>}
          <button className="btn-primary" type="submit" disabled={creating}>{creating ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
        </form>
      </section>
      <section className="portal-card" aria-labelledby="support-list-title">
        <div className="portal-card-header member-support-heading"><h2 id="support-list-title" className="portal-card-title">Phiếu của tôi</h2><button type="button" className="member-support-link" onClick={() => void loadTickets(page)} disabled={loading}>Làm mới</button></div>
        {loading ? <p role="status">Đang tải phiếu hỗ trợ…</p> : listError ? <div role="alert"><p>{listError}</p><button type="button" className="member-support-link" onClick={() => void loadTickets(page)}>Thử lại</button></div> : tickets.length === 0 ? <p className="portal-empty">Bạn chưa có phiếu hỗ trợ nào.</p> : <div className="member-support-list">{tickets.map((ticket) => <button type="button" key={ticket.id} className={`member-support-ticket${selectedId === ticket.id ? ' is-active' : ''}`} onClick={() => setSelectedId(ticket.id)} aria-current={selectedId === ticket.id ? 'true' : undefined}>
          <span className="member-support-ticket-top"><strong>#{ticket.id} · {displaySubject(ticket.subject)}</strong><span className={`member-support-status member-support-status--${ticket.status}`}>{statusLabel[ticket.status] ?? ticket.status}</span></span>
          <span className="member-support-meta">{categoryOf(ticket.subject)} · {dateTime(ticket.createdAt)}</span>
          {ticket.description && <span className="member-support-summary">{ticket.description}</span>}
        </button>)}</div>}
        {!loading && !listError && totalPages > 1 && <div className="member-support-pages"><button type="button" disabled={page === 0} onClick={() => void loadTickets(page - 1)}>Trước</button><span>{page + 1}/{totalPages}</span><button type="button" disabled={page + 1 >= totalPages} onClick={() => void loadTickets(page + 1)}>Sau</button></div>}
      </section>
    </div>
    <section className="portal-card member-support-conversation" aria-labelledby="support-conversation-title">
      <div className="portal-card-header member-support-heading"><h2 id="support-conversation-title" className="portal-card-title">{selected ? `Trao đổi · Phiếu #${selected.id}` : 'Trao đổi'}</h2>{selected && <button type="button" className="member-support-link" disabled={messagesLoading} onClick={() => void loadMessages(selected.id)}>Làm mới hội thoại</button>}</div>
      {!selected ? <p className="portal-empty">Chọn một phiếu để xem trao đổi.</p> : <>
        <p className="member-support-context">{displaySubject(selected.subject)} · {statusLabel[selected.status] ?? selected.status}</p>
        {messagesLoading ? <p role="status">Đang tải hội thoại…</p> : messagesError ? <div role="alert"><p>{messagesError}</p><button type="button" className="member-support-link" onClick={() => void loadMessages(selected.id)}>Thử lại</button></div> : messages.length === 0 ? <p className="portal-empty">Chưa có tin nhắn. Hãy bắt đầu trao đổi.</p> : <ol className="member-support-messages">{messages.map((message) => <li key={message.id} className={message.senderRole === 'MEMBER' ? 'is-member' : 'is-staff'}><strong>{message.senderRole === 'MEMBER' ? 'Bạn' : (message.senderName || 'Nhân viên')}</strong><p>{message.message}</p><time dateTime={message.createdAt}>{dateTime(message.createdAt)}</time></li>)}</ol>}
        {selected.status === 'closed' ? <p className="member-support-context">Phiếu đã đóng, không thể gửi thêm tin nhắn.</p> : <form className="member-support-compose" onSubmit={(event) => void submitMessage(event)}><label className="portal-label" htmlFor="support-message">Tin nhắn</label><textarea id="support-message" className="portal-textarea" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} required placeholder="Nhập nội dung phản hồi…" />{sendError && <p role="alert" className="member-support-error">{sendError}</p>}<button className="btn-primary" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Đang gửi…' : 'Gửi tin nhắn'}</button></form>}
      </>}
    </section>
  </div>;
}
