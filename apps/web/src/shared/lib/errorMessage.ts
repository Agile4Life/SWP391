/**
 * Thông điệp an toàn để hiển thị cho người dùng: giữ lỗi từ API (`ApiError`) và lỗi nghiệp vụ (`new Error('...')`),
 * thay lỗi lập trình (TypeError, SyntaxError…) bằng câu chung để không lộ chi tiết kỹ thuật.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === 'Error' && error.message) return error.message;
  return fallback;
}

/**
 * Giữ nguyên thông báo lỗi nghiệp vụ từ API; chỉ dùng chuỗi dự phòng (thuộc mã nguồn, dịch được) khi lỗi không có
 * nội dung riêng.
 */
export function localizableError(error: unknown, fallback: string): string | Error {
  return error instanceof Error && error.name === 'Error' && error.message ? error : fallback;
}
