import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { ChatThread } from './ChatThread';
import * as chatApi from './chatApi';
import type { ChatConversation } from './chatApi';
import type { useChatConversation } from './useChatConversation';

vi.mock('./chatApi', async original => ({
  ...(await original<typeof chatApi>()),
  markConversationRead: vi.fn().mockResolvedValue({ count: 0 }),
}));

let host: HTMLDivElement, root: Root;
const conversation: ChatConversation = { id: 7, peer: { id: 20, name: 'Tin nhắn', role: 'COACH', available: true, avatarUrl: 'https://example.com/broken.jpg' }, createdAt: '', lastActivityAt: '' };
// Tạo trạng thái hội thoại giả (ghi đè được từng phần).
const chat = (extra: Partial<ReturnType<typeof useChatConversation>> = {}): ReturnType<typeof useChatConversation> => ({
  selectedId: 7, messages: [], draft: 'Gửi', setDraft: vi.fn(), select: vi.fn(), refresh: vi.fn(), loadOlder: vi.fn(), send: vi.fn(),
  loading: false, error: null, hasOlder: false, olderLoading: false, sending: false, sendError: null, ...extra,
});
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(chatApi.markConversationRead).mockClear();
  vi.mocked(chatApi.markConversationRead).mockResolvedValue({ count: 0 });
  setLanguage('vi');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setLanguage('vi');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
// Dựng component vào DOM giả để kiểm thử.
const render = (state: ReturnType<typeof useChatConversation>, props: { canMarkRead?: boolean; onRead?: (id: number) => void } = {}) =>
  act(async () => root.render(<ChatThread conversation={conversation} chat={state} canMarkRead={props.canMarkRead ?? false} onRead={props.onRead} onBack={() => {}} />));

it('toggles retry, older-history, transcript and loading labels without translating names, errors or drafts', async () => {
  const state = chat({ hasOlder: true, error: 'Lỗi từ máy chủ: Gửi' });
  await render(state);
  expect(host.querySelector('.direct-chat__older')!.textContent).toBe('Tải tin nhắn cũ hơn');
  expect(host.textContent).toContain('Thử lại tải tin nhắn');
  await act(async () => setLanguage('en'));
  expect(host.querySelector('.direct-chat__older')!.textContent).toBe('Load older messages');
  expect(host.textContent).toContain('Retry loading messages');
  expect(host.querySelector('[aria-label="Message history"]')).not.toBeNull();
  expect(host.textContent).toContain('Coach');
  expect(host.querySelector('h2')!.textContent).toBe('Tin nhắn');
  expect(host.querySelector('textarea')!.value).toBe('Gửi');
  expect(host.textContent).toContain('Lỗi từ máy chủ: Gửi');
  await render(chat({ hasOlder: true, olderLoading: true }));
  expect(host.querySelector('.direct-chat__older')!.textContent).toBe('Loading…');
  expect(host.querySelector('.direct-chat__older')!.getAttribute('disabled')).not.toBeNull();
  expect(host.querySelector('.loading-skeleton .sr-only')!.textContent).toBe('Loading older messages…');
  await act(async () => setLanguage('vi'));
  expect(host.querySelector('.direct-chat__older')!.textContent).toBe('Đang tải…');
  expect(host.querySelector('.loading-skeleton .sr-only')!.textContent).toBe('Đang tải tin nhắn cũ hơn…');
});

it('localizes empty and message reaction states while keeping the message body unchanged', async () => {
  await render(chat());
  await act(async () => setLanguage('en'));
  expect(host.textContent).toContain('No messages yet. Start the conversation.');
  await render(chat({ messages: [{ id: 1, conversationId: 7, clientMessageId: 'one', senderId: 20, mine: false, message: 'Tìm Tin nhắn', createdAt: '2026-11-05T01:00:00Z' }] }));
  expect(host.querySelector('.direct-chat__bubble p')!.textContent).toBe('Tìm Tin nhắn');
  expect(host.querySelector('[aria-label="Like message"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Like message"] svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(host.querySelector('[role="status"]')!.textContent).toBe('Showing 1 message.');
  await render(chat({
    messages: [
      { id: 1, conversationId: 7, clientMessageId: 'one', senderId: 20, mine: false, message: 'Tìm Tin nhắn', createdAt: '2026-11-05T01:00:00Z' },
      { id: 2, conversationId: 7, clientMessageId: 'two', senderId: 1, mine: true, message: 'Ok', createdAt: '2026-11-05T01:01:00Z' },
    ],
  }));
  expect(host.querySelector('[role="status"]')!.textContent).toBe('Showing 2 messages.');
  await act(async () => setLanguage('vi'));
  expect(host.querySelector('[aria-label="Thả tim tin nhắn"]')).not.toBeNull();
  expect(host.querySelector('.direct-chat__bubble p')!.textContent).toBe('Tìm Tin nhắn');
});

it('P1-FE-64: marks messages read automatically when returning to a hidden tab via visibilitychange or focus', async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  const onRead = vi.fn();
  const state = chat({
    messages: [{ id: 12, conversationId: 7, clientMessageId: 'm12', senderId: 20, mine: false, message: 'Tin khi tab ẩn', createdAt: '2026-11-05T01:00:00Z' }],
  });
  await render(state, { canMarkRead: true, onRead });
  expect(chatApi.markConversationRead).not.toHaveBeenCalled();

  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(onRead).toHaveBeenCalledWith(7);
  expect(chatApi.markConversationRead).toHaveBeenCalledWith(7, 12);

  // Also works when focus arrives after a second message while hidden
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  await render(chat({
    messages: [
      ...state.messages,
      { id: 15, conversationId: 7, clientMessageId: 'm15', senderId: 20, mine: false, message: 'Tin thứ hai', createdAt: '2026-11-05T01:02:00Z' },
    ],
  }), { canMarkRead: true, onRead });
  expect(chatApi.markConversationRead).toHaveBeenCalledTimes(1);

  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(chatApi.markConversationRead).toHaveBeenLastCalledWith(7, 15);
});

it('P2-FE-80: auto-scrolls on own sent message when scrolled up, and shows new-messages pill only for peer replies', async () => {
  const m1 = { id: 1, conversationId: 7, clientMessageId: 'm1', senderId: 20, mine: false, message: 'Hello', createdAt: '2026-11-05T01:00:00Z' };
  await render(chat({ messages: [m1] }));
  const transcript = host.querySelector<HTMLDivElement>('.direct-chat__transcript')!;
  Object.defineProperty(transcript, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(transcript, 'clientHeight', { value: 300, configurable: true });
  transcript.scrollTop = 100;
  await act(async () => { transcript.dispatchEvent(new Event('scroll')); });

  // Peer message while scrolled up -> shows "Có tin nhắn mới" pill, does not yank scrollTop
  const m2 = { id: 2, conversationId: 7, clientMessageId: 'm2', senderId: 20, mine: false, message: 'Peer reply', createdAt: '2026-11-05T01:01:00Z' };
  await render(chat({ messages: [m1, m2] }));
  expect(host.querySelector('.direct-chat__new')).not.toBeNull();
  expect(transcript.scrollTop).toBe(100);

  // Own message while scrolled up -> auto-scrolls to bottom and clears "Có tin nhắn mới"
  const m3 = { id: 3, conversationId: 7, clientMessageId: 'm3', senderId: 1, mine: true, message: 'My reply', createdAt: '2026-11-05T01:02:00Z' };
  await render(chat({ messages: [m1, m2, m3] }));
  expect(host.querySelector('.direct-chat__new')).toBeNull();
  expect(transcript.scrollTop).toBe(1000);
});

it('P3-FE-32: ignores double-click like when selecting text and falls back when avatar image errors', async () => {
  await render(chat({
    messages: [{ id: 1, conversationId: 7, clientMessageId: 'one', senderId: 20, mine: false, message: 'Double click word', createdAt: '2026-11-05T01:00:00Z' }],
  }));
  const img = host.querySelector<HTMLImageElement>('.direct-chat__avatar-img')!;
  expect(img).not.toBeNull();
  await act(async () => { img.dispatchEvent(new Event('error')); });
  expect(host.querySelector('.direct-chat__avatar-img')).toBeNull();
  expect(host.querySelector('.direct-chat__avatar-placeholder')).not.toBeNull();

  const bubble = host.querySelector<HTMLElement>('.direct-chat__bubble')!;
  vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'word' } as Selection);
  await act(async () => { bubble.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  expect(host.querySelector('.direct-chat__reaction-pill')).toBeNull();

  vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);
  await act(async () => { bubble.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  expect(host.querySelector('.direct-chat__reaction-pill')?.textContent).toBe('❤️');
});
