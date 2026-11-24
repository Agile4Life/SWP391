import { apiFetch } from '../../shared/api/client';

/** Loại đơn từ: nghỉ phép, đổi ca, đổi lịch hoặc khác. */
export type RequestType = 'LEAVE' | 'SHIFT_EXCHANGE' | 'SCHEDULE_CHANGE' | 'OTHER';
/** Trạng thái đơn: chờ duyệt, đã duyệt, từ chối hoặc đã hủy. */
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/**
 * Một đơn từ nội bộ trả về từ backend: người gửi, loại, tiêu đề, lý do, thời gian, ca, trạng thái và ghi chú
 * của quản lý.
 */
export interface StaffInternalRequestDto {
  id: number;
  userId: number;
  userFullName: string;
  userEmail: string;
  userRole: string;
  requestType: RequestType;
  title: string;
  reason: string;
  startDate: string | null;
  endDate: string | null;
  targetShift: string | null;
  replacementUserId: number | null;
  replacementUserFullName: string | null;
  status: RequestStatus;
  managerNotes: string | null;
  reviewedByUserId: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Dữ liệu tạo đơn: loại, tiêu đề, lý do, ngày, ca mong muốn, người thay thế và cờ xác nhận khi nghỉ phép trùng. */
export interface StaffInternalRequestCreatePayload {
  requestType: RequestType;
  title: string;
  reason: string;
  startDate?: string | null;
  endDate?: string | null;
  targetShift?: string | null;
  replacementUserId?: number | null;
  /** Send a leave even though it overlaps a pending/approved one (after the user confirmed the warning). */
  confirmOverlap?: boolean;
}

/** Dữ liệu duyệt đơn: kết quả (duyệt/từ chối) và ghi chú của quản lý. */
export interface StaffInternalRequestReviewPayload {
  status: 'APPROVED' | 'REJECTED';
  managerNotes?: string;
}

/** Gửi một đơn từ mới. */
export async function createStaffRequest(payload: StaffInternalRequestCreatePayload): Promise<StaffInternalRequestDto> {
  return apiFetch<StaffInternalRequestDto>('/operations/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Lấy đơn từ của chính người dùng, lọc theo trạng thái (tùy chọn). */
export async function getMyStaffRequests(status?: string): Promise<StaffInternalRequestDto[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiFetch<StaffInternalRequestDto[]>(`/operations/requests/my${query}`);
  return res ?? [];
}

/** Hủy một đơn đang chờ của chính mình. */
export async function cancelStaffRequest(id: number): Promise<StaffInternalRequestDto> {
  return apiFetch<StaffInternalRequestDto>(`/operations/requests/${id}/cancel`, {
    method: 'PUT',
  });
}

/** Lấy đơn từ của toàn bộ nhân sự (dành cho quản lý), lọc theo trạng thái và loại. */
export async function getAllStaffRequests(status?: string, type?: string): Promise<StaffInternalRequestDto[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (type) params.append('type', type);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<StaffInternalRequestDto[]>(`/operations/requests${query}`);
  return res ?? [];
}

/** Quản lý duyệt hoặc từ chối một đơn. */
export async function reviewStaffRequest(
  id: number,
  payload: StaffInternalRequestReviewPayload
): Promise<StaffInternalRequestDto> {
  return apiFetch<StaffInternalRequestDto>(`/operations/requests/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

