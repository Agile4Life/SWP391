import { apiFetch } from '../../shared/api/client';

export interface MemberNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
  actionPath?: string | null;
}

export interface NotificationPage {
  content: MemberNotification[];
  number: number;
  totalPages: number;
}

export const getNotifications = async (page = 0): Promise<NotificationPage> => {
  const res = await apiFetch<NotificationPage | MemberNotification[]>(`/notifications?page=${page}&size=20`);
  if (Array.isArray(res)) {
    return { content: res, number: page, totalPages: res.length > 0 ? 1 : 0 };
  }
  const content = Array.isArray(res?.content) ? res.content : [];
  return {
    content,
    number: typeof res?.number === 'number' ? res.number : page,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : (content.length > 0 ? 1 : 0),
  };
};
export const getUnreadCount = async () => {
  const res = await apiFetch<{ count?: number } | null>('/notifications/unread-count');
  return typeof res?.count === 'number' ? res.count : 0;
};
export const markNotificationRead = (id: number) =>
  apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () =>
  apiFetch<void>('/notifications/read-all', { method: 'PATCH' });

/** Accept only internal portal routes; never follow arbitrary URLs from notification content. */
export function safeNotificationPath(path: string | null | undefined, role = 'MEMBER'): string | null {
  if (!path || !/^\/[a-z0-9/-]+(?:\?[a-zA-Z0-9_=&%-]+)?(?:#[a-z0-9-]+)?$/.test(path)) return null;
  // Lễ tân chỉ mở màn hiện có; bỏ query/anchor không được màn danh sách hỗ trợ, không đoán ID.
  if (role === 'STAFF' || role === 'RECEPTIONIST') {
    if (path === '/messages' || path === '/messages?tab=support') return path;
    const pathname = path.split(/[?#]/)[0];
    if (pathname === '/staff/support') return '/messages?tab=support';
    if (/^\/staff\/(?:orders|classes|courts|pt-attendance|attendance)(?:\/|$)/.test(pathname)) return '/staff/reception';
    return ['/staff/reception', '/staff/check-in', '/staff/check-out', '/staff/reception-history',
      '/staff/kyc', '/staff/holds', '/staff/requests'].includes(pathname) ? pathname : null;
  }
  // Thông báo sân cũ không mở route đã bỏ; lịch sử thanh toán vẫn ở hóa đơn.
  if (role === 'MEMBER' && /^\/member\/courts(?:[?/#]|$)/.test(path)) return '/member/invoices';
  // Thông báo đơn hàng cũ dẫn về lịch sử giao dịch, không mở màn Shop đã bỏ.
  if (role === 'MEMBER' && /^\/member\/(?:orders|products|checkout)(?:[?/#]|$)/.test(path)) return '/member/invoices';
  // Thông báo Streak cũ về Dashboard; bỏ anchor cũ để mở trang Giáo án hiện tại.
  if (role === 'MEMBER' && /^\/member\/streak(?:[?/#]|$)/.test(path)) return '/member/dashboard';
  if (role === 'MEMBER' && /^\/member\/progress(?:[?/#]|$)/.test(path)) return '/member/progress';
  const prefix = role === 'COACH' ? '/coach/' : ['STAFF', 'RECEPTIONIST'].includes(role) ? '/staff/' : ['MANAGER', 'CENTER_MANAGER'].includes(role) ? '/manager/' : role === 'ADMIN' ? '/admin/' : '/member/';
  return path.startsWith(prefix) || path.startsWith('/member/profile') || (role === 'COACH' && (path === '/staff/requests' || path.startsWith('/staff/requests?'))) || path === '/messages' || path === '/messages?tab=support' ? path : null;
}

export function notificationDestination(notification: Pick<MemberNotification, 'relatedEntityType' | 'type' | 'actionPath'> & { title?: string }, role = 'MEMBER'): string {
  const explicit = safeNotificationPath(notification.actionPath, role);
  if (explicit) return explicit;
  if (role === 'STAFF' || role === 'RECEPTIONIST') {
    // Ưu tiên metadata thật; lịch sử hiện có chỉ chứa yêu cầu gói đã xử lý và nạp ví.
    if (notification.relatedEntityType === 'support_request' || notification.type === 'support_reply') return '/messages?tab=support';
    if (notification.relatedEntityType === 'payment' || notification.type === 'payment') return '/staff/reception-history';
    // Đơn nội bộ hiện gửi system/null, không có actionPath: chỉ nhận đúng tiêu đề VI/EN của backend.
    if (notification.type === 'system' && !notification.relatedEntityType && [
      'Your request was approved', 'Your request was rejected',
      'Đơn từ của bạn đã được duyệt', 'Đơn từ của bạn bị từ chối',
    ].includes(notification.title ?? '')) return '/staff/requests';
    // Thiếu thông tin thì về quầy; không suy luận bản ghi hoặc chức năng từ nội dung tự do.
    return '/staff/reception';
  }
  if (role === 'COACH') return notification.relatedEntityType === 'training_plan' ? '/coach/training-plans' : '/coach/classes';
  if (['MANAGER', 'CENTER_MANAGER'].includes(role)) {
    if (notification.relatedEntityType === 'support_request' || notification.type === 'support_reply') return '/messages?tab=support';
    return '/manager/reports';
  }
  if (role === 'ADMIN') return '/admin/users';
  switch (notification.relatedEntityType) {
    case 'class_session':
    case 'class_enrollment': return '/member/dashboard';
    case 'membership_subscription': return '/member/packages';
    case 'payment': return '/member/invoices';
    case 'product_order': return '/member/invoices';
    case 'support_request': return '/messages?tab=support';
    case 'training_plan': return '/member/progress';
    default:
      if (notification.type === 'class_reminder' || notification.type === 'schedule_change') return '/member/dashboard';
      if (notification.type === 'package_expiry') return '/member/packages';
      if (notification.type === 'payment') return '/member/invoices';
      if (notification.type === 'order') return '/member/invoices';
      if (notification.type === 'support_reply') return '/messages?tab=support';
      return '/member/dashboard';
  }
}
