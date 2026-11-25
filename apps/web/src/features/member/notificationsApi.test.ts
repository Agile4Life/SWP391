import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  notificationDestination,
  safeNotificationPath,
} from './notificationsApi';
import { localizeMessage, localizeTitle } from './notificationLocalizer';

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

  it('routes member group class, PT 1:1, membership, payment and support notifications accurately', () => {
    expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' })).toBe('/member/classes');
    expect(notificationDestination({ relatedEntityType: 'class_enrollment', type: 'system' })).toBe('/member/classes');
    expect(notificationDestination({ relatedEntityType: null, type: 'class_reminder' })).toBe('/member/classes');
    expect(notificationDestination({ relatedEntityType: 'coach_booking', type: 'booking' })).toBe('/member/classes?tab=pt');
    expect(notificationDestination({ relatedEntityType: 'pt_booking', type: 'system' })).toBe('/member/classes?tab=pt');
    expect(notificationDestination({ actionPath: '/member/classes?tab=coach_booking' }, 'MEMBER')).toBe('/member/classes?tab=pt');
    expect(notificationDestination({ relatedEntityType: 'membership_subscription', type: 'package_expiry' })).toBe('/member/packages');
    expect(notificationDestination({ relatedEntityType: 'payment', type: 'payment' })).toBe('/member/invoices');
    expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' })).toBe('/messages?tab=support');
    expect(notificationDestination({ relatedEntityType: 'training_plan', type: 'system' })).toBe('/member/progress');
  });
});

it('routes coach group-class, attendance, PT, plans and requests notifications to the right workspace', () => {
  expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' }, 'COACH')).toBe('/coach/classes');
  expect(notificationDestination({ relatedEntityType: 'coach_booking', type: 'booking' }, 'COACH')).toBe('/coach/classes');
  expect(notificationDestination({ relatedEntityType: 'training_plan', type: 'system' }, 'COACH')).toBe('/coach/training-plans');
  expect(notificationDestination({ relatedEntityType: 'training_plan', title: 'Giáo án đã lưu', type: 'system' }, 'COACH')).toBe('/coach/saved-plans');
  expect(notificationDestination({ relatedEntityType: 'health_metric', type: 'system' }, 'COACH')).toBe('/coach/training-plans');
  expect(notificationDestination({ actionPath: '/coach/health-metrics' }, 'COACH')).toBe('/coach/training-plans');
  expect(notificationDestination({ relatedEntityType: 'session_attendance', type: 'system' }, 'COACH')).toBe('/coach/attendance');
  expect(notificationDestination({ relatedEntityType: 'pt_attendance', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ relatedEntityType: 'session_evaluation', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đánh giá tiến độ mới', type: 'system' }, 'COACH')).toBe('/coach/pt-attendance');
  expect(notificationDestination({ actionPath: '/staff/attendance' }, 'COACH')).toBe('/coach/attendance');
  expect(notificationDestination({ actionPath: '/staff/attendance/99' }, 'COACH')).toBe('/coach/attendance/99');
  expect(notificationDestination({ actionPath: '/staff/coach-classes' }, 'COACH')).toBe('/coach/classes');
  expect(notificationDestination({ actionPath: '/staff/classes' }, 'COACH')).toBe('/coach/classes');
  expect(notificationDestination({ relatedEntityType: 'staff_internal_request', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đơn từ nội bộ đã được phê duyệt', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: null, title: 'Your request was rejected', type: 'system' }, 'COACH')).toBe('/staff/requests');
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'COACH')).toBe('/messages?tab=support');
  expect(notificationDestination({ relatedEntityType: 'coach_review', type: 'system' }, 'COACH')).toBe('/member/profile');
  expect(notificationDestination({ relatedEntityType: null, title: 'Đánh giá mới từ học viên', type: 'system' }, 'COACH')).toBe('/member/profile');
  expect(notificationDestination({ relatedEntityType: null, title: 'Bảng vinh danh & đánh giá tháng', type: 'system' }, 'COACH')).toBe('/member/profile');
});

it('routes manager, staff and admin notifications cleanly including restored class links', () => {
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'STAFF')).toBe('/messages?tab=support');
  expect(notificationDestination({ relatedEntityType: 'support_request', type: 'support_reply' }, 'MANAGER')).toBe('/messages?tab=support');
  expect(notificationDestination({ relatedEntityType: 'class_session', type: 'schedule_change' }, 'MANAGER')).toBe('/manager/classes');
  expect(notificationDestination({ actionPath: '/staff/classes' }, 'MANAGER')).toBe('/manager/classes');
  expect(notificationDestination({ actionPath: '/staff/classes' }, 'CENTER_MANAGER')).toBe('/manager/classes');
  expect(notificationDestination({ relatedEntityType: 'coach_booking', type: 'system' }, 'MANAGER')).toBe('/manager/coach-assignments');
  expect(notificationDestination({ relatedEntityType: 'staff_internal_request', type: 'system' }, 'MANAGER')).toBe('/manager/requests');
  expect(notificationDestination({ relatedEntityType: null, title: 'Cancellation request approved', type: 'system' }, 'STAFF')).toBe('/staff/reception');
  expect(notificationDestination({ relatedEntityType: 'class_session', type: 'class_reminder' }, 'STAFF')).toBe('/staff/reception');
  expect(notificationDestination({ actionPath: '/admin/payments' }, 'ADMIN')).toBe('/admin/payments');
  expect(notificationDestination({ relatedEntityType: null, type: 'system' }, 'ADMIN')).toBe('/admin/users');
});

it('uses safe action links and rejects external, path-traversal or cross-role destinations', () => {
  expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath: '/member/streak' })).toBe('/member/dashboard');
  expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath: '/member/progress#coach-evaluations' })).toBe('/member/progress');
  for (const actionPath of ['https://example.com', '//example.com', '/admin/users', '/manager/classes', '/member/../admin/users']) {
    expect(notificationDestination({ relatedEntityType: null, type: 'system', actionPath }, 'MEMBER')).toBe('/member/dashboard');
  }
  expect(safeNotificationPath('/staff/orders', 'MANAGER')).toBeNull();
  expect(safeNotificationPath('/staff/classes', 'COACH')).toBeNull();
  expect(safeNotificationPath('/staff/requests', 'COACH')).toBe('/staff/requests');
});

it('redirects retired shop and court notifications to transaction history', () => {
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'MEMBER')).toBe('/member/invoices');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'STAFF')).toBe('/staff/reception');
  expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order' }, 'MANAGER')).toBe('/manager/reports');
  expect(safeNotificationPath('/member/courts?sport=Tennis', 'MEMBER')).toBe('/member/invoices');
  expect(safeNotificationPath('/member/classes?tab=pt', 'MEMBER')).toBe('/member/classes?tab=pt');
  expect(safeNotificationPath('/staff/courts', 'STAFF')).toBe('/staff/reception');
  for (const actionPath of ['/member/orders/42', '/member/products', '/member/checkout']) {
    expect(notificationDestination({ relatedEntityType: 'product_order', type: 'order', actionPath }, 'MEMBER')).toBe('/member/invoices');
  }
});

it('localizes restored class reschedule, checkout and cancellation notifications cleanly', () => {
  expect(localizeTitle('Class session rescheduled')).toBe('Thông báo đổi lịch buổi học');
  expect(localizeTitle('Course registration successful')).toBe('Đăng ký khóa học thành công');
  expect(
    localizeMessage('The session of class Yoga Flow (previously 30/11/2026, 18:00 – 19:00) has been moved to 01/12/2026 (19:00 – 20:00).'),
  ).toBe('Buổi học của lớp Yoga Flow (lịch cũ 30/11/2026, 18:00 – 19:00) đã được dời sang ngày 01/12/2026 (19:00 – 20:00).');
  expect(
    localizeMessage('Your teaching session for class Yoga Flow (previously 30/11/2026, 18:00 – 19:00) has been moved to 01/12/2026 (19:00 – 20:00).'),
  ).toBe('Lịch dạy lớp Yoga Flow (lịch cũ 30/11/2026, 18:00 – 19:00) đã được dời sang ngày 01/12/2026 (19:00 – 20:00).');
  expect(
    localizeMessage('Your spot in course Yoga Flow has been reserved. Please complete payment to confirm your enrollment.'),
  ).toBe('Bạn đã giữ chỗ thành công cho khóa học Yoga Flow. Vui lòng hoàn tất thanh toán để xác nhận suất học.');
});
