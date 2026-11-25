/**
 * Báo giá nâng cấp gói, cùng quy tắc với backend (`SubscriptionValueCalculator`):
 * phí = giá gói mới hiện tại − giá trị còn lại của kỳ đang dùng.
 *
 * Giá trị còn lại (`remainingValue`) do backend tính từ số tiền hội viên **thực trả** cho kỳ hiện tại theo tỷ lệ ngày
 * chưa dùng, không phải từ giá niêm yết, nên Quản lý đổi giá gói cũ không làm lệch báo giá. Số tiền cuối cùng luôn do
 * backend chốt khi gửi yêu cầu; đây chỉ là bản xem trước.
 */
export interface UpgradeQuote {
  /** Số tiền phải thanh toán; 0 khi không nâng cấp được. */
  amount: number;
  /** Giá trị còn lại của kỳ hiện tại được trừ vào giá gói mới. */
  credit: number;
  /** Số ngày chưa dùng của kỳ hiện tại, tính cả hôm nay. */
  remainingDays: number;
  totalDays: number;
  /** false khi giá trị còn lại đã bằng hoặc vượt giá gói mới. */
  allowed: boolean;
}

const ISO_DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;

/** Số thứ tự ngày (tính từ 1970-01-01 UTC) của chuỗi YYYY-MM-DD (chấp nhận cắt bỏ phần giờ ISO); sai trả null. */
function dayNumber(date: string): number | null {
  if (typeof date !== 'string') return null;
  const match = ISO_DATE_PREFIX_RE.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utcMs / 86_400_000);
}

/**
 * Báo giá nâng cấp gói: tiền phải trả = giá gói mới − giá trị còn lại của gói hiện tại (không âm), kèm số ngày
 * còn lại/tổng số ngày; chỉ cho nâng cấp khi phải trả thêm.
 */
export function upgradeQuote(
  current: { startDate: string; endDate: string; remainingValue?: number | null },
  targetPrice: number,
  today: string,
): UpgradeQuote | null {
  if (typeof current.remainingValue !== 'number' || !Number.isFinite(current.remainingValue)) return null;
  if (typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice < 0) return null;
  const startDay = dayNumber(current.startDate);
  const endDay = dayNumber(current.endDate);
  const todayDay = dayNumber(today);
  if (startDay === null || endDay === null || todayDay === null) return null;
  const totalDays = Math.max(0, endDay - startDay + 1);
  const remainingDays = Math.min(totalDays, Math.max(0, endDay - todayDay + 1));
  const credit = current.remainingValue;
  const amount = targetPrice - credit;
  return { amount: Math.max(0, amount), credit, remainingDays, totalDays, allowed: amount > 0 };
}
