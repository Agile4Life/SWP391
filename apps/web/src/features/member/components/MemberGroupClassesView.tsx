import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../../shared/ui/Modal';
import { LoadingSkeleton } from '../../../shared/ui/LoadingSkeleton';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useI18n } from '../../../shared/i18n';
import { useLanguage } from '../../../shared/i18n/language';
import { ApiError } from '../../../shared/api/client';
import { centerNowParts, formatCenterDate } from '../../../shared/lib/centerTime';
import { formatPrice } from '../../../shared/lib/membershipPresentation';
import { matchesDiscipline } from '../../../shared/lib/disciplines';
import { notify } from '../../../shared/lib/portalNotices';
import { navigateToVnpay } from '../../payments/vnpayApi';
import { disciplineAccentColor, hhmm } from '../../schedule/timetable';
import {
  cancelCourse,
  checkoutCourse,
  getClasses,
  getMyEnrollments,
  getMyQuota,
  type EnrollmentDto,
  type GymClassDto,
  type QuotaDto,
} from '../memberClassesApi';

const DAY_SHORT: Record<string, [string, string]> = {
  MONDAY: ['T2', 'Mon'],
  TUESDAY: ['T3', 'Tue'],
  WEDNESDAY: ['T4', 'Wed'],
  THURSDAY: ['T5', 'Thu'],
  FRIDAY: ['T6', 'Fri'],
  SATURDAY: ['T7', 'Sat'],
  SUNDAY: ['CN', 'Sun'],
};

interface MemberGroupClassesViewProps {
  initialDiscipline?: string;
  onBookingChange?: () => void;
}

/**
 * Tab "Đăng ký lớp học" của Hội viên:
 * - Hiển thị hạn mức khóa học theo hạng gói tập.
 * - Lọc 1 chạm theo bộ môn (Yoga, Boxing, Pilates…) và tìm kiếm khóa học.
 * - Đăng ký miễn phí bằng hạn mức gói hoặc thanh toán vượt hạn mức (Ví SÖL / VNPay / Tiền mặt tại quầy).
 * - Hủy đăng ký trước ngày khai giảng.
 */
export function MemberGroupClassesView({ initialDiscipline, onBookingChange }: MemberGroupClassesViewProps) {
  useLanguage();
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();

  const [classes, setClasses] = useState<GymClassDto[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [quota, setQuota] = useState<QuotaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [disciplineFilter, setDisciplineFilter] = useState<string>(initialDiscipline || 'ALL');
  useEffect(() => {
    setDisciplineFilter(initialDiscipline || 'ALL');
  }, [initialDiscipline]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<GymClassDto | null>(null);
  const [payMethod, setPayMethod] = useState<'online_wallet' | 'vnpay' | 'cash'>('online_wallet');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clsList, enrollList, quotaRes] = await Promise.all([
        getClasses(),
        getMyEnrollments().catch(() => [] as EnrollmentDto[]),
        getMyQuota().catch(() => null),
      ]);
      setClasses(Array.isArray(clsList) ? clsList.filter((c) => String(c.status).toLowerCase() === 'active') : []);
      setEnrollments(Array.isArray(enrollList) ? enrollList : []);
      setQuota(quotaRes);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('Không thể tải danh sách lớp học. Vui lòng thử lại.', 'Could not load group classes. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeEnrollmentByClass = useMemo(() => {
    const map = new Map<number, EnrollmentDto>();
    for (const item of enrollments) {
      if (String(item.status).toLowerCase() === 'booked') {
        map.set(item.classId, item);
      }
    }
    return map;
  }, [enrollments]);

  const disciplines = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; count: number }>();
    for (const cls of classes) {
      const existing = seen.get(cls.disciplineId);
      if (existing) existing.count += 1;
      else seen.set(cls.disciplineId, { id: cls.disciplineId, name: cls.disciplineName, count: 1 });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [classes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const normDisc = disciplineFilter.trim().toLowerCase();
    return classes.filter((cls) => {
      const matchDisc =
        disciplineFilter === 'ALL'
        || String(cls.disciplineId) === disciplineFilter
        || cls.disciplineName.toLowerCase() === normDisc
        || matchesDiscipline(cls.disciplineName, disciplineFilter);
      const matchSearch =
        !needle
        || [cls.name, cls.disciplineName, cls.coachName, cls.roomName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      return matchDisc && matchSearch;
    });
  }, [classes, disciplineFilter, search]);

  const today = centerNowParts().date;
  const hasFreeCredit = Boolean(quota && (quota.unlimited || quota.remainingCredits > 0));
  const discountPercent = quota?.discountPercent ?? 0;

  const discountedPrice = (rawPrice?: number) => {
    const base = typeof rawPrice === 'number' && rawPrice > 0 ? rawPrice : 0;
    if (base === 0 || discountPercent <= 0) return base;
    return Math.round((base * (100 - discountPercent)) / 100);
  };

  const formatDays = (raw?: string) => {
    if (!raw) return t('Theo lịch trung tâm', 'As scheduled');
    return raw
      .split(',')
      .map((code) => {
        const pair = DAY_SHORT[code.trim().toUpperCase()];
        return pair ? t(pair[0], pair[1]) : code.trim();
      })
      .join(', ');
  };

  const handleEnrollClick = async (cls: GymClassDto) => {
    if (hasFreeCredit || !cls.price || cls.price <= 0) {
      const ok = await confirm({
        title: t('Xác nhận đăng ký khóa học', 'Confirm course registration'),
        message: hasFreeCredit
          ? t(
              `Đăng ký khóa "${cls.name}" bằng 1 lượt miễn phí trong gói tập hiện tại?`,
              `Register for "${cls.name}" using 1 free course credit from your active membership?`,
            )
          : t(`Xác nhận đăng ký khóa "${cls.name}"?`, `Confirm registration for "${cls.name}"?`),
        confirmLabel: t('Đăng ký ngay', 'Register now'),
        cancelLabel: t('Để sau', 'Later'),
      });
      if (!ok) return;
      setBusyId(cls.id);
      try {
        await checkoutCourse(cls.id, 'cash');
        notify(t(`Đăng ký khóa "${cls.name}" thành công!`, `Registered for "${cls.name}" successfully!`), 'success', { record: true });
        await loadData();
        onBookingChange?.();
      } catch (err) {
        notify(
          err instanceof Error && err.message
            ? err.message
            : t('Không thể đăng ký khóa học.', 'Could not register for course.'),
          'error',
        );
      } finally {
        setBusyId(null);
      }
      return;
    }

    setCheckoutError(null);
    setPayMethod('online_wallet');
    setCheckoutTarget(cls);
  };

  const handlePaidCheckout = async () => {
    if (!checkoutTarget) return;
    setBusyId(checkoutTarget.id);
    setCheckoutError(null);
    try {
      const res = await checkoutCourse(checkoutTarget.id, payMethod);
      if (payMethod === 'vnpay' && res.paymentUrl) {
        navigateToVnpay(res.paymentUrl);
        return;
      }
      notify(
        payMethod === 'cash'
          ? t(`Đã giữ chỗ khóa "${checkoutTarget.name}". Vui lòng thanh toán tại quầy lễ tân trước ngày khai giảng.`, `Spot reserved for "${checkoutTarget.name}". Please pay at reception before start date.`)
          : t(`Đăng ký khóa "${checkoutTarget.name}" thành công!`, `Registered for "${checkoutTarget.name}" successfully!`),
        'success',
        { record: true },
      );
      setCheckoutTarget(null);
      await loadData();
      onBookingChange?.();
    } catch (err) {
      setCheckoutError(
        err instanceof Error && err.message
          ? err.message
          : t('Không thể thanh toán khóa học. Vui lòng thử lại.', 'Could not complete course checkout. Please try again.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelCourse = async (cls: GymClassDto) => {
    const ok = await confirm({
      title: t('Hủy đăng ký khóa học?', 'Cancel course registration?'),
      message: t(
        `Bạn có chắc muốn hủy đăng ký khóa "${cls.name}"? Lượt miễn phí hoặc học phí đã trả sẽ được hoàn lại theo chính sách.`,
        `Are you sure you want to cancel "${cls.name}"? Free credits or paid fees will be refunded per policy.`,
      ),
      confirmLabel: t('Xác nhận hủy', 'Confirm cancellation'),
      cancelLabel: t('Giữ lại', 'Keep'),
      danger: true,
    });
    if (!ok) return;
    setBusyId(cls.id);
    try {
      await cancelCourse(cls.id);
      notify(t(`Đã hủy đăng ký khóa "${cls.name}".`, `Cancelled registration for "${cls.name}".`), 'success', { record: true });
      await loadData();
      onBookingChange?.();
    } catch (err) {
      notify(
        err instanceof Error && err.message
          ? err.message
          : t('Không thể hủy đăng ký khóa học.', 'Could not cancel course registration.'),
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading && classes.length === 0) {
    return <LoadingSkeleton label={t('Đang tải danh sách lớp học...', 'Loading group classes...')} count={5} />;
  }

  if (error && classes.length === 0) {
    return (
      <div className="portal-state" role="alert">
        <p>{error}</p>
        <button type="button" className="btn-secondary" onClick={() => void loadData()}>
          {t('Thử lại', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div data-i18n-managed data-testid="member-group-classes">
      {/* Banner hạn mức khóa học */}
      {quota && (
        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>{t('Quyền lợi khóa học nhóm của gói tập', 'Membership group class allowance')}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--portal-muted)' }}>
                {quota.unlimited
                  ? t('Gói hiện tại được đăng ký khóa học nhóm không giới hạn.', 'Your active membership includes unlimited group courses.')
                  : quota.remainingCredits > 0
                    ? t(
                        `Còn ${quota.remainingCredits} lượt đăng ký khóa học miễn phí trong chu kỳ hiện tại.`,
                        `${quota.remainingCredits} free course credit(s) remaining in your current cycle.`,
                      )
                    : t(
                        discountPercent > 0
                          ? `Bạn đã dùng hết lượt miễn phí; khóa học đăng ký thêm được giảm ${discountPercent}%.`
                          : 'Bạn đã dùng hết lượt miễn phí trong chu kỳ này; vẫn có thể đăng ký thêm có phí.',
                        discountPercent > 0
                          ? `You have used your free credits; extra courses receive a ${discountPercent}% member discount.`
                          : 'No free credits remaining this cycle; extra paid courses are available.',
                      )}
              </p>
              {quota.enrollBlockedUntil && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--portal-danger)' }}>
                  {t(
                    `Tạm khóa đăng ký khóa mới đến hết ngày ${formatCenterDate(quota.enrollBlockedUntil)}.`,
                    `New course registration paused until ${formatCenterDate(quota.enrollBlockedUntil)}.`,
                  )}
                </p>
              )}
            </div>
            <Link to="/member/packages" className="btn-secondary btn-sm">
              {t('Xem gói tập', 'View memberships')}
            </Link>
          </div>
        </div>
      )}

      {/* Thanh chip lọc bộ môn & ô tìm kiếm */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div className="class-discipline-chips" role="group" aria-label={t('Lọc khóa học theo bộ môn', 'Filter courses by discipline')}>
          <button
            type="button"
            className={`filter-chip${disciplineFilter === 'ALL' ? ' is-active' : ''}`}
            aria-pressed={disciplineFilter === 'ALL'}
            onClick={() => setDisciplineFilter('ALL')}
          >
            {t(`Tất cả bộ môn (${classes.length})`, `All disciplines (${classes.length})`)}
          </button>
          {disciplines.map((d) => {
            const selected =
              disciplineFilter === String(d.id)
              || disciplineFilter.toLowerCase() === d.name.toLowerCase()
              || (disciplineFilter !== 'ALL' && matchesDiscipline(d.name, disciplineFilter));
            return (
              <button
                key={d.id}
                type="button"
                data-testid={`member-discipline-chip-${d.id}`}
                className={`filter-chip${selected ? ' is-active' : ''}`}
                aria-pressed={selected}
                onClick={() => setDisciplineFilter(String(d.id))}
              >
                <span className="class-discipline-dot" style={{ background: disciplineAccentColor(d.id) }} aria-hidden="true" />
                {`${d.name} (${d.count})`}
              </button>
            );
          })}
        </div>

        <div className="class-filter-bar" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="class-filter-field" style={{ flex: '1 1 260px' }}>
            <label className="portal-label" htmlFor="member-class-search">{t('Tìm khóa học', 'Search courses')}</label>
            <input
              id="member-class-search"
              className="portal-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Tên lớp, bộ môn, phòng tập hoặc HLV…', 'Course, discipline, room, or coach…')}
            />
          </div>
        </div>
      </div>

      {/* Danh sách thẻ khóa học */}
      {filtered.length === 0 ? (
        <div className="portal-empty" role="status">
          <p>{t('Hiện chưa có khóa học nào mở đăng ký theo bộ lọc này.', 'No open courses match this filter.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map((cls) => {
            const enrolled = activeEnrollmentByClass.get(cls.id);
            const started = Boolean(cls.startDate && cls.startDate <= today);
            const accent = disciplineAccentColor(cls.disciplineId);
            const finalFee = discountedPrice(cls.price);
            const isBusy = busyId === cls.id;

            return (
              <article
                key={cls.id}
                className="portal-card"
                data-testid={`member-class-card-${cls.id}`}
                style={{ borderLeft: `4px solid ${accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--portal-muted)' }}>{cls.disciplineName}</span>
                    <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>{cls.name}</h3>
                  </div>
                  {enrolled ? (
                    <span className="badge badge-success">{t('Đã đăng ký', 'Enrolled')}</span>
                  ) : started ? (
                    <span className="badge badge-neutral">{t('Đã khai giảng', 'Started')}</span>
                  ) : null}
                </div>

                {cls.description && (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--portal-muted)' }}>{cls.description}</p>
                )}

                <div className="kv-list">
                  <div className="kv-row">
                    <span>{t('Lịch học', 'Schedule')}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatDays(cls.recurringDays)}
                      {cls.startTime && cls.endTime ? ` · ${hhmm(cls.startTime)}–${hhmm(cls.endTime)}` : ''}
                    </strong>
                  </div>
                  {cls.startDate && cls.endDate && (
                    <div className="kv-row">
                      <span>{t('Thời gian khóa', 'Course dates')}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {`${formatCenterDate(cls.startDate)} – ${formatCenterDate(cls.endDate)}`}
                      </strong>
                    </div>
                  )}
                  <div className="kv-row">
                    <span>{t('Phòng & HLV', 'Room & coach')}</span>
                    <strong>{`${cls.roomName} · ${cls.coachName}`}</strong>
                  </div>
                  <div className="kv-row">
                    <span>{t('Chi phí', 'Fee')}</span>
                    <strong>
                      {hasFreeCredit || !finalFee
                        ? t('Miễn phí theo gói', 'Free with membership')
                        : formatPrice(finalFee)}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {enrolled ? (
                    !started ? (
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={isBusy}
                        onClick={() => void handleCancelCourse(cls)}
                      >
                        {isBusy ? t('Đang hủy...', 'Cancelling...') : t('Hủy đăng ký', 'Cancel registration')}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--portal-muted)' }}>
                        {t('Khóa đã bắt đầu', 'Course in progress')}
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={started || isBusy || Boolean(quota?.enrollBlockedUntil)}
                      onClick={() => void handleEnrollClick(cls)}
                    >
                      {isBusy ? t('Đang xử lý...', 'Processing...') : t('Đăng ký khóa học', 'Register course')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal thanh toán khóa học vượt hạn mức */}
      {checkoutTarget && (
        <Modal
          title={t(`Thanh toán khóa học: ${checkoutTarget.name}`, `Course checkout: ${checkoutTarget.name}`)}
          onClose={() => setCheckoutTarget(null)}
          busy={busyId === checkoutTarget.id}
        >
          {checkoutError && (
            <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>
              {checkoutError}
            </div>
          )}
          <div className="kv-list" style={{ marginBottom: 14 }}>
            <div className="kv-row">
              <span>{t('Khóa học', 'Course')}</span>
              <strong>{checkoutTarget.name}</strong>
            </div>
            <div className="kv-row">
              <span>{t('Học phí cần thanh toán', 'Amount due')}</span>
              <strong>{formatPrice(discountedPrice(checkoutTarget.price))}</strong>
            </div>
          </div>

          <div className="portal-form-group">
            <span className="portal-label">{t('Phương thức thanh toán', 'Payment method')}</span>
            <div className="filter-chips" role="radiogroup" aria-label={t('Chọn phương thức thanh toán', 'Select payment method')}>
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === 'online_wallet'}
                className={`filter-chip${payMethod === 'online_wallet' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('online_wallet')}
              >
                {t('Ví điện tử SÖL', 'SÖL wallet')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === 'vnpay'}
                className={`filter-chip${payMethod === 'vnpay' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('vnpay')}
              >
                VNPay
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === 'cash'}
                className={`filter-chip${payMethod === 'cash' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('cash')}
              >
                {t('Tiền mặt tại quầy lễ tân', 'Cash at reception')}
              </button>
            </div>
          </div>

          <div className="mcal__dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => setCheckoutTarget(null)} disabled={busyId === checkoutTarget.id}>
              {t('Hủy', 'Cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={() => void handlePaidCheckout()} disabled={busyId === checkoutTarget.id}>
              {busyId === checkoutTarget.id ? t('Đang xử lý...', 'Processing...') : t('Xác nhận đăng ký', 'Confirm registration')}
            </button>
          </div>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}
