import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, notificationDestination } from './notificationsApi';

afterEach(() => vi.unstubAllGlobals());

describe('SCRUM-127 notification API', () => {
  it('uses the authenticated notification endpoints and unwraps pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { content: [], number: 0, totalPages: 1 } }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(getNotifications(0)).resolves.toMatchObject({ content: [] });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/notifications?page=0&size=20');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { count: 4 } }) });
    await expect(getUnreadCount()).resolves.toBe(4);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/notifications/unread-count');
    await markNotificationRead(7);
    await markAllNotificationsRead();
    expect(fetchMock.mock.calls[2]).toMatchObject(['/api/v1/notifications/7/read', { method: 'PATCH' }]);
    expect(fetchMock.mock.calls[3]).toMatchObject(['/api/v1/notifications/read-all', { method: 'PATCH' }]);
  });

  it('maps only existing member destinations', () => {
    expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' })).toBe('/member/classes');
    expect(notificationDestination({ relatedEntityType: 'membership_subscription', type: 'package_expiry' })).toBe('/member/packages');
    expect(notificationDestination({ relatedEntityType: 'payment', type: 'payment' })).toBe('/member/invoices');
    expect(notificationDestination({ relatedEntityType: null, type: 'class_reminder' })).toBe('/member/classes');
    expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' })).toBe('/member/support');
  });
});
