import { sourceMessage, type SourceMessage } from '../../shared/i18n';

/** Lỗi hiển thị trong chat: Error thật hoặc cặp thông điệp song ngữ. */
export type ChatError = Error | SourceMessage;
/**
 * Giữ nguyên lỗi từ server; chỉ dùng câu dự phòng song ngữ khi không có lỗi riêng.
 *
 * Preserve server messages; only the client-owned fallback has a translation pair.
 */
export function chatError(cause: unknown, vi: string, en: string): ChatError {
  return cause instanceof Error && cause.name === 'Error' && cause.message ? cause : sourceMessage(vi, en);
}
