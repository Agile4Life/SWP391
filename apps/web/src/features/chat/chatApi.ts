import { apiFetch } from '../../shared/api/client';

export interface ChatContact { id: number; name: string; role: string; available: boolean; avatarUrl?: string | null }
export interface ChatConversation {
  id: number; peer: ChatContact; createdAt: string; lastActivityAt: string;
  /** Chỉ có trong danh sách hội thoại. */
  lastMessage?: string | null; lastMessageMine?: boolean; unreadCount?: number;
}
export interface ChatMessage {
  id: number; conversationId: number; clientMessageId: string; senderId: number;
  mine: boolean; message: string; createdAt: string;
}
export interface ChatHistory { items: ChatMessage[]; hasMore: boolean }
export interface ChatPageData<T> { content: T[]; totalPages: number; number: number }
export interface ChatRealtimeSession {
  enabled: boolean; userId: number; url?: string; publishableKey?: string;
  topic?: string; token?: string; expiresAt?: string;
}
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
function normalizeChatHistory(res: ChatHistory | ChatMessage[] | null | undefined): ChatHistory {
  if (Array.isArray(res)) {
    return { items: res, hasMore: false };
  }
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    hasMore: Boolean(res?.hasMore),
  };
}
export const getConversations = (page = 0) =>
  apiFetch<ChatPageData<ChatConversation>>(`/chat/conversations?page=${page}`).then(res => normalizeChatPage(res, page));
export const getContacts = (query: string, page = 0) =>
  apiFetch<ChatPageData<ChatContact>>(`/chat/contacts?query=${encodeURIComponent(query)}&page=${page}`).then(res => normalizeChatPage(res, page));
export const openConversation = (contactId: number) => apiFetch<ChatConversation>('/chat/conversations', { method: 'POST', body: JSON.stringify({ contactId }) });
export function getHistory(id: number, cursor: { beforeId?: number; afterId?: number } = {}) {
  const params = new URLSearchParams();
  if (cursor.beforeId !== undefined) params.set('beforeId', String(cursor.beforeId));
  if (cursor.afterId !== undefined) params.set('afterId', String(cursor.afterId));
  return apiFetch<ChatHistory>(`/chat/conversations/${id}/messages${params.size ? `?${params}` : ''}`).then(normalizeChatHistory);
}
export const sendMessage = (id: number, message: string, clientMessageId: string) => apiFetch<ChatMessage>(`/chat/conversations/${id}/messages`, {
  method: 'POST', body: JSON.stringify({ message, clientMessageId }),
});

export const getChatUnreadCount = () => apiFetch<{ count: number }>('/chat/unread-count');
export const markConversationRead = (id: number, lastMessageId: number) => apiFetch<{ count: number }>(`/chat/conversations/${id}/read`, {
  method: 'POST', body: JSON.stringify({ lastMessageId }),
});

/** Số tin chưa đọc được phát cho nút “Tin nhắn” mỗi khi thay đổi. */
export const CHAT_UNREAD_EVENT = 'sol-chat-unread';
export const announceChatUnread = (count: number) => window.dispatchEvent(new CustomEvent<number>(CHAT_UNREAD_EVENT, { detail: count }));

export const chatRoleLabel = (role: string, t: (vi: string, en: string) => string = vi => vi) => ({ MEMBER: t('Hội viên', 'Member'), RECEPTIONIST: t('Lễ tân', 'Receptionist'), COACH: t('Huấn luyện viên', 'Coach'), AI: t('Trợ lý AI', 'AI assistant') })[role] ?? t('Tài khoản', 'Account');
