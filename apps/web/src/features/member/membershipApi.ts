import { apiFetch } from '../../shared/api/client';

/** Gói tập: giá, thời hạn, giới hạn credit lớp và trạng thái. */
export interface MembershipPackage {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  classCreditLimit: number | null;
  status: 'active' | 'inactive';
}

/** Gói đăng ký của hội viên: gói, thời gian, giá/credit khi nâng cấp, trạng thái, mã QR và thông tin bảo lưu. */
export interface MemberSubscription {
  id: number;
  memberId: number;
  packageId: number;
  packageName: string;
  previousSubscriptionId: number | null;
  startDate: string;
  endDate: string;
  paidThroughDate?: string | null;
  /** Quoted amount of a pending upgrade: new package price minus `creditApplied`; null for other subscriptions. */
  upgradeCharge?: number | null;
  /** Pending registration or renewal: catalog price fixed when the request was made; null for older requests. */
  quotedPrice?: number | null;
  /** Pending upgrade: unused value of the replaced period already deducted from the price. */
  creditApplied?: number | null;
  /** Period active today: unused share of what was actually paid, deducted by an upgrade. */
  remainingValue?: number | null;
  status: string;
  qrCode: string | null;
  createdAt: string;
  holdStatus?: string | null;
  holdReason?: string | null;
  holdRequestedAt?: string | null;
  holdResolvedAt?: string | null;
}

/** Một khoản thanh toán: hội viên, gói/lớp, số tiền, phương thức, trạng thái, người nhận, ghi chú và số hóa đơn. */
export interface Payment {
  id: number;
  memberId: number;
  memberName: string | null;
  subscriptionId: number | null;
  classEnrollmentId: number | null;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  receivedById: number | null;
  receivedByName: string | null;
  note: string | null;
  createdAt: string;
  invoiceNumber: string | null;
  /** What the payment is for (server-derived); absent on endpoints that do not describe payments. */
  serviceType?: 'MEMBERSHIP' | 'CLASS' | 'PT' | 'COURT' | 'SHOP' | 'WALLET_TOPUP' | 'OTHER' | null;
  /** The paid item as stored data: package, class, coach + slot, court + slot or order code. */
  serviceName?: string | null;
  coachBookingId?: number | null;
  courtBookingId?: number | null;
  productOrderId?: number | null;
  vnpayPending?: boolean;
}

/** Yêu cầu hủy gói của hội viên: gói, lý do, trạng thái duyệt và người xử lý. */
export interface MembershipCancellationRequest {
  id: number;
  memberId: number;
  memberName: string | null;
  subscriptionId: number;
  packageName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedById: number | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

/** Lấy các yêu cầu hủy gói của hội viên (luôn trả mảng). */
export const getMyMembershipCancellations = async () => {
  const res = await apiFetch<MembershipCancellationRequest[]>('/memberships/cancellations/my');
  return Array.isArray(res) ? res : [];
};

/** Lấy danh sách gói tập đang bán (luôn trả mảng). */
export const getMembershipPackages = async () => {
  const res = await apiFetch<MembershipPackage[]>('/packages');
  return Array.isArray(res) ? res : [];
};

/** Lấy gói hiện tại của hội viên; null khi chưa có, dữ liệu lạ thì trả undefined. */
export const getCurrentMembership = async (): Promise<MemberSubscription | null> => {
  const res = await apiFetch<MemberSubscription | null>('/memberships/subscriptions/my');
  if (res === null) return null;
  if (res && !Array.isArray(res) && typeof res === 'object' && 'id' in res) return res;
  return undefined as unknown as MemberSubscription | null;
};

/** Lấy lịch sử các kỳ gói của hội viên. */
export const getMembershipHistory = async () => {
  const res = await apiFetch<MemberSubscription[]>('/memberships/subscriptions/history');
  return Array.isArray(res) ? res : [];
};

/** Lấy lịch sử thanh toán của hội viên. */
export const getMyPayments = async () => {
  const res = await apiFetch<Payment[]>('/payments/my');
  return Array.isArray(res) ? res : [];
};

/** Tạo khoản thanh toán bằng ví điện tử cho một gói. */
export const createPaymentRequest = (subscription: MemberSubscription, amount: number) =>
  apiFetch<Payment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      memberId: subscription.memberId,
      subscriptionId: subscription.id,
      amount,
      method: 'online_wallet',
    }),
  });

/** Thanh toán tiền mặt: gửi ảnh hóa đơn để lễ tân đối chiếu và xác nhận trên web. */
export const createCashReceiptPayment = (subscription: MemberSubscription, amount: number, receiptImage: string) =>
  apiFetch<Payment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      memberId: subscription.memberId,
      subscriptionId: subscription.id,
      amount,
      method: 'cash',
      receiptImage,
    }),
  });

/** Đăng ký một gói tập mới. */
export const createMembershipSubscription = (packageId: number) =>
  apiFetch<MemberSubscription>('/memberships/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ packageId }),
  });

/** Gia hạn một kỳ gói. */
export const renewMembershipSubscription = (subscriptionId: number) =>
  apiFetch<MemberSubscription>(
    `/memberships/subscriptions/${subscriptionId}/renew`,
    {
      method: 'POST',
    },
  );

export const upgradeMembershipSubscription = (
  subscriptionId: number,
  packageId: number,
) =>
  apiFetch<MemberSubscription>(
    `/memberships/subscriptions/${subscriptionId}/upgrade`,
    {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    },
  );

/** Mở lại gói đang bảo lưu. */
export const resumeMembershipSubscription = (subscriptionId: number) =>
  apiFetch<MemberSubscription>(`/memberships/subscriptions/${subscriptionId}/resume`, { method: 'POST' });

export const cancelPendingMembershipSubscription = (
  subscriptionId: number,
) =>
  apiFetch<MemberSubscription>(
    `/memberships/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
    },
  );
