import { z } from 'zod';

const KEY = 'scms_pending_registration';
const pendingSchema = z.object({
  username: z.string().min(3), email: z.string().email(),
  createdAt: z.number().finite(), resendAt: z.number().finite(),
});
/** Dữ liệu đăng ký đang chờ xác thực OTP: tên đăng nhập, email và mốc thời gian tạo/được gửi lại. */
export type PendingRegistration = z.infer<typeof pendingSchema>;

/** Đọc đăng ký đang chờ từ sessionStorage; dữ liệu hỏng, ở tương lai hoặc quá 24 giờ thì xóa. */
export function readPendingRegistration(): PendingRegistration | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(sessionStorage.getItem(KEY) || 'null'));
    if (parsed.success && parsed.data.createdAt <= Date.now() && Date.now() - parsed.data.createdAt < 86_400_000) return parsed.data;
    sessionStorage.removeItem(KEY);
  } catch { /* Verification still works when browser storage is unavailable. */ }
  return null;
}

/** Lưu (hoặc xóa khi null) đăng ký đang chờ vào sessionStorage. */
export function savePendingRegistration(value: PendingRegistration | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch { /* The current screen keeps its in-memory state. */ }
}
