import { centerNowParts } from '../../shared/lib/centerTime';
import { memberText } from './memberI18n';

/** Tên HLV hiển thị: bỏ tiền tố "HLV" (không có tên thì "Huấn luyện viên" / "Coach"). */
export function formatCoachName(name?: string | null): string {
  const cleaned = name ? name.replace(/^HLV\s+/i, '').trim() : '';
  if (!cleaned) return memberText('Huấn luyện viên', 'Coach');
  return cleaned;
}

/** Buổi đã bắt đầu (kể cả đã kết thúc) theo giờ trung tâm (không phụ thuộc múi giờ của trình duyệt). */
export function isSessionStarted(
  booking: { bookingDate: string; startTime: string; status?: string },
  now = centerNowParts(),
): boolean {
  if (booking.status === 'completed') return true;
  if (booking.status === 'cancelled') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.bookingDate) || !/^\d{2}:\d{2}/.test(booking.startTime)) return false;
  return `${booking.bookingDate} ${booking.startTime.slice(0, 5)}` <= `${now.date} ${now.time}`;
}

/** Buổi đã kết thúc theo giờ trung tâm (không phụ thuộc múi giờ của trình duyệt). */
export function isSessionCompleted(
  booking: { bookingDate: string; endTime: string; status?: string },
  now = centerNowParts(),
): boolean {
  if (booking.status === 'completed') return true;
  if (booking.status === 'cancelled') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.bookingDate) || !/^\d{2}:\d{2}/.test(booking.endTime)) return false;
  return `${booking.bookingDate} ${booking.endTime.slice(0, 5)}` <= `${now.date} ${now.time}`;
}
