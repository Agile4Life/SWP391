import { apiFetch, apiFetchBlob } from '../../shared/api/client';

/** Trạng thái yêu cầu bảo lưu: chờ duyệt, đã duyệt, từ chối hoặc hoàn tất. */
export type HoldStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

/** Một tài liệu đính kèm yêu cầu bảo lưu: tên, loại, dung lượng và thời điểm tải lên. */
export interface HoldDocument {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * Chính sách bảo lưu: có được bảo lưu không, đã dùng chưa, số ngày tối thiểu/tối đa, báo trước bao nhiêu giờ,
 * số và dung lượng tài liệu tối đa.
 */
export interface HoldPolicy {
  allowed: boolean;
  alreadyUsed: boolean;
  minDays: number;
  maxDays: number;
  noticeHours: number;
  maxDocuments: number;
  maxDocumentBytes: number;
}

/**
 * Một yêu cầu bảo lưu hoặc dòng lịch sử hiển thị cho hội viên và nhân viên quầy lễ tân: hội viên, gói, thời
 * gian, trạng thái, lý do, thời điểm xử lý, số lớp bị hủy và tài liệu.
 */
export interface HoldDetail {
  id: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string | null;
  memberEmail: string | null;
  memberPhone: string | null;
  packageId: number | null;
  packageName: string | null;
  startDate: string;
  endDate: string;
  status: string;
  holdStatus: HoldStatus | null;
  holdReason: string | null;
  holdRejectionReason?: string | null;
  holdRequestedAt: string | null;
  holdResolvedAt: string | null;
  cancelledEnrollmentsCount: number;
  holdStartDate: string | null;
  holdEndDate: string | null;
  documents: HoldDocument[];
}

/** Dữ liệu hội viên gửi khi xin bảo lưu: lý do, khoảng ngày và các tệp đính kèm. */
export interface HoldSubmission {
  reason: string;
  startDate: string;
  endDate: string;
  files: File[];
}

const base = '/memberships/subscriptions';

/** Lấy chính sách bảo lưu áp dụng cho một gói. */
export const getHoldPolicy = (subscriptionId: number) =>
  apiFetch<HoldPolicy>(`${base}/${subscriptionId}/hold/policy`);

/** Lấy yêu cầu bảo lưu hiện có của một gói. */
export const getHoldDetail = (subscriptionId: number) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold`);

/** Gửi yêu cầu bảo lưu (dạng multipart kèm tài liệu). */
export function submitHoldRequest(subscriptionId: number, submission: HoldSubmission) {
  const form = new FormData();
  form.append('reason', submission.reason);
  form.append('startDate', submission.startDate);
  form.append('endDate', submission.endDate);
  submission.files.forEach((file) => form.append('documents', file, file.name));
  return apiFetch<unknown>(`${base}/${subscriptionId}/hold`, { method: 'POST', body: form });
}

/** Hội viên rút yêu cầu bảo lưu của mình. */
export const withdrawHoldRequest = (subscriptionId: number) =>
  apiFetch<unknown>(`${base}/${subscriptionId}/hold`, { method: 'DELETE' });

/** Lấy danh sách yêu cầu bảo lưu theo trạng thái (dành cho lễ tân/quản lý). */
export const listHolds = (status: HoldStatus | 'ALL') =>
  apiFetch<HoldDetail[]>(`${base}/holds?status=${status}`);

/** Duyệt yêu cầu bảo lưu. */
export const approveHold = (subscriptionId: number) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold/approve`, { method: 'POST' });

/** Từ chối yêu cầu bảo lưu kèm lý do. */
export const rejectHold = (subscriptionId: number, reason: string) =>
  apiFetch<HoldDetail>(`${base}/${subscriptionId}/hold/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

/**
 * Tải tài liệu y tế riêng tư của yêu cầu bảo lưu: luôn tải kèm session token rồi mở blob, không liên kết trực tiếp.
 */
export const fetchHoldDocument = (subscriptionId: number, documentId: number) =>
  apiFetchBlob(`${base}/${subscriptionId}/hold/documents/${documentId}`);

/**
 * Lễ tân rút yêu cầu bảo lưu thay cho hội viên yêu cầu tại quầy (đang chờ duyệt hoặc đã duyệt nhưng chưa bắt đầu).
 */
export const withdrawHoldForMember = (subscriptionId: number) =>
  apiFetch<unknown>(`${base}/${subscriptionId}/hold/withdraw`, { method: 'POST' });
