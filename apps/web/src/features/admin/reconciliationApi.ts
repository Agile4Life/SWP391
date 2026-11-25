import { staffSourceError } from '../operations/staffI18n';
import { apiFetch } from '../../shared/api/client';
import type { PageResult } from './auditApi';

/** Trạng thái lượt thanh toán VNPay: chờ, thành công hoặc thất bại. */
export type AttemptStatus = 'pending' | 'success' | 'failed';
/** Loại đối tượng được thanh toán: gói tập, buổi PT, đơn hàng, khóa học hoặc nạp ví. */
export type TargetType = 'MEMBERSHIP' | 'COACH_BOOKING' | 'PRODUCT_ORDER' | 'COURSE' | 'WALLET_TOPUP';

/** Tham chiếu tới hội viên: id, họ tên, email và số điện thoại. */
export interface MemberRef {
  userId: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Tóm tắt đối soát: lượt chờ/quá hạn, hoàn tiền trễ, sự kiện IPN cần thử lại/bị từ chối, khoản có nhiều lượt và
 * các bất thường.
 */
export interface ReconciliationSummary {
  from: string;
  to: string;
  staleAttempts: number;
  pendingAttempts: number;
  lateRefundCount: number;
  lateRefundAmount: number;
  ipnRetryable: number;
  ipnRejected: number;
  multiAttemptPayments: number;
  anomalies: { successAttemptUnpaid: number; walletPaymentWithoutSource: number; total: number };
}

/**
 * Một dòng lượt thanh toán VNPay: mã tham chiếu, hội viên, số tiền, trạng thái, đối tượng, thời điểm tạo/hết
 * hạn và số lượt.
 */
export interface VnpayAttemptRow {
  reference: string;
  paymentId: number | null;
  member: MemberRef | null;
  amount: number;
  status: AttemptStatus | string;
  stale: boolean;
  paymentStatus: string | null;
  targetType: TargetType | string | null;
  targetId: number | null;
  createdAt: string;
  expiresAt: string;
  gatewayTransactionNo: string | null;
  attemptCount: number;
}

/** Một khoản hoàn tiền trễ vào ví: giao dịch ví, hội viên, số tiền, loại và khoản thanh toán liên quan. */
export interface LateRefundRow {
  walletTransactionId: number;
  createdAt: string;
  member: MemberRef | null;
  amount: number;
  kind: 'VNPAY_LATE_REFUND' | 'ORDER_LATE_REFUND' | string;
  reference: string | null;
  paymentId: number | null;
  paymentStatus: string | null;
}

/** Một sự kiện nhận từ VNPay (IPN hoặc trang trả về): mã phản hồi, trạng thái, số tiền và mã IPN trả lại. */
export interface IpnEventRow {
  id: number;
  reference: string | null;
  source: 'IPN' | 'RETURN' | string;
  gatewayResponseCode: string | null;
  gatewayTransactionStatus: string | null;
  gatewayTransactionNo: string | null;
  amount: number | null;
  rspCode: string;
  receivedAt: string;
}

/**
 * Một mục trong dòng thời gian thanh toán: thời điểm, loại, tham chiếu, trạng thái, mã, nguồn, số tiền và chi
 * tiết.
 */
export interface TimelineEntry {
  at: string | null;
  type: 'PAYMENT_CREATED' | 'ATTEMPT_CREATED' | 'CALLBACK_RECEIVED' | 'WALLET_TRANSACTION' | 'PAYMENT_PAID' | 'INVOICE_ISSUED' | string;
  reference: string | null;
  status: string | null;
  code: string | null;
  source: string | null;
  amount: number | null;
  detail: string | null;
}

/**
 * Dòng thời gian đầy đủ của một khoản thanh toán: thông tin khoản, các lượt VNPay, callback, giao dịch ví và
 * các mục theo thứ tự.
 */
export interface PaymentTimeline {
  payment: {
    id: number;
    member: MemberRef | null;
    amount: number;
    refundedAmount: number | null;
    method: string;
    status: string;
    targetType: string | null;
    targetId: number | null;
    createdAt: string | null;
    paidAt: string | null;
    invoiceNumber: string | null;
  } | null;
  attempts: VnpayAttemptRow[];
  callbacks: IpnEventRow[];
  walletTransactions: { id: number; type: string; referenceType: string | null; referenceId: string | null; amount: number; createdAt: string }[];
  entries: TimelineEntry[];
}

/** Bộ lọc khoảng ngày. */
export interface RangeFilter { from?: string; to?: string }
/** Bộ lọc phân trang. */
export interface PageFilter { page?: number; size?: number }
/** Bộ lọc lượt thanh toán: trạng thái, chỉ lượt quá hạn, từ khóa và khoảng ngày/phân trang. */
export interface AttemptFilter extends RangeFilter, PageFilter { status?: string; stale?: boolean; q?: string }
/** Bộ lọc sự kiện IPN: mã phản hồi, nguồn, tham chiếu và khoảng ngày/phân trang. */
export interface IpnFilter extends RangeFilter, PageFilter { rspCode?: string; source?: string; reference?: string }

const BASE = '/admin/payments/reconciliation';

/** Dựng query string từ các giá trị, bỏ qua giá trị rỗng, undefined hoặc "ALL". */
function query(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'ALL') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Bắt buộc phản hồi là trang dữ liệu hợp lệ (có mảng content), nếu không thì báo lỗi dữ liệu. */
function requirePage<T>(res: PageResult<T> | null | undefined): PageResult<T> {
  if (!res || !Array.isArray(res.content)) {
    throw staffSourceError('Dữ liệu đối soát không hợp lệ.', 'Invalid reconciliation data.');
  }
  return res;
}

/** Gom các hàm API đối soát thanh toán (chỉ ADMIN). */
export const reconciliationApi = {
  /** Lấy tóm tắt đối soát và kiểm tra dữ liệu hợp lệ (GET /admin/payments/reconciliation/summary, quyền ADMIN). */
  getSummary: async (filter: RangeFilter = {}): Promise<ReconciliationSummary> => {
    const res = await apiFetch<ReconciliationSummary>(`${BASE}/summary${query({ from: filter.from, to: filter.to })}`);
    if (!res || typeof res.staleAttempts !== 'number' || !res.anomalies) {
      throw staffSourceError('Dữ liệu đối soát không hợp lệ.', 'Invalid reconciliation data.');
    }
    return res;
  },

  /** Lấy một trang lượt thanh toán VNPay theo bộ lọc (GET /admin/payments/reconciliation/attempts, quyền ADMIN). */
  getAttempts: async (filter: AttemptFilter = {}): Promise<PageResult<VnpayAttemptRow>> =>
    requirePage(await apiFetch<PageResult<VnpayAttemptRow>>(`${BASE}/attempts${query({
      status: filter.status,
      stale: filter.stale ? true : undefined,
      q: filter.q?.trim(),
      from: filter.from,
      to: filter.to,
      page: filter.page ?? 0,
      size: filter.size ?? 20,
    })}`)),

  /** Lấy một trang các khoản hoàn tiền trễ (GET /admin/payments/reconciliation/late-refunds, quyền ADMIN). */
  getLateRefunds: async (filter: RangeFilter & PageFilter = {}): Promise<PageResult<LateRefundRow>> =>
    requirePage(await apiFetch<PageResult<LateRefundRow>>(`${BASE}/late-refunds${query({
      from: filter.from, to: filter.to, page: filter.page ?? 0, size: filter.size ?? 20,
    })}`)),

  /** Lấy một trang sự kiện IPN theo bộ lọc (GET /admin/payments/reconciliation/ipn-events, quyền ADMIN). */
  getIpnEvents: async (filter: IpnFilter = {}): Promise<PageResult<IpnEventRow>> =>
    requirePage(await apiFetch<PageResult<IpnEventRow>>(`${BASE}/ipn-events${query({
      rspCode: filter.rspCode,
      source: filter.source,
      reference: filter.reference?.trim(),
      from: filter.from,
      to: filter.to,
      page: filter.page ?? 0,
      size: filter.size ?? 20,
    })}`)),

  /** Lấy dòng thời gian của một khoản thanh toán (GET /admin/payments/reconciliation/payments/{id}/timeline, quyền ADMIN). */
  getTimeline: async (paymentId: number): Promise<PaymentTimeline> => {
    const res = await apiFetch<PaymentTimeline>(`${BASE}/payments/${paymentId}/timeline`);
    if (!res || !Array.isArray(res.entries)) {
      throw staffSourceError('Dữ liệu dòng thời gian không hợp lệ.', 'Invalid timeline data.');
    }
    return res;
  },
};
