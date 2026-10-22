import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import {
  cancelPendingMembershipSubscription,
  createMembershipSubscription,
  getCurrentMembership,
  getMembershipHistory,
  getMembershipPackages,
  getMyMembershipCancellations,
  getMyPayments,
  renewMembershipSubscription,
  requestMembershipHold,
  resumeMembershipSubscription,
  requestMembershipCancellation,
  upgradeMembershipSubscription,
  type MemberSubscription,
  type MembershipPackage,
  type MembershipCancellationRequest,
  type Payment,
} from './membershipApi';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; data: T };

interface RequestResult {
  subscription: MemberSubscription;
  membershipPackage: MembershipPackage;
  action: 'register' | 'renew' | 'upgrade';
}

interface PackageDetails {
  tierBadge: string;
  summary: string;
  benefits: string[];
}

const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const paymentInstructionsNotice = 'Vui lòng thanh toán trực tiếp tại Quầy Lễ Tân để nhân viên xác nhận và kích hoạt gói tập.';

function formatPrice(price: number): string {
  return priceFormatter.format(price);
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('vi-VN');
}

function todayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function isHigherPackage(currentPkg: MembershipPackage | null, targetPkg: MembershipPackage): boolean {
  if (!currentPkg || currentPkg.id === targetPkg.id) return false;
  if (targetPkg.price > currentPkg.price) return true;
  if (targetPkg.price === currentPkg.price && targetPkg.durationDays > currentPkg.durationDays) return true;
  return false;
}

function getPackageDetails(pkg: MembershipPackage): PackageDetails {
  const lowerName = pkg.name.toLowerCase();
  const isAnnual = pkg.durationDays >= 300 || lowerName.includes('sovereign') || lowerName.includes('annual');
  const isVip = !isAnnual && (pkg.durationDays >= 80 || lowerName.includes('sanctuary') || lowerName.includes('vip'));

  const tierBadge = isAnnual
    ? `Gói Thượng Hạng • ${pkg.durationDays} ngày`
    : isVip
      ? `Gói Đặc Quyền VIP • ${pkg.durationDays} ngày`
      : `Gói Tiêu Chuẩn • ${pkg.durationDays} ngày`;

  const rawDesc = pkg.description?.trim() ?? '';
  const isShortEnglish =
    !rawDesc ||
    /^(8 classes per month|unlimited classes|unlimited classes \+ 24 pt sessions)$/i.test(rawDesc);

  const summary = !isShortEnglish
    ? rawDesc
    : isAnnual
      ? 'Trải nghiệm đặc quyền toàn diện suốt 365 ngày với lộ trình huấn luyện cá nhân hóa 1-kèm-1 và sử dụng trọn vẹn mọi phân khu dịch vụ.'
      : isVip
        ? 'Tập luyện và phục hồi không giới hạn trong 90 ngày tại toàn bộ Studio chuyên sâu, khu vực Gym và tổ hợp Thủy trị liệu – Sauna.'
        : 'Khởi đầu hành trình rèn luyện thể lực 30 ngày linh hoạt với khu vực Gym tự do và các lớp học nhóm có Huấn luyện viên hướng dẫn.';

  const classBenefit =
    pkg.classCreditLimit != null
      ? `Tối đa ${pkg.classCreditLimit} buổi đặt lịch lớp học HLV chuyên sâu / kỳ (Yoga, Pilates, Boxing)`
      : 'Không giới hạn số buổi đặt lịch tất cả lớp học cùng HLV (Reformer Pilates, Yoga, Boxing, Strength)';

  const facilityBenefit = isAnnual
    ? 'Toàn quyền sử dụng khu Gym, Studio VIP, Hồ bơi khoáng ấm, Sauna & kèm 24 buổi PT 1-kèm-1'
    : isVip
      ? 'Sử dụng trọn vẹn khu Gym, Reformer Pilates, Hồ bơi khoáng ấm & phòng xông hơi Sauna phục hồi'
      : 'Tập luyện tự do khu vực Gym & Cardio toàn khung giờ mở cửa (06:00 – 22:00 mỗi ngày)';

  const extraBenefit = isAnnual
    ? 'Cấp thẻ QR định danh ưu tiên, tủ đồ cá nhân cố định, khăn tập cao cấp & đo InBody định kỳ'
    : 'Cấp thẻ hội viên QR điện tử định danh Check-in nhanh tại quầy, miễn phí tủ đồ & khăn tập';

  return {
    tierBadge,
    summary,
    benefits: [
      `Thời hạn hiệu lực ${pkg.durationDays} ngày liên tục kể từ thời điểm kích hoạt`,
      classBenefit,
      facilityBenefit,
      extraBenefit,
    ],
  };
}

function renderModalOverlay(content: ReactNode) {
  const portalShell = typeof document !== 'undefined' ? document.querySelector('.portal-v2') : null;
  return portalShell ? createPortal(content, portalShell) : content;
}

export function MemberPackagesPage() {
  const [packagesState, setPackagesState] = useState<LoadState<MembershipPackage[]>>({ status: 'loading' });
  const [currentState, setCurrentState] = useState<LoadState<MemberSubscription | null>>({ status: 'loading' });
  const [historyState, setHistoryState] = useState<LoadState<MemberSubscription[]>>({ status: 'loading' });
  const [paymentsState, setPaymentsState] = useState<LoadState<Payment[]>>({ status: 'loading' });
  const [cancellationsState, setCancellationsState] = useState<LoadState<MembershipCancellationRequest[]>>({ status: 'loading' });

  const [submittingPackageId, setSubmittingPackageId] =
    useState<number | null>(null);
  const requestBusy = useRef(false);
  const createdSubscriptions = useRef<MemberSubscription[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [holdSuccessMessage, setHoldSuccessMessage] = useState<string | null>(null);

  const [requestResult, setRequestResult] =
    useState<RequestResult | null>(null);

  // Bảo lưu gói tập modal state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdError, setHoldError] = useState<string | null>(null);
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [pendingToCancel, setPendingToCancel] = useState<MemberSubscription | null>(null);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

  const loadPackages = useCallback(async () => {
    setPackagesState({ status: 'loading' });
    try { setPackagesState({ status: 'success', data: await getMembershipPackages() }); }
    catch { setPackagesState({ status: 'error' }); }
  }, []);

  const loadCurrent = useCallback(async () => {
    setCurrentState({ status: 'loading' });
    try { setCurrentState({ status: 'success', data: await getCurrentMembership() }); }
    catch { setCurrentState({ status: 'error' }); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryState({ status: 'loading' });
    try {
      const history = await getMembershipHistory();
      setHistoryState({ status: 'success', data: [
        ...history,
        ...createdSubscriptions.current.filter((item) => !history.some((saved) => saved.id === item.id)),
      ] });
    }
    catch { setHistoryState({ status: 'error' }); }
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsState({ status: 'loading' });
    try {
      const payments = await getMyPayments();
      setPaymentsState({ status: 'success', data: payments });
      return payments;
    } catch {
      setPaymentsState({ status: 'error' });
      return null;
    }
  }, []);

  const loadCancellations = useCallback(async () => {
    setCancellationsState({ status: 'loading' });
    try { setCancellationsState({ status: 'success', data: await getMyMembershipCancellations() }); }
    catch { setCancellationsState({ status: 'error' }); }
  }, []);

  useEffect(() => {
    void loadPackages();
    void loadCurrent();
    void loadHistory();
    void loadPayments();
    void loadCancellations();
  }, [loadPackages, loadCurrent, loadHistory, loadPayments, loadCancellations]);

  const packages = packagesState.status === 'success' ? packagesState.data : [];
  const current =
    currentState.status === 'success' &&
    currentState.data?.status?.toLowerCase() === 'active'
      ? currentState.data
      : null;
  const currentPackage = current
    ? packages.find((item) => item.id === current.packageId) ?? null
    : null;
  const latestCancellation = current && cancellationsState.status === 'success'
    ? cancellationsState.data.find((item) => item.subscriptionId === current.id) ?? null
    : null;
  const frozenSubscription =
    !current && historyState.status === 'success'
      ? historyState.data.find((item) => item.status?.toLowerCase() === 'frozen') ?? null
      : null;
  const pendingItems = historyState.status === 'success'
    ? historyState.data.filter((item) => item.status === 'pending_payment') : [];
  const pending = pendingItems.length === 1 ? pendingItems[0] : null;
  const relatedPayments = pending && paymentsState.status === 'success'
    ? paymentsState.data.filter((payment) => payment.subscriptionId === pending.id) : [];
  const pendingPackage = pending ? packages.find((item) => item.id === pending.packageId) : null;

  function renewalCount(subscriptionId: number): number {
    // Match MembershipSubscriptionService.renew(): only pending_payment/active block renewal.
    return historyState.status === 'success'
      ? historyState.data.filter((item) => item.previousSubscriptionId === subscriptionId
        && (item.status === 'active' || item.status === 'pending_payment')).length
      : 0;
  }

  function paidHistoryConflict(): boolean {
    if (historyState.status !== 'success') return true;
    const paid = historyState.data.filter((item) => item.status === 'active' || item.status === 'expired');
    for (let i = 0; i < paid.length; i += 1) {
      const a = paid[i];
      if (!a.startDate || !a.endDate || a.startDate > a.endDate) return true;
      for (let j = i + 1; j < paid.length; j += 1) {
        const b = paid[j];
        if (!b.startDate || !b.endDate || b.startDate > b.endDate) return true;
        const upgradeTransition = (a.previousSubscriptionId === b.id && a.packageId !== b.packageId && a.startDate === b.endDate)
          || (b.previousSubscriptionId === a.id && a.packageId !== b.packageId && b.startDate === a.endDate);
        if (a.startDate <= b.endDate && b.startDate <= a.endDate && !upgradeTransition) return true;
        if (a.previousSubscriptionId != null && a.previousSubscriptionId === b.previousSubscriptionId) return true;
      }
    }
    return false;
  }

  function renewalPath(subscriptionId: number): { tail: MemberSubscription | null; conflict: boolean } {
    if (historyState.status !== 'success' || paidHistoryConflict()
      || historyState.data.some((item) => item.status === 'frozen')) return { tail: null, conflict: true };
    let tail = historyState.data.find((item) => item.id === subscriptionId) ?? null;
    const visited = new Set<number>();
    while (tail) {
      if (visited.has(tail.id)) return { tail: null, conflict: true };
      visited.add(tail.id);
      const next = historyState.data.filter((item) => item.previousSubscriptionId === tail?.id
        && (item.status === 'active' || item.status === 'expired'));
      if (next.length > 1) return { tail: null, conflict: true };
      if (next.length === 0) return { tail, conflict: false };
      if (next[0].startDate <= tail.endDate || next[0].packageId !== tail.packageId) {
        return { tail: null, conflict: true };
      }
      tail = next[0];
    }
    return { tail: null, conflict: true };
  }

  const futurePeriods = historyState.status === 'success'
    ? historyState.data.filter((item) => item.status === 'active' && item.startDate > todayKey())
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const isStatusSyncing =
    currentState.status === 'loading' ||
    historyState.status === 'loading' ||
    paymentsState.status === 'loading';

  async function handleMembershipAction(
    membershipPackage: MembershipPackage,
    renewFrom: MemberSubscription | null,
    upgradeFrom: MemberSubscription | null = null,
  ) {
    if (
      packagesState.status !== 'success' || currentState.status !== 'success' ||
      historyState.status !== 'success' || paymentsState.status !== 'success' ||
      frozenSubscription || pendingItems.length > 0 || submittingPackageId !== null || requestBusy.current
    ) {
      return;
    }

    if (current && current.id !== renewFrom?.id && current.id !== upgradeFrom?.id) {
      return;
    }

    if (renewFrom && renewalPath(renewFrom.id).conflict) {
      return;
    }

    if (upgradeFrom && renewalCount(upgradeFrom.id) > 0) {
      return;
    }

    requestBusy.current = true;
    setSubmittingPackageId(membershipPackage.id);
    setActionError(null);

    try {
      const subscription = upgradeFrom
        ? await upgradeMembershipSubscription(upgradeFrom.id, membershipPackage.id)
        : renewFrom
          ? await renewMembershipSubscription(renewFrom.id)
          : await createMembershipSubscription(membershipPackage.id);

      createdSubscriptions.current.push(subscription);
      setHistoryState((previous) =>
        previous.status === 'success'
          ? { status: 'success', data: [subscription, ...previous.data] }
          : previous,
      );
      void loadPayments();

      setRequestResult({
        subscription,
        membershipPackage,
        action: upgradeFrom ? 'upgrade' : renewFrom ? 'renew' : 'register',
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      await loadHistory();
      setSubmittingPackageId(null);
      requestBusy.current = false;
    }
  }

  async function handleResume() {
    if (!frozenSubscription || requestBusy.current) return;
    requestBusy.current = true;
    setIsResuming(true);
    setActionError(null);
    try {
      const resumed = await resumeMembershipSubscription(frozenSubscription.id);
      setCurrentState({ status: 'success', data: resumed });
      setHistoryState((previous) => previous.status === 'success'
        ? { status: 'success', data: previous.data.map((item) => item.id === resumed.id ? resumed : item) }
        : previous);
      setHoldSuccessMessage('Đã mở lại gói tập. Thời hạn còn lại được giữ nguyên, không phát sinh phí.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể mở lại gói tập. Vui lòng thử lại.');
    } finally {
      setIsResuming(false);
      requestBusy.current = false;
    }
  }

  async function handleSubmitHold(e: React.FormEvent) {
    e.preventDefault();
    if (!current || isSubmittingHold) return;
    const trimmed = holdReason.trim();
    if (!trimmed) {
      setHoldError('Vui lòng nhập lý do bảo lưu gói tập.');
      return;
    }

    setIsSubmittingHold(true);
    setHoldError(null);
    setActionError(null);
    try {
      const updated = await requestMembershipHold(current.id, trimmed);
      setCurrentState({ status: 'success', data: updated });
      setIsHoldModalOpen(false);
      setHoldReason('');
      setHoldSuccessMessage('Đã gửi yêu cầu bảo lưu gói tập. Lễ tân sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất.');
      await loadHistory();
    } catch (error) {
      setHoldError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi yêu cầu bảo lưu. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmittingHold(false);
    }
  }

  async function handleCancelPending(subscriptionId: number) {
    if (isCancellingPending || requestBusy.current) return;
    requestBusy.current = true;
    setIsCancellingPending(true);
    setActionError(null);
    try {
      const cancelled = await cancelPendingMembershipSubscription(subscriptionId);
      createdSubscriptions.current = createdSubscriptions.current.map((item) =>
        item.id === cancelled.id ? cancelled : item,
      );
      setHistoryState((previous) =>
        previous.status === 'success'
          ? {
              status: 'success',
              data: previous.data.map((item) =>
                item.id === cancelled.id ? cancelled : item,
              ),
            }
          : previous,
      );
      setRequestResult(null);
      setPendingToCancel(null);
      setHoldSuccessMessage(`Đã hủy yêu cầu gói tập #${cancelled.id}.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Không thể hủy yêu cầu gói tập. Vui lòng thử lại.',
      );
    } finally {
      await Promise.all([loadCurrent(), loadHistory(), loadPayments()]);
      setIsCancellingPending(false);
      requestBusy.current = false;
    }
  }

  async function handleSubmitCancellation(e: React.FormEvent) {
    e.preventDefault();
    if (!current || isSubmittingCancellation || requestBusy.current) return;
    const reason = cancellationReason.trim();
    if (!reason) {
      setCancellationError('Vui lòng nhập lý do hủy gói tập.');
      return;
    }
    requestBusy.current = true;
    setIsSubmittingCancellation(true);
    setCancellationError(null);
    try {
      await requestMembershipCancellation(current.id, reason);
      await loadCancellations();
      setIsCancellationModalOpen(false);
      setCancellationReason('');
      setHoldSuccessMessage('Đã gửi yêu cầu hủy gói. Gói vẫn có hiệu lực cho đến khi quản lý duyệt.');
    } catch (error) {
      setCancellationError(error instanceof Error ? error.message : 'Không thể gửi yêu cầu hủy. Vui lòng thử lại.');
    } finally {
      setIsSubmittingCancellation(false);
      requestBusy.current = false;
    }
  }

  const activePackages = packages.filter((item) => item.status === 'active');

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Hội viên"
        title="Gói tập & Đặc quyền"
        subtitle="Mỗi gói tập bao gồm quyền lợi sử dụng khu vực tập luyện, số buổi lớp có HLV hướng dẫn và thẻ QR check-in định danh."
      />

      {/* Unified Skeleton for Status Area (replaces piecemeal text lines) */}
      {isStatusSyncing && !current && !pending && (
        <div className="portal-card" role="status" aria-busy="true" style={{ marginBottom: 24 }}>
          <span className="sr-only">Đang đồng bộ thông tin gói tập…</span>
          <div className="portal-skeleton-line" style={{ width: '22%', height: 12, marginBottom: 14 }} />
          <div className="portal-skeleton-line" style={{ width: '48%', height: 22, marginBottom: 10 }} />
          <div className="portal-skeleton-line" style={{ width: '68%', height: 14 }} />
        </div>
      )}

      {currentState.status === 'error' && (
        <div className="portal-alert" role="alert">
          <span>Không thể kiểm tra gói hiện tại.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadCurrent()}>Thử lại</button>
        </div>
      )}
      {historyState.status === 'error' && (
        <div className="portal-alert" role="alert">
          <span>Không thể kiểm tra lịch sử gói.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadHistory()}>Thử lại</button>
        </div>
      )}
      {paymentsState.status === 'error' && (
        <div className="portal-alert" role="alert">
          <span>Không thể kiểm tra thanh toán.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadPayments()}>Thử lại</button>
        </div>
      )}
      {cancellationsState.status === 'error' && (
        <div className="portal-alert" role="alert">
          <span>Không thể kiểm tra trạng thái yêu cầu hủy gói.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadCancellations()}>Thử lại</button>
        </div>
      )}

      {holdSuccessMessage && (
        <div className="portal-alert" role="status" style={{ marginBottom: 24, borderColor: '#86EFAC', backgroundColor: '#F0FDF4', color: '#166534' }}>
          <span>{holdSuccessMessage}</span>
        </div>
      )}

      {current && (
        <section
          className="portal-card portal-card--feature"
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="meta-label">
                Gói hiện tại
              </div>
              <h2
                className="portal-card-title"
                style={{ marginTop: 8 }}
              >
                {current.packageName}
              </h2>
              <p className="row-card__meta" style={{ marginTop: 4 }}>
                Hiệu lực từ {formatDate(current.startDate)} đến {formatDate(current.paidThroughDate ?? current.endDate)}
              </p>
              {current.status === 'active' && paymentsState.status === 'success' &&
                paymentsState.data.some((payment) => payment.subscriptionId === current.id && payment.status === 'success') && (
                  <p role="status" style={{ margin: '8px 0 0', fontWeight: 600, color: '#15803D', fontSize: '0.84rem' }}>
                    ✓ Gói đã kích hoạt. Bạn có thể sử dụng thẻ QR để check-in và đặt lịch lớp học.
                  </p>
                )}
              {current.holdStatus === 'PENDING' && (
                <p role="status" style={{ margin: '8px 0 0', fontWeight: 600, color: '#996515', fontSize: '0.86rem' }}>
                  ⏳ Đang chờ Lễ tân xử lý yêu cầu bảo lưu{current.holdReason ? ` • Lý do: "${current.holdReason}"` : ''}
                </p>
              )}
              {current.holdStatus === 'REJECTED' && (
                <p role="status" style={{ margin: '8px 0 0', fontWeight: 600, color: '#B91C1C', fontSize: '0.84rem' }}>
                  Yêu cầu bảo lưu trước đó đã bị từ chối. Bạn có thể gửi lại yêu cầu mới nếu cần.
                </p>
              )}
              {latestCancellation?.status === 'PENDING' && (
                <p role="status" className="row-card__meta" style={{ marginTop: 8 }}>
                  Đang chờ quản lý duyệt yêu cầu hủy. Gói vẫn có hiệu lực.
                </p>
              )}
              {latestCancellation?.status === 'REJECTED' && (
                <p role="status" className="row-card__meta" style={{ marginTop: 8 }}>
                  Yêu cầu hủy trước đó đã bị từ chối. {latestCancellation.resolutionNote ?? ''}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/member/card" className="btn-primary btn-sm">
                Xem thẻ QR Check-in
              </a>
              <a href="/member/classes" className="btn-secondary btn-sm">
                Đặt lịch lớp học
              </a>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={current.holdStatus === 'PENDING'}
                onClick={() => {
                  setHoldError(null);
                  setHoldReason(current.holdReason && current.holdStatus !== 'REJECTED' ? current.holdReason : '');
                  setIsHoldModalOpen(true);
                }}
              >
                {current.holdStatus === 'PENDING' ? 'Đang chờ duyệt bảo lưu' : 'Bảo lưu gói tập'}
              </button>
              <button type="button" className="btn-secondary btn-sm"
                disabled={cancellationsState.status !== 'success' || latestCancellation?.status === 'PENDING'}
                onClick={() => { setCancellationError(null); setIsCancellationModalOpen(true); }}>
                {latestCancellation?.status === 'PENDING' ? 'Đang chờ duyệt hủy' : 'Yêu cầu hủy gói'}
              </button>
            </div>
          </div>
        </section>
      )}

      {!current && cancellationsState.status === 'success' && cancellationsState.data.length > 0 && (
        <section className="portal-card" style={{ marginBottom: 24 }} aria-label="Kết quả yêu cầu hủy gói">
          <div className="meta-label">Yêu cầu hủy gói gần nhất</div>
          <h2 className="portal-card-title" style={{ marginTop: 8 }}>
            {cancellationsState.data[0].packageName}
          </h2>
          <p className="row-card__meta" role="status">
            {cancellationsState.data[0].status === 'APPROVED' ? 'Đã duyệt hủy' :
              cancellationsState.data[0].status === 'REJECTED' ? 'Yêu cầu bị từ chối' : 'Đang chờ quản lý duyệt'}
          </p>
          {cancellationsState.data[0].resolutionNote &&
            <p className="row-card__meta">Ghi chú: {cancellationsState.data[0].resolutionNote}</p>}
        </section>
      )}

      {frozenSubscription && (
        <section
          className="portal-card"
          style={{ marginBottom: 24, border: '1px solid #93C5FD', background: '#EFF6FF' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div className="meta-label">
              Gói tập đang bảo lưu
            </div>
            <span className="badge badge-info">ĐANG BẢO LƯU</span>
          </div>
          <h2 className="portal-card-title" style={{ marginTop: 10 }}>
            {frozenSubscription.packageName}
          </h2>
          <p className="row-card__meta" style={{ marginTop: 4 }}>
            Thời hạn gói: {formatDate(frozenSubscription.startDate)} đến {formatDate(frozenSubscription.endDate)}
          </p>
          {frozenSubscription.holdReason && (
            <p className="row-card__meta" style={{ marginTop: 4, fontWeight: 600 }}>
              Lý do bảo lưu: "{frozenSubscription.holdReason}"
            </p>
          )}
          <p className="row-card__meta" style={{ marginTop: 6 }}>
            Gói tập của bạn đã được Lễ tân xác nhận bảo lưu. Các lịch lớp học đặt trước trong tương lai đã được hủy tự động.
          </p>
          <p className="row-card__meta">Mở lại để tiếp tục sử dụng số ngày còn lại, không cần thanh toán lại. Bạn có thể đặt lại lịch học sau khi mở gói.</p>
          <button type="button" className="btn-primary" disabled={isResuming || isStatusSyncing || pendingItems.length > 0}
            onClick={() => void handleResume()}>
            {isResuming ? 'Đang mở lại…' : 'Mở lại gói tập miễn phí'}
          </button>
        </section>
      )}

      {futurePeriods.length > 0 && (
        <section className="portal-card" aria-label="Các kỳ đã thanh toán tiếp theo" style={{ marginBottom: 24 }}>
          <h2 className="portal-card-title">Kỳ đã thanh toán tiếp theo</h2>
          {futurePeriods.map((period) => (
            <p className="row-card__meta" key={period.id}>
              {period.packageName}: {formatDate(period.startDate)} – {formatDate(period.endDate)}
            </p>
          ))}
        </section>
      )}

      {currentState.status === 'success' && !current && !frozenSubscription && !pending && !isStatusSyncing && (
        <div className="portal-alert portal-alert--info" style={{ marginBottom: 24 }}>
          <span>Bạn chưa có gói đang hoạt động. Hãy chọn một gói tập bên dưới để đăng ký và kích hoạt thẻ hội viên.</span>
        </div>
      )}

      {pendingItems.length > 1 && (
        <div className="portal-alert" role="alert">
          <span>Có nhiều yêu cầu đang chờ. Vui lòng liên hệ nhân viên để kiểm tra.</span>
        </div>
      )}

      {pending && (
        <section
          className="portal-card"
          style={{ marginBottom: 24, border: '1px solid #D6C7B8', background: '#FCF9F4' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div className="meta-label">
              Thanh toán gói tập • Yêu cầu #{pending.id}
            </div>
            <span className="badge badge-warning">Đang chờ xác nhận tại quầy Lễ tân</span>
          </div>

          <h2
            className="portal-card-title"
            style={{ marginTop: 10 }}
          >
            {pending.packageName}
          </h2>

          <p className="row-card__meta">
            Yêu cầu #{pending.id} đang ở trạng thái chờ thanh toán và đã được chuyển thẳng vào danh sách chờ tại Quầy Lễ Tân (POS).
          </p>
          {pendingPackage && (
            <p className="row-card__meta" style={{ fontWeight: 600, color: '#211C18' }}>
              Số tiền thanh toán: {formatPrice(pendingPackage.price)} ({pendingPackage.durationDays} ngày)
            </p>
          )}
          {paymentsState.status === 'success' && relatedPayments.length === 0 && pendingPackage && (
            <>
              <p className="row-card__meta" role="status">{paymentInstructionsNotice}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { void loadCurrent(); void loadHistory(); void loadPayments(); }}
                >
                  Tải lại trạng thái
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                  disabled={isCancellingPending || paymentsState.status !== 'success' || relatedPayments.some((payment) => payment.status !== 'failed')}
                  onClick={() => setPendingToCancel(pending)}
                >
                  {isCancellingPending ? 'Đang hủy…' : 'Hủy yêu cầu đăng ký'}
                </button>
              </div>
            </>
          )}
          {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'pending') && (
            <p className="row-card__meta" role="status">Đã gửi thông báo chuyển khoản. Vui lòng chờ nhân viên xác nhận.</p>
          )}
          {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'success') && (
            <p role="alert">Thanh toán đã ghi nhận nhưng gói chưa active. Vui lòng yêu cầu nhân viên kiểm tra.</p>
          )}
          {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'failed') && (
            <p role="alert">Có giao dịch thất bại. Vui lòng liên hệ nhân viên để được hướng dẫn trước khi gửi yêu cầu mới.</p>
          )}
          {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'refunded') && (
            <p role="alert">Giao dịch đã hoàn tiền. Vui lòng liên hệ nhân viên để xác nhận cách thanh toán tiếp theo.</p>
          )}
          {paymentsState.status === 'success' && relatedPayments.length === 0 && !pendingPackage && (
            <p role="alert">Không tìm thấy giá gói để gửi yêu cầu. Vui lòng thử lại sau.</p>
          )}
          {!(paymentsState.status === 'success' && relatedPayments.length === 0 && pendingPackage) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { void loadCurrent(); void loadHistory(); void loadPayments(); }}
              >
                Tải lại trạng thái
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                disabled={isCancellingPending || paymentsState.status !== 'success' || relatedPayments.some((payment) => payment.status !== 'failed')}
                onClick={() => setPendingToCancel(pending)}
              >
                {isCancellingPending ? 'Đang hủy…' : 'Hủy yêu cầu đăng ký'}
              </button>
            </div>
          )}
        </section>
      )}

      {actionError && (
        <div
          className="portal-card"
          role="alert"
          style={{ marginBottom: 24 }}
        >
          <h2 className="portal-card-title">
            Không thể xử lý yêu cầu
          </h2>

          <p className="row-card__meta">
            {actionError}
          </p>
        </div>
      )}

      {packagesState.status === 'loading' && (
        <div className="grid-3" role="status" aria-busy="true">
          <span className="sr-only">Đang tải danh sách gói tập…</span>
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="portal-card" style={{ marginBottom: 0 }}>
              <div className="portal-skeleton-line" style={{ width: '42%', height: 12, marginBottom: 16 }} />
              <div className="portal-skeleton-line" style={{ width: '72%', height: 26, marginBottom: 12 }} />
              <div className="portal-skeleton-line" style={{ width: '95%', height: 14, marginBottom: 8 }} />
              <div className="portal-skeleton-line" style={{ width: '84%', height: 14, marginBottom: 20 }} />
              <div className="portal-skeleton-line" style={{ width: '90%', height: 13, marginBottom: 10 }} />
              <div className="portal-skeleton-line" style={{ width: '86%', height: 13, marginBottom: 10 }} />
              <div className="portal-skeleton-line" style={{ width: '78%', height: 13, marginBottom: 24 }} />
              <div className="portal-skeleton-line" style={{ width: '55%', height: 32, marginBottom: 20 }} />
              <div className="portal-skeleton" style={{ width: '100%', height: 42, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      )}

      {packagesState.status === 'error' && (
        <div className="portal-card portal-empty" role="alert">
          <h2 className="portal-card-title">
            Không thể tải gói tập
          </h2>

          <p>Vui lòng thử lại sau ít phút.</p>

          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 20 }}
            onClick={() => void loadPackages()}
          >
            Thử lại
          </button>
        </div>
      )}

      {packagesState.status === 'success' && (activePackages.length === 0 ? (
        <div className="portal-card portal-empty">
          <h2 className="portal-card-title">
            Chưa có gói tập khả dụng
          </h2>

          <p>Vui lòng quay lại sau.</p>
        </div>
      ) : (
        <div className="grid-3">
          {activePackages.map((membershipPackage) => {
            const details = getPackageDetails(membershipPackage);
            const isCurrent =
              current?.packageId ===
              membershipPackage.id;

            const expiredForPackage = historyState.status === 'success'
              ? historyState.data.filter((item) =>
                  item.packageId === membershipPackage.id &&
                  (item.status === 'active' || item.status === 'expired') &&
                  item.endDate < todayKey(),
                ).sort((a, b) => b.endDate.localeCompare(a.endDate))
              : [];
            const ambiguousRenewal = !current && expiredForPackage.length > 1 &&
              expiredForPackage[0].endDate === expiredForPackage[1].endDate;
            const renewFrom = current && isCurrent ? current :
              !current && !ambiguousRenewal ? expiredForPackage[0] ?? null : null;
            const upgradeFrom =
              current && !isCurrent && isHigherPackage(currentPackage, membershipPackage)
                ? current
                : null;
            const renewalConflict = renewFrom && historyState.status === 'success' ? renewalPath(renewFrom.id).conflict : false;
            const nextRenewals = upgradeFrom ? renewalCount(upgradeFrom.id) : 0;

            const isPending =
              pending?.packageId ===
              membershipPackage.id;

            const isSubmitting =
              submittingPackageId ===
              membershipPackage.id;

            const hasLowerOrNonUpgradableCurrentPackage =
              current !== null && !isCurrent && !upgradeFrom;

            const disabled =
              frozenSubscription !== null ||
              submittingPackageId !== null ||
              packagesState.status !== 'success' || currentState.status !== 'success' ||
              historyState.status !== 'success' || paymentsState.status !== 'success' ||
              pendingItems.length > 0 ||
              nextRenewals > 0 ||
              renewalConflict ||
              ambiguousRenewal ||
              hasLowerOrNonUpgradableCurrentPackage;

            let buttonText = historyState.status === 'success' && historyState.data.length === 0
              ? 'Đăng ký lần đầu' : 'Đăng ký gói mới';

            if (isSubmitting) {
              buttonText = 'Đang xử lý…';
            } else if (frozenSubscription) {
              buttonText = 'Đang có gói bảo lưu';
            } else if (renewalConflict || nextRenewals > 1) {
              buttonText = 'Cần kiểm tra gia hạn';
            } else if (nextRenewals === 1) {
              buttonText = renewFrom ? 'Đã gia hạn' : 'Có yêu cầu đang chờ';
            } else if (pendingItems.length > 0) {
              buttonText = isPending
                ? 'Đang chờ xác nhận'
                : 'Có yêu cầu đang chờ';
            } else if (ambiguousRenewal) {
              buttonText = 'Cần kiểm tra lịch sử';
            } else if (current) {
              buttonText = isCurrent
                ? 'Gia hạn'
                : upgradeFrom
                  ? 'Nâng cấp gói'
                  : 'Đang có gói hoạt động';
            } else if (renewFrom) {
              buttonText = 'Gia hạn';
            }

            return (
              <article
                className={`portal-card ${isCurrent ? 'portal-card--feature' : ''}`}
                key={membershipPackage.id}
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="meta-label">
                      {details.tierBadge}
                    </div>
                    <span className="badge badge-info">
                      {membershipPackage.classCreditLimit != null
                        ? `${membershipPackage.classCreditLimit} buổi lớp HLV`
                        : 'Không giới hạn lớp'}
                    </span>
                  </div>

                  <h2
                    className="portal-card-title"
                    style={{ margin: '14px 0 8px' }}
                  >
                    {membershipPackage.name}
                  </h2>

                  <p className="row-card__meta" style={{ margin: 0, lineHeight: 1.6 }}>
                    {details.summary}
                  </p>

                  <ul className="package-benefit-list" aria-label={`Quyền lợi gói ${membershipPackage.name}`}>
                    {details.benefits.map((benefit, index) => (
                      <li key={index} className="package-benefit-item">
                        <span className="package-benefit-check" aria-hidden="true">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div
                    className="metric-value"
                    style={{
                      fontSize: '1.9rem',
                      marginTop: 8,
                    }}
                  >
                    {formatPrice(membershipPackage.price)}
                  </div>
                  <div className="row-card__meta" style={{ fontSize: '0.76rem', marginTop: 2 }}>
                    Trọn gói {membershipPackage.durationDays} ngày • Kích hoạt ngay tại quầy
                  </div>

                  {(renewalConflict || nextRenewals > 1) && (
                    <p className="row-card__meta" role="alert">
                      Lịch sử gói có kỳ trùng, chồng ngày hoặc chuỗi gia hạn bất thường. Vui lòng liên hệ nhân viên để kiểm tra.
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: 18, width: '100%' }}
                    disabled={disabled}
                    onClick={() =>
                      void handleMembershipAction(
                        membershipPackage,
                        renewFrom,
                        upgradeFrom,
                      )
                    }
                  >
                    {buttonText}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ))}

      {requestResult && renderModalOverlay(
        <div
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setRequestResult(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(51, 39, 29, 0.48)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            zIndex: 1200,
          }}
        >
          <section
            className="portal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-request-title"
            style={{
              width: 'min(520px, 100%)',
              marginBottom: 0,
              borderRadius: 22,
              boxShadow: '0 30px 90px rgba(56, 43, 32, 0.25)',
            }}
          >
            <div className="meta-label">
              Yêu cầu đã được tạo
            </div>

            <h2
              id="membership-request-title"
              className="portal-card-title"
              style={{ marginTop: 12 }}
            >
              {requestResult.action === 'upgrade'
                ? 'Nâng cấp gói tập'
                : requestResult.action === 'renew'
                  ? 'Gia hạn gói tập'
                  : 'Đăng ký gói tập'}
            </h2>

            <div
              className="stack"
              style={{ marginTop: 24 }}
            >
              <div className="row-card">
                <div className="row-card__meta">
                  Gói tập
                </div>
                <h3 className="row-card__title">
                  {requestResult.membershipPackage.name}
                </h3>
              </div>

              <div className="row-card">
                <div className="row-card__meta">
                  Số tiền
                </div>
                <h3 className="row-card__title">
                  {formatPrice(
                    requestResult.membershipPackage.price,
                  )}
                </h3>
              </div>

              <div className="row-card">
                <div className="row-card__meta">
                  Mã yêu cầu
                </div>
                <h3 className="row-card__title">
                  #{requestResult.subscription.id}
                </h3>
              </div>
            </div>

            <p className="row-card__meta" role="status" style={{ marginTop: 20 }}>
              {paymentInstructionsNotice}
            </p>

            <p
              className="row-card__meta"
              style={{ marginTop: 16 }}
            >
              Yêu cầu đã được đồng bộ tới Quầy Lễ Tân. Gói tập sẽ được kích hoạt ngay sau khi nhân viên xác nhận thanh toán.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
                onClick={() => setPendingToCancel(requestResult.subscription)}
                disabled={isCancellingPending || paymentsState.status !== 'success' ||
                  paymentsState.data.some((payment) => payment.subscriptionId === requestResult.subscription.id && payment.status !== 'failed')}
              >
                {isCancellingPending ? 'Đang hủy…' : 'Hủy yêu cầu đăng ký'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setRequestResult(null)}
              >
                Đóng
              </button>
            </div>
          </section>
        </div>,
      )}

      {pendingToCancel && renderModalOverlay(
        <div role="presentation" onClick={(e) => e.target === e.currentTarget && !isCancellingPending && setPendingToCancel(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(51, 39, 29, 0.48)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 1300 }}>
          <section className="portal-card" role="dialog" aria-modal="true" aria-labelledby="cancel-pending-title"
            onKeyDown={(e) => { if (e.key === 'Escape' && !isCancellingPending) setPendingToCancel(null); }}
            style={{ width: 'min(500px, 100%)', marginBottom: 0, borderRadius: 22 }}>
            <div className="meta-label">Xác nhận yêu cầu</div>
            <h2 id="cancel-pending-title" className="portal-card-title" style={{ marginTop: 10 }}>Hủy yêu cầu đăng ký?</h2>
            <p className="row-card__meta" style={{ marginTop: 12 }}>
              Yêu cầu {pendingToCancel.packageName} sẽ bị hủy. Bạn có thể đăng ký gói khác sau khi hệ thống xác nhận.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn-secondary" autoFocus disabled={isCancellingPending}
                onClick={() => setPendingToCancel(null)}>Giữ yêu cầu</button>
              <button type="button" className="btn-primary" disabled={isCancellingPending}
                onClick={() => void handleCancelPending(pendingToCancel.id)}>
                {isCancellingPending ? 'Đang hủy…' : 'Xác nhận hủy'}
              </button>
            </div>
          </section>
        </div>,
      )}

      {isCancellationModalOpen && current && renderModalOverlay(
        <div role="presentation" onClick={(e) => e.target === e.currentTarget && !isSubmittingCancellation && setIsCancellationModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(51, 39, 29, 0.48)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 1300 }}>
          <section className="portal-card" role="dialog" aria-modal="true" aria-labelledby="cancel-active-title"
            onKeyDown={(e) => { if (e.key === 'Escape' && !isSubmittingCancellation) setIsCancellationModalOpen(false); }}
            style={{ width: 'min(540px, 100%)', marginBottom: 0, borderRadius: 22 }}>
            <div className="meta-label">Yêu cầu quản lý xét duyệt</div>
            <h2 id="cancel-active-title" className="portal-card-title" style={{ marginTop: 10 }}>Yêu cầu hủy {current.packageName}</h2>
            <p className="row-card__meta" style={{ marginTop: 12 }}>
              Gói tập sau khi được duyệt hủy sẽ không được hoàn tiền. Các lịch học tương lai có thể bị chấm dứt.
            </p>
            <form onSubmit={(e) => void handleSubmitCancellation(e)} style={{ marginTop: 20 }}>
              <label className="portal-label" htmlFor="membership-cancellation-reason">Lý do hủy *</label>
              <textarea id="membership-cancellation-reason" className="portal-input" required maxLength={500} rows={4}
                value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)}
                disabled={isSubmittingCancellation} style={{ width: '100%', resize: 'vertical' }} />
              {cancellationError && <p role="alert" style={{ color: '#B91C1C' }}>{cancellationError}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn-secondary" disabled={isSubmittingCancellation}
                  onClick={() => setIsCancellationModalOpen(false)}>Quay lại</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingCancellation || !cancellationReason.trim()}>
                  {isSubmittingCancellation ? 'Đang gửi…' : 'Xác nhận gửi yêu cầu'}
                </button>
              </div>
            </form>
          </section>
        </div>,
      )}

      {isHoldModalOpen && current && renderModalOverlay(
        <div
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && !isSubmittingHold && setIsHoldModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(51, 39, 29, 0.48)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            zIndex: 1200,
          }}
        >
          <section
            className="portal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-hold-title"
            style={{
              width: 'min(520px, 100%)',
              marginBottom: 0,
              borderRadius: 22,
              boxShadow: '0 30px 90px rgba(56, 43, 32, 0.25)',
            }}
          >
            <div className="meta-label">
              Yêu cầu bảo lưu gói tập
            </div>

            <h2
              id="membership-hold-title"
              className="portal-card-title"
              style={{ marginTop: 12 }}
            >
              Bảo lưu {current.packageName}
            </h2>

            <p className="row-card__meta" style={{ marginTop: 8 }}>
              Khi Lễ tân xác nhận bảo lưu, gói tập hiện tại của bạn sẽ tạm dừng hoạt động và toàn bộ các lịch học bạn đã đặt trong tương lai sẽ được hủy tự động.
            </p>

            <form onSubmit={(e) => void handleSubmitHold(e)} style={{ marginTop: 18 }}>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="hold-reason-input">
                  Lý do bảo lưu gói tập *
                </label>
                <textarea
                  id="hold-reason-input"
                  className="portal-input"
                  rows={4}
                  maxLength={500}
                  placeholder="Nhập lý do bảo lưu (ví dụ: Đi công tác dài ngày, chấn thương cần nghỉ ngơi...)"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  disabled={isSubmittingHold}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {holdError && (
                <p role="alert" style={{ color: '#B91C1C', fontSize: '0.86rem', marginTop: 8 }}>
                  {holdError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmittingHold}
                  onClick={() => setIsHoldModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingHold}
                >
                  {isSubmittingHold ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu bảo lưu'}
                </button>
              </div>
            </form>
          </section>
        </div>,
      )}
    </div>
  );
}
