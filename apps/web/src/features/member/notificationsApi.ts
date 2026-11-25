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
  const prefix = role === 'COACH' ? '/coach/' : ['STAFF', 'RECEPTIONIST'].includes(role) ? '/staff/' : ['MANAGER', 'CENTER_MANAGER'].includes(role) ? '/manager/' : role === 'ADMIN' ? '/admin/' : '/member/';
  return path.startsWith(prefix) ||
    path.startsWith('/member/profile') ||
    path === '/profile' ||
    (role === 'COACH' && ['/staff/attendance', '/staff/requests', '/staff/coach-classes', '/staff/classes'].some(p => path === p || path.startsWith(`${p}?`))) ||
    (['MANAGER', 'CENTER_MANAGER'].includes(role) && ['/staff/classes', '/staff/courts', '/staff/orders', '/staff/requests'].some(p => path === p || path.startsWith(`${p}?`))) ||
    path === '/messages' ||
    path === '/messages?tab=support' ? path : null;
}

export type NotificationTarget = Partial<Pick<MemberNotification, 'relatedEntityType' | 'type' | 'actionPath' | 'title' | 'message'>>;

export function notificationDestination(notification: NotificationTarget, role = 'MEMBER'): string {
  const explicit = safeNotificationPath(notification.actionPath, role);
  if (explicit) {
    if (role === 'COACH') {
      if (explicit === '/staff/attendance' || explicit.startsWith('/staff/attendance?')) {
        return explicit.replace('/staff/attendance', '/coach/pt-attendance');
      }
      if (explicit === '/staff/coach-classes' || explicit === '/staff/classes' || explicit.startsWith('/staff/classes?')) {
        return '/coach/classes';
      }
    }
    return explicit;
  }

  const rawEntity = (notification.relatedEntityType ?? '').toLowerCase().trim();
  const rawType = (notification.type ?? '').toLowerCase().trim();
  const rawTitle = (notification.title ?? '').toLowerCase().trim();
  const rawMessage = (notification.message ?? '').toLowerCase().trim();
  const text = `${rawTitle} ${rawMessage}`;

  if (role === 'COACH') {
    // 1. Hỗ trợ / Khiếu nại / Tin nhắn
    if (rawEntity === 'support_request' || rawType === 'support_reply' || /support|hỗ trợ|khiếu nại|tin nhắn|message/.test(text)) {
      return '/messages?tab=support';
    }

    // 2. Đơn từ nội bộ (Nghỉ phép / Đổi ca / Đề xuất)
    if (
      ['staff_internal_request', 'internal_request', 'staff_request', 'leave_request'].includes(rawEntity) ||
      rawType === 'staff_request' ||
      /đơn từ|nội bộ|nghỉ phép|đổi ca|đề xuất|internal request|leave request|shift change|leave_impact|phê duyệt|từ chối|chờ duyệt|approved|rejected/.test(text)
    ) {
      return '/staff/requests';
    }

    // 3. Điểm danh PT 1-1 & Đánh giá buổi tập PT
    if (
      ['session_attendance', 'session_evaluation', 'pt_attendance', 'attendance', 'evaluation'].includes(rawEntity) ||
      rawType === 'evaluation' ||
      /điểm danh|attendance|buổi tập pt|đánh giá buổi tập|đánh giá tiến độ|nhận xét buổi tập|progress evaluation/.test(text)
    ) {
      return '/coach/pt-attendance';
    }

    // 4. Chỉ số sức khỏe học viên
    if (
      ['health_metric', 'health_metrics', 'member_metrics'].includes(rawEntity) ||
      /chỉ số sức khỏe|chỉ số thể chất|health metric|bmi|inbody|số đo/.test(text)
    ) {
      return '/coach/health-metrics';
    }

    // 5. Giáo án huấn luyện (Soạn giáo án vs Giáo án đã lưu)
    if (
      rawEntity === 'training_plan' ||
      rawType === 'training_plan' ||
      /giáo án|training plan|kế hoạch tập|phân công giáo án/.test(text)
    ) {
      if (/đã lưu|saved|lịch sử|history/.test(text)) {
        return '/coach/saved-plans';
      }
      return '/coach/training-plans';
    }

    // 6. Đánh giá từ học viên / Vinh danh & Thành tích HLV
    if (
      ['coach_review', 'monthly_review', 'coach_monthly_review', 'review'].includes(rawEntity) ||
      /đánh giá mới từ học viên|đánh giá của học viên|vinh danh|bảng vinh danh|monthly review|xếp hạng|leaderboard|star review/.test(text)
    ) {
      return '/member/profile';
    }

    // 7. Lịch dạy PT 1-1 / Thời khóa biểu / Nhắc lịch học / Hủy lịch
    if (
      ['pt_booking', 'coach_booking', 'class_session', 'class_enrollment', 'booking'].includes(rawEntity) ||
      ['schedule_change', 'class_reminder', 'booking'].includes(rawType) ||
      /lịch dạy|thời khóa biểu|lịch hẹn pt|pt booking|đặt lịch|hủy lịch|nhắc lịch|bàn giao|transferred|schedule|class session/.test(text)
    ) {
      return '/coach/classes';
    }

    // 8. Tài khoản cá nhân / Mật khẩu
    if (
      ['user', 'profile', 'auth', 'password'].includes(rawEntity) ||
      /mật khẩu|tài khoản|password|profile|hồ sơ/.test(text)
    ) {
      return '/member/profile';
    }

    // Fallback cho COACH
    return '/coach/classes';
  }

  if (['STAFF', 'RECEPTIONIST', 'MANAGER', 'CENTER_MANAGER'].includes(role)) {
    const manager = ['MANAGER', 'CENTER_MANAGER'].includes(role);
    if (rawEntity === 'product_order' || rawType === 'order') return manager ? '/manager/products?tab=orders' : '/staff/orders';
    if (rawEntity === 'support_request' || rawType === 'support_reply') return '/messages?tab=support';
    if (
      ['staff_internal_request', 'internal_request', 'staff_request'].includes(rawEntity) ||
      /đơn từ|nội bộ|nghỉ phép|đổi ca|đề xuất|internal request|leave request/.test(text)
    ) {
      return manager ? '/manager/requests' : '/staff/requests';
    }
    if (['class_session', 'class_enrollment'].includes(rawEntity) || ['schedule_change', 'class_reminder'].includes(rawType)) return '/staff/classes';
    return manager ? '/manager/reports' : '/staff/reception';
  }
  if (role === 'ADMIN') return '/admin/users';
  switch (rawEntity) {
    case 'class_session':
    case 'class_enrollment': return '/member/classes';
    case 'membership_subscription': return '/member/packages';
    case 'payment': return '/member/invoices';
    case 'product_order': return '/member/orders';
    case 'support_request': return '/messages?tab=support';
    case 'training_plan': return '/member/progress';
    default:
      if (rawType === 'class_reminder' || rawType === 'schedule_change') return '/member/classes';
      if (rawType === 'package_expiry') return '/member/packages';
      if (rawType === 'payment') return '/member/invoices';
      if (rawType === 'order') return '/member/orders';
      if (rawType === 'support_reply') return '/messages?tab=support';
      if (/đánh giá|nhận xét|evaluation|tiến độ|progress/.test(text)) return '/member/progress#coach-evaluations';
      return '/member/dashboard';
  }
}
