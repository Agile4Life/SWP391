import { apiFetch } from '../../shared/api/client';

/** Một thông báo: tiêu đề, nội dung, loại, đối tượng liên quan, đã đọc chưa và đường dẫn hành động. */
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

/** Một trang thông báo: nội dung, số trang và tổng số trang. */
export interface NotificationPage {
  content: MemberNotification[];
  number: number;
  totalPages: number;
}

/** Lấy một trang thông báo (20 mỗi trang); chấp nhận cả mảng thuần. */
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
/** Lấy số thông báo chưa đọc (lỗi dữ liệu thì 0). */
export const getUnreadCount = async () => {
  const res = await apiFetch<{ count?: number } | null>('/notifications/unread-count');
  return typeof res?.count === 'number' ? res.count : 0;
};
/** Đánh dấu một thông báo đã đọc. */
export const markNotificationRead = (id: number) =>
  apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
/** Đánh dấu mọi thông báo đã đọc. */
export const markAllNotificationsRead = () =>
  apiFetch<void>('/notifications/read-all', { method: 'PATCH' });

/**
 * Chỉ chấp nhận đường dẫn nội bộ của portal (không bao giờ mở URL tùy ý từ nội dung thông báo) và đổi đường dẫn
 * cũ/đã bỏ về màn phù hợp theo vai trò; đường dẫn lạ trả null.
 */
export function safeNotificationPath(path: string | null | undefined, role = 'MEMBER'): string | null {
  if (!path || !/^\/[a-z0-9/-]+(?:\?[a-zA-Z0-9_=&%-]+)?(?:#[a-z0-9-]+)?$/.test(path)) return null;
  // Lễ tân chỉ mở màn hiện có; bỏ query/anchor không được màn danh sách hỗ trợ, không đoán ID.
  if (role === 'STAFF' || role === 'RECEPTIONIST') {
    if (path === '/messages' || path === '/messages?tab=support') return path;
    const pathname = path.split(/[?#]/)[0];
    if (pathname === '/staff/support') return '/messages?tab=support';
    if (/^\/staff\/(?:orders|classes|pt-attendance|attendance)(?:\/|$)/.test(pathname)) return '/staff/reception';
    return ['/staff/reception', '/staff/check-in', '/staff/check-out', '/staff/reception-history',
      '/staff/kyc', '/staff/holds', '/staff/requests'].includes(pathname) ? pathname : null;
  }
  // Thông báo đơn hàng cũ dẫn về lịch sử giao dịch, không mở màn Shop đã bỏ.
  if (role === 'MEMBER' && /^\/member\/(?:orders|products|checkout)(?:[?/#]|$)/.test(path)) return '/member/invoices';
  // Thông báo Streak cũ về Dashboard; bỏ anchor cũ để mở trang Giáo án hiện tại.
  if (role === 'MEMBER' && /^\/member\/streak(?:[?/#]|$)/.test(path)) return '/member/dashboard';
  if (role === 'MEMBER' && /^\/member\/progress(?:[?/#]|$)/.test(path)) return '/member/progress';
  // Chuẩn hóa param cũ ?tab=coach_booking của thông báo chuyển HLV PT sang ?tab=pt.
  if (role === 'MEMBER' && path === '/member/classes?tab=coach_booking') return '/member/classes?tab=pt';
  // Thông báo chỉ số cơ thể cũ của HLV về Soạn giáo án; liên kết điểm danh lớp nhóm giữ nguyên sessionId.
  if (role === 'COACH' && /^\/coach\/health-metrics(?:[?/#]|$)/.test(path)) return '/coach/training-plans';
  if (role === 'COACH' && /^\/staff\/attendance(?:\/(\d+))?(?:[?#].*)?$/.test(path)) {
    const match = path.match(/^\/staff\/attendance(?:\/(\d+))?/);
    return match?.[1] ? `/coach/attendance/${match[1]}` : '/coach/attendance';
  }
  if (role === 'COACH' && path === '/staff/coach-classes') return '/coach/classes';
  // Liên kết cũ /staff/classes của Quản lý dẫn thẳng sang màn Quản lý lớp học mới.
  if (['MANAGER', 'CENTER_MANAGER'].includes(role) && /^\/staff\/classes(?:[?/#]|$)/.test(path)) return '/manager/classes';
  const prefix = role === 'COACH' ? '/coach/' : ['STAFF', 'RECEPTIONIST'].includes(role) ? '/staff/' : ['MANAGER', 'CENTER_MANAGER'].includes(role) ? '/manager/' : role === 'ADMIN' ? '/admin/' : '/member/';
  return path.startsWith(prefix) ||
    path.startsWith('/member/profile') ||
    (role === 'COACH' && (path === '/staff/requests' || path.startsWith('/staff/requests?'))) ||
    path === '/messages' ||
    path === '/messages?tab=support' ? path : null;
}

export type NotificationTarget = Partial<Pick<MemberNotification, 'relatedEntityType' | 'type' | 'actionPath' | 'title' | 'message'>>;

/**
 * Chọn trang đích khi bấm thông báo: ưu tiên đường dẫn hợp lệ trong thông báo, rồi theo vai trò và loại đối
 * tượng liên quan.
 */
export function notificationDestination(notification: NotificationTarget, role = 'MEMBER'): string {
  const explicit = safeNotificationPath(notification.actionPath, role);
  if (explicit) return explicit;
  if (role === 'COACH' && notification.actionPath === '/staff/classes') {
    return '/coach/classes';
  }

  const rawEntity = (notification.relatedEntityType ?? '').toLowerCase().trim();
  const rawType = (notification.type ?? '').toLowerCase().trim();
  const rawTitle = (notification.title ?? '').toLowerCase().trim();
  const rawMessage = (notification.message ?? '').toLowerCase().trim();
  const text = `${rawTitle} ${rawMessage}`;

  if (role === 'STAFF' || role === 'RECEPTIONIST') {
    // Thông báo yêu cầu mới thiếu actionPath vẫn đi tới màn xử lý hiện có.
    if (['New identity verification request', 'Có hồ sơ KYC mới'].includes(notification.title ?? '')) return '/staff/kyc';
    if (['New membership hold request', 'Có yêu cầu bảo lưu mới'].includes(notification.title ?? '')) return '/staff/holds';
    if (['New trial request', 'Có yêu cầu trải nghiệm mới', 'New counter payment request', 'Có yêu cầu thanh toán mới'].includes(notification.title ?? '')) return '/staff/reception';
    // Ưu tiên metadata thật; lịch sử hiện có chỉ chứa yêu cầu gói đã xử lý và nạp ví.
    if (notification.relatedEntityType === 'support_request' || notification.type === 'support_reply') return '/messages?tab=support';
    if (notification.relatedEntityType === 'payment' || notification.type === 'payment') return '/staff/reception-history';
    if (['staff_internal_request', 'internal_request', 'staff_request', 'leave_request'].includes(rawEntity) || rawType === 'staff_request') {
      return '/staff/requests';
    }
    // Đơn nội bộ hiện gửi system/null, không có actionPath: chỉ nhận đúng tiêu đề VI/EN của backend.
    if (notification.type === 'system' && !notification.relatedEntityType && [
      'Your request was approved', 'Your request was rejected',
      'Đơn từ của bạn đã được duyệt', 'Đơn từ của bạn bị từ chối',
    ].includes(notification.title ?? '')) return '/staff/requests';
    // Thiếu thông tin thì về quầy; không suy luận bản ghi hoặc chức năng từ nội dung tự do.
    return '/staff/reception';
  }

  if (role === 'COACH') {
    // 1. Hỗ trợ / Khiếu nại (ưu tiên metadata hoặc tiêu đề hỗ trợ rõ ràng để không bắt nhầm nội dung tự do)
    if (rawEntity === 'support_request' || rawType === 'support_reply' || /hỗ trợ|khiếu nại|support request|support reply/.test(rawTitle)) {
      return '/messages?tab=support';
    }

    // 2. Đơn từ nội bộ (Nghỉ phép / Đổi ca / Đề xuất)
    if (
      ['staff_internal_request', 'internal_request', 'staff_request', 'leave_request'].includes(rawEntity) ||
      rawType === 'staff_request' ||
      /đơn từ|nội bộ|nghỉ phép|đổi ca|internal request|leave request|shift change|leave_impact|your request was approved|your request was rejected/.test(text)
    ) {
      return '/staff/requests';
    }

    // 3. Điểm danh lớp nhóm vs Điểm danh PT 1:1
    if (
      rawEntity === 'session_attendance' ||
      (rawEntity === 'attendance' && /lớp|class/.test(text))
    ) {
      return '/coach/attendance';
    }
    if (
      ['session_evaluation', 'pt_attendance', 'attendance', 'evaluation'].includes(rawEntity) ||
      rawType === 'evaluation' ||
      /điểm danh|attendance|buổi tập pt|đánh giá buổi tập|đánh giá tiến độ|nhận xét buổi tập|progress evaluation/.test(text)
    ) {
      return '/coach/pt-attendance';
    }

    // 4. Chỉ số sức khỏe cũ -> chuyển về màn Soạn giáo án còn giữ (không trỏ màn đã bỏ /coach/health-metrics)
    if (
      ['health_metric', 'health_metrics', 'member_metrics'].includes(rawEntity) ||
      /chỉ số sức khỏe|chỉ số thể chất|health metric|bmi|inbody|số đo/.test(text)
    ) {
      return '/coach/training-plans';
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

    // 6. Đánh giá từ học viên / Vinh danh cũ -> về hồ sơ cá nhân
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

  if (['MANAGER', 'CENTER_MANAGER'].includes(role)) {
    if (rawEntity === 'support_request' || rawType === 'support_reply') return '/messages?tab=support';
    if (
      ['staff_internal_request', 'internal_request', 'staff_request'].includes(rawEntity) ||
      /đơn từ|nội bộ|nghỉ phép|đổi ca|đề xuất|internal request|leave request/.test(text)
    ) {
      return '/manager/requests';
    }
    if (
      ['class_session', 'class_enrollment'].includes(rawEntity) ||
      ['schedule_change', 'class_reminder'].includes(rawType)
    ) {
      return '/manager/classes';
    }
    if (['coach_booking', 'pt_booking', 'coach_assignment'].includes(rawEntity)) {
      return '/manager/coach-assignments';
    }
    return '/manager/reports';
  }

  if (role === 'ADMIN') return '/admin/users';

  switch (rawEntity) {
    case 'class_session':
    case 'class_enrollment': return '/member/classes';
    case 'coach_booking':
    case 'pt_booking': return '/member/classes?tab=pt';
    case 'membership_subscription': return '/member/packages';
    case 'payment': return '/member/invoices';
    case 'product_order': return '/member/invoices';
    case 'support_request': return '/messages?tab=support';
    case 'training_plan': return '/member/progress';
    default:
      if (rawType === 'class_reminder' || rawType === 'schedule_change') return '/member/classes';
      if (rawType === 'booking') {
        return /pt|1:1|1-1|huấn luyện viên|coach/.test(text) ? '/member/classes?tab=pt' : '/member/classes';
      }
      if (rawType === 'package_expiry') return '/member/packages';
      if (rawType === 'payment') return '/member/invoices';
      if (rawType === 'order') return '/member/invoices';
      if (rawType === 'support_reply') return '/messages?tab=support';
      if (/đánh giá|nhận xét|evaluation|tiến độ|progress/.test(text)) return '/member/progress';
      return '/member/dashboard';
  }
}
