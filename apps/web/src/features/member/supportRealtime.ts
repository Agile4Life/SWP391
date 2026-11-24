import { subscribeChat, type ChatConnection } from '../chat/chatRealtime';

/**
 * Đăng ký realtime cho hộp thư hỗ trợ hoặc một phiếu cụ thể, dùng lại kênh của chat với phiên được cấp quyền
 * riêng.
 *
 * Reuse the private DM transport, with a separately authorized ticket/inbox session.
 */
export function subscribeSupport(changed: () => void, status: (state: ChatConnection) => void, ticketId?: number) {
  const path = ticketId == null ? '/support/requests/realtime-session' : `/support/requests/${ticketId}/realtime-session`;
  return subscribeChat(changed, status, path);
}
