import { apiFetch } from '../../shared/api/client';
import { catalogApi, type MembershipPackage } from '../manager/catalogApi';
import type { CoachBookingDto } from '../member/coachBookingApi';
import { staffText } from '../operations/staffI18n';
export type { MembershipPackage };
/** Buổi PT 1:1 chưa thu tiền (dùng chung kiểu booking). */
export type UnpaidCoachBooking = CoachBookingDto;

/** Ghi danh khóa học nhóm chờ thu học phí tại quầy lễ tân (tiền mặt hoặc chuyển khoản). */
export interface UnpaidCourseEnrollmentItem {
  enrollmentId: number;
  paymentId: number;
  classId: number;
  className: string;
  disciplineName: string;
  startDate: string | null;
  endDate: string | null;
  memberId: number;
  memberName: string;
  memberPhone?: string | null;
  membershipCode?: string | null;
  amount: number;
  method: string;
  createdAt: string;
}

/** Kết quả tra cứu hội viên: mã thẻ, họ tên, liên hệ, trạng thái và gói hiện tại. */
export interface MemberLookupResult {
  userId: number;
  membershipCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  citizenId?: string | null;
  identityVerified?: boolean;
  kycStatus?: string | null;
  approvedTrial?: boolean;
  documentType?: string | null;
  status: string;
  currentPackage?: string;
  endDate?: string;
}

/** Một đơn dùng thử chờ duyệt: hội viên, loại và số giấy tờ (đã che), họ tên trên giấy tờ và quốc tịch. */
export interface ReceptionTrialItem {
  id: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string;
  memberEmail: string;
  memberPhone: string | null;
  documentType: 'CCCD' | 'PASSPORT';
  documentNumberMasked: string;
  /** Số giấy tờ đầy đủ, chỉ hiển thị khi yêu cầu đang chờ duyệt. */
  documentNumber?: string | null;
  documentFullName: string;
  nationality?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  subscriptionId?: number | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  subscriptionStatus?: string | null;
}

/**
 * Một dòng lịch sử yêu cầu gói tập quầy lễ tân đã xử lý (GET /memberships/subscriptions/requests/history): loại
 * (đăng ký, gia hạn, nâng cấp), kết quả, hội viên, gói, số tiền và phương thức.
 */
export interface RequestHistoryItem {
  subscriptionId: number;
  type: 'REGISTER' | 'RENEW' | 'UPGRADE';
  outcome: 'APPROVED' | 'CANCELLED';
  memberId: number;
  membershipCode: string | null;
  memberName: string;
  packageName: string | null;
  previousPackageName: string | null;
  amount: number | null;
  paymentMethod: string | null;
  processedAt: string | null;
  processedByName: string | null;
}

/**
 * Một lần nạp ví tại quầy lễ tân (GET /wallet/counter-topups): hội viên, số tiền, phương thức, thời điểm và người nhận.
 */
export interface CounterTopupHistoryItem {
  paymentId: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: string | null;
  receivedByName: string | null;
}

/** Một yêu cầu gói tập chờ thanh toán: hội viên, gói, thời hạn, giá, thời gian và trạng thái. */
export interface PendingSubscriptionItem {
  previousSubscriptionId?: number | null;
  id: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string;
  memberEmail: string;
  memberPhone: string | null;
  packageId: number;
  packageName: string;
  durationDays: number;
  packagePrice: number;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

/** Một kỳ gói có thể gia hạn: gói, thời gian, trạng thái, kỳ trước và giá trị còn lại. */
export interface RenewalCandidate {
  id: number;
  memberId: number;
  packageId: number;
  packageName: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  /** Có sẵn trong SubscriptionDto: nối tới kỳ trước để xác định đúng cuối chuỗi gia hạn. */
  previousSubscriptionId?: number | null;
  /** Kỳ đang hiệu lực hôm nay: phần chưa dùng của số tiền thực trả, cũng là số tiền hoàn đề xuất khi hủy gói. */
  remainingValue?: number | null;
}

/** Một yêu cầu bảo lưu gói: hội viên, gói, thời gian, trạng thái, lý do và thời điểm yêu cầu. */
export interface HoldRequestItem {
  id: number;
  memberId: number;
  membershipCode: string | null;
  memberName: string;
  memberEmail: string;
  memberPhone: string | null;
  packageId: number;
  packageName: string;
  startDate: string;
  endDate: string;
  status: string;
  holdStatus: string;
  holdReason: string;
  holdRequestedAt: string;
  holdResolvedAt?: string | null;
  cancelledEnrollmentsCount: number;
}

/** Dữ liệu yêu cầu hủy gói do lễ tân tạo: hội viên, gói, lý do và số tiền hoàn. */
export interface StaffCancellationRequestPayload {
  memberId: number;
  subscriptionId?: number;
  reason: string;
  refundAmount?: number;
}

/** Một yêu cầu hủy gói: hội viên, gói, lý do, trạng thái duyệt và người xử lý. */
export interface CancellationRequestItem {
  id: number;
  memberId: number;
  memberName: string | null;
  subscriptionId: number;
  packageName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedById?: number | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  refundAmount?: number | null;
  requestedById?: number | null;
  requestedByName?: string | null;
}

/** Phương thức thu tiền: tiền mặt, POS, chuyển khoản hoặc ví. */
export type PaymentMethod = 'cash' | 'pos' | 'bank_transfer' | 'online_wallet';

/** Dữ liệu thu tiền gói tập: hội viên, gói, số tiền, phương thức và ghi chú. */
export interface ProcessPaymentPayload {
  memberId: number;
  packageId: number;
  subscriptionId?: number;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

/** Kết quả thanh toán: id, hội viên, số tiền, phương thức, trạng thái, thời điểm và số hóa đơn. */
export interface PaymentResponseDto {
  id: number;
  memberId: number;
  memberName?: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  invoiceNumber?: string;
}

/** Tóm tắt biên lai của một khoản thanh toán: trạng thái và ảnh biên lai (nếu có). */
export interface PaymentReceiptSummary {
  id: number;
  subscriptionId: number | null;
  status: string;
  hasReceipt?: boolean;
  receiptImage?: string | null;
}

/** Hóa đơn: số hóa đơn, tiền trước thuế, thuế, tổng tiền, ngày xuất và link PDF. */
export interface InvoiceDto {
  id: number;
  invoiceNumber: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt: string;
  pdfUrl?: string | null;
}

/**
 * BR-05: Che một phần (masked) dữ liệu nhạy cảm CCCD (ví dụ: 079******123)
 */
export function maskCitizenId(id?: string | null): string {
  if (!id) return staffText('Chưa cập nhật', 'Not updated');
  const clean = id.trim();
  if (clean.length < 6) return '******';
  const start = clean.slice(0, 3);
  const end = clean.slice(-3);
  return `${start}******${end}`;
}

/** Gom các hàm API nghiệp vụ lễ tân. */
export const receptionApi = {
  /**
   * Tra cứu hội viên theo SĐT, Mã hội viên hoặc CCCD qua /api/v1/members/lookup
   */
  lookupMembers: async (query: string): Promise<MemberLookupResult[]> => {
    const q = query.trim();
    if (q.length < 2) return [];
    // Chỉ dùng API tra cứu đúng quyền; để UI nhận lỗi thay vì tạo hội viên giả hoặc trả danh sách rỗng.
    return apiFetch<MemberLookupResult[]>(`/members/lookup?q=${encodeURIComponent(q)}`);
  },

  /**
   * BR-02: Lấy danh sách gói tập chỉ bao gồm các gói đang 'active'
   */
  getActivePackages: async (): Promise<MembershipPackage[]> => {
    const all = await catalogApi.packages();
    return all.filter((p) => p.status === 'active');
  },

  // Lấy các kỳ gói có thể gia hạn của hội viên.
  getRenewalCandidates: (memberId: number): Promise<RenewalCandidate[]> =>
    apiFetch(`/memberships/subscriptions/members/${memberId}/renewal-candidates`),

  // Tạo gia hạn cho một kỳ gói của hội viên.
  createRenewal: (memberId: number, subscriptionId: number): Promise<RenewalCandidate> =>
    apiFetch(`/memberships/subscriptions/members/${memberId}/renew/${subscriptionId}`, { method: 'POST' }),

  /**
   * Lấy danh sách yêu cầu đăng ký/gia hạn/nâng cấp gói tập đang chờ thanh toán (pending_payment)
   */
  getPendingSubscriptions: async (): Promise<PendingSubscriptionItem[]> => {
    return apiFetch<PendingSubscriptionItem[]>('/memberships/subscriptions/pending');
  },

  /** Lịch sử yêu cầu gói tập lễ tân đã xử lý (đã thu tiền hoặc đã hủy) trong `days` ngày gần nhất. */
  getRequestHistory: (days = 30): Promise<RequestHistoryItem[]> =>
    apiFetch<RequestHistoryItem[]>(`/memberships/subscriptions/requests/history?days=${days}`),

  /** Lịch sử nạp tiền vào Ví SÖL tại quầy trong `days` ngày gần nhất. */
  getCounterTopupHistory: (days = 30): Promise<CounterTopupHistoryItem[]> =>
    apiFetch<CounterTopupHistoryItem[]>(`/wallet/counter-topups?days=${days}`),

  /**
   * Hủy yêu cầu đăng ký/gia hạn/nâng cấp gói tập đang chờ thanh toán (pending_payment)
   */
  cancelPendingSubscription: async (subscriptionId: number, reason: string): Promise<void> => {
    await apiFetch(`/memberships/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
  },

  /**
   * Lấy danh sách yêu cầu bảo lưu gói tập đang chờ lễ tân xử lý
   */
  getPendingHoldRequests: async (): Promise<HoldRequestItem[]> => {
    return apiFetch<HoldRequestItem[]>('/memberships/subscriptions/holds/pending');
  },

  /**
   * Lễ tân xác nhận bảo lưu gói tập (tự động hủy các lịch học tương lai của hội viên)
   */
  approveHoldRequest: async (subscriptionId: number): Promise<HoldRequestItem> => {
    return apiFetch<HoldRequestItem>(`/memberships/subscriptions/${subscriptionId}/hold/approve`, {
      method: 'POST',
    });
  },

  /**
   * Lễ tân từ chối yêu cầu bảo lưu gói tập
   */
  rejectHoldRequest: async (subscriptionId: number, reason: string): Promise<HoldRequestItem> => {
    return apiFetch<HoldRequestItem>(`/memberships/subscriptions/${subscriptionId}/hold/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Lễ tân trình yêu cầu hủy gói tập & hoàn tiền lên Quản lý trung tâm phê duyệt
   */
  requestSubscriptionCancellation: async (payload: StaffCancellationRequestPayload): Promise<CancellationRequestItem> => {
    return apiFetch<CancellationRequestItem>('/memberships/cancellations/staff-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Buổi PT 1:1 trả phí theo giờ chưa thu tiền, cũ nhất trước. */
  getUnpaidCoachBookings: (): Promise<UnpaidCoachBooking[]> => apiFetch('/coach-bookings/unpaid'),

  /** Ghi nhận đã thu tiền buổi PT 1:1; backend tạo payment để tính vào doanh thu. */
  confirmCoachBookingPayment: (bookingId: number, method: string): Promise<UnpaidCoachBooking> =>
    apiFetch(`/coach-bookings/${bookingId}/confirm-payment?method=${encodeURIComponent(method)}`, { method: 'POST' }),

  /** Danh sách ghi danh khóa học nhóm chờ thu học phí tại quầy lễ tân. */
  getUnpaidCourseEnrollments: (): Promise<UnpaidCourseEnrollmentItem[]> =>
    apiFetch<UnpaidCourseEnrollmentItem[]>('/classes/enrollments/unpaid'),

  /** Ghi nhận đã thu học phí khóa học nhóm (tiền mặt hoặc chuyển khoản) và trả về hóa đơn đã thanh toán. */
  confirmCourseEnrollmentPayment: (
    enrollmentId: number,
    method: 'cash' | 'bank_transfer',
  ): Promise<PaymentResponseDto> =>
    apiFetch<PaymentResponseDto>(`/classes/enrollments/${enrollmentId}/confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),

  /** Ảnh hóa đơn tiền mặt hội viên đã gửi cho yêu cầu gói tập đang chờ (null nếu chưa có). */
  getPendingReceipt: async (memberId: number, subscriptionId: number): Promise<string | null> => {
    const payments = await apiFetch<PaymentReceiptSummary[]>(`/payments/member/${memberId}`);
    const match = payments.find((p) => p.subscriptionId === subscriptionId && p.status === 'pending' && p.hasReceipt);
    if (!match) return null;
    const detail = await apiFetch<PaymentReceiptSummary>(`/payments/${match.id}`);
    return detail.receiptImage ?? null;
  },

  /**
   * Xác nhận thu tiền qua Payment API (/payments/process) & tự động phát hành hóa đơn
   */
  processPayment: async (payload: ProcessPaymentPayload): Promise<PaymentResponseDto> => {
    const res = await apiFetch<PaymentResponseDto>('/payments/process', {
      method: 'POST',
      body: JSON.stringify({
        memberId: payload.memberId,
        subscriptionId: payload.subscriptionId,
        packageId: payload.packageId,
        amount: payload.amount,
        method: payload.method,
        note: payload.notes || staffText('Thu tiền tại quầy Lễ tân POS', 'Front desk POS payment'),
      }),
    });

    return res;
  },

  /**
   * Lễ tân lấy danh sách đơn đăng ký Gói Trải Nghiệm 3 Ngày (mặc định chờ duyệt)
   */
  getPendingTrials: async (search?: string): Promise<ReceptionTrialItem[]> => {
    const params = new URLSearchParams({ status: 'PENDING_APPROVAL' });
    if (search) params.set('search', search);
    return apiFetch<ReceptionTrialItem[]>(`/reception/trials?${params.toString()}`);
  },

  /**
   * Lễ tân phê duyệt đơn đăng ký gói trải nghiệm: kích hoạt 3 ngày & đồng bộ tên tài khoản
   */
  approveTrial: async (trialId: number): Promise<ReceptionTrialItem> => {
    return apiFetch<ReceptionTrialItem>(`/reception/trials/${trialId}/approve`, {
      method: 'POST',
    });
  },

  /**
   * Lễ tân từ chối đơn đăng ký gói trải nghiệm kèm lý do
   */
  rejectTrial: async (trialId: number, reason: string): Promise<ReceptionTrialItem> => {
    return apiFetch<ReceptionTrialItem>(`/reception/trials/${trialId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Lấy số dư & lịch sử Ví SÖL của hội viên tại quầy Lễ tân
   */
  getMemberWallet: async (memberId: number): Promise<{ balance: number; updatedAt?: string }> => {
    return apiFetch<{ balance: number; updatedAt?: string }>(`/wallet/members/${memberId}`);
  },

  /**
   * Lễ tân nạp/cộng tiền trực tiếp vào Ví SÖL cho hội viên tại quầy
   */
  topupMemberWallet: async (
    memberId: number,
    payload: { amount: number; paymentMethod: string; note?: string; clientRequestId?: string }
  ): Promise<{ balance: number; updatedAt?: string }> => {
    return apiFetch<{ balance: number; updatedAt?: string }>(`/wallet/members/${memberId}/topup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
