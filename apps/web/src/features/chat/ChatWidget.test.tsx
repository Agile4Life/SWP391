import { setLanguage } from '../../shared/i18n';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatWidget } from './ChatWidget';
import * as api from './chatApi';
import { subscribeChat } from './chatRealtime';
import { clearAuthSession, setCurrentUser } from '../../shared/api/client';

vi.mock('./chatApi', async original => ({ ...await original<typeof api>(), getConversations: vi.fn(), getHistory: vi.fn(), sendMessage: vi.fn(), getChatUnreadCount: vi.fn(), markConversationRead: vi.fn() }));
vi.mock('./chatRealtime', () => ({ subscribeChat: vi.fn(() => vi.fn()) }));
vi.mock('../../shared/api/client', async importOriginal => ({ ...(await importOriginal<typeof import('../../shared/api/client')>()), apiFetch: vi.fn() }));
let host: HTMLDivElement, root: Root;
const conversation: api.ChatConversation = { id: 7, peer: { id: 20, name: 'Coach Linh', role: 'COACH', available: true, avatarUrl: 'https://example.com/linh.jpg' }, createdAt: '2026-10-29T01:00:00Z', lastActivityAt: '2026-10-29T01:00:00Z' };
beforeEach(() => {
  setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setCurrentUser({ id: 'member', identifier: 'member', name: 'Member', role: 'MEMBER' });
  vi.mocked(api.getConversations).mockResolvedValue({ content: [conversation], totalPages: 1, number: 0 });
  vi.mocked(api.getHistory).mockResolvedValue({ items: [], hasMore: false });
  vi.mocked(api.markConversationRead).mockResolvedValue({ count: 0 });
  vi.mocked(api.getChatUnreadCount).mockResolvedValue({ count: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); clearAuthSession(); host.remove(); setLanguage('vi'); vi.clearAllMocks(); vi.unstubAllGlobals(); });
// Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
// Dựng component vào DOM giả để kiểm thử.
const render = () => act(async () => root.render(<MemoryRouter><ChatWidget /></MemoryRouter>));
/** Khung chat tải lazy khi mở widget lần đầu: chờ module xong rồi mới kiểm tra. */
const settle = () => act(async () => { await vi.dynamicImportSettled(); });

it('opens the real inbox in place, preserves drafts and returns focus on Escape', async () => {
  await render();
  expect(api.getConversations).not.toHaveBeenCalled();
  expect(host.querySelectorAll('.chat-widget__mini-avatar')).toHaveLength(3);
  await act(async () => button('Mở tin nhắn').click()); await settle();
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Tin nhắn SÖL');
  expect(subscribeChat).toHaveBeenCalled();
  const contact = [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!;
  await act(async () => contact.click());
  const input = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Hẹn lịch tập');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector<HTMLElement>('[role="dialog"]')?.hidden).toBe(true);
  expect(document.activeElement).toBe(button('Mở tin nhắn'));
  await act(async () => button('Mở tin nhắn').click()); await settle();
  expect(host.querySelector('textarea')?.value).toBe('Hẹn lịch tập');
  expect(api.getConversations).toHaveBeenCalledTimes(1);
  // SÖL AI là một người trong danh sách tin nhắn, không còn nút riêng.
  expect(host.textContent).toContain('SÖL AI');
});

it('supports Instagram-style expand toggle and message heart reaction', async () => {
  vi.mocked(api.getHistory).mockResolvedValue({ items: [{ id: 1, conversationId: 7, clientMessageId: 'reply', senderId: 20, mine: false, message: 'Hẹn bạn lúc 18h', createdAt: '2026-11-02T10:00:00Z' }], hasMore: false });
  await render();
  await act(async () => button('Mở tin nhắn').click()); await settle();
  expect(host.querySelector<HTMLImageElement>('.chat-widget__mini-avatar img')?.getAttribute('src')).toBe('https://example.com/linh.jpg');
  await act(async () => button('Mở rộng cửa sổ tin nhắn').click());
  expect(host.querySelector('.chat-widget__panel')?.classList.contains('is-expanded')).toBe(true);
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  const bubble = host.querySelector<HTMLElement>('.direct-chat__bubble')!;
  await act(async () => { bubble.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  expect(host.querySelector('.direct-chat__reaction-pill')?.textContent).toBe('❤️');
});

it('refreshes the visible conversation when realtime reports a new message', async () => {
  await render();
  await act(async () => button('Mở tin nhắn').click()); await settle();
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  vi.mocked(api.getHistory).mockResolvedValue({ items: [{ id: 1, conversationId: 7, clientMessageId: 'reply', senderId: 20, mine: false, message: 'Hẹn bạn lúc 18h', createdAt: '2026-11-02T10:00:00Z' }], hasMore: false });
  await act(async () => vi.mocked(subscribeChat).mock.calls[0][0]());
  expect(host.textContent).toContain('Hẹn bạn lúc 18h');
});

it('shows the unread badge and clears it after reading the conversation', async () => {
  vi.mocked(api.getChatUnreadCount).mockResolvedValue({ count: 2 });
  vi.mocked(api.getConversations).mockResolvedValue({ content: [{ ...conversation, unreadCount: 2, lastMessage: 'Hẹn bạn lúc 18h', lastMessageMine: false }], totalPages: 1, number: 0 });
  vi.mocked(api.getHistory).mockResolvedValue({ items: [{ id: 5, conversationId: 7, clientMessageId: 'reply', senderId: 20, mine: false, message: 'Hẹn bạn lúc 18h', createdAt: '2026-11-02T10:00:00Z' }], hasMore: false });
  await render();
  expect(host.querySelector('.chat-widget__badge')?.textContent).toBe('2');
  await act(async () => button('Mở tin nhắn · 2 chưa đọc').click()); await settle();
  expect(host.querySelector('.direct-chat__person:not(.direct-chat__person--ai):not(.direct-chat__person--support) .direct-chat__preview')?.textContent).toBe('Hẹn bạn lúc 18h');
  expect(host.querySelector('.direct-chat__unread')?.textContent).toBe('2');
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  expect(api.markConversationRead).toHaveBeenCalledWith(7, 5);
  expect(host.querySelector('.chat-widget__badge')).toBeNull();
});

it('does not mark messages read while the panel is closed', async () => {
  await render();
  await act(async () => button('Mở tin nhắn').click()); await settle();
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  vi.mocked(api.getHistory).mockResolvedValue({ items: [{ id: 9, conversationId: 7, clientMessageId: 'late', senderId: 20, mine: false, message: 'Tin mới', createdAt: '2026-11-02T10:00:00Z' }], hasMore: false });
  await act(async () => vi.mocked(subscribeChat).mock.calls[0][0]());
  expect(host.textContent).toContain('Tin mới');
  expect(api.markConversationRead).not.toHaveBeenCalled();
});

it('closes on outside pointer without stealing focus', async () => {
  await render();
  await act(async () => button('Mở tin nhắn').click()); await settle();
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(host.querySelector<HTMLElement>('[role="dialog"]')?.hidden).toBe(true);
});

it('asks guests to log in without fetching private data', async () => {
  clearAuthSession();
  await render();
  await act(async () => button('Mở tin nhắn').click()); await settle();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/login');
  expect(api.getConversations).not.toHaveBeenCalled();
});

it('hides the chat widget for managers because escalated tickets live in ManagerInternalRequestsPage', async () => {
  setCurrentUser({ id: 'manager', identifier: 'manager', name: 'Manager', role: 'MANAGER' });
  await render();
  expect(host.querySelector('.chat-widget__trigger')).toBeNull();
  expect(api.getConversations).not.toHaveBeenCalled();
  expect(api.getChatUnreadCount).not.toHaveBeenCalled();
  expect(subscribeChat).not.toHaveBeenCalled();
});

/** jsdom không có PointerEvent: dựng MouseEvent mang đủ trường pointer mà React đọc. */
const pointer = (target: EventTarget, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  target.dispatchEvent(event);
};

it('drags the chat pill anywhere, remembers the spot and does not toggle on drop', async () => {
  window.localStorage.removeItem('sol-chat-widget-position');
  await render();
  const pill = button('Mở tin nhắn');
  await act(async () => {
    pointer(pill, 'pointerdown', 10, 10);
    pointer(window, 'pointermove', 110, 60);
    pointer(window, 'pointermove', 210, 110);
    pointer(window, 'pointerup', 210, 110);
    pill.click();
  });
  const widget = host.querySelector<HTMLElement>('.chat-widget')!;
  expect(widget.style.left).toBe('200px');
  expect(widget.style.top).toBe('100px');
  expect(pill.getAttribute('aria-expanded')).toBe('false');
  expect(JSON.parse(window.localStorage.getItem('sol-chat-widget-position')!)).toEqual({ x: 200, y: 100 });
  window.localStorage.removeItem('sol-chat-widget-position');
});

it('still opens on a plain click without movement', async () => {
  window.localStorage.removeItem('sol-chat-widget-position');
  await render();
  const pill = button('Mở tin nhắn');
  await act(async () => {
    pointer(pill, 'pointerdown', 10, 10);
    pointer(window, 'pointerup', 12, 11);
    pill.click();
  });
  await settle();
  expect(host.querySelector<HTMLElement>('[role="dialog"]')?.hidden).toBe(false);
  expect(host.querySelector<HTMLElement>('.chat-widget')!.style.left).toBe('');
});


it('switches widget status, dialog and action names in both languages', async () => {
  await render();
  await act(async () => setLanguage('en'));
  expect(host.querySelector('.chat-widget__trigger-label')!.textContent).toBe('Messages');
  await act(async () => button('Open messages').click()); await settle();
  expect(host.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('SÖL messages');
  expect(host.querySelector('.chat-widget__status')).toBeNull();
  expect(button('Close messages window')).not.toBeNull();
  await act(async () => setLanguage('vi'));
  expect(host.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Tin nhắn SÖL');
  expect(host.querySelector('.chat-widget__status')).toBeNull();
  expect(button('Đóng cửa sổ tin nhắn')).not.toBeNull();
});

it('closes only the emoji picker on Escape without closing the chat widget dialog', async () => {
  await render();
  await act(async () => button('Mở tin nhắn').click());
  await settle();
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.hidden).toBe(false);

  const contact = [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!;
  await act(async () => contact.click());

  const emojiBtn = button('Chọn biểu tượng cảm xúc');
  await act(async () => emojiBtn.click());
  expect(host.querySelector('.direct-chat__emoji-bar')).not.toBeNull();

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  expect(host.querySelector('.direct-chat__emoji-bar')).toBeNull();
  expect(dialog.hidden).toBe(false);
});

it('P0-07: tears down Realtime subscription and wipes User A drafts/messages immediately on logout', async () => {
  const unsubscribeA = vi.fn();
  vi.mocked(subscribeChat).mockReturnValueOnce(unsubscribeA);
  vi.mocked(api.getChatUnreadCount).mockResolvedValue({ count: 3 });
  vi.mocked(api.getHistory).mockResolvedValue({
    items: [{ id: 1, conversationId: 7, clientMessageId: 'u-a', senderId: 20, mine: false, message: 'Tin riêng của User A', createdAt: '2026-11-02T10:00:00Z' }],
    hasMore: false,
  });

  await render();
  await act(async () => button('Mở tin nhắn · 3 chưa đọc').click());
  await settle();
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  expect(host.textContent).toContain('Tin riêng của User A');

  // Logout immediately unmounts SignedInChatWidget & closes Realtime subscription
  await act(async () => { clearAuthSession(); });
  expect(unsubscribeA).toHaveBeenCalledTimes(1);
  expect(host.querySelector('.chat-widget__badge')).toBeNull();
  expect(host.textContent).not.toContain('Tin riêng của User A');
  expect(host.querySelector('[role="dialog"]')).toBeNull();

  // Reopening as guest shows login prompt instead of User A's chat
  await act(async () => button('Mở tin nhắn').click());
  await settle();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/login');
});

it('P0-07: remounts widget and clears cached drafts/messages when switching accounts', async () => {
  const unsubscribeA = vi.fn();
  const unsubscribeB = vi.fn();
  vi.mocked(subscribeChat).mockReturnValueOnce(unsubscribeA).mockReturnValueOnce(unsubscribeB);
  vi.mocked(api.getHistory).mockResolvedValueOnce({
    items: [{ id: 1, conversationId: 7, clientMessageId: 'u-a', senderId: 20, mine: false, message: 'Bí mật User A', createdAt: '2026-11-02T10:00:00Z' }],
    hasMore: false,
  });

  await render();
  await act(async () => button('Mở tin nhắn').click());
  await settle();
  await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes('Coach Linh'))!.click());
  const input = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Nháp User A');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.textContent).toContain('Bí mật User A');

  // Switch directly to User B
  vi.mocked(api.getConversations).mockResolvedValue({
    content: [{ id: 99, peer: { id: 30, name: 'Lễ tân Mai', role: 'RECEPTIONIST', available: true }, createdAt: '2026-10-29T01:00:00Z', lastActivityAt: '2026-10-29T01:00:00Z' }],
    totalPages: 1,
    number: 0,
  });
  vi.mocked(api.getHistory).mockResolvedValue({ items: [], hasMore: false });

  await act(async () => {
    setCurrentUser({ id: 'member-b', identifier: 'member-b', name: 'Member B', role: 'MEMBER' });
  });

  expect(unsubscribeA).toHaveBeenCalledTimes(1);
  expect(subscribeChat).toHaveBeenCalledTimes(2);
  expect(host.textContent).not.toContain('Bí mật User A');
  expect(host.textContent).not.toContain('Nháp User A');

  await act(async () => button('Mở tin nhắn').click());
  await settle();
  expect(host.textContent).toContain('Lễ tân Mai');
  expect(host.textContent).not.toContain('Coach Linh');
});

it('P1-FE-62: ignores Escape when a native <dialog open> is active so modals close without trapping inert top layer', async () => {
  await render();
  await act(async () => button('Mở tin nhắn').click());
  await settle();
  const panel = host.querySelector<HTMLElement>('#sol-direct-chat')!;
  expect(panel.hidden).toBe(false);

  const nativeDialog = document.createElement('dialog');
  nativeDialog.setAttribute('open', '');
  document.body.append(nativeDialog);
  try {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(panel.hidden).toBe(false);
  } finally {
    nativeDialog.remove();
  }
});

it('P2-FE-26 & P2-FE-80 & P3-FE-30 & P3-FE-32: omits nested LiquidGlassContainer, renders reconnecting status outside header-title, updates disabled copy, and falls back broken mini avatars', async () => {
  let setStatus!: (state: 'connecting' | 'connected' | 'reconnecting' | 'disabled') => void;
  vi.mocked(subscribeChat).mockImplementation((_changed, status) => {
    setStatus = status;
    return vi.fn();
  });
  await render();
  expect(host.querySelector('.glass-container')).toBeNull();

  await act(async () => button('Mở tin nhắn').click());
  await settle();
  expect(host.querySelector('.glass-container')).toBeNull();

  // Mini avatar falls back to placeholder SVG on image load error
  const miniImg = host.querySelector<HTMLImageElement>('.chat-widget__mini-avatar img')!;
  expect(miniImg).not.toBeNull();
  await act(async () => { miniImg.dispatchEvent(new Event('error')); });
  expect(host.querySelector('.chat-widget__mini-avatar img')).toBeNull();

  // Realtime status banner is omitted from the floating widget box
  await act(async () => { setStatus('reconnecting'); });
  expect(host.querySelector('.chat-widget__status')).toBeNull();
  await act(async () => { setStatus('disabled'); });
  expect(host.querySelector('.chat-widget__status')).toBeNull();
});

it('P2-FE-77: ignores non-finite stored coordinates and clamps off-screen desktop coordinates to viewport on mount', async () => {
  // Non-finite / corrupt stored position falls back cleanly to default CSS anchor
  window.localStorage.setItem('sol-chat-widget-position', JSON.stringify({ x: null, y: 'bad' }));
  await render();
  expect(host.querySelector<HTMLElement>('.chat-widget')!.style.left).toBe('');
  await act(async () => root.unmount());
  root = createRoot(host);

  // Off-screen coordinates from a wider screen are clamped inside current viewport on mount
  const origInnerWidth = window.innerWidth;
  const origInnerHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 640, configurable: true });
  window.localStorage.setItem('sol-chat-widget-position', JSON.stringify({ x: 1800, y: 1200 }));
  try {
    await render();
    const widget = host.querySelector<HTMLElement>('.chat-widget')!;
    expect(Number.parseFloat(widget.style.left)).toBeLessThanOrEqual(390 - 8);
    expect(Number.parseFloat(widget.style.top)).toBeLessThanOrEqual(640 - 8);
  } finally {
    Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: origInnerHeight, configurable: true });
    window.localStorage.removeItem('sol-chat-widget-position');
  }
});
