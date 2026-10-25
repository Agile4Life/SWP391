import { afterEach, expect, it, vi } from 'vitest';
import { createSupportTicket, getMySupportTickets, getSupportMessages, sendSupportMessage } from './memberSupportApi';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('uses authenticated member-scoped list and actual support payloads', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { content: [], totalPages: 0 } }) });
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('fitcenter_token', 'test-token');
  await getMySupportTickets();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/support/requests/my?page=0&size=20', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  await createSupportTicket('[Gói tập] Gia hạn', 'Cần hỗ trợ');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/support/requests', expect.objectContaining({ method: 'POST', body: JSON.stringify({ subject: '[Gói tập] Gia hạn', description: 'Cần hỗ trợ' }) }));
  await getSupportMessages(12);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/support/requests/12/messages', expect.anything());
  await sendSupportMessage(12, 'Xin chào');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/support/requests/12/messages', expect.objectContaining({ method: 'POST', body: '{"message":"Xin chào"}' }));
});
