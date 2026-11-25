import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal } from '../../../shared/ui/Modal';
import { LoadingSkeleton } from '../../../shared/ui/LoadingSkeleton';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useI18n } from '../../../shared/i18n';
import { useLanguage, type SourceMessage } from '../../../shared/i18n/language';
import { centerNowParts, formatCenterDate } from '../../../shared/lib/centerTime';
import { formatPrice } from '../../../shared/lib/membershipPresentation';
import { matchesDiscipline } from '../../../shared/lib/disciplines';
import { navigateToVnpay } from '../../payments/vnpayApi';
import { payWithWallet } from '../../wallet/walletApi';
import { formatSlotLabel } from '../../schedule/slots';
import { disciplineAccentColor } from '../../schedule/timetable';
import { memberError, memberMessage, memberNotify, memberRenderMessage } from '../memberI18n';
import {
  cancelCourse,
  checkoutCourse,
  enrollCourse,
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

const COURSE_PAY_METHODS: ReadonlyArray<'online_wallet' | 'vnpay' | 'cash'> = ['online_wallet', 'vnpay', 'cash'];

interface MemberGroupClassesViewProps {
  initialDiscipline?: string;
  onBookingChange?: () => void;
}

/**
 * Tab "Đăng ký lớp học" của Hội viên:
 * - Hiển thị hạn mức khóa học theo hạng gói tập.
 * - Lọc 1 chạm theo bộ môn (Gym, Boxing, Yoga) và tìm kiếm khóa học.
 * - Đăng ký miễn phí bằng hạn mức gói hoặc thanh toán vượt hạn mức (Ví SÖL / VNPay / Tiền mặt tại quầy).
 * - Hủy đăng ký trước ngày khai giảng.
 */
export function MemberGroupClassesView({ initialDiscipline, onBookingChange }: MemberGroupClassesViewProps) {
  useLanguage();
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses] = useState<GymClassDto[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [quota, setQuota] = useState<QuotaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | SourceMessage | null>(null);
  const [metaError, setMetaError] = useState<string | SourceMessage | null>(null);

  const [disciplineFilter, setDisciplineFilter] = useState<string>(initialDiscipline || searchParams.get('discipline') || 'ALL');
  useEffect(() => {
    if (initialDiscipline !== undefined) {
      setDisciplineFilter(initialDiscipline || 'ALL');
    }
  }, [initialDiscipline]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const busyRef = useRef(false);
  const [checkoutTarget, setCheckoutTarget] = useState<GymClassDto | null>(null);
  const [payMethod, setPayMethod] = useState<'online_wallet' | 'vnpay' | 'cash'>('online_wallet');
  const [checkoutError, setCheckoutError] = useState<string | SourceMessage | null>(null);
  const [pendingVnpayNotice, setPendingVnpayNotice] = useState<SourceMessage | null>(null);
  const payRadioRefs = useRef<Record<'online_wallet' | 'vnpay' | 'cash', HTMLButtonElement | null>>({
    online_wallet: null,
    vnpay: null,
    cash: null,
  });

  const selectDiscipline = (nextValue: string) => {
    setDisciplineFilter(nextValue);
    const next = new URLSearchParams(searchParams);
    if (nextValue === 'ALL') {
      next.delete('discipline');
      if (!next.get('tab')) next.set('tab', 'classes');
    } else {
      next.set('discipline', nextValue);
      if (!next.get('tab')) next.set('tab', 'classes');
    }
    setSearchParams(next, { replace: true });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMetaError(null);
    const [clsResult, enrollResult, quotaResult] = await Promise.allSettled([
      getClasses(),
      getMyEnrollments(),
      getMyQuota(),
    ]);

    if (clsResult.status === 'fulfilled') {
      setClasses(Array.isArray(clsResult.value) ? clsResult.value.filter((c) => String(c.status).toLowerCase() === 'active') : []);
    } else {
      setError(
        memberError(
          clsResult.reason,
          'Không thể tải danh sách lớp học. Vui lòng thử lại.',
          'Could not load group classes. Please try again.',
        ),
      );
    }

    if (enrollResult.status === 'fulfilled') {
      setEnrollments(Array.isArray(enrollResult.value) ? enrollResult.value : []);
    } else {
      setEnrollments([]);
    }

    if (quotaResult.status === 'fulfilled') {
      setQuota(quotaResult.value);
    } else {
      setQuota(null);
    }

    if (enrollResult.status === 'rejected' || quotaResult.status === 'rejected') {
      const failedReason = enrollResult.status === 'rejected'
        ? enrollResult.reason
        : quotaResult.status === 'rejected'
          ? quotaResult.reason
          : undefined;
      setMetaError(
        memberError(
          failedReason,
          'Không thể tải trạng thái đăng ký và hạn mức khóa học. Vui lòng thử lại trước khi đăng ký.',
          'Unable to load your course enrollments and quota. Please retry before registering.',
        ),
      );
    }

    setLoading(false);
  }, []);

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
  const metaLoadFailed = Boolean(metaError);
  const noActiveMembership = Boolean(quota && !quota.tier);
  const hasFreeCredit = Boolean(quota && quota.tier && (quota.unlimited || quota.remainingCredits > 0));
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
    if (busyRef.current || busyId !== null || metaLoadFailed || noActiveMembership) return;

    if (hasFreeCredit || !cls.price || cls.price <= 0) {
      busyRef.current = true;
      let ok = false;
      try {
        ok = await confirm({
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
      } finally {
        if (!ok) busyRef.current = false;
      }
      if (!ok) return;
      setBusyId(cls.id);
      try {
        if (hasFreeCredit) {
          await enrollCourse(cls.id);
        } else {
          await checkoutCourse(cls.id, 'cash');
        }
        memberNotify(
          memberMessage(`Đăng ký khóa "${cls.name}" thành công!`, `Registered for "${cls.name}" successfully!`),
          'success',
          { record: true },
        );
        await loadData();
        onBookingChange?.();
      } catch (err) {
        memberNotify(
          memberError(err, 'Không thể đăng ký khóa học.', 'Could not register for course.'),
          'error',
        );
      } finally {
        busyRef.current = false;
        setBusyId(null);
      }
      return;
    }

    setCheckoutError(null);
    setPayMethod('online_wallet');
    setCheckoutTarget(cls);
  };

  const handlePaidCheckout = async () => {
    if (!checkoutTarget || busyRef.current || busyId !== null) return;
    busyRef.current = true;
    setBusyId(checkoutTarget.id);
    setCheckoutError(null);
    setPendingVnpayNotice(null);
    try {
      const res = await checkoutCourse(checkoutTarget.id, payMethod);
      if (payMethod === 'vnpay') {
        if (res.paymentUrl) {
          navigateToVnpay(res.paymentUrl);
          return;
        }
        const warningMessage = memberMessage(
          `Chỗ học khóa "${checkoutTarget.name}" đã được giữ tạm chờ thanh toán nhưng chưa mở được cổng VNPay. Vui lòng vào mục Hóa đơn để hoàn tất thanh toán VNPay.`,
          `Your seat for "${checkoutTarget.name}" is reserved pending payment, but the VNPay gateway could not be opened. Please go to Invoices to complete VNPay payment.`,
        );
        memberNotify(warningMessage, 'error', { record: true, destination: '/member/invoices' });
        setPendingVnpayNotice(warningMessage);
        setCheckoutTarget(null);
        await loadData();
        onBookingChange?.();
        return;
      }

      if (payMethod === 'online_wallet') {
        const paymentStatus = String(res.paymentStatus ?? '').toLowerCase();
        if (paymentStatus === 'pending' && res.paymentId) {
          try {
            await payWithWallet({ paymentId: res.paymentId });
          } catch (walletErr) {
            void loadData();
            throw walletErr;
          }
        } else if (paymentStatus !== 'success') {
          setCheckoutError(
            memberMessage(
              'Thanh toán bằng Ví SÖL chưa hoàn tất. Vui lòng kiểm tra mục Hóa đơn để hoàn tất thanh toán.',
              'SÖL Wallet payment did not complete. Please check Invoices to finish payment.',
            ),
          );
          return;
        }
        window.dispatchEvent(new Event('wallet-updated'));
        window.dispatchEvent(new Event('member-notifications-changed'));
        memberNotify(
          memberMessage(`Đăng ký khóa "${checkoutTarget.name}" thành công!`, `Registered for "${checkoutTarget.name}" successfully!`),
          'success',
          { record: true },
        );
        setCheckoutTarget(null);
        await loadData();
        onBookingChange?.();
        return;
      }

      memberNotify(
        memberMessage(
          `Đã giữ chỗ khóa "${checkoutTarget.name}". Vui lòng thanh toán tại quầy lễ tân trước ngày khai giảng.`,
          `Spot reserved for "${checkoutTarget.name}". Please pay at reception before start date.`,
        ),
        'success',
        { record: true },
      );
      setCheckoutTarget(null);
      await loadData();
      onBookingChange?.();
    } catch (err) {
      setCheckoutError(
        memberError(
          err,
          'Không thể thanh toán khóa học. Vui lòng thử lại.',
          'Could not complete course checkout. Please try again.',
        ),
      );
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const handleCancelCourse = async (cls: GymClassDto) => {
    if (busyRef.current || busyId !== null) return;
    busyRef.current = true;
    let ok = false;
    try {
      ok = await confirm({
        title: t('Hủy đăng ký khóa học?', 'Cancel course registration?'),
        message: t(
          `Bạn có chắc muốn hủy đăng ký khóa "${cls.name}"? Lượt miễn phí hoặc học phí đã trả sẽ được hoàn lại theo chính sách.`,
          `Are you sure you want to cancel "${cls.name}"? Free credits or paid fees will be refunded per policy.`,
        ),
        confirmLabel: t('Xác nhận hủy', 'Confirm cancellation'),
        cancelLabel: t('Giữ lại', 'Keep'),
        danger: true,
      });
    } finally {
      if (!ok) busyRef.current = false;
    }
    if (!ok) return;
    setBusyId(cls.id);
    try {
      await cancelCourse(cls.id);
      memberNotify(
        memberMessage(`Đã hủy đăng ký khóa "${cls.name}".`, `Cancelled registration for "${cls.name}".`),
        'success',
        { record: true },
      );
      await loadData();
      onBookingChange?.();
    } catch (err) {
      memberNotify(
        memberError(err, 'Không thể hủy đăng ký khóa học.', 'Could not cancel course registration.'),
        'error',
      );
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const handlePayMethodKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: 'online_wallet' | 'vnpay' | 'cash') => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const index = COURSE_PAY_METHODS.indexOf(current);
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const nextMethod = COURSE_PAY_METHODS[(index + delta + COURSE_PAY_METHODS.length) % COURSE_PAY_METHODS.length];
    setPayMethod(nextMethod);
    payRadioRefs.current[nextMethod]?.focus();
  };

  if (loading && classes.length === 0) {
    return <LoadingSkeleton label={t('Đang tải danh sách lớp học...', 'Loading group classes...')} count={5} />;
  }

  if (error && classes.length === 0) {
    return (
      <div className="portal-state" role="alert">
        <p>{memberRenderMessage(error)}</p>
        <button type="button" className="btn-secondary" onClick={() => void loadData()}>
          {t('Thử lại', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div data-i18n-managed data-testid="member-group-classes">
      {pendingVnpayNotice && (
        <div
          className="portal-alert portal-alert--error"
          role="alert"
          data-testid="vnpay-missing-url-alert"
          style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
        >
          <span>{memberRenderMessage(pendingVnpayNotice)}</span>
          <Link to="/member/invoices" className="btn-secondary btn-sm">
            {t('Đến mục Hóa đơn', 'Go to Invoices')}
          </Link>
        </div>
      )}

      {metaError && (
        <div
          className="portal-alert portal-alert--error"
          role="alert"
          data-testid="member-classes-meta-error"
          style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
        >
          <span>{memberRenderMessage(metaError)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void loadData()}>
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      {/* Banner hạn mức khóa học */}
      {quota && !metaLoadFailed && (
        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>{t('Quyền lợi khóa học nhóm của gói tập', 'Membership group class allowance')}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--portal-muted)' }}>
                {noActiveMembership
                  ? t(
                      'Bạn chưa có gói tập đang hoạt động. Cần kích hoạt gói tập để đăng ký khóa học nhóm.',
                      'You do not have an active membership. An active membership is required to register for group courses.',
                    )
                  : quota.unlimited
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
            <Link to="/member/packages" className={noActiveMembership ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
              {noActiveMembership ? t('Đăng ký gói tập', 'Register membership') : t('Xem gói tập', 'View memberships')}
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
            onClick={() => selectDiscipline('ALL')}
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
                onClick={() => selectDiscipline(d.name)}
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
            const registrationClosed = Boolean(cls.startDate && cls.startDate < today);
            const cannotCancel = Boolean(cls.startDate && cls.startDate <= today);
            const startsToday = Boolean(cls.startDate && cls.startDate === today);
            const accent = disciplineAccentColor(cls.disciplineId);
            const finalFee = discountedPrice(cls.price);
            const isBusy = busyId === cls.id;
            const anyBusy = busyId !== null;

            return (
              <article
                key={cls.id}
                className="portal-card"
                data-testid={`member-class-card-${cls.id}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--portal-muted)' }}>
                      <span className="class-discipline-dot" style={{ background: accent }} aria-hidden="true" />
                      {cls.disciplineName}
                    </span>
                    <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>{cls.name}</h3>
                  </div>
                  {enrolled ? (
                    <span className="badge badge-success">{t('Đã đăng ký', 'Enrolled')}</span>
                  ) : registrationClosed ? (
                    <span className="badge badge-neutral">{t('Đã khai giảng', 'Started')}</span>
                  ) : startsToday ? (
                    <span className="badge badge-info">{t('Khai giảng hôm nay', 'Starts today')}</span>
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
                      {cls.startTime && cls.endTime ? ` · ${formatSlotLabel(cls.startTime, cls.endTime)}` : ''}
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
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {hasFreeCredit || !finalFee
                        ? t('Miễn phí theo gói', 'Free with membership')
                        : formatPrice(finalFee)}
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {enrolled ? (
                    !cannotCancel ? (
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={anyBusy || metaLoadFailed}
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
                      disabled={registrationClosed || anyBusy || metaLoadFailed || noActiveMembership || Boolean(quota?.enrollBlockedUntil)}
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
              {memberRenderMessage(checkoutError)}
            </div>
          )}
          <div className="kv-list" style={{ marginBottom: 14 }}>
            <div className="kv-row">
              <span>{t('Khóa học', 'Course')}</span>
              <strong>{checkoutTarget.name}</strong>
            </div>
            <div className="kv-row">
              <span>{t('Học phí cần thanh toán', 'Amount due')}</span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(discountedPrice(checkoutTarget.price))}</strong>
            </div>
          </div>

          <div className="portal-form-group">
            <span className="portal-label">{t('Phương thức thanh toán', 'Payment method')}</span>
            <div className="filter-chips" role="radiogroup" aria-label={t('Chọn phương thức thanh toán', 'Select payment method')}>
              <button
                ref={(el) => { payRadioRefs.current.online_wallet = el; }}
                type="button"
                role="radio"
                aria-checked={payMethod === 'online_wallet'}
                tabIndex={payMethod === 'online_wallet' ? 0 : -1}
                className={`filter-chip${payMethod === 'online_wallet' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('online_wallet')}
                onKeyDown={(e) => handlePayMethodKeyDown(e, 'online_wallet')}
              >
                {t('Ví điện tử SÖL', 'SÖL wallet')}
              </button>
              <button
                ref={(el) => { payRadioRefs.current.vnpay = el; }}
                type="button"
                role="radio"
                aria-checked={payMethod === 'vnpay'}
                tabIndex={payMethod === 'vnpay' ? 0 : -1}
                className={`filter-chip${payMethod === 'vnpay' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('vnpay')}
                onKeyDown={(e) => handlePayMethodKeyDown(e, 'vnpay')}
              >
                VNPay
              </button>
              <button
                ref={(el) => { payRadioRefs.current.cash = el; }}
                type="button"
                role="radio"
                aria-checked={payMethod === 'cash'}
                tabIndex={payMethod === 'cash' ? 0 : -1}
                className={`filter-chip${payMethod === 'cash' ? ' is-active' : ''}`}
                onClick={() => setPayMethod('cash')}
                onKeyDown={(e) => handlePayMethodKeyDown(e, 'cash')}
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
