import { apiFetch } from '../../shared/api/client';

/** Một liên hệ chat: id, tên, vai trò, có sẵn sàng không và ảnh đại diện. */
export interface ChatContact { id: number; name: string; role: string; available: boolean; avatarUrl?: string | null }
/** Một hội thoại: người đối thoại, thời điểm tạo/hoạt động cuối, tin cuối và số tin chưa đọc. */
export interface ChatConversation {
  id: number; peer: ChatContact; createdAt: string; lastActivityAt: string;
  /** Chỉ có trong danh sách hội thoại. */
  lastMessage?: string | null; lastMessageMine?: boolean; unreadCount?: number;
}
/**
 * Một tin nhắn: hội thoại, mã tin do client tạo (chống gửi trùng), người gửi, có phải của mình không, nội dung
 * và thời điểm.
 */
export interface ChatMessage {
  id: number; conversationId: number; clientMessageId: string; senderId: number;
  mine: boolean; message: string; createdAt: string;
}
/** Lịch sử tin nhắn: các tin và còn tin cũ hơn không. */
export interface ChatHistory { items: ChatMessage[]; hasMore: boolean }
/** Dữ liệu phân trang chuẩn: nội dung, tổng số trang và trang hiện tại. */
export interface ChatPageData<T> { content: T[]; totalPages: number; number: number }
/** Thông tin phiên realtime: bật hay tắt, người dùng, URL, khóa công khai, kênh và token có hạn. */
export interface ChatRealtimeSession {
  enabled: boolean; userId: number; url?: string; publishableKey?: string;
  topic?: string; token?: string; expiresAt?: string;
}
/** Chuẩn hóa phản hồi phân trang (chấp nhận mảng thuần hoặc dữ liệu phân trang). */
function normalizeChatPage<T>(res: ChatPageData<T> | T[] | null | undefined, page = 0): ChatPageData<T> {
  if (Array.isArray(res)) {
    return { content: res, totalPages: res.length > 0 ? 1 : 0, number: page };
  }
  const content = Array.isArray(res?.content) ? res.content : [];
  return {
    content,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : (content.length > 0 ? 1 : 0),
    number: typeof res?.number === 'number' ? res.number : page,
  };
}
/** Chuẩn hóa lịch sử tin nhắn (chấp nhận mảng thuần hoặc đối tượng items/hasMore). */
function normalizeChatHistory(res: ChatHistory | ChatMessage[] | null | undefined): ChatHistory {
  if (Array.isArray(res)) {
    return { items: res, hasMore: false };
  }
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    hasMore: Boolean(res?.hasMore),
  };
}
/** Lấy một trang hội thoại của người dùng. */
export const getConversations = (page = 0) =>
  apiFetch<ChatPageData<ChatConversation>>(`/chat/conversations?page=${page}`).then(res => normalizeChatPage(res, page));
/** Tìm liên hệ theo từ khóa, phân trang. */
export const getContacts = (query: string, page = 0) =>
  apiFetch<ChatPageData<ChatContact>>(`/chat/contacts?query=${encodeURIComponent(query)}&page=${page}`).then(res => normalizeChatPage(res, page));
/** Mở (hoặc tạo) hội thoại với một liên hệ. */
export const openConversation = (contactId: number) => apiFetch<ChatConversation>('/chat/conversations', { method: 'POST', body: JSON.stringify({ contactId }) });
/** Lấy lịch sử tin nhắn của hội thoại, tải tin cũ hơn (beforeId) hoặc mới hơn (afterId). */
export function getHistory(id: number, cursor: { beforeId?: number; afterId?: number } = {}) {
  const params = new URLSearchParams();
  if (cursor.beforeId !== undefined) params.set('beforeId', String(cursor.beforeId));
  if (cursor.afterId !== undefined) params.set('afterId', String(cursor.afterId));
  return apiFetch<ChatHistory>(`/chat/conversations/${id}/messages${params.size ? `?${params}` : ''}`).then(normalizeChatHistory);
}
/** Gửi tin nhắn kèm mã client để server nhận ra tin gửi lại. */
export const sendMessage = (id: number, message: string, clientMessageId: string) => apiFetch<ChatMessage>(`/chat/conversations/${id}/messages`, {
  method: 'POST', body: JSON.stringify({ message, clientMessageId }),
});

/** Lấy số tin chưa đọc. */
export const getChatUnreadCount = () => apiFetch<{ count: number }>('/chat/unread-count');
/** Đánh dấu đã đọc đến một tin nhắn. */
export const markConversationRead = (id: number, lastMessageId: number) => apiFetch<{ count: number }>(`/chat/conversations/${id}/read`, {
  method: 'POST', body: JSON.stringify({ lastMessageId }),
});

/** Số tin chưa đọc được phát cho nút “Tin nhắn” mỗi khi thay đổi. */
export const CHAT_UNREAD_EVENT = 'sol-chat-unread';
/** Phát sự kiện số tin chưa đọc để nút "Tin nhắn" cập nhật. */
export const announceChatUnread = (count: number) => window.dispatchEvent(new CustomEvent<number>(CHAT_UNREAD_EVENT, { detail: count }));

/** Nhãn vai trò của liên hệ theo ngôn ngữ. */
export const chatRoleLabel = (role: string, t: (vi: string, en: string) => string = vi => vi) => ({ MEMBER: t('Hội viên', 'Member'), RECEPTIONIST: t('Lễ tân', 'Receptionist'), COACH: t('Huấn luyện viên', 'Coach'), AI: t('Trợ lý AI', 'AI assistant') })[role] ?? t('Tài khoản', 'Account');
