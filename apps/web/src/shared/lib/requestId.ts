/**
 * Sinh mã định danh cho một thao tác ghi dữ liệu của người dùng; gửi lại cùng mã này khi thử lại sau lỗi mạng để
 * server nhận biết lần thử lại và không áp dụng thao tác hai lần.
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
