import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { ApiError } from '../../shared/api/client';
import * as supportApi from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import { MemberSupportChat } from './MemberSupportChat';

vi.mock('../member/supportRealtime', () => ({ subscribeSupport: vi.fn(() => () => {}) }));
vi.mock('../member/memberSupportApi', () => ({ getMySupportTickets: vi.fn(), getSupportTicket: vi.fn(), createSupportTicket: vi.fn(), getSupportMessages: vi.fn(), sendSupportMessage: vi.fn() }));

const ticket = { id: 7, memberId: 10, subject: '[Thiết bị] Máy chạy', description: 'Máy chạy không bật\nĐã thử cắm lại', status: 'open', createdAt: '2026-10-25T08:00:00', assignedToName: null } as supportApi.SupportTicket;
const staffMessage = (id: number, text: string): supportApi.SupportMessage => ({ id, senderId: 2, senderName: 'Lễ tân Hà', senderRole: 'RECEPTIONIST', message: text, createdAt: '2026-10-25T08:05:00' });
let host: HTMLDivElement, root: Root;

beforeEach(() => {
  setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [], totalPages: 0 });
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([]);
  vi.mocked(supportApi.getSupportTicket).mockResolvedValue(ticket);
  vi.mocked(subscribeSupport).mockImplementation(() => () => {});
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.resetAllMocks(); vi.unstubAllGlobals(); });

const render = () => act(async () => root.render(<MemberSupportChat onBack={() => {}} />));
const input = () => host.querySelector<HTMLTextAreaElement>('textarea#support-message')!;
const sendButton = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function type(value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input(), value); input().dispatchEvent(new Event('input', { bubbles: true })); });
}
async function send() { await act(async () => { sendButton().click(); }); }
const bubbles = () => [...host.querySelectorAll('.direct-chat__bubble')];
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

it('opens as a chat with category chips and no ticket form when the member has no ticket yet', async () => {
  await render();
  expect(host.querySelector('#support-subject')).toBeNull();
  expect(host.querySelector('#support-description')).toBeNull();
  expect(host.textContent).toContain('Lễ tân sẽ phản hồi ngay tại đây');
  expect([...host.querySelectorAll('[role="radio"]')].map(chip => chip.textContent)).toEqual(['Gói tập', 'Thiết bị', 'Lịch học', 'Khác']);
  expect(host.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe('Gói tập');
});

it('creates a categorized ticket from the first message and keeps chatting in it', async () => {
  vi.mocked(supportApi.createSupportTicket).mockResolvedValue({ ...ticket, id: 9 });
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([]);
  await render();
  await act(async () => (host.querySelectorAll('[role="radio"]')[1] as HTMLButtonElement).click());
  await type('Máy chạy không bật\nĐã thử cắm lại');
  await send();
  expect(supportApi.createSupportTicket).toHaveBeenCalledWith('[Thiết bị] Máy chạy không bật', 'Máy chạy không bật\nĐã thử cắm lại');
  await vi.waitFor(() => expect(supportApi.getSupportMessages).toHaveBeenCalledWith(9));
  expect(host.querySelector('[role="radiogroup"]')).toBeNull();
  expect(bubbles()[0].textContent).toContain('Máy chạy không bật');
  expect(host.querySelector('.direct-chat__thread-meta p')?.textContent).toBe('#9 · Đang chờ');
});

it('opens the latest ticket with its description as the first bubble and shows staff replies', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([staffMessage(21, 'Chúng tôi sẽ kiểm tra ngay')]);
  await render();
  await vi.waitFor(() => expect(bubbles()).toHaveLength(2));
  expect(bubbles()[0].parentElement?.classList.contains('is-mine')).toBe(true);
  expect(bubbles()[1].parentElement?.classList.contains('is-mine')).toBe(false);
  expect(bubbles()[1].textContent).toContain('Lễ tân Hà');
  expect(bubbles()[1].textContent).toContain('Chúng tôi sẽ kiểm tra ngay');
  expect(host.querySelector('.support-chat__ticketbar')?.textContent).toContain('Máy chạy');
});

it('sends a reply into the open ticket with an idempotency key and refreshes the conversation', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(supportApi.sendSupportMessage).mockResolvedValue(staffMessage(30, 'x'));
  await render();
  await vi.waitFor(() => expect(input().disabled).toBe(false));
  await type('Mình đang chờ');
  await send();
  expect(supportApi.sendSupportMessage).toHaveBeenCalledWith(7, 'Mình đang chờ', expect.any(String));
  await vi.waitFor(() => expect(input().value).toBe(''));
  expect(supportApi.getSupportMessages).toHaveBeenCalledTimes(2);
});

it('keeps the draft and the same idempotency key when sending fails, then retries', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(supportApi.sendSupportMessage).mockRejectedValueOnce(new ApiError('Mạng lỗi', 500)).mockResolvedValueOnce(staffMessage(31, 'x'));
  await render();
  await vi.waitFor(() => expect(input().disabled).toBe(false));
  await type('Thử lại nhé');
  await send();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mạng lỗi');
  expect(input().value).toBe('Thử lại nhé');
  await send();
  const [first, second] = vi.mocked(supportApi.sendSupportMessage).mock.calls;
  expect(second[2]).toBe(first[2]);
  await vi.waitFor(() => expect(input().value).toBe(''));
});

it('does not create a ticket when creation fails and keeps what the member typed', async () => {
  vi.mocked(supportApi.createSupportTicket).mockRejectedValue(new ApiError('Không tạo được', 500));
  await render();
  await type('Cần hỗ trợ gói tập');
  await send();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tạo được');
  expect(input().value).toBe('Cần hỗ trợ gói tập');
  expect(host.querySelector('[role="radiogroup"]')).not.toBeNull();
});

it('blocks composing on a closed ticket and lets the member start a new request', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [{ ...ticket, status: 'closed' }], totalPages: 1 });
  await render();
  await vi.waitFor(() => expect(host.textContent).toContain('Phiếu đã đóng, không thể gửi thêm tin nhắn.'));
  expect(host.querySelector('textarea')).toBeNull();
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Gửi yêu cầu mới')!.click());
  expect(host.querySelector('textarea#support-message')).not.toBeNull();
  expect(host.querySelector('[role="radiogroup"]')).not.toBeNull();
});

it('applies realtime replies and a closed status without duplicating messages', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 1 });
  await render();
  await vi.waitFor(() => expect(vi.mocked(subscribeSupport).mock.calls.at(-1)?.[2]).toBe(7));
  const changed = vi.mocked(subscribeSupport).mock.calls.at(-1)![0];
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([staffMessage(21, 'Đã xử lý'), staffMessage(21, 'Đã xử lý')]);
  vi.mocked(supportApi.getSupportTicket).mockResolvedValue({ ...ticket, status: 'closed' });
  await act(async () => { changed(); changed(); await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(bubbles()).toHaveLength(2);
  expect(host.textContent).toContain('Phiếu đã đóng');
});

it('switches between tickets from the ticket list and shows each ticket status', async () => {
  const other = { ...ticket, id: 8, subject: '[Khác] Phiếu B', description: 'Nội dung B', status: 'resolved' } as supportApi.SupportTicket;
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket, other], totalPages: 1 });
  await render();
  await vi.waitFor(() => expect(bubbles()).toHaveLength(1));
  await act(async () => button('Phiếu của tôi').click());
  expect(host.querySelectorAll('[data-support-ticket]')).toHaveLength(2);
  expect(host.textContent).toContain('Đã giải quyết');
  await act(async () => (host.querySelector('[data-support-ticket="8"]') as HTMLButtonElement).click());
  await vi.waitFor(() => expect(supportApi.getSupportMessages).toHaveBeenLastCalledWith(8));
  expect(host.querySelector('.support-chat__ticketbar')?.textContent).toContain('Phiếu B');
  expect(bubbles()[0].textContent).toContain('Nội dung B');
});

it('shows a ticket-load error with retry and still lets the member write a new request', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockRejectedValueOnce(new ApiError('Không tải được', 500)).mockResolvedValueOnce({ content: [], totalPages: 0 });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không tải được');
  expect(input().disabled).toBe(false);
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Thử lại')!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it('switches labels with the language', async () => {
  await render();
  await act(async () => setLanguage('en'));
  expect(host.querySelector('#chat-support-title')?.textContent).toBe('Support & Tickets');
  expect([...host.querySelectorAll('[role="radio"]')].map(chip => chip.textContent)).toEqual(['Membership', 'Equipment', 'Class schedule', 'Other']);
  expect(input().placeholder).toContain('Describe your issue');
});
