import { apiFetch } from '../../shared/api/client';

/** Khóa học/lớp học nhóm hiển thị cho hội viên. */
export interface GymClassDto {
  id: number;
  name: string;
  disciplineId: number;
  disciplineName: string;
  coachId: number;
  coachName: string;
  roomId: number;
  roomName: string;
  capacity: number;
  level: string;
  description: string | null;
  status: string;
  price?: number;
  startDate?: string;
  endDate?: string;
  recurringDays?: string;
  startTime?: string;
  endTime?: string;
}

/** Hạn mức đăng ký khóa học theo hạng gói tập của hội viên. */
export interface QuotaDto {
  tier: string | null;
  totalCredits: number | null;
  usedCredits: number;
  remainingCredits: number;
  unlimited: boolean;
  /** Ngày hết hạn bị chặn đăng ký khóa mới nếu hội viên vắng mặt phần lớn khóa trước. */
  enrollBlockedUntil?: string | null;
  /** Mức giảm học phí ngoài gói theo hạng thẻ: 0, 10 (Gold) hoặc 20 (Platinum). */
  discountPercent?: number;
}

/** Kết quả đăng ký/thanh toán một khóa học định kỳ. */
export interface CourseCheckoutResult {
  enrollmentId: number;
  paymentId: number | null;
  classId: number;
  className: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentUrl?: string | null;
  holdUntil?: string | null;
}

/** Một buổi học của lớp nhóm. */
export interface ClassSessionDto {
  id: number;
  classId: number;
  className: string;
  disciplineId: number;
  disciplineName: string;
  coachId: number;
  coachName: string;
  roomId: number;
  roomName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  cancelReason: string | null;
  capacity: number;
  bookedCount: number;
}

/** Một lượt ghi danh khóa học của hội viên. */
export interface EnrollmentDto {
  id: number;
  classId: number;
  className: string;
  memberId: number;
  sessionId: number | null;
  sessionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  enrolledAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalSessions?: number | null;
  attendedSessions?: number | null;
  remainingSessions?: number | null;
}

/** Lấy toàn bộ danh sách khóa học nhóm đang mở (không lọc cứng theo tên bộ môn). */
export const getClasses = () => apiFetch<GymClassDto[]>('/classes');

/** Buổi học trong khoảng ngày tùy ý (thời khóa biểu tuần/tháng). */
export const getSessionsBetween = (fromDate: string, toDate: string) =>
  apiFetch<ClassSessionDto[]>(`/classes/sessions?fromDate=${fromDate}&toDate=${toDate}`);

export const getMyEnrollments = () => apiFetch<EnrollmentDto[]>('/classes/enrollments/my');

export const getMyQuota = () => apiFetch<QuotaDto>('/classes/my-quota');
export const enrollCourse = (classId: number) => apiFetch<EnrollmentDto>(`/classes/${classId}/enroll`, { method: 'POST' });
export const cancelCourse = (classId: number) => apiFetch<EnrollmentDto>(`/classes/${classId}/enroll`, { method: 'DELETE' });
export const checkoutCourse = (classId: number, method = 'cash') =>
  apiFetch<CourseCheckoutResult>(`/classes/${classId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ method }),
  });
