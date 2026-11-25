import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, notificationDestination, safeNotificationPath } from './notificationsApi';

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

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    await expect(getNotifications(0)).resolves.toEqual({ content: [], number: 0, totalPages: 0 });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    await expect(getUnreadCount()).resolves.toBe(0);
  });

  it('maps only existing member destinations', () => {
    expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' })).toBe('/member/dashboard');
    expect(notificationDestination({ relatedEntityType: 'membership_subscription', type: 'package_expiry' })).toBe('/member/packages');
    expect(notificationDestination({ relatedEntityType: 'payment', type: 'payment' })).toBe('/member/invoices');
    expect(notificationDestination({ relatedEntityType: null, type: 'class_reminder' })).toBe('/member/dashboard');
    expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' })).toBe('/messages?tab=support');
  });
});

it('routes training plans and coach notifications to the correct workspace', () => {
  expect(notificationDestination({ relatedEntityType: 'training_plan', type: 'system' })).toBe('/member/progress');
  expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' }, 'COACH')).toBe('/coach/classes');
  expect(notificationDestination({ relatedEntityType: 'training_plan', type: 'system' }, 'COACH')).toBe('/coach/training-plans');
  expect(notificationDestination({ relatedEntityType: 'training_plan', title: 'Giáo án đã lưu', type: 'system' }, 'COACH')).toBe('/coach/saved-plans');
  expect(notificationDestination({ relatedEntityType: 'health_metric', type: 'system' }, 'COACH')).toBe('/coach/health-metrics');
  expect(notificationDestination({ relatedEntityType: 'session_attendance', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ relatedEntityType: 'session_evaluation', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đánh giá tiến độ mới', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ relatedEntityType: 'staff_internal_request', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đơn từ nội bộ đã được phê duyệt', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: null, title: 'Your request was rejected', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'COACH')).toBe('/messages?tab=support');
  expect(notificationDestination({ relatedEntityType: 'coach_review', type: 'system' }, 'COACH')).toBe('/member/profile');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đánh giá mới từ học viên', type: 'system' }, 'COACH')).toBe('/member/profile');
  expect(notificationDestination({ relatedEntityType: null, title: 'Bảng vinh danh & đánh giá tháng', type: 'system' }, 'COACH')).toBe('/member/profile');
  expect(notificationDestination({ actionPath: '/staff/attendance' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ actionPath: '/staff/coach-classes' }, 'COACH')).toBe('/coach/classes');
});

it('uses safe action links and rejects external or other-role destinations', () => {
  expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath: '/member/streak' })).toBe('/member/dashboard');
  expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath: '/member/progress#coach-evaluations' })).toBe('/member/progress');
  for (const actionPath of ['https://example.com', '//example.com', '/admin/users', '/member/../admin/users']) {
    expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath })).toBe('/member/dashboard');
  }
});

it('opens staff and manager support notifications in their own queues', () => {
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'STAFF')).toBe('/messages?tab=support');
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'MANAGER')).toBe('/messages?tab=support');
});

it('retired shop and class notifications open the home queue of each role', () => {
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'MEMBER')).toBe('/member/invoices');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'STAFF')).toBe('/staff/reception');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'RECEPTIONIST')).toBe('/staff/reception');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'MANAGER')).toBe('/manager/reports');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'CENTER_MANAGER')).toBe('/manager/reports');
  expect(notificationDestination({ relatedEntityType: 'class_session', type: 'class_reminder' }, 'STAFF')).toBe('/staff/reception');
  expect(safeNotificationPath('/staff/orders', 'MANAGER')).toBeNull();
  expect(safeNotificationPath('/staff/classes', 'COACH')).toBeNull();
  expect(safeNotificationPath('/staff/requests', 'COACH')).toBe('/staff/requests');
});

it('redirects retired court notifications while preserving PT and staff destinations', () => {
  expect(safeNotificationPath('/member/courts?sport=Tennis', 'MEMBER')).toBe('/member/invoices');
  expect(safeNotificationPath('/member/classes?tab=pt', 'MEMBER')).toBe('/member/classes?tab=pt');
  expect(safeNotificationPath('/staff/courts', 'STAFF')).toBe('/staff/reception');
});

it.each(['/member/orders/42', '/member/products', '/member/checkout'])('maps retired Shop notification links to transaction history: %s', actionPath => {
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order', actionPath }, 'MEMBER')).toBe('/member/invoices');
});
