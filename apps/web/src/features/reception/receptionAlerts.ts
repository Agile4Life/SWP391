import type { MemberNotification } from '../member/notificationsApi';
import { notificationDestination } from '../member/notificationsApi';

/** Mỗi lần đăng nhập chỉ lấy mốc; polling/refresh không phát lại thông báo cũ hoặc đã đọc. */
export function createReceptionAlertTracker() {
  let latest: number | null = null;
  return (items: MemberNotification[]) => {
    const previous = latest;
    latest = Math.max(latest ?? 0, ...items.map(item => item.id));
    if (previous === null) return [];
    return items.filter(item => item.id > previous && !item.isRead &&
      (item.actionPath?.startsWith('/staff/') || item.actionPath === '/messages?tab=support' || item.relatedEntityType === 'support_request' || ['Có hồ sơ KYC mới', 'New identity verification request', 'Có yêu cầu bảo lưu mới', 'New membership hold request', 'Có yêu cầu trải nghiệm mới', 'New trial request', 'Có yêu cầu thanh toán mới', 'New counter payment request'].includes(item.title)) &&
      ['/staff/kyc', '/staff/holds', '/staff/reception', '/staff/requests', '/messages?tab=support'].includes(notificationDestination(item, 'STAFF')));
  };
}
