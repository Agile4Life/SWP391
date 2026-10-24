// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MemberNotificationsPage } from './MemberNotificationsPage';

const api = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), read: vi.fn(), all: vi.fn() }));
vi.mock('./notificationsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./notificationsApi')>()),
  getNotifications: api.list, getUnreadCount: api.count,
  markNotificationRead: api.read, markAllNotificationsRead: api.all,
}));

describe('SCRUM-127 member notifications', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    Object.values(api).forEach((mock) => mock.mockReset());
    api.list.mockResolvedValue({ content: [], number: 0, totalPages: 1 });
    api.count.mockResolvedValue(0); api.read.mockResolvedValue(undefined); api.all.mockResolvedValue(undefined);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  const render = async () => act(async () => root.render(<MemoryRouter><MemberNotificationsPage /></MemoryRouter>));
  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

  it('shows empty state from the API', async () => {
    await render();
    expect(host.textContent).toContain('Chưa có thông báo');
  });

  it('retries a failed list request', async () => {
    api.list.mockRejectedValueOnce(new Error('Mất kết nối'));
    await render();
    expect(host.textContent).toContain('Mất kết nối');
    await act(async () => button('Thử lại')?.click());
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Chưa có thông báo');
  });

  it('marks a notification read before navigation and reports mutation errors', async () => {
    api.list.mockResolvedValue({ content: [{ id: 3, title: 'Đổi phòng', message: 'Lớp đổi phòng', type: 'schedule_change', relatedEntityType: 'class_session', relatedEntityId: 9, isRead: false, createdAt: '2026-10-24T08:00:00' }], number: 0, totalPages: 1 });
    api.read.mockRejectedValueOnce(new Error('Không thể cập nhật'));
    await render();
    await act(async () => button('Đổi phòng')?.click());
    expect(host.textContent).toContain('Không thể cập nhật');
    expect(api.read).toHaveBeenCalledWith(3);
  });

  it('marks all visible notifications read through the backend', async () => {
    api.count.mockResolvedValue(2);
    api.list.mockResolvedValue({ content: [{ id: 3, title: 'Nhắc lịch', message: 'Lớp hôm nay', type: 'class_reminder', relatedEntityType: null, relatedEntityId: null, isRead: false, createdAt: '2026-10-24T08:00:00' }], number: 0, totalPages: 1 });
    await render();
    await act(async () => button('Đánh dấu tất cả đã đọc')?.click());
    expect(api.all).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-label="Chưa đọc"]')).toBeNull();
  });

  it('notifies the navbar after marking one notification read', async () => {
    api.count.mockResolvedValue(1);
    api.list.mockResolvedValue({ content: [{ id: 4, title: 'Nhắc lịch', message: 'Lớp hôm nay', type: 'class_reminder', relatedEntityType: null, relatedEntityId: null, isRead: false, createdAt: '2026-10-24T08:00:00' }], number: 0, totalPages: 1 });
    const changed = vi.fn();
    window.addEventListener('member-notifications-changed', changed);
    try {
      await render();
      await act(async () => button('Nhắc lịch')?.click());
      expect(api.read).toHaveBeenCalledWith(4);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[aria-label="Chưa đọc"]')).toBeNull();
    } finally {
      window.removeEventListener('member-notifications-changed', changed);
    }
  });
});
