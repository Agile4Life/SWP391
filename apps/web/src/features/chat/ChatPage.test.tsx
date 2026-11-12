import { setLanguage } from '../../shared/i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatPage } from './ChatPage';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import * as api from './chatApi';
import { subscribeChat } from './chatRealtime';
import { getCurrentUser } from '../../shared/api/client';
vi.mock('./chatApi', async importOriginal => ({ ...await importOriginal<typeof api>(), getConversations: vi.fn(), getContacts: vi.fn(), openConversation: vi.fn(), getHistory: vi.fn(), sendMessage: vi.fn(), markConversationRead: vi.fn() }));
vi.mock('../member/memberSupportApi', () => ({ getMySupportTickets: vi.fn(async () => ({ content: [], totalPages: 0 })), getSupportInbox: vi.fn(async () => ({ content: [], totalPages: 0 })), getSupportTicket: vi.fn(), getSupportMessages: vi.fn(async () => []), sendSupportMessage: vi.fn(), createSupportTicket: vi.fn(), updateSupportStatus: vi.fn(), escalateSupportTicket: vi.fn() }));
vi.mock('../member/supportRealtime', () => ({ subscribeSupport: vi.fn(() => () => {}) }));
vi.mock('./chatRealtime', () => ({ subscribeChat: vi.fn(() => vi.fn()) }));
vi.mock('../../shared/api/client', () => ({ getCurrentUser: vi.fn(), apiFetch: vi.fn() }));
let host: HTMLDivElement, root: Root;
const conversation: api.ChatConversation = { id: 7, peer: { id: 20, name: 'Coach Linh', role: 'COACH', available: true }, createdAt: '2026-10-29T01:00:00Z', lastActivityAt: '2026-10-29T01:00:00Z' };
beforeEach(() => {
  setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'member', identifier: 'member', name: 'Member', role: 'MEMBER' });
  vi.mocked(api.getConversations).mockResolvedValue({ content: [conversation], totalPages: 1, number: 0 });
  vi.mocked(api.getHistory).mockResolvedValue({ items: [], hasMore: false });
  vi.mocked(api.markConversationRead).mockResolvedValue({ count: 0 });
  vi.mocked(api.getContacts).mockResolvedValue({ content: [conversation.peer], totalPages: 1, number: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const button = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
const render = () => act(async () => root.render(<ChatPage />));

it('keeps a skeleton in each pending chat region and renders responses immediately', async () => {
  let finishInbox!: (value: api.ChatPageData<api.ChatConversation>) => void;
  let finishContacts!: (value: api.ChatPageData<api.ChatContact>) => void;
  let finishHistory!: (value: api.ChatHistory) => void;
  vi.mocked(api.getConversations).mockReturnValueOnce(new Promise(resolve => { finishInbox = resolve; }));
  vi.mocked(api.getContacts).mockReturnValueOnce(new Promise(resolve => { finishContacts = resolve; }));
  vi.mocked(api.getHistory).mockReturnValueOnce(new Promise(resolve => { finishHistory = resolve; }));
  await render();
  expect(host.querySelector('.direct-chat__inbox [role="status"] [aria-hidden="true"]')).not.toBeNull();
  expect(host.textContent).not.toContain('Chưa có hội thoại');
  await act(async () => finishInbox({ content: [conversation], totalPages: 1, number: 0 }));
  expect(host.querySelector('.direct-chat__inbox [aria-busy="true"]')).toBeNull();
  expect(button('Coach Linh')).toBeDefined();

  await act(async () => button('Cuộc trò chuyện mới').click());
  expect(host.querySelector('.direct-chat__contacts [role="status"] [aria-hidden="true"]')).not.toBeNull();
  expect(host.textContent).not.toContain('Không tìm thấy lễ tân');
  await act(async () => finishContacts({ content: [conversation.peer], totalPages: 1, number: 0 }));
  expect(host.querySelector('[data-contact-id="20"]')).not.toBeNull();
  await act(async () => button('Đóng danh bạ').click());

  await act(async () => button('Coach Linh').click());
  expect(host.querySelector('.direct-chat__transcript [role="status"] [aria-hidden="true"]')).not.toBeNull();
  expect(host.textContent).not.toContain('Chưa có tin nhắn');
  expect(host.querySelector('textarea')?.disabled).toBe(true);
  await act(async () => finishHistory({ items: [], hasMore: false }));
  expect(host.querySelector('.direct-chat__transcript [role="status"]')).toBeNull();
  expect(host.textContent).toContain('Chưa có tin nhắn');
  expect(host.querySelector('textarea')?.disabled).toBe(false);
});

it('member starts a conversation from the contact directory', async () => {
  vi.mocked(api.openConversation).mockResolvedValue(conversation);
  await render();
  await act(async () => button('Cuộc trò chuyện mới').click());
  const contact = host.querySelector('[data-contact-id="20"]') as HTMLButtonElement;
  await act(async () => contact.click());
  expect(api.openConversation).toHaveBeenCalledWith(20);
  expect(host.querySelector('textarea')).not.toBeNull();
  expect(host.querySelector('[data-thread-title]')?.textContent).toContain('Coach Linh');
});

it('coach and receptionist can start a chat with a member from the directory', async () => {
  const memberContact: api.ChatContact = { id: 10, name: 'Hội viên An', role: 'MEMBER', available: true };
  for (const role of ['COACH', 'RECEPTIONIST'] as const) {
    vi.mocked(getCurrentUser).mockReturnValue({ id: role, identifier: role, name: role, role: role === 'COACH' ? 'COACH' : 'STAFF' });
    vi.mocked(api.getContacts).mockResolvedValue({ content: [memberContact], totalPages: 1, number: 0 });
    vi.mocked(api.openConversation).mockResolvedValue({ ...conversation, id: 9, peer: memberContact });
    await render();
    expect(button('Cuộc trò chuyện mới')).toBeDefined();
    await act(async () => button('Cuộc trò chuyện mới').click());
    // Staff look for a member, not for another receptionist/coach.
    expect(host.textContent).toContain('Tìm hội viên');
    expect(host.textContent).not.toContain('Tìm lễ tân hoặc huấn luyện viên');
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-contact-id="10"]')!.click());
    expect(api.openConversation).toHaveBeenCalledWith(10);
    expect(host.querySelector('textarea')).not.toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(api.openConversation).mockClear();
  }
});

it('a coach can still reply to an existing conversation', async () => {
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'coach', identifier: 'coach', name: 'Coach', role: 'COACH' });
  await render();
  await act(async () => button('Coach Linh').click());
  expect(host.querySelector('textarea')).not.toBeNull();
});

it('renders chat as plain text and keeps unavailable peers read-only', async () => {
  vi.mocked(api.getConversations).mockResolvedValue({ content: [{ ...conversation, peer: { ...conversation.peer, available: false } }], totalPages: 1, number: 0 });
  vi.mocked(api.getHistory).mockResolvedValue({ items: [{ id: 1, conversationId: 7, clientMessageId: 'id', senderId: 20, mine: false, message: '<img src=x onerror=alert(1)>', createdAt: '2026-10-29T01:00:00Z' }], hasMore: false });
  await render(); await act(async () => button('Coach Linh').click());
  expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(host.querySelector('.direct-chat__transcript img')).toBeNull();
  expect(host.querySelector('textarea')?.disabled).toBe(true);
});

it('manager is forbidden without fetching private data', async () => {
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'manager', identifier: 'manager', name: 'Manager', role: 'MANAGER' });
  await render(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(api.getConversations).not.toHaveBeenCalled(); expect(subscribeChat).not.toHaveBeenCalled();
});

it('shows list error and retry, then opens an empty conversation', async () => {
  vi.mocked(api.getConversations).mockRejectedValueOnce(new Error('Mất kết nối'));
  await render(); expect(host.textContent).toContain('Mất kết nối');
  await act(async () => button('Thử lại').click());
  await act(async () => button('Coach Linh').click());
  expect(host.textContent).toContain('Chưa có tin nhắn');
});

it('toggles mobile thread state and restores focus to inbox heading on back', async () => {
  await render();
  await act(async () => button('Coach Linh').click());
  expect(host.querySelector('.direct-chat')?.classList.contains('direct-chat--thread-open')).toBe(true);
  await act(async () => {
    button('Danh sách').click();
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  expect(host.querySelector('.direct-chat')?.classList.contains('direct-chat--thread-open')).toBe(false);
  expect(document.activeElement?.id).toBe('chat-inbox-title');
  await act(async () => button('Coach Linh').click());
  expect(document.activeElement?.id).toBe('chat-thread-title');
});


it('uses the stable shared composer with keyboard-accessible emoji controls and no inactive tools', async () => {
  await render();
  await act(async () => button('Coach Linh').click());
  const input = host.querySelector('textarea')!;
  const send = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(input.classList.contains('direct-chat__input')).toBe(true);
  expect(input.classList.contains('portal-textarea')).toBe(false);
  expect(send.disabled).toBe(true);
  expect(send.classList.contains('btn-primary')).toBe(false);
  expect(host.querySelector('[title="Ghi âm"]')).toBeNull();
  expect(host.querySelector('[title="Đính kèm hình ảnh"]')).toBeNull();
  const emoji = host.querySelector<HTMLButtonElement>('button[aria-label="Chọn biểu tượng cảm xúc"]')!;
  expect(emoji).not.toBeNull();
  await act(async () => emoji.click());
  expect(emoji.getAttribute('aria-expanded')).toBe('true');
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Chèn 💪"]')!.click());
  expect(input.value).toBe('💪');
  expect(document.activeElement).toBe(input);
  expect(send.disabled).toBe(false);
  expect(host.querySelector('button[type="submit"]')).toBe(send);
});


it('owns inbox, unread, role, contact and empty labels in both languages without changing peer content', async () => {
  vi.mocked(api.getConversations).mockResolvedValue({ content: [{ ...conversation, peer: { ...conversation.peer, name: 'Tin nhắn' }, unreadCount: 2, lastMessage: 'Tìm', lastMessageMine: true }], totalPages: 2, number: 0 });
  await render();
  await act(async () => setLanguage('en'));
  expect(host.querySelector('#chat-inbox-title')!.textContent).toBe('Your conversations');
  expect(host.querySelector('[aria-label="2 unread messages"]')).not.toBeNull();
  expect(host.querySelector('.direct-chat__person:not(.direct-chat__person--ai):not(.direct-chat__person--support) strong')!.textContent).toBe('Tin nhắn');
  expect(host.querySelector('.direct-chat__person:not(.direct-chat__person--ai):not(.direct-chat__person--support) .direct-chat__preview')!.textContent).toBe('You: Tìm');
  expect(host.querySelector('[aria-label="Conversation pages"]')).not.toBeNull();
  expect(host.querySelector('[title="Refresh messages"]')).not.toBeNull();
  await act(async () => button('New conversation').click());
  expect(host.querySelector('[aria-label="Choose a chat recipient"]')).not.toBeNull();
  expect(host.querySelector('input[type="search"]')!.getAttribute('placeholder')).toBe('Search recipients...');
  expect(host.querySelector('[data-contact-id="20"]')!.textContent).toContain('Coach');
  await act(async () => setLanguage('vi'));
  expect(host.querySelector('#chat-inbox-title')!.textContent).toBe('Hội thoại của bạn');
  expect(host.querySelector('[aria-label="2 tin chưa đọc"]')).not.toBeNull();
  expect(host.querySelector('input[type="search"]')!.getAttribute('placeholder')).toBe('Tìm kiếm người nhận...');
  expect(host.querySelector('.direct-chat__person:not(.direct-chat__person--ai):not(.direct-chat__person--support) .direct-chat__preview')!.textContent).toBe('Bạn: Tìm');
});

it('tells a member without any coach class that only the front desk can be messaged', async () => {
  vi.mocked(api.getContacts).mockResolvedValue({ content: [{ id: 3, name: 'Lễ tân Ngọc', role: 'RECEPTIONIST', available: true }], totalPages: 1, number: 0 });
  await render();
  await act(async () => button('Cuộc trò chuyện mới').click());
  const notice = host.querySelector('[data-testid="chat-no-coach"]');
  expect(notice?.textContent).toContain('Chưa có huấn luyện viên để nhắn tin');
  expect(notice?.querySelector('a')?.getAttribute('href')).toBe('/member/classes');
  expect(host.querySelector('[data-contact-id="3"]')).not.toBeNull();
});

it('hides the no-coach notice once the member has a coach to message', async () => {
  await render();
  await act(async () => button('Cuộc trò chuyện mới').click());
  expect(host.querySelector('[data-contact-id="20"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="chat-no-coach"]')).toBeNull();
});

it('keeps SÖL AI first, above the contact directory and the conversations', async () => {
  await render();
  await act(async () => button('Cuộc trò chuyện mới').click());
  const ai = host.querySelector('.direct-chat__person--ai')!;
  const directory = host.querySelector('#chat-directory')!;
  const firstConversation = host.querySelector('.direct-chat__list:not(.direct-chat__list--pinned) .direct-chat__person')!;
  expect(ai.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(ai.compareDocumentPosition(firstConversation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('pins Support & Tickets above SÖL AI so member complaints to the front desk live in Messages', async () => {
  await render();
  const support = host.querySelector('.direct-chat__person--support')!;
  expect(support).not.toBeNull();
  expect(support.compareDocumentPosition(host.querySelector('.direct-chat__person--ai')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async () => (support as HTMLButtonElement).click());
  await act(async () => { await Promise.resolve(); });
  await vi.waitFor(() => expect(host.querySelector('#support-subject')).not.toBeNull());
  expect(host.querySelector('.direct-chat__support')).not.toBeNull();
});

it('gives receptionists the ticket inbox and coaches no support entry', async () => {
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'staff', identifier: 'staff', name: 'Lễ tân', role: 'STAFF' });
  await render();
  await act(async () => (host.querySelector('.direct-chat__person--support') as HTMLButtonElement).click());
  await vi.waitFor(() => expect(host.querySelector('#staff-support-filter')).not.toBeNull());
  await act(async () => root.unmount()); root = createRoot(host);
  vi.mocked(getCurrentUser).mockReturnValue({ id: 'coach', identifier: 'coach', name: 'HLV', role: 'COACH' });
  await render();
  expect(host.querySelector('.direct-chat__person--support')).toBeNull();
});

it('opens Support & Tickets when a notification links to ?tab=support while Messages is already open', async () => {
  let go!: (to: string) => void;
  function Nav() { go = useNavigate(); return null; }
  await act(async () => root.render(<MemoryRouter initialEntries={['/messages']}><Nav /><ChatPage /></MemoryRouter>));
  await vi.waitFor(() => expect(host.querySelector('.direct-chat__person--support')).not.toBeNull());
  expect(host.querySelector('.direct-chat__support')).toBeNull();
  await act(async () => go('/messages?tab=support'));
  await vi.waitFor(() => expect(host.querySelector('.direct-chat__support')).not.toBeNull());
});
