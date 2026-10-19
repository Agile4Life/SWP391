import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import {
  createMembershipSubscription,
  createPaymentRequest,
  getCurrentMembership,
  getMembershipHistory,
  getMembershipPackages,
  getMyPayments,
  renewMembershipSubscription,
  type MemberSubscription,
  type MembershipPackage,
  type Payment,
} from './membershipApi';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; data: T };

interface RequestResult {
  subscription: MemberSubscription;
  membershipPackage: MembershipPackage;
  action: 'register' | 'renew';
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

// Keep confirmation locked until the team supplies approved transfer instructions.
const paymentInstructionsAvailable = false;
const paymentInstructionsNotice = 'Chưa cấu hình thông tin thanh toán. Vui lòng liên hệ nhân viên để được hướng dẫn chuyển khoản.';

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

export function MemberPackagesPage() {
  const [packagesState, setPackagesState] = useState<LoadState<MembershipPackage[]>>({ status: 'loading' });
  const [currentState, setCurrentState] = useState<LoadState<MemberSubscription | null>>({ status: 'loading' });
  const [historyState, setHistoryState] = useState<LoadState<MemberSubscription[]>>({ status: 'loading' });
  const [paymentsState, setPaymentsState] = useState<LoadState<Payment[]>>({ status: 'loading' });

  const [submittingPackageId, setSubmittingPackageId] =
    useState<number | null>(null);
  const [sendingPayment, setSendingPayment] = useState(false);
  const requestBusy = useRef(false);
  const createdSubscriptions = useRef<MemberSubscription[]>([]);
  const createdPayments = useRef<Payment[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);

  const [requestResult, setRequestResult] =
    useState<RequestResult | null>(null);

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
      const data = [
        ...payments,
        ...createdPayments.current.filter((item) => !payments.some((saved) => saved.id === item.id)),
      ];
      setPaymentsState({ status: 'success', data });
      return data;
    } catch {
      setPaymentsState({ status: 'error' });
      return null;
    }
  }, []);

  useEffect(() => {
    void loadPackages();
    void loadCurrent();
    void loadHistory();
    void loadPayments();
  }, [loadPackages, loadCurrent, loadHistory, loadPayments]);

  const packages = packagesState.status === 'success' ? packagesState.data : [];
  const current =
    currentState.status === 'success' &&
    currentState.data?.status?.toLowerCase() === 'active'
      ? currentState.data
      : null;
  const pendingItems = historyState.status === 'success'
    ? historyState.data.filter((item) => item.status === 'pending_payment') : [];
  const pending = pendingItems.length === 1 ? pendingItems[0] : null;
  const relatedPayments = pending && paymentsState.status === 'success'
    ? paymentsState.data.filter((payment) => payment.subscriptionId === pending.id) : [];
  const pendingPackage = pending ? packages.find((item) => item.id === pending.packageId) : null;
  const canRequest = paymentInstructionsAvailable && packagesState.status === 'success' && currentState.status === 'success'
    && historyState.status === 'success' && paymentsState.status === 'success'
    && pendingItems.length === 1 && pendingPackage != null
    && pending?.memberId != null && relatedPayments.length === 0 && !sendingPayment;

  const isStatusSyncing =
    currentState.status === 'loading' ||
    historyState.status === 'loading' ||
    paymentsState.status === 'loading';

  async function handlePaymentRequest() {
    if (!pending || !pendingPackage || !canRequest || requestBusy.current) return;
    requestBusy.current = true;
    setSendingPayment(true);
    setActionError(null);
    try {
      const payment = await createPaymentRequest(pending, pendingPackage.price);
      createdPayments.current.push(payment);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể gửi yêu cầu thanh toán.');
    } finally {
      // A failed POST may have reached the server. Verify before enabling Retry.
      const payments = await loadPayments();
      if (payments?.some((item) => item.subscriptionId === pending.id)) setActionError(null);
      setSendingPayment(false);
      requestBusy.current = false;
    }
  }

  async function handleMembershipAction(
    membershipPackage: MembershipPackage,
    renewFrom: MemberSubscription | null,
  ) {
    if (
      packagesState.status !== 'success' || currentState.status !== 'success' ||
      historyState.status !== 'success' || paymentsState.status !== 'success' ||
      pendingItems.length > 0 || submittingPackageId !== null || requestBusy.current
    ) {
      return;
    }

    if (current && current.id !== renewFrom?.id) {
      return;
    }

    requestBusy.current = true;
    setSubmittingPackageId(membershipPackage.id);
    setActionError(null);

    try {
      const subscription =
        renewFrom
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
        action: renewFrom ? 'renew' : 'register',
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
                Hiệu lực từ {formatDate(current.startDate)} đến {formatDate(current.endDate)}
              </p>
              {current.status === 'active' && paymentsState.status === 'success' &&
                paymentsState.data.some((payment) => payment.subscriptionId === current.id && payment.status === 'success') && (
                  <p role="status" style={{ margin: '8px 0 0', fontWeight: 600, color: '#15803D', fontSize: '0.84rem' }}>
                    ✓ Gói đã kích hoạt. Bạn có thể sử dụng thẻ QR để check-in và đặt lịch lớp học.
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
            </div>
          </div>
        </section>
      )}

      {currentState.status === 'success' && !current && !pending && !isStatusSyncing && (
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
                  className="btn-primary"
                  disabled={!canRequest}
                  onClick={() => void handlePaymentRequest()}
                >
                  {sendingPayment ? 'Đang gửi…' : 'Tôi đã chuyển khoản'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { void loadCurrent(); void loadHistory(); void loadPayments(); }}
                >
                  Tải lại trạng thái
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
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { void loadCurrent(); void loadHistory(); void loadPayments(); }}
              >
                Tải lại trạng thái
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

            const isPending =
              pending?.packageId ===
              membershipPackage.id;

            const isSubmitting =
              submittingPackageId ===
              membershipPackage.id;

            const hasDifferentCurrentPackage =
              current !== null && !isCurrent;

            const disabled =
              submittingPackageId !== null ||
              packagesState.status !== 'success' || currentState.status !== 'success' ||
              historyState.status !== 'success' || paymentsState.status !== 'success' ||
              pendingItems.length > 0 ||
              ambiguousRenewal ||
              hasDifferentCurrentPackage;

            let buttonText = historyState.status === 'success' && historyState.data.length === 0
              ? 'Đăng ký lần đầu' : 'Đăng ký gói mới';

            if (isSubmitting) {
              buttonText = 'Đang xử lý…';
            } else if (pendingItems.length > 0) {
              buttonText = isPending
                ? 'Đang chờ xác nhận'
                : 'Có yêu cầu đang chờ';
            } else if (ambiguousRenewal) {
              buttonText = 'Cần kiểm tra lịch sử';
            } else if (current) {
              buttonText = isCurrent
                ? 'Gia hạn'
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

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: 18, width: '100%' }}
                    disabled={disabled}
                    onClick={() =>
                      void handleMembershipAction(
                        membershipPackage,
                        renewFrom,
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

      {requestResult && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            zIndex: 1000,
          }}
        >
          <section
            className="portal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-request-title"
            style={{
              width: 'min(520px, 100%)',
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
              {requestResult.action === 'renew'
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
            <button type="button" className="btn-primary" disabled style={{ marginTop: 16 }}>
              Tôi đã chuyển khoản
            </button>

            <p
              className="row-card__meta"
              style={{ marginTop: 16 }}
            >
              Yêu cầu đã được đồng bộ tới Quầy Lễ Tân. Gói tập sẽ được kích hoạt ngay sau khi nhân viên xác nhận thanh toán.
            </p>

            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => setRequestResult(null)}
            >
              Đóng
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

