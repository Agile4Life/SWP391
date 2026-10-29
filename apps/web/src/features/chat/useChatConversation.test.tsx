import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useChatConversation } from './useChatConversation';
import * as api from './chatApi';
vi.mock('./chatApi', () => ({ getHistory: vi.fn(), sendMessage: vi.fn() }));
let root: Root, host: HTMLDivElement;
let chat: ReturnType<typeof useChatConversation>;
const msg = (id: number, conversationId = 1): api.ChatMessage => ({ id, conversationId, clientMessageId: `uuid-${id}`, senderId: 10, mine: false, message: `Message ${id}`, createdAt: '2026-10-29T01:00:00Z' });
function Harness() {
  const state = useChatConversation(vi.fn());
  useLayoutEffect(() => { chat = state; }, [state]);
  return <div>{state.messages.map(m => m.message).join('|')}</div>;
}
async function select(id: number) { await act(async () => chat.select(id)); }
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(api.getHistory).mockResolvedValue({ items: [], hasMore: false });
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('ignores history from the previous chat and restores separate drafts', async () => {
  let resolve!: (v: api.ChatHistory) => void;
  vi.mocked(api.getHistory).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await select(1); await act(async () => chat.setDraft('Draft one'));
  await select(2); await act(async () => chat.setDraft('Draft two'));
  await act(async () => resolve({ items: [msg(1)], hasMore: false }));
  expect(chat.messages).toEqual([]); expect(chat.draft).toBe('Draft two');
  await select(1); expect(chat.draft).toBe('Draft one');
});

it('keeps failed text and retries with the same UUID without double submission', async () => {
  vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ ...msg(10), mine: true });
  await select(1); await act(async () => chat.setDraft('Hello'));
  await act(async () => chat.send());
  expect(chat.draft).toBe('Hello'); expect(chat.sendError).toBe('Offline');
  const first = vi.mocked(api.sendMessage).mock.calls[0];
  await act(async () => { void chat.send(); void chat.send(); });
  expect(api.sendMessage).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.sendMessage).mock.calls[1]).toEqual(first);
  expect(chat.draft).toBe('');
});

it('does not erase the next draft or mix messages when a send finishes after switching chats', async () => {
  let resolve!: (m: api.ChatMessage) => void;
  vi.mocked(api.sendMessage).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await select(1); await act(async () => chat.setDraft('To first'));
  await act(async () => { void chat.send(); });
  await select(2); await act(async () => chat.setDraft('To second'));
  await act(async () => resolve({ ...msg(10, 1), mine: true }));
  expect(chat.draft).toBe('To second'); expect(chat.messages).toEqual([]);
});

it('catches up every page after reconnect and deduplicates overlaps', async () => {
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(1)], hasMore: true });
  await select(1);
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(1), msg(2)], hasMore: true })
    .mockResolvedValueOnce({ items: [msg(3)], hasMore: false });
  await act(async () => chat.refresh());
  expect(chat.messages.map(m => m.id)).toEqual([1, 2, 3]);
  expect(api.getHistory).toHaveBeenLastCalledWith(1, { afterId: 2 });
  expect(chat.hasOlder).toBe(true);
});

it('loads older history without removing newer messages', async () => {
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(5), msg(6)], hasMore: true });
  await select(1);
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(3), msg(4)], hasMore: false });
  await act(async () => chat.loadOlder());
  expect(chat.messages.map(m => m.id)).toEqual([3, 4, 5, 6]); expect(chat.hasOlder).toBe(false);
  expect(api.getHistory).toHaveBeenLastCalledWith(1, { beforeId: 5 });
});

it('does not skip unseen peer messages when own send succeeds', async () => {
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(1)], hasMore: false });
  await select(1); await act(async () => chat.setDraft('Own message'));
  vi.mocked(api.sendMessage).mockResolvedValueOnce({ ...msg(3), mine: true });
  vi.mocked(api.getHistory).mockResolvedValueOnce({ items: [msg(2), { ...msg(3), mine: true }], hasMore: false });
  await act(async () => chat.send());
  expect(chat.messages.map(m => m.id)).toEqual([1, 2, 3]);
  expect(api.getHistory).toHaveBeenLastCalledWith(1, { afterId: 1 });
});

it('shows a successful pending send when returning to the same chat before its response', async () => {
  let resolve!: (m: api.ChatMessage) => void;
  vi.mocked(api.sendMessage).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  await select(1); await act(async () => chat.setDraft('Pending'));
  await act(async () => { void chat.send(); });
  await select(2); await select(1);
  await act(async () => resolve({ ...msg(10), mine: true }));
  expect(chat.messages.map(m => m.id)).toContain(10);
  expect(chat.draft).toBe(''); expect(chat.sending).toBe(false);
});

it('shows a failed pending send and retained draft after returning to the same chat', async () => {
  let reject!: (e: Error) => void;
  vi.mocked(api.sendMessage).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  await select(1); await act(async () => chat.setDraft('Keep this'));
  await act(async () => { void chat.send(); });
  await select(2); await select(1);
  await act(async () => reject(new Error('Send failed')));
  expect(chat.sendError).toBe('Send failed'); expect(chat.draft).toBe('Keep this');
});
