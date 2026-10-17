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
        title="Gói tập"
        subtitle="Chọn gói tập phù hợp với mục tiêu của bạn."
      />

      {packagesState.status === 'loading' && (
        <div className="portal-card" role="status">
          Đang tải danh sách gói tập…
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

      <>
          {currentState.status === 'loading' && <p role="status">Đang tải gói hiện tại…</p>}
          {currentState.status === 'error' && <p role="alert">Không thể kiểm tra gói hiện tại. <button type="button" onClick={() => void loadCurrent()}>Thử lại</button></p>}
          {historyState.status === 'loading' && <p role="status">Đang kiểm tra yêu cầu đang chờ…</p>}
          {historyState.status === 'error' && <p role="alert">Không thể kiểm tra lịch sử gói. <button type="button" onClick={() => void loadHistory()}>Thử lại</button></p>}
          {paymentsState.status === 'loading' && <p role="status">Đang kiểm tra thanh toán…</p>}
          {paymentsState.status === 'error' && <p role="alert">Không thể kiểm tra thanh toán. <button type="button" onClick={() => void loadPayments()}>Thử lại</button></p>}
          {current && (
            <section
              className="portal-card"
              style={{ marginBottom: 24 }}
            >
              <div className="meta-label">
                Gói hiện tại
              </div>

              <h2
                className="portal-card-title"
                style={{ marginTop: 12 }}
              >
                {current.packageName}
              </h2>

              <p className="row-card__meta">
                Hiệu lực đến {formatDate(current.endDate)}
              </p>
              {current.status === 'active' && paymentsState.status === 'success' &&
                paymentsState.data.some((payment) => payment.subscriptionId === current.id && payment.status === 'success') &&
                <p role="status">Gói đã kích hoạt.</p>}
            </section>
          )}
          {currentState.status === 'success' && !current && (
            <p className="row-card__meta">Bạn chưa có gói đang hoạt động.</p>
          )}

          {pendingItems.length > 1 && <p role="alert">Có nhiều yêu cầu đang chờ. Vui lòng liên hệ nhân viên để kiểm tra.</p>}
          {pending && (
            <section
              className="portal-card"
              style={{ marginBottom: 24 }}
            >
              <div className="meta-label">
                Thanh toán gói tập
              </div>

              <h2
                className="portal-card-title"
                style={{ marginTop: 12 }}
              >
                {pending.packageName}
              </h2>

              <p className="row-card__meta">
                Yêu cầu #{pending.id} đang ở trạng thái chờ
                thanh toán.
              </p>
              {pendingPackage && <p className="row-card__meta">Số tiền: {formatPrice(pendingPackage.price)}</p>}
              {paymentsState.status === 'success' && relatedPayments.length === 0 && pendingPackage && (
                <>
                <p className="row-card__meta" role="status">{paymentInstructionsNotice}</p>
                <button type="button" className="btn-primary" disabled={!canRequest}
                  onClick={() => void handlePaymentRequest()}>
                  {sendingPayment ? 'Đang gửi…' : 'Tôi đã chuyển khoản'}
                </button>
                </>
              )}
              {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'pending') &&
                <p className="row-card__meta" role="status">Đã gửi thông báo chuyển khoản. Vui lòng chờ nhân viên xác nhận.</p>}
              {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'success') &&
                <p role="alert">Thanh toán đã ghi nhận nhưng gói chưa active. Vui lòng yêu cầu nhân viên kiểm tra.</p>}
              {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'failed') &&
                <p role="alert">Có giao dịch thất bại. Vui lòng liên hệ nhân viên để được hướng dẫn trước khi gửi yêu cầu mới.</p>}
              {paymentsState.status === 'success' && relatedPayments.some((payment) => payment.status === 'refunded') &&
                <p role="alert">Giao dịch đã hoàn tiền. Vui lòng liên hệ nhân viên để xác nhận cách thanh toán tiếp theo.</p>}
              {paymentsState.status === 'success' && relatedPayments.length === 0 && !pendingPackage &&
                <p role="alert">Không tìm thấy giá gói để gửi yêu cầu. Vui lòng thử lại sau.</p>}
              <button type="button" className="btn-secondary" onClick={() => { void loadCurrent(); void loadHistory(); void loadPayments(); }}>
                Tải lại trạng thái
              </button>
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
                    className="portal-card"
                    key={membershipPackage.id}
                  >
                    <div className="meta-label">
                      {membershipPackage.durationDays} ngày
                    </div>

                    <h2
                      className="portal-card-title"
                      style={{ margin: '18px 0 12px' }}
                    >
                      {membershipPackage.name}
                    </h2>

                    {membershipPackage.description && (
                      <p className="row-card__meta">
                        {membershipPackage.description}
                      </p>
                    )}

                    <div
                      className="metric-value"
                      style={{
                        fontSize: '1.9rem',
                        marginTop: 28,
                      }}
                    >
                      {formatPrice(membershipPackage.price)}
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: 24 }}
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
                  </article>
                );
              })}
            </div>
          ))}
      </>

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
            <button type="button" className="btn-primary" disabled style={{ marginTop: 20 }}>
              Tôi đã chuyển khoản
            </button>

            <p
              className="row-card__meta"
              style={{ marginTop: 20 }}
            >
              Gói tập chỉ được kích hoạt sau khi hệ thống xác
              nhận thanh toán.
            </p>

            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 24 }}
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
