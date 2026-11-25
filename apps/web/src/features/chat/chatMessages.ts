import { sourceMessage, type SourceMessage } from '../../shared/i18n';

/** Lỗi hiển thị trong chat: Error thật hoặc cặp thông điệp song ngữ. */
export type ChatError = Error | SourceMessage;
/**
 * Giữ nguyên thông điệp lỗi từ server; chỉ chuỗi dự phòng do client sở hữu mới dùng cặp dịch song ngữ.
 */
export function chatError(cause: unknown, vi: string, en: string): ChatError {
  return cause instanceof Error && cause.name === 'Error' && cause.message ? cause : sourceMessage(vi, en);
}
