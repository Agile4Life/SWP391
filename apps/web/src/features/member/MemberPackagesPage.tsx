import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import {
  createMembershipSubscription,
  getCurrentMembership,
  getMembershipHistory,
  getMembershipPackages,
  renewMembershipSubscription,
  type MemberSubscription,
  type MembershipPackage,
} from './membershipApi';

type PackagesState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'success';
      packages: MembershipPackage[];
      current: MemberSubscription | null;
      pending: MemberSubscription | null;
    };

interface RequestResult {
  subscription: MemberSubscription;
  membershipPackage: MembershipPackage;
  action: 'register' | 'renew';
}

const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

function formatPrice(price: number): string {
  return priceFormatter.format(price);
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('vi-VN');
}

export function MemberPackagesPage() {
  const [state, setState] = useState<PackagesState>({
    status: 'loading',
  });

  const [submittingPackageId, setSubmittingPackageId] =
    useState<number | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [requestResult, setRequestResult] =
    useState<RequestResult | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const [packages, current, history] = await Promise.all([
        getMembershipPackages(),
        getCurrentMembership(),
        getMembershipHistory(),
      ]);

      const pending =
        history.find(
          (subscription) =>
            subscription.status?.toLowerCase() === 'pending_payment',
        ) ?? null;

      setState({
        status: 'success',
        packages,
        current,
        pending,
      });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMembershipAction(
    membershipPackage: MembershipPackage,
  ) {
    if (
      state.status !== 'success' ||
      submittingPackageId !== null ||
      state.pending
    ) {
      return;
    }

    const isCurrentPackage =
      state.current?.packageId === membershipPackage.id;

    if (state.current && !isCurrentPackage) {
      return;
    }

    setSubmittingPackageId(membershipPackage.id);
    setActionError(null);

    try {
      const subscription =
        state.current && isCurrentPackage
          ? await renewMembershipSubscription(state.current.id)
          : await createMembershipSubscription(membershipPackage.id);

      setState((previous) =>
        previous.status === 'success'
          ? {
              ...previous,
              pending: subscription,
            }
          : previous,
      );

      setRequestResult({
        subscription,
        membershipPackage,
        action: state.current ? 'renew' : 'register',
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      setSubmittingPackageId(null);
    }
  }

  const activePackages =
    state.status === 'success'
      ? state.packages.filter(
          (membershipPackage) =>
            membershipPackage.status?.toLowerCase() === 'active',
        )
      : [];

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Hội viên"
        title="Gói tập"
        subtitle="Chọn gói tập phù hợp với mục tiêu của bạn."
      />

      {state.status === 'loading' && (
        <div className="portal-card" role="status">
          Đang tải danh sách gói tập…
        </div>
      )}

      {state.status === 'error' && (
        <div className="portal-card portal-empty" role="alert">
          <h2 className="portal-card-title">
            Không thể tải gói tập
          </h2>

          <p>Vui lòng thử lại sau ít phút.</p>

          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 20 }}
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}

      {state.status === 'success' && (
        <>
          {state.current && (
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
                {state.current.packageName}
              </h2>

              <p className="row-card__meta">
                Hiệu lực đến {formatDate(state.current.endDate)}
              </p>
            </section>
          )}

          {state.pending && (
            <section
              className="portal-card"
              style={{ marginBottom: 24 }}
            >
              <div className="meta-label">
                Đang chờ xác nhận
              </div>

              <h2
                className="portal-card-title"
                style={{ marginTop: 12 }}
              >
                {state.pending.packageName}
              </h2>

              <p className="row-card__meta">
                Yêu cầu #{state.pending.id} đang ở trạng thái chờ
                thanh toán.
              </p>
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

          {activePackages.length === 0 ? (
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
                  state.current?.packageId ===
                  membershipPackage.id;

                const isPending =
                  state.pending?.packageId ===
                  membershipPackage.id;

                const isSubmitting =
                  submittingPackageId ===
                  membershipPackage.id;

                const hasDifferentCurrentPackage =
                  state.current !== null && !isCurrent;

                const disabled =
                  submittingPackageId !== null ||
                  state.pending !== null ||
                  hasDifferentCurrentPackage;

                let buttonText = 'Đăng ký';

                if (isSubmitting) {
                  buttonText = 'Đang xử lý…';
                } else if (state.pending) {
                  buttonText = isPending
                    ? 'Đang chờ xác nhận'
                    : 'Có yêu cầu đang chờ';
                } else if (state.current) {
                  buttonText = isCurrent
                    ? 'Gia hạn'
                    : 'Đang có gói hoạt động';
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
                        )
                      }
                    >
                      {buttonText}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

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