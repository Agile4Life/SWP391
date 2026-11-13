import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { ApiError } from '../../shared/api/client';
import * as supportApi from '../member/memberSupportApi';
import { subscribeSupport } from '../member/supportRealtime';
import { StaffSupportChat } from './StaffSupportChat';

vi.mock('../member/supportRealtime', () => ({ subscribeSupport: vi.fn(() => () => {}) }));
vi.mock('../member/memberSupportApi', () => ({ getSupportInbox: vi.fn(), getSupportTicket: vi.fn(), getSupportMessages: vi.fn(), sendSupportMessage: vi.fn(), updateSupportStatus: vi.fn(), escalateSupportTicket: vi.fn() }));

const ticket = { id: 7, memberId: 10, memberName: 'Nguyễn An', subject: '[Thiết bị] Máy chạy', description: 'Máy không bật', status: 'open', createdAt: '2026-10-25T08:00:00', assignedToName: null } as supportApi.SupportTicket;
const memberMessage = (id: number, text: string): supportApi.SupportMessage => ({ id, senderId: 10, senderName: 'Nguyễn An', senderRole: 'MEMBER', message: text, createdAt: '2026-10-25T08:05:00' });
const staffMessage = (id: number, text: string): supportApi.SupportMessage => ({ id, senderId: 2, senderName: 'Lễ tân Hà', senderRole: 'RECEPTIONIST', message: text, createdAt: '2026-10-25T08:06:00' });
let host: HTMLDivElement, root: Root;

beforeEach(() => {
  setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(supportApi.getSupportInbox).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(supportApi.getSupportTicket).mockResolvedValue(ticket);
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([memberMessage(20, 'Em cần giúp')]);
  vi.mocked(subscribeSupport).mockImplementation(() => () => {});
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const render = () => act(async () => root.render(<StaffSupportChat onBack={() => {}} />));
const bubbles = () => [...host.querySelectorAll('.direct-chat__bubble')];
const byText = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement;
async function openTicket() {
  await render();
  await vi.waitFor(() => expect(host.querySelector('[data-support-ticket="7"]')).not.toBeNull());
  await act(async () => (host.querySelector('[data-support-ticket="7"]') as HTMLButtonElement).click());
  await vi.waitFor(() => expect(bubbles().length).toBeGreaterThan(0));
}
async function type(value: string) {
  const field = host.querySelector<HTMLTextAreaElement>('textarea#staff-support-message')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
}

it('lists tickets as an inbox and filters them by status chips', async () => {
  await render();
  await vi.waitFor(() => expect(host.querySelector('[data-support-ticket="7"]')?.textContent).toContain('Nguyễn An'));
  expect(supportApi.getSupportInbox).toHaveBeenLastCalledWith(0, '');
  await act(async () => byText('Đang xử lý').click());
  expect(supportApi.getSupportInbox).toHaveBeenLastCalledWith(0, 'in_progress');
});

it('opens a ticket as a chat with the member on the left and the receptionist reply on the right', async () => {
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([memberMessage(20, 'Em cần giúp'), staffMessage(21, 'Chị đang xem')]);
  await openTicket();
  await vi.waitFor(() => expect(bubbles()).toHaveLength(3));
  expect(bubbles().map(b => b.parentElement?.classList.contains('is-mine'))).toEqual([false, false, true]);
  expect(host.querySelector('#chat-support-title')?.textContent).toBe('Nguyễn An');
});

it('replies through the composer with an idempotency key and clears the draft', async () => {
  vi.mocked(supportApi.sendSupportMessage).mockResolvedValue(staffMessage(22, 'x'));
  await openTicket();
  await type('Đã nhận, sẽ kiểm tra');
  await act(async () => { host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(); });
  expect(supportApi.sendSupportMessage).toHaveBeenCalledWith(7, 'Đã nhận, sẽ kiểm tra', expect.any(String));
  await vi.waitFor(() => expect(host.querySelector<HTMLTextAreaElement>('textarea#staff-support-message')!.value).toBe(''));
});

it('keeps the reply and shows the error when sending fails', async () => {
  vi.mocked(supportApi.sendSupportMessage).mockRejectedValue(new ApiError('Gửi lỗi', 500));
  await openTicket();
  await type('Trả lời');
  await act(async () => { host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Gửi lỗi');
  expect(host.querySelector<HTMLTextAreaElement>('textarea#staff-support-message')!.value).toBe('Trả lời');
});

it('changes the ticket status from the status chips and offers only allowed transitions', async () => {
  vi.mocked(supportApi.updateSupportStatus).mockResolvedValue({ ...ticket, status: 'in_progress' });
  await openTicket();
  const chips = [...host.querySelectorAll('[role="radiogroup"][aria-label="Trạng thái phiếu"] [role="radio"]')].map(chip => chip.textContent);
  expect(chips).toEqual(['Đang chờ', 'Đang xử lý', 'Đã giải quyết']);
  await act(async () => byText('Đang xử lý').click());
  expect(supportApi.updateSupportStatus).toHaveBeenCalledWith(7, 'in_progress');
});

it('escalates to a manager with a reason', async () => {
  vi.mocked(supportApi.escalateSupportTicket).mockResolvedValue({ ...ticket, escalatedAt: '2026-10-25T09:00:00' });
  await openTicket();
  await act(async () => (host.querySelector('button[aria-label="Chuyển lên quản lý"]') as HTMLButtonElement).click());
  const reason = host.querySelector<HTMLTextAreaElement>('#staff-support-escalation')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Cần quản lý quyết định'); reason.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => host.querySelector('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(supportApi.escalateSupportTicket).toHaveBeenCalledWith(7, 'Cần quản lý quyết định');
});

it('makes an escalated ticket read-only for the receptionist', async () => {
  const escalated = { ...ticket, escalatedAt: '2026-10-25T09:00:00', escalatedByName: 'Hà', escalationReason: 'Đền bù' };
  vi.mocked(supportApi.getSupportInbox).mockResolvedValue({ content: [escalated], totalPages: 1 });
  vi.mocked(supportApi.getSupportTicket).mockResolvedValue(escalated);
  await openTicket();
  await vi.waitFor(() => expect(host.querySelector('[data-testid="escalation-info"]')?.textContent).toContain('lễ tân chỉ xem'));
  expect(host.querySelector('textarea')).toBeNull();
  expect(host.querySelector('[aria-label="Trạng thái phiếu"]')).toBeNull();
});

it('blocks replying on a closed ticket and goes back to the inbox', async () => {
  const closed = { ...ticket, status: 'closed' } as supportApi.SupportTicket;
  vi.mocked(supportApi.getSupportInbox).mockResolvedValue({ content: [closed], totalPages: 1 });
  vi.mocked(supportApi.getSupportTicket).mockResolvedValue(closed);
  await openTicket();
  expect(host.textContent).toContain('Phiếu đã đóng, không thể gửi thêm tin nhắn.');
  expect(host.querySelector('textarea')).toBeNull();
  await act(async () => (host.querySelector('.direct-chat__back') as HTMLButtonElement).click());
  expect(host.querySelector('[data-support-ticket="7"]')).not.toBeNull();
});

it('shows inbox errors with retry and an empty state', async () => {
  vi.mocked(supportApi.getSupportInbox).mockRejectedValueOnce(new ApiError('Lỗi tải', 500)).mockResolvedValueOnce({ content: [], totalPages: 0 });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Lỗi tải');
  await act(async () => byText('Thử lại').click());
  expect(host.textContent).toContain('Không có phiếu hỗ trợ phù hợp.');
});

it('refetches the open ticket when the realtime channel reports a new member message', async () => {
  await openTicket();
  const changed = vi.mocked(subscribeSupport).mock.calls.at(-1)![0];
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([memberMessage(20, 'Em cần giúp'), memberMessage(23, 'Em gửi thêm ảnh')]);
  await act(async () => { changed(); await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(bubbles().map(b => b.textContent).join('|')).toContain('Em gửi thêm ảnh');
});
