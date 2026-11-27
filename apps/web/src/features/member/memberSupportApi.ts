import { apiFetch } from '../../shared/api/client';

/** Phiếu hỗ trợ/khiếu nại: chủ đề, mô tả, trạng thái, người xử lý và thông tin chuyển cấp lên quản lý. */
export interface SupportTicket {
  id: number;
  memberId: number;
  memberName?: string | null;
  assignedTo?: number | null;
  resolvedAt?: string | null;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  assignedToName: string | null;
  /** Được gán khi lễ tân chuyển khiếu nại lên quản lý. */
  escalatedAt?: string | null;
  /** Chỉ dành cho nhân sự: ai đã chuyển cấp và lý do (API ẩn khỏi hội viên). */
  escalatedByName?: string | null;
  escalationReason?: string | null;
  /** Dữ liệu hộp thư lễ tân, tính từ server theo người đang đăng nhập. */
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  lastMessageSenderName?: string | null;
  lastMessageMine?: boolean | null;
}

/** Một tin nhắn trong phiếu hỗ trợ: người gửi, vai trò, nội dung và thời điểm. */
export interface SupportMessage {
  id: number;
  senderId: number;
  senderName: string | null;
  senderRole: string | null;
  message: string;
  createdAt: string;
}

/** Một trang phiếu hỗ trợ: nội dung và tổng số trang. */
interface TicketPage { content: SupportTicket[]; totalPages: number }

/** Lấy phiếu của hội viên đang đăng nhập (20 phiếu mỗi trang). */
export const getMySupportTickets = (page = 0) =>
  apiFetch<TicketPage>(`/support/requests/my?page=${page}&size=20`);

/** Tạo phiếu hỗ trợ mới. */
export const createSupportTicket = (subject: string, description: string) =>
  apiFetch<SupportTicket>('/support/requests', {
    method: 'POST', body: JSON.stringify({ subject, description }),
  });

/** Lấy tin nhắn của một phiếu. */
export const getSupportMessages = (id: number) =>
  apiFetch<SupportMessage[]>(`/support/requests/${id}/messages`);

/** Gửi tin nhắn vào phiếu (kèm mã client chống gửi trùng). */
export const sendSupportMessage = (id: number, message: string, clientMessageId?: string) =>
  apiFetch<SupportMessage>(`/support/requests/${id}/messages`, {
    method: 'POST', body: JSON.stringify({ message, clientMessageId }),
  });

/** Lấy chi tiết một phiếu. */
export const getSupportTicket = (id: number) => apiFetch<SupportTicket>(`/support/requests/${id}`);

/** Lấy hộp thư phiếu của nhân sự, lọc theo trạng thái. */
export const getSupportInbox = (page = 0, status = '', unreadOnly?: boolean, search = '') =>
  apiFetch<TicketPage>(`/support/requests?page=${page}&size=20${status ? `&status=${encodeURIComponent(status)}` : ''}${unreadOnly === undefined ? '' : `&unreadOnly=${unreadOnly}`}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`);

/** Chỉ xác nhận đến tin đã tải thành công; server giữ con trỏ riêng cho từng lễ tân. */
export const markSupportRead = (id: number, lastMessageId: number) =>
  apiFetch<{ unreadCount: number }>(`/support/requests/${id}/read`, { method: 'POST', body: JSON.stringify({ lastMessageId }) });

/** Đổi trạng thái phiếu và người được giao. */
export const updateSupportStatus = (id: number, status: SupportTicket['status'], assignedTo?: number) =>
  apiFetch<SupportTicket>(`/support/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, assignedTo }) });

/**
 * Hội viên rút phiếu đang mở hoặc xác nhận phiếu đã giải quyết.
 */
export const closeSupportTicket = (id: number) =>
  apiFetch<SupportTicket>(`/support/requests/${id}/close`, { method: 'POST' });

/** Lễ tân chuyển khiếu nại lên quản lý kèm lý do. */
export const escalateSupportTicket = (id: number, reason: string) =>
  apiFetch<SupportTicket>(`/support/requests/${id}/escalate`, { method: 'POST', body: JSON.stringify({ reason }) });
