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

it('uses the refreshed ticket status and preserves draft until the ticket is closed', async () => {
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  await type('#support-message', 'Nội dung đang soạn');
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValueOnce({ content: [{ ...ticket, status: 'resolved' }], totalPages: 1 });
  const refresh = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Làm mới')!;
  await click(refresh);
  expect(host.querySelector('.member-support-context')?.textContent).toContain('Đã giải quyết');
  expect((host.querySelector('#support-message') as HTMLTextAreaElement).value).toBe('Nội dung đang soạn');
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValueOnce({ content: [{ ...ticket, status: 'closed' }], totalPages: 1 });
  await click(refresh);
  expect(host.querySelector('.member-support-context')?.textContent).toContain('Đã đóng');
  expect(host.querySelector('.member-support-compose')).toBeNull();
  expect(supportApi.sendSupportMessage).not.toHaveBeenCalled();
  expect(host.querySelector('.portal-container.member-support')).not.toBeNull();
});

it('hides unavailable selection and keeps its draft across pagination', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket], totalPages: 2 });
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  await type('#support-message', 'Bản nháp chưa gửi');
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValueOnce({ content: [{ ...ticket, id: 8 }], totalPages: 2 });
  await click([...host.querySelectorAll('button')].find((button) => button.textContent === 'Sau')!);
  expect(host.querySelector('.member-support-compose')).toBeNull();
  expect(host.querySelector('#support-conversation-title')?.textContent).toBe('Trao đổi');
  await click([...host.querySelectorAll('button')].find((button) => button.textContent === 'Trước')!);
  expect((host.querySelector('#support-message') as HTMLTextAreaElement).value).toBe('Bản nháp chưa gửi');
  expect(supportApi.getMySupportTickets).toHaveBeenLastCalledWith(0);
});

it('prevents duplicate sends while a message is pending', async () => {
  let resolve!: (message: supportApi.SupportMessage) => void;
  vi.mocked(supportApi.sendSupportMessage).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await render(); await click(host.querySelector('.member-support-ticket') as HTMLButtonElement);
  await type('#support-message', 'Xin chào');
  await act(async () => {
    const form = host.querySelector('.member-support-compose') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(supportApi.sendSupportMessage).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ id: 2, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'Xin chào', createdAt: ticket.createdAt }));
});

it('ignores messages from A arriving after B', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket, { ...ticket, id: 8 }], totalPages: 1 });
  let finishA!: (messages: supportApi.SupportMessage[]) => void;
  vi.mocked(supportApi.getSupportMessages).mockImplementationOnce(() => new Promise(resolve => { finishA = resolve; }))
    .mockResolvedValueOnce([{ id: 80, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'Tin của B', createdAt: ticket.createdAt }]);
  await render();
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[0]);
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[1]);
  await act(async () => finishA([{ id: 70, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'Tin của A', createdAt: ticket.createdAt }]));
  expect(host.querySelector('#support-conversation-title')?.textContent).toContain('#8');
  expect(host.textContent).toContain('Tin của B');
  expect(host.textContent).not.toContain('Tin của A');
});

it('ignores the first A response after switching A to B and back to A', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket, { ...ticket, id: 8 }], totalPages: 1 });
  let finish!: (messages: supportApi.SupportMessage[]) => void;
  const message: supportApi.SupportMessage = { id: 70, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'A mới', createdAt: ticket.createdAt };
  vi.mocked(supportApi.getSupportMessages).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce([]).mockResolvedValueOnce([message]);
  await render();
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[0]);
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[1]);
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[0]);
  await act(async () => finish([{ ...message, message: 'A cũ' }]));
  expect(host.textContent).toContain('A mới');
  expect(host.textContent).not.toContain('A cũ');
});

it('does not clear B draft or reload A when an A send finishes after switching tickets', async () => {
  vi.mocked(supportApi.getMySupportTickets).mockResolvedValue({ content: [ticket, { ...ticket, id: 8 }], totalPages: 1 });
  let finish!: (message: supportApi.SupportMessage) => void;
  vi.mocked(supportApi.sendSupportMessage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render();
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[0]);
  await type('#support-message', 'Gửi A');
  await act(async () => host.querySelector('form.member-support-compose')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await click(host.querySelectorAll<HTMLButtonElement>('.member-support-ticket')[1]);
  await type('#support-message', 'Draft B');
  await act(async () => finish({ id: 70, senderId: 10, senderName: 'Bạn', senderRole: 'MEMBER', message: 'Gửi A', createdAt: ticket.createdAt }));
  expect((host.querySelector('#support-message') as HTMLTextAreaElement).value).toBe('Draft B');
  expect(supportApi.getSupportMessages).toHaveBeenCalledTimes(2);
});
