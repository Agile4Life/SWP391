import { staffSourceError } from '../operations/staffI18n';
import { apiFetch } from '../../shared/api/client';
import type { PageResult } from './auditApi';

export type AttemptStatus = 'pending' | 'success' | 'failed';
export type TargetType = 'MEMBERSHIP' | 'COACH_BOOKING' | 'COURT_BOOKING' | 'PRODUCT_ORDER' | 'COURSE' | 'WALLET_TOPUP';

export interface MemberRef {
  userId: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
}

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

export interface RangeFilter { from?: string; to?: string }
export interface PageFilter { page?: number; size?: number }
export interface AttemptFilter extends RangeFilter, PageFilter { status?: string; stale?: boolean; q?: string }
export interface IpnFilter extends RangeFilter, PageFilter { rspCode?: string; source?: string; reference?: string }

const BASE = '/admin/payments/reconciliation';

function query(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'ALL') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

function requirePage<T>(res: PageResult<T> | null | undefined): PageResult<T> {
  if (!res || !Array.isArray(res.content)) {
    throw staffSourceError('Dữ liệu đối soát không hợp lệ.', 'Invalid reconciliation data.');
  }
  return res;
}

export const reconciliationApi = {
  /** GET /admin/payments/reconciliation/summary (ADMIN) */
  getSummary: async (filter: RangeFilter = {}): Promise<ReconciliationSummary> => {
    const res = await apiFetch<ReconciliationSummary>(`${BASE}/summary${query({ from: filter.from, to: filter.to })}`);
    if (!res || typeof res.staleAttempts !== 'number' || !res.anomalies) {
      throw staffSourceError('Dữ liệu đối soát không hợp lệ.', 'Invalid reconciliation data.');
    }
    return res;
  },

  /** GET /admin/payments/reconciliation/attempts (ADMIN) */
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

  /** GET /admin/payments/reconciliation/late-refunds (ADMIN) */
  getLateRefunds: async (filter: RangeFilter & PageFilter = {}): Promise<PageResult<LateRefundRow>> =>
    requirePage(await apiFetch<PageResult<LateRefundRow>>(`${BASE}/late-refunds${query({
      from: filter.from, to: filter.to, page: filter.page ?? 0, size: filter.size ?? 20,
    })}`)),

  /** GET /admin/payments/reconciliation/ipn-events (ADMIN) */
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

  /** GET /admin/payments/reconciliation/payments/{id}/timeline (ADMIN) */
  getTimeline: async (paymentId: number): Promise<PaymentTimeline> => {
    const res = await apiFetch<PaymentTimeline>(`${BASE}/payments/${paymentId}/timeline`);
    if (!res || !Array.isArray(res.entries)) {
      throw staffSourceError('Dữ liệu dòng thời gian không hợp lệ.', 'Invalid timeline data.');
    }
    return res;
  },
};
