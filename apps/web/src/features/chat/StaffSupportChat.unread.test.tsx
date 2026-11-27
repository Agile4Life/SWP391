import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n';
import * as api from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import { StaffSupportChat } from './StaffSupportChat';

vi.mock('../member/supportRealtime', () => ({ subscribeSupport: vi.fn(() => () => {}) }));
vi.mock('../member/memberSupportApi', () => ({ getSupportInbox: vi.fn(), getSupportTicket: vi.fn(), getSupportMessages: vi.fn(), markSupportRead: vi.fn(), sendSupportMessage: vi.fn(), updateSupportStatus: vi.fn(), escalateSupportTicket: vi.fn() }));

const ticket: api.SupportTicket = { id: 2, memberId: 10, memberName: 'Hội viên An', subject: 'Hỗ trợ gói tập', description: 'Yêu cầu ban đầu', status: 'open', createdAt: '2026-10-01T08:00:00', assignedToName: null, lastMessage: 'Em cần hỗ trợ thêm', lastMessageAt: '2026-11-25T10:00:00', unreadCount: 2 };
const message: api.SupportMessage = { id: 20, senderId: 10, senderName: 'An', senderRole: 'MEMBER', message: 'Em cần hỗ trợ thêm', createdAt: ticket.lastMessageAt! };
let host: HTMLDivElement, root: Root;
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === text)!;
const row = () => host.querySelector<HTMLButtonElement>('[data-support-ticket="2"]')!;
const render = (props = {}) => act(async () => root.render(<StaffSupportChat onBack={() => {}} {...props} />));
const open = () => act(async () => row().click());

beforeEach(() => {
  setLanguage('vi'); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(api.getSupportInbox).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(api.getSupportTicket).mockResolvedValue(ticket);
  vi.mocked(api.getSupportMessages).mockResolvedValue([message]);
  vi.mocked(api.markSupportRead).mockResolvedValue({ unreadCount: 0 });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('shows member, subject, latest message/time, status and unread badge without marking the inbox read', async () => {
  await render();
  expect(row().classList.contains('has-unread')).toBe(true);
  expect(row().textContent).toContain('Hội viên An');
  expect(row().textContent).toContain('#2 · Hỗ trợ gói tập');
  expect(row().querySelector('.direct-chat__preview.is-unread')?.textContent).toBe(ticket.lastMessage);
  expect(row().querySelector('time')?.dateTime).toBe(ticket.lastMessageAt);
  expect(row().querySelector('.direct-chat__unread')?.textContent).toBe('2');
  expect(row().textContent).toContain('Đang chờ');
  expect(api.markSupportRead).not.toHaveBeenCalled();
});

it('combines unread and status filters and returns to the same inbox without changing status', async () => {
  await render();
  await act(async () => button('Chưa đọc').click());
  await act(async () => button('Đang chờ').click());
  expect(api.getSupportInbox).toHaveBeenLastCalledWith(0, 'open', true);
  await open();
  const back = button('Quay lại hộp thư');
  expect(back).toBeDefined();
  await act(async () => back.click());
  expect(host.querySelector('[aria-label="Lọc theo trạng thái"] [aria-checked="true"]')?.textContent).toBe('Đang chờ');
  expect(button('Chưa đọc').getAttribute('aria-checked')).toBe('true');
  expect(api.getSupportInbox).toHaveBeenLastCalledWith(0, 'open', true);
  expect(api.updateSupportStatus).not.toHaveBeenCalled();
});

it('only acknowledges the loaded cursor and uses persisted server counts after reopening and remounting', async () => {
  let unreadCount = 2;
  vi.mocked(api.getSupportInbox).mockImplementation(async () => ({ content: [{ ...ticket, unreadCount }], totalPages: 1 }));
  vi.mocked(api.markSupportRead).mockImplementation(async () => { unreadCount = 0; return { unreadCount }; });
  await render(); await open();
  expect(api.markSupportRead).toHaveBeenCalledWith(2, 20);
  await act(async () => button('Quay lại hộp thư').click());
  expect(row().querySelector('.direct-chat__unread')).toBeNull();
  expect(row().classList.contains('has-unread')).toBe(false);
  await act(async () => root.unmount()); root = createRoot(host);
  await render();
  expect(row().querySelector('.direct-chat__unread')).toBeNull();
  expect(api.updateSupportStatus).not.toHaveBeenCalled();
});

it('never acknowledges a failed or forbidden history request', async () => {
  vi.mocked(api.getSupportMessages).mockRejectedValue(new ApiError('Không có quyền', 403));
  await render(); await open();
  expect(api.markSupportRead).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không có quyền');
  expect(host.querySelector('textarea')).toBeNull();
});

it('does not consume a new message that arrived after the history snapshot', async () => {
  vi.mocked(api.markSupportRead).mockResolvedValue({ unreadCount: 1 });
  await render();
  vi.mocked(api.getSupportInbox).mockResolvedValue({ content: [{ ...ticket, unreadCount: 1, lastMessage: 'Tin mới trong khi tải' }], totalPages: 1 });
  await open();
  expect(api.markSupportRead).toHaveBeenCalledWith(2, 20);
  await act(async () => button('Quay lại hộp thư').click());
  expect(row().querySelector('.direct-chat__unread')?.textContent).toBe('1');
});

it('retains unread state and offers retry if the read acknowledgement fails', async () => {
  vi.mocked(api.markSupportRead).mockRejectedValueOnce(new ApiError('Không lưu được trạng thái đọc', 500));
  await render(); await open();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không lưu được trạng thái đọc');
  await act(async () => button('Thử lại').click());
  expect(api.markSupportRead).toHaveBeenCalledTimes(2);
});

it('does not mark a hidden support thread read', async () => {
  await render({ active: false }); await open();
  expect(api.markSupportRead).not.toHaveBeenCalled();
  await render({ active: true });
  expect(api.markSupportRead).toHaveBeenCalledWith(2, 20);
});

it('preserves latest-activity ordering from the paginated backend rather than ticket creation dates', async () => {
  vi.mocked(api.getSupportInbox).mockResolvedValue({ content: [ticket, { ...ticket, id: 6, createdAt: '2026-11-24T08:00:00', lastMessageAt: '2026-11-24T08:00:00', unreadCount: 0 }], totalPages: 1 });
  await render();
  expect([...host.querySelectorAll('[data-support-ticket]')].map(node => node.getAttribute('data-support-ticket'))).toEqual(['2', '6']);
});

it('enables unread filter, latest message preview with sender, and mark-read for manager escalated inbox', async () => {
  vi.mocked(api.getSupportInbox).mockResolvedValue({
    content: [{ ...ticket, lastMessage: 'oke123', lastMessageMine: true, lastMessageSenderName: 'Center Manager' }],
    totalPages: 1,
  });
  await render({ manager: true });
  expect(api.getSupportInbox).toHaveBeenCalledWith(0, '', false);
  expect([...host.querySelectorAll('button')].filter(b => b.textContent === 'Tất cả')).toHaveLength(1);
  expect(button('Mọi trạng thái')).toBeUndefined();
  expect(row().querySelector('time')).toBeNull();
  expect(row().querySelector('.direct-chat__unread')?.textContent).toBe('2');
  expect(row().querySelector('.direct-chat__preview.is-unread')?.textContent).toBe('Bạn: oke123');
  await act(async () => button('Chưa đọc').click());
  expect(api.getSupportInbox).toHaveBeenLastCalledWith(0, '', true);
  await open();
  expect(api.markSupportRead).toHaveBeenCalledWith(2, 20);
  expect(button('Quay lại hộp thư')).toBeDefined();
});

it('searches manager complaints across pages while retaining the status filter', async () => {
  await render({ manager: true, split: true });
  await act(async () => button('Đang chờ').click());
  const search = host.querySelector<HTMLInputElement>('[aria-label="Tìm khiếu nại"]')!;
  expect(search.compareDocumentPosition(button('Tất cả')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Hội viên An');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
  });
  await vi.waitFor(() => expect(api.getSupportInbox).toHaveBeenLastCalledWith(0, 'open', false, 'Hội viên An'));
});

it('shows unread again when realtime reports a new incoming member message', async () => {
  vi.mocked(api.getSupportInbox).mockResolvedValueOnce({ content: [{ ...ticket, unreadCount: 0 }], totalPages: 1 });
  await render();
  expect(row().querySelector('.direct-chat__unread')).toBeNull();
  const changed = vi.mocked(subscribeSupport).mock.calls[0][0];
  await act(async () => { changed(); await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(row().querySelector('.direct-chat__unread')?.textContent).toBe('2');
  expect(api.markSupportRead).not.toHaveBeenCalled();
});

it('does not acknowledge a history response after returning to the inbox', async () => {
  let finish!: (value: api.SupportMessage[]) => void;
  vi.mocked(api.getSupportMessages).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const outerBack = vi.fn();
  await render({ onBack: outerBack }); await open();
  await act(async () => button('Quay lại hộp thư').click());
  await act(async () => finish([message]));
  expect(row()).not.toBeNull();
  expect(api.markSupportRead).not.toHaveBeenCalled();
  expect(outerBack).not.toHaveBeenCalled();
  expect(api.updateSupportStatus).not.toHaveBeenCalled();
});

it('coalesces realtime refreshes and never acknowledges the same cursor twice', async () => {
  let finish!: (value: api.SupportMessage[]) => void;
  vi.mocked(api.getSupportMessages).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue([message, message]);
  await render(); await open();
  const changed = vi.mocked(subscribeSupport).mock.calls.at(-1)![0];
  await act(async () => { changed(); changed(); changed(); await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(api.getSupportMessages).toHaveBeenCalledTimes(1);
  expect(api.markSupportRead).not.toHaveBeenCalled();
  await act(async () => finish([message]));
  expect(api.getSupportMessages).toHaveBeenCalledTimes(2);
  expect(api.markSupportRead).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll('.direct-chat__bubble')).toHaveLength(2);
});

it('rejects an older inbox response that completes after read confirmation', async () => {
  let finishList!: (value: { content: api.SupportTicket[]; totalPages: number }) => void;
  let finishRead!: (value: { unreadCount: number }) => void;
  vi.mocked(api.markSupportRead).mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
  await render(); await open();
  vi.mocked(api.getSupportInbox).mockReturnValueOnce(new Promise(resolve => { finishList = resolve; })).mockResolvedValue({ content: [{ ...ticket, unreadCount: 0 }], totalPages: 1 });
  const changed = vi.mocked(subscribeSupport).mock.calls[0][0];
  await act(async () => { changed(); await new Promise(resolve => setTimeout(resolve, 120)); });
  await act(async () => finishRead({ unreadCount: 0 }));
  await act(async () => finishList({ content: [ticket], totalPages: 1 }));
  await act(async () => button('Quay lại hộp thư').click());
  expect(row().querySelector('.direct-chat__unread')).toBeNull();
});

it('acknowledges the initial request with cursor zero when there are no subsequent messages', async () => {
  vi.mocked(api.getSupportMessages).mockResolvedValue([]);
  await render(); await open();
  expect(api.markSupportRead).toHaveBeenCalledWith(2, 0);
  expect(host.querySelector('.direct-chat__bubble')?.textContent).toContain('Yêu cầu ban đầu');
});

it('preserves a conversation draft and the inbox scroll position when going back', async () => {
  await render();
  host.querySelector('.support-chat__tickets')!.scrollTop = 145;
  await open();
  const field = host.querySelector<HTMLTextAreaElement>('textarea#staff-support-message')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Bản nháp trả lời'); field.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => button('Quay lại hộp thư').click());
  expect(host.querySelector('.support-chat__tickets')!.scrollTop).toBe(145);
  await open();
  expect(host.querySelector<HTMLTextAreaElement>('textarea#staff-support-message')?.value).toBe('Bản nháp trả lời');
  expect(api.sendSupportMessage).not.toHaveBeenCalled();
});

it('loads a fresh snapshot when the same ticket is reopened before its older request finishes', async () => {
  let finish!: (value: api.SupportMessage[]) => void;
  vi.mocked(api.getSupportMessages).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue([{ ...message, id: 21 }]);
  await render(); await open();
  await act(async () => button('Quay lại hộp thư').click());
  await open();
  await act(async () => finish([message]));
  expect(api.getSupportMessages).toHaveBeenCalledTimes(2);
  expect(api.markSupportRead).toHaveBeenCalledExactlyOnceWith(2, 21);
  expect(host.querySelector('textarea')?.disabled).toBe(false);
});
