import { apiFetch } from '../../shared/api/client';

/** Một phiên chat với AI: chủ đề, thời điểm bắt đầu và kết thúc. */
export interface AiChatSession { id: number; memberId: number; topic: string; startedAt: string; endedAt: string | null }
/** Một tin nhắn trong phiên AI: người gửi (hội viên hoặc AI), nội dung và thời điểm. */
export interface AiChatMessage { id: number; sessionId: number; sender: 'member' | 'ai'; message: string; createdAt: string }
/** Kết quả gửi tin cho AI: tin của hội viên, tin trả lời của AI và nội dung trả lời. */
export interface AiChatReply { sessionId: number; memberMessage: AiChatMessage; aiMessage: AiChatMessage; reply: string }
/** Tạo tín hiệu hủy request sau ms mili giây (mặc định 15 giây). */
const timeout = (ms = 15_000) => AbortSignal.timeout(ms);

/** Lấy danh sách phiên chat AI của hội viên. */
export const listAiChatSessions = () => apiFetch<AiChatSession[]>('/ai/chat/sessions', { signal: timeout() });
/** Tạo phiên chat AI mới. */
export const createAiChatSession = () => apiFetch<AiChatSession>('/ai/chat/sessions', {
  method: 'POST', body: '{}', signal: timeout(),
});
/** Lấy lịch sử tin nhắn của một phiên AI. */
export const getAiChatHistory = (id: number) => apiFetch<AiChatMessage[]>(`/ai/chat/sessions/${id}/history`, { signal: timeout() });
/** Gửi tin nhắn cho AI (chờ tối đa 45 giây). */
export const sendAiChatMessage = (id: number, message: string) => apiFetch<AiChatReply>(`/ai/chat/sessions/${id}/messages`, {
  method: 'POST', body: JSON.stringify({ message }), signal: timeout(45_000),
});
