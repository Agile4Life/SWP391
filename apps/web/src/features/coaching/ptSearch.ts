import type { CoachBookingDto } from '../member/coachBookingApi';

/** Chuẩn hóa chuỗi để so khớp: chữ thường, bỏ dấu và đổi đ thành d. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/**
 * Buổi kèm có khớp từ khóa không: tên (không phân biệt dấu), mã thẻ, đúng #id, số điện thoại hoặc email.
 *
 * Matches a 1:1 booking by member name (accent-insensitive), card code, exact #id, phone or email.
 */
export function matchPtSearch(b: CoachBookingDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (fold(b.memberName ?? '').includes(fold(q))) return true;
  if ((b.membershipCode ?? '').toLowerCase().includes(q)) return true;
  // Exact only: a substring test on "#12" would match every row for "#" or "1".
  if (b.memberId != null && (q === String(b.memberId) || q === `#${b.memberId}`)) return true;
  const qPhone = q.replace(/\s+/g, '');
  if (qPhone && (b.memberPhone ?? '').replace(/\s+/g, '').includes(qPhone)) return true;
  return (b.memberEmail ?? '').toLowerCase().includes(q);
}
