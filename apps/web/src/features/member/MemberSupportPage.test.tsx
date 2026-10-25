import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberSupportPage } from './MemberSupportPage';
import * as supportApi from './memberSupportApi';

vi.mock('./memberSupportApi', () => ({ getMySupportTickets: vi.fn(), createSupportTicket: vi.fn(), getSupportMessages: vi.fn(), sendSupportMessage: vi.fn() }));
const ticket = { id: 7, memberId: 10, subject: '[Thiết bị] Máy chạy', description: 'Máy không bật', status: 'open', createdAt: '2026-10-25T08:00:00', assignedToName: null } as supportApi.SupportTicket;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 1 });
  vi.mocked(supportApi.getSupportMessages).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<MemberSupportPage />)); }
async function click(button: HTMLButtonElement) { await act(async () => button.click()); }
async function type(selector: string, value: string) {
  const field = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  await act(async () => { const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set; setter?.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
}

it('lists member tickets, maps status and opens an empty conversation', async () => {
  await render();
  expect(host.textContent).toContain('Máy chạy');
  expect(host.textContent).toContain('Đang chờ');
  await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  expect(supportApi.getSupportMessages).toHaveBeenCalledWith(7);
  expect(host.textContent).toContain('Chưa có tin nhắn');
});

it('creates a categorized ticket and refreshes the list', async () => {
  vi.mocked(supportApi.createSupportTicket).mockResolvedValue(ticket);
  await render();
  await type('#support-subject', 'Gia hạn gói');
  await act(async () => { (host.querySelector('.member-support-form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(supportApi.createSupportTicket).toHaveBeenCalledWith('[Gói tập] Gia hạn gói', '');
  expect(supportApi.getMySupportTickets).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain('Đã tạo phiếu #7');
});

it('sends a message once and reloads the conversation', async () => {
  vi.mocked(supportApi.sendSupportMessage).mockResolvedValue({ id: 2, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'Xin chào', createdAt: '2026-10-25T09:00:00' });
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  await type('#support-message', 'Xin chào');
  await act(async () => { (host.querySelector('.member-support-compose') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(supportApi.sendSupportMessage).toHaveBeenCalledWith(7, 'Xin chào');
  expect(supportApi.getSupportMessages).toHaveBeenCalledTimes(2);
});

it('blocks composing on closed tickets and shows list failure', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValueOnce({ content: [{ ...ticket, status: 'closed' }], totalPages: 1 });
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  expect(host.textContent).toContain('Phiếu đã đóng');
  expect(host.querySelector('.member-support-compose')).toBeNull();
});

it('shows API errors without adding a fake ticket', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockRejectedValueOnce(new Error('offline'));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể hoàn tất');
  expect(host.querySelector('.member-support-ticket')).toBeNull();
});

it('keeps message draft when the send API fails', async () => {
  vi.mocked(supportApi.sendSupportMessage).mockRejectedValue(new Error('offline'));
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  await type('#support-message', 'Thử lại');
  await act(async () => { (host.querySelector('.member-support-compose') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể hoàn tất');
  expect((host.querySelector('#support-message') as HTMLTextAreaElement).value).toBe('Thử lại');
});
