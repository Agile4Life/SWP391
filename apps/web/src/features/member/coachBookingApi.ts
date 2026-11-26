import { apiFetch } from '../../shared/api/client';

/** Thông tin công khai của HLV: liên hệ, chuyên môn, giới thiệu, chứng chỉ, ảnh và giá mỗi slot. */
export interface CoachPublicDto {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  bio: string;
  certification: string;
  avatarUrl: string | null;
  defaultHourlyRate: number;
}

/**
 * Một khung giờ PT trong 5 Slot cố định (07:00 – 20:30): số Slot, giờ bắt đầu/kết thúc, còn trống không và lý do nếu bận.
 */
export interface CoachAvailableSlotDto {
  slotNumber?: number; // 1..5
  startTime: string;   // "07:00"
  endTime: string;     // "09:30"
  available: boolean;
  reason: 'too_soon' | 'coach_busy' | 'member_busy' | 'coach_on_leave' | null;
}

/** Một buổi PT 1:1: hội viên, HLV, bộ môn, ngày giờ, giá, thanh toán, trạng thái, thông tin hủy và điểm danh. */
export interface CoachBookingDto {
  id: number;
  memberId: number;
  memberName: string;
  coachId: number;
  coachName: string;
  coachSpecialization: string;
  coachAvatarUrl: string | null;
  disciplineId: number | null;
  disciplineName: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  paymentMethod: string;
  paymentStatus: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Thời điểm hội viên được ghi nhận có mặt (quét cổng trong buổi tập); null nếu chưa được ghi nhận. */
  attendedAt?: string | null;
  /** Nhân viên đã gỡ dấu điểm danh; lượt quét và tác vụ quét tự động không được khôi phục lại. */
  attendanceLocked?: boolean;
  /** Lượt check-in tại cổng trùng khung giờ buổi tập (chỉ có trong danh sách điểm danh); chỉ là gợi ý, không phải xác nhận điểm danh. */
  gateCheckinAt?: string | null;
  membershipCode?: string | null;
  memberPhone?: string | null;
  memberEmail?: string | null;
}

/** Dữ liệu đặt buổi PT: HLV, bộ môn, ngày, giờ, phương thức thanh toán và ghi chú. */
export interface CoachBookingCreatePayload {
  coachId: number;
  disciplineId?: number | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod?: string;
  notes?: string;
}

/** Tình trạng hạn mức PT của hội viên: gói, số buổi/tháng, đã dùng và còn lại. */
export interface CoachQuotaStatusDto {
  packageName: string | null;
  monthlyQuota: number;
  usedThisMonth: number;
  remainingQuota: number;
}

/** Lấy danh sách HLV có thể đặt. */
export async function getCoaches(): Promise<CoachPublicDto[]> {
  const res = await apiFetch<CoachPublicDto[]>('/coach-bookings/coaches');
  return res ?? [];
}

/** Lấy các khung giờ của HLV trong một ngày. */
export async function getAvailableSlots(coachId: number, date: string): Promise<CoachAvailableSlotDto[]> {
  const res = await apiFetch<CoachAvailableSlotDto[]>(`/coach-bookings/available-slots?coachId=${coachId}&date=${date}`);
  return res ?? [];
}

/** Đặt một buổi PT 1:1. */
export async function createCoachBooking(payload: CoachBookingCreatePayload): Promise<CoachBookingDto> {
  return apiFetch<CoachBookingDto>('/coach-bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Lấy các buổi PT của hội viên đang đăng nhập. */
export async function getMyCoachBookings(): Promise<CoachBookingDto[]> {
  const res = await apiFetch<CoachBookingDto[]>('/coach-bookings/my');
  return res ?? [];
}

/** Hủy một buổi PT kèm lý do (tùy chọn). */
export async function cancelCoachBooking(bookingId: number, reason?: string): Promise<CoachBookingDto> {
  const url = reason
    ? `/coach-bookings/${bookingId}?reason=${encodeURIComponent(reason)}`
    : `/coach-bookings/${bookingId}`;
  return apiFetch<CoachBookingDto>(url, {
    method: 'DELETE',
  });
}

/** Lấy hạn mức PT của hội viên. */
export async function getMemberQuotaStatus(): Promise<CoachQuotaStatusDto> {
  return apiFetch<CoachQuotaStatusDto>('/coach-bookings/quota-status');
}

/** Lấy lịch dạy kèm 1:1 của HLV đang đăng nhập. */
export async function getCoachSchedule(): Promise<CoachBookingDto[]> {
  const res = await apiFetch<CoachBookingDto[]>('/coach-bookings/coach-schedule');
  return res ?? [];
}
