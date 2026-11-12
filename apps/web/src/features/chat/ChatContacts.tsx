import { Link, useInRouterContext } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { chatRoleLabel, getContacts, type ChatContact } from './chatApi';
import { ChatAvatar } from './ChatAvatar';
import { chatError, type ChatError } from './chatMessages';
import { useI18n } from '../../shared/i18n';

/** `forMember`: a member looks for a receptionist/coach; otherwise staff look for a member to write to. */
export function ChatContacts({ onChoose, pending, forMember = true }: { onChoose: (contact: ChatContact) => void; pending: number | null; forMember?: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ChatError | null>(null);
  const [noCoach, setNoCoach] = useState(false);
  const inRouter = useInRouterContext();
  const sequence = useRef({ value: 0 });
  const search = useCallback(async (term: string, nextPage: number) => {
    const request = ++sequence.current.value;
    setLoading(true); setError(null); setSubmitted(term);
    try {
      const data = await getContacts(term, nextPage);
      if (request !== sequence.current.value) return;
      setContacts(data.content); setPage(nextPage); setTotal(data.totalPages);
      // Coaches are listed first, so none on the first unfiltered page means the member has no coach to write to yet.
      if (term === '' && nextPage === 0) setNoCoach(!data.content.some(contact => contact.role === 'COACH'));
    } catch (e) { if (request === sequence.current.value) setError(chatError(e, 'Không thể tải danh bạ.', 'Unable to load contacts.')); }
    finally { if (request === sequence.current.value) setLoading(false); }
  }, []);
  useEffect(() => { const requests = sequence.current; void search('', 0); return () => { requests.value++; }; }, [search]);
  function submit(event: FormEvent) { event.preventDefault(); void search(query.trim(), 0); }
  return <section data-i18n-managed className="direct-chat__contacts" aria-label={forMember ? t("Chọn người để trò chuyện", "Choose a chat recipient") : t("Chọn hội viên để nhắn tin", "Choose a member to message")}>
    <form onSubmit={submit} className="direct-chat__search">
      <label className="portal-label" htmlFor="chat-contact-query">{forMember ? t("Tìm lễ tân hoặc huấn luyện viên của bạn", "Find a receptionist or one of your coaches") : t("Tìm hội viên", "Find a member")}</label>
      <div><input id="chat-contact-query" className="portal-input" type="search" value={query} maxLength={80} onChange={e => setQuery(e.target.value)} placeholder={forMember ? t("Tìm kiếm người nhận...", "Search recipients...") : t("Tên hội viên...", "Member name...")} />
        <button type="submit" className="btn-secondary" disabled={loading}>{t("Tìm", "Search")}</button></div>
    </form>
    {forMember && noCoach && !loading && !error && <div className="direct-chat__notice" role="status" data-testid="chat-no-coach">
      <strong>{t("Chưa có huấn luyện viên để nhắn tin", "No coach to message yet")}</strong>
      <span>{t("Bạn chỉ nhắn tin được với huấn luyện viên của lớp bạn đã đăng ký. Đăng ký lớp để trò chuyện với huấn luyện viên đó.", "You can only message coaches of classes you have joined. Join a class to chat with its coach.")}</span>
      {inRouter ? <Link className="direct-chat__link" to="/member/classes">{t("Xem lớp học", "Browse classes")}</Link> : <a className="direct-chat__link" href="/member/classes">{t("Xem lớp học", "Browse classes")}</a>}
    </div>}
    {loading ? <LoadingSkeleton label={t("Đang tải danh bạ…", "Loading contacts…")} count={3} /> : error ? <div role="alert"><p>{t(error)}</p><button className="direct-chat__link" type="button" onClick={() => void search(submitted, page)}>{t("Thử lại", "Retry")}</button></div>
      : contacts.length === 0 ? <p className="direct-chat__muted">{forMember ? t("Không tìm thấy lễ tân hoặc huấn luyện viên của lớp bạn đã đăng ký.", "No matching receptionist or coach from your classes found.") : t("Không tìm thấy hội viên phù hợp.", "No matching members found.")}</p>
        : <ul className="direct-chat__list">{contacts.map(contact => <li key={contact.id}><button type="button" data-contact-id={contact.id} className="direct-chat__person" disabled={pending !== null} onClick={() => onChoose(contact)}>
          <ChatAvatar contact={contact} />
          <span className="direct-chat__person-info"><strong>{contact.name}</strong><small className="direct-chat__role">{pending === contact.id ? t('Đang mở hội thoại…', 'Opening conversation…') : chatRoleLabel(contact.role, t)}</small></span>
          <span className="direct-chat__person-arrow" aria-hidden="true">↗</span>
        </button></li>)}</ul>}
    {!loading && !error && total > 1 && <nav className="direct-chat__pagination" aria-label={t("Trang danh bạ", "Contact pages")}>
      <button type="button" className="direct-chat__link" disabled={page === 0} onClick={() => void search(submitted, page - 1)}>{t("Trước", "Previous")}</button>
      <span>{page + 1}/{total}</span><button type="button" className="direct-chat__link" disabled={page + 1 >= total} onClick={() => void search(submitted, page + 1)}>{t("Sau", "Next")}</button>
    </nav>}
  </section>;
}
