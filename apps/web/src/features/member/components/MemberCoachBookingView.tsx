import { memberMessage, memberError, memberText, memberRenderMessage, memberNotify } from '../memberI18n';
import type { SourceMessage } from '../../../shared/i18n/language';
import { useLanguage } from '../../../shared/i18n/language';
import { VnpayPayButton } from '../../payments/VnpayPayButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeMembershipChanges } from '../membershipRealtime';
import { Modal } from '../../../shared/ui/Modal';
import { DatePicker } from '../../../shared/ui/DatePicker';
import { centerNowParts, formatCenterDate, parseCenterTime } from '../../../shared/lib/centerTime';
import { addDays, parseISODate } from '../../schedule/timetable';
import { findScheduleSlot, findSlotByNumber, formatSlotLabel } from '../../schedule/slots';
import {
  getCoaches,
  getAvailableSlots,
  createCoachBooking,
  getMyCoachBookings,
  cancelCoachBooking,
  getMemberQuotaStatus,
  type CoachPublicDto,
  type CoachAvailableSlotDto,
  type CoachBookingDto,
  type CoachQuotaStatusDto,
} from '../coachBookingApi';
import { coachIllustration } from '../../../shared/lib/coachIllustration';
import { formatPrice, localizeSeededPackageName } from '../../../shared/lib/membershipPresentation';
import { ApiError } from '../../../shared/api/client';
import {
  formatCoachName,
  isSessionCompleted,
  isSessionStarted,
} from '../coachBookingUtils';

/** Chuyển lỗi đặt lịch PT thành thông báo dễ hiểu (gói hết hạn, hết hạn mức...). */
function coachBookingErrorMessage(err: unknown): string | SourceMessage {
  if (err instanceof ApiError) {
    if (err.code === 'MEMBERSHIP_INACTIVE_OR_EXPIRED') {
      return memberMessage('Cần có gói tập đang hoạt động để đặt lịch HLV 1:1.');
    }
    if (err.code === 'COACH_BOOKING_PACKAGE_NO_QUOTA') {
      return memberMessage(
        'Gói hiện tại không có lượt PT 1:1 miễn phí. Chọn thanh toán theo slot.',
        'Your plan has no free 1:1 sessions. Choose pay per slot.',
      );
    }
    if (err.code === 'COACH_BOOKING_QUOTA_EXCEEDED') {
      return memberMessage(
        'Đã hết lượt PT 1:1 miễn phí của tháng. Chọn thanh toán theo slot.',
        'Your free 1:1 sessions for this month are used up. Choose pay per slot.',
      );
    }
    return err.message;
  }
  return memberError(err, 'Không thể đặt lịch. Vui lòng thử lại.');
}

/** Ngày hôm nay theo giờ trung tâm. */
function localToday(): string {
  return centerNowParts().date;
}

/** Danh sách `count` ngày liên tiếp từ `start` (mặc định hôm nay) kèm tên thứ, ngày, tháng và nhãn. */
function nextDays(count = 14, start = localToday()): Array<{
  iso: string;
  dayName: string;
  dayNumber: string;
  monthText: string;
  label: string;
  isToday: boolean;
}> {
  const days: Array<{
    iso: string;
    dayName: string;
    dayNumber: string;
    monthText: string;
    label: string;
    isToday: boolean;
  }> = [];
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const todayIso = localToday();
  for (let i = 0; i < count; i++) {
    const iso = addDays(start, i);
    const d = parseISODate(iso);
    const dayName = memberText(dayNames[d.getDay()], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]);
    const dayNumber = String(d.getDate()).padStart(2, '0');
    const monthText = memberText(`Tháng ${d.getMonth() + 1}`, `Month ${d.getMonth() + 1}`);
    days.push({
      iso,
      dayName,
      dayNumber,
      monthText,
      label: `${iso === todayIso ? memberText('Hôm nay') : dayName} (${dayNumber}/${String(d.getMonth() + 1).padStart(2, '0')})`,
      isToday: iso === todayIso,
    });
  }
  return days;
}

/**
 * Giao diện đặt lịch PT 1:1 của hội viên: chọn HLV và ngày, xem khung giờ, đặt lịch (miễn phí theo hạn mức hoặc
 * trả tiền), hủy lịch và xem các buổi đã đặt.
 */
export function MemberCoachBookingView({
  onBookingSuccess,
}: {
  onBookingSuccess?: () => void;
}) {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<CoachPublicDto[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(localToday());
  const [slots, setSlots] = useState<CoachAvailableSlotDto[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<CoachAvailableSlotDto | null>(null);
  const [myBookings, setMyBookings] = useState<CoachBookingDto[]>([]);
  const [bookingDateFilter, setBookingDateFilter] = useState<string>('');
  const [quotaStatus, setQuotaStatus] = useState<CoachQuotaStatusDto | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [initRetryTick, setInitRetryTick] = useState(0);
  const [slotRetryTick, setSlotRetryTick] = useState(0);
  const [errorCode, setErrorCode] = useState<string | undefined | SourceMessage>();
  // Lỗi gửi của hộp thoại hiện ngay trong hộp thoại (không dùng banner đầu trang nằm sau lớp nền mờ).
  const [bookingError, setBookingError] = useState<string | SourceMessage>('');
  const [cancelError, setCancelError] = useState<string | SourceMessage>('');
  // quotaStatus giữ null khi đang tải hoặc khi yêu cầu lỗi; chỉ kết quả đã tải xong mà không có gói mới nghĩa là chưa có gói.
  const hasNoPackage = quotaStatus !== null && !quotaStatus.packageName;
  const isTrial = Boolean(
    quotaStatus?.packageName && (
      quotaStatus.packageName.toLowerCase().includes('trải nghiệm') ||
      quotaStatus.packageName.toLowerCase().includes('trai nghiem') ||
      quotaStatus.packageName.toUpperCase().includes('TRIAL')
    ),
  );
  const displayedPackageName = isTrial
    ? localizeSeededPackageName('Gói Trải Nghiệm 3 Ngày', lang)
    : quotaStatus?.packageName
      ? localizeSeededPackageName(quotaStatus.packageName, lang)
      : 'Gold / Platinum';
  const ptDiscountPercent = (() => {
    if (!quotaStatus || !quotaStatus.packageName || isTrial) return 0;
    const upper = quotaStatus.packageName.toUpperCase();
    if (upper.includes('PLATINUM')) return 20;
    if (upper.includes('GOLD')) return 10;
    return 0;
  })();

  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | SourceMessage>('');

  // Trạng thái hộp thoại đặt lịch
  const [modalSlot, setModalSlot] = useState<CoachAvailableSlotDto | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'package_quota' | 'hourly_pay'>('package_quota');
  const [notes, setNotes] = useState('');
  const slotDate = selectedDate;
  const quotaRadioRef = useRef<HTMLDivElement | null>(null);
  const hourlyRadioRef = useRef<HTMLDivElement | null>(null);

  // Trạng thái hộp thoại thanh toán
  const [paymentModalBooking, setPaymentModalBooking] = useState<CoachBookingDto | null>(null);
  const watchedPendingBookingsRef = useRef<Set<number>>(new Set());
  const announcedPaidBookingsRef = useRef<Set<number>>(new Set());

  // Tải lại các buổi đã đặt và hạn mức PT.
  const refreshBookingsAndQuota = useCallback(async () => {
    try {
      const [bookingsList, quotaResult] = await Promise.all([
        getMyCoachBookings(),
        getMemberQuotaStatus().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const }),
        ),
      ]);
      setMyBookings(bookingsList);
      if (quotaResult.ok) {
        setQuotaStatus(quotaResult.value);
        setQuotaError(false);
      } else {
        setQuotaError(true);
      }
    } catch {
      // Làm mới ngầm khi có lỗi
    }
  }, []);

  // Trạng thái hộp thoại hủy lịch
  const [cancelTarget, setCancelTarget] = useState<CoachBookingDto | null>(null);
  // Thời điểm mở hộp thoại hủy, dùng để báo trước có được hoàn lượt (quy tắc 2 giờ) hay không.
  const [cancelOpenedAt, setCancelOpenedAt] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  // Dải 7 ngày có thể lùi/tiến theo tuần hoặc nhảy tới ngày bất kỳ; không cho xem ngày đã qua.
  const [stripStart, setStripStart] = useState<string>(localToday());
  const daysList = nextDays(7, stripStart);
  const todayIso = localToday();
  const pickDate = (iso: string) => {
    setSelectedDate(iso);
    setSelectedSlot(null);
    setError('');
  };
  const shiftStrip = (days: number) => {
    const next = addDays(stripStart, days);
    setStripStart(next < todayIso ? todayIso : next);
  };

  // Tải HLV, lịch PT và quota thật; không gọi API đánh giá đã bỏ khỏi Member.
  useEffect(() => {
    let active = true;
    // Tải HLV, buổi đã đặt và hạn mức khi vào màn hình.
    async function init() {
      setLoadingCoaches(true);
      setError('');
      setQuotaError(false);
      try {
        const [coachList, bookingsList, quotaResult] = await Promise.all([
          getCoaches(),
          getMyCoachBookings(),
          getMemberQuotaStatus().then(
            (value) => ({ ok: true as const, value }),
            () => ({ ok: false as const }),
          ),
        ]);
        if (!active) return;
        setCoaches(coachList);
        setMyBookings(bookingsList);
        if (quotaResult.ok) {
          setQuotaStatus(quotaResult.value);
          setQuotaError(false);
        } else {
          setQuotaStatus(null);
          setQuotaError(true);
        }
        setSelectedCoachId((current) => current ?? coachList[0]?.id ?? null);
      } catch (err: unknown) {
        if (active) setError((memberError(err, 'Không thể tải danh sách huấn luyện viên.')));
      } finally {
        if (active) setLoadingCoaches(false);
      }
    }
    void init();
    return () => { active = false; };
  }, [initRetryTick]);

  // Theo dõi các buổi 1:1 trả phí đang chờ thanh toán và thông báo theo thời gian thực khi thanh toán được xác nhận
  useEffect(() => {
    for (const b of myBookings) {
      if (b.status !== 'cancelled' && b.paymentMethod !== 'package_quota' && b.paymentStatus === 'pending') {
        watchedPendingBookingsRef.current.add(b.id);
      } else if (
        watchedPendingBookingsRef.current.has(b.id) &&
        b.paymentStatus === 'paid' &&
        !announcedPaidBookingsRef.current.has(b.id)
      ) {
        announcedPaidBookingsRef.current.add(b.id);
        setPaymentModalBooking((prev) => (prev?.id === b.id ? null : prev));
        memberNotify(
          memberMessage(
            `Thanh toán buổi tập PT 1:1 ngày ${formatCenterDate(b.bookingDate)} (${formatSlotLabel(b.startTime, b.endTime)}) với HLV ${formatCoachName(b.coachName)} thành công!`,
            `Payment confirmed for 1:1 PT session on ${formatCenterDate(b.bookingDate)} (${formatSlotLabel(b.startTime, b.endTime)}) with coach ${formatCoachName(b.coachName)}!`,
          ),
          'success',
          { record: true },
        );
        window.dispatchEvent(new Event('member-notifications-changed'));
        window.dispatchEvent(new CustomEvent('wallet-updated'));
      }
    }
    setPaymentModalBooking((prev) => {
      if (!prev) return null;
      const latest = myBookings.find((item) => item.id === prev.id);
      return latest ?? prev;
    });
  }, [myBookings]);

  const hasPendingPaymentBooking = myBookings.some(
    (b) => b.status !== 'cancelled' && b.paymentMethod !== 'package_quota' && b.paymentStatus === 'pending',
  );

  // Làm mới theo thời gian thực và đồng bộ khi hiển thị/focus cho thanh toán lịch 1:1
  useEffect(() => {
    let fallbackTimer: number | null = null;
    // Dừng vòng hỏi định kỳ.
    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };
    // Hỏi định kỳ khi có buổi đang chờ thanh toán.
    const startFallback = () => {
      if (!hasPendingPaymentBooking || fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refreshBookingsAndQuota();
        }
      }, 8000);
    };
    const disconnect = subscribeMembershipChanges(
      () => {
        stopFallback();
        void refreshBookingsAndQuota();
        window.dispatchEvent(new Event('member-notifications-changed'));
      },
      startFallback,
    );
    // Làm mới khi tab đang hiển thị.
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshBookingsAndQuota();
      }
    };
    // Làm mới ngay (focus, có mạng hoặc ví vừa cập nhật).
    const refreshNow = () => {
      void refreshBookingsAndQuota();
    };
    window.addEventListener('focus', refreshNow);
    window.addEventListener('online', refreshNow);
    window.addEventListener('wallet-updated', refreshNow);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      disconnect();
      stopFallback();
      window.removeEventListener('focus', refreshNow);
      window.removeEventListener('online', refreshNow);
      window.removeEventListener('wallet-updated', refreshNow);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [hasPendingPaymentBooking, refreshBookingsAndQuota]);

  // Tải danh sách khung giờ khi đổi HLV hoặc đổi ngày
  useEffect(() => {
    if (!selectedCoachId || !slotDate) return;
    let active = true;
    // Tải các khung giờ của HLV trong ngày đang chọn.
    async function loadSlots() {
      setLoadingSlots(true);
      setError('');
      setSlots([]);
      setSelectedSlot(null);
      try {
        const availableSlots = await getAvailableSlots(selectedCoachId!, slotDate);
        if (active) setSlots(availableSlots);
      } catch (err: unknown) {
        if (active) setError((memberError(err, 'Không thể tải khung giờ trống.')));
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    void loadSlots();
    return () => { active = false; };
  }, [selectedCoachId, slotDate, slotRetryTick]);

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);
  const baseSlotPrice = selectedCoach?.defaultHourlyRate || 200000;
  const finalSlotPrice = ptDiscountPercent > 0
    ? Math.round((baseSlotPrice * (100 - ptDiscountPercent)) / 100)
    : baseSlotPrice;

  const hasRemainingQuota = (quotaStatus?.remainingQuota ?? 0) > 0;

  useEffect(() => { setCancelError(''); }, [cancelTarget]);

  // Mở hộp xác nhận đặt lịch cho một khung giờ.
  function handleOpenBookingModal(slot: CoachAvailableSlotDto) {
    setModalSlot(slot);
    setError('');
    setBookingError('');
    setErrorCode(undefined);
    if (hasRemainingQuota) {
      setPaymentMethod('package_quota');
    } else {
      setPaymentMethod('hourly_pay');
    }
  }

  // Xác nhận đặt lịch PT và xử lý lỗi hiển thị theo mã lỗi.
  async function handleConfirmBooking() {
    if (!selectedCoach || !modalSlot) return;
    setSubmitting(true);
    setError('');
    setBookingError('');
    setErrorCode(undefined);

    try {
      const created = await createCoachBooking({
        coachId: selectedCoach.id,
        bookingDate: slotDate,
        startTime: modalSlot.startTime,
        endTime: modalSlot.endTime,
        paymentMethod: paymentMethod === 'package_quota' ? 'package_quota' : 'cash',
        notes: notes.trim() || undefined,
      });

      setModalSlot(null);
      setSelectedSlot(null);
      setNotes('');

      const [updatedSlots, updatedBookings, updatedQuotaResult] = await Promise.all([
        getAvailableSlots(selectedCoach.id, slotDate),
        getMyCoachBookings(),
        getMemberQuotaStatus().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const }),
        ),
      ]);
      setSlots(updatedSlots);
      setMyBookings(updatedBookings);
      if (updatedQuotaResult.ok) {
        setQuotaStatus(updatedQuotaResult.value);
        setQuotaError(false);
      } else {
        setQuotaError(true);
      }
      window.dispatchEvent(new Event('member-notifications-changed'));
      onBookingSuccess?.();

      if (paymentMethod === 'hourly_pay') {
        watchedPendingBookingsRef.current.add(created.id);
        setPaymentModalBooking(created);
        memberNotify(
          memberMessage(
            `Đã ghi nhận lịch tập 1:1 với HLV ${formatCoachName(created.coachName)} ngày ${formatCenterDate(created.bookingDate)} (${formatSlotLabel(created.startTime, created.endTime)}) — Chờ thanh toán ${formatPrice(created.hourlyRate)}.`,
            `1:1 session with coach ${formatCoachName(created.coachName)} on ${formatCenterDate(created.bookingDate)} (${formatSlotLabel(created.startTime, created.endTime)}) recorded — Awaiting payment of ${formatPrice(created.hourlyRate)}.`,
          ),
          'info',
          { record: true },
        );
      } else {
        memberNotify(
          memberMessage(
            `Đặt lịch tập 1:1 với HLV ${formatCoachName(created.coachName)} ngày ${formatCenterDate(created.bookingDate)} (${formatSlotLabel(created.startTime, created.endTime)}) thành công (đã trừ 1 lượt quyền lợi gói)!`,
            `1:1 session booked with coach ${formatCoachName(created.coachName)} on ${formatCenterDate(created.bookingDate)} (${formatSlotLabel(created.startTime, created.endTime)}) using 1 membership session!`,
          ),
          'success',
          { record: true },
        );
      }
    } catch (err: unknown) {
      setErrorCode(err instanceof ApiError ? err.code : undefined);
      setBookingError(coachBookingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Xác nhận hủy buổi PT (buổi đã trả tiền thì được hoàn về Ví SÖL).
  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');
    try {
      const wasPaid = cancelTarget.paymentMethod !== 'package_quota' && cancelTarget.paymentStatus === 'paid';
      await cancelCoachBooking(cancelTarget.id, 'Hội viên chủ động hủy');
      memberNotify(
        wasPaid
          ? memberMessage(
              `Đã hủy lịch tập 1:1 với HLV ${formatCoachName(cancelTarget.coachName)} và hoàn tiền về Ví SÖL.`,
              `Cancelled your 1:1 session with coach ${formatCoachName(cancelTarget.coachName)} and refunded to your SÖL Wallet.`,
            )
          : memberMessage(
              `Đã hủy lịch tập 1:1 với HLV ${formatCoachName(cancelTarget.coachName)} thành công.`,
              `Your 1:1 session with coach ${formatCoachName(cancelTarget.coachName)} was cancelled.`,
            ),
        'success',
        { record: true },
      );
      window.dispatchEvent(new Event('member-notifications-changed'));
      if (wasPaid) {
        window.dispatchEvent(new CustomEvent('wallet-updated'));
      }
      setCancelTarget(null);

      try {
        const [updatedSlots, updatedBookings, updatedQuotaResult] = await Promise.all([
          selectedCoachId ? getAvailableSlots(selectedCoachId, slotDate) : Promise.resolve(null),
          getMyCoachBookings(),
          getMemberQuotaStatus().then(
            (value) => ({ ok: true as const, value }),
            () => ({ ok: false as const }),
          ),
        ]);
        if (updatedSlots !== null) setSlots(updatedSlots);
        setMyBookings(updatedBookings);
        if (updatedQuotaResult.ok) {
          setQuotaStatus(updatedQuotaResult.value);
          setQuotaError(false);
        } else {
          setQuotaError(true);
        }
      } catch {
        // Đã hủy lịch thành công ở backend; bỏ qua lỗi làm mới tạm thời.
      }
      onBookingSuccess?.();
    } catch (err: unknown) {
      setCancelError(memberError(err, 'Không thể hủy lịch.'));
    } finally {
      setCancelling(false);
    }
  }

  if (loadingCoaches) {
    return (
      <div className="portal-card" style={{ padding: 32, textAlign: 'center' }}>
        <p className="row-card__meta">{memberText("Đang tải thông tin Huấn luyện viên và khung giờ trống...")}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 24 }}>

      {error && (
        <div
          className="portal-card"
          role="alert"
          style={{
            borderColor: 'color-mix(in srgb, var(--portal-danger) 45%, transparent)',
            background: 'color-mix(in srgb, var(--portal-danger) 8%, transparent)',
            padding: 14,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <strong style={{ color: 'var(--portal-danger)' }}>{memberRenderMessage(error)}</strong>
            {errorCode === 'MEMBERSHIP_INACTIVE_OR_EXPIRED' && (
              <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/member/packages')} style={{ padding: '4px 10px', fontSize: 12 }}>
                {memberText("Đăng ký / Kích hoạt gói tập")}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setError('');
                if (coaches.length === 0) {
                  setInitRetryTick((v) => v + 1);
                } else {
                  setSlotRetryTick((v) => v + 1);
                  if (quotaError) void refreshBookingsAndQuota();
                }
              }}
            >
              {memberText("Thử lại", "Retry")}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              aria-label={memberText("Đóng thông báo lỗi", "Dismiss error")}
              onClick={() => setError('')}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Banner thông tin hạn mức */}
      <div
        className="portal-card"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--portal-salmon) 12%, transparent) 0%, color-mix(in srgb, var(--portal-salmon) 3%, transparent) 100%)',
          borderColor: 'color-mix(in srgb, var(--portal-salmon) 35%, transparent)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 750,
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 99,
                background: 'var(--portal-salmon)',
                color: 'var(--portal-on-accent)',
              }}
            >
              {quotaError
                ? memberText("Không thể tải thông tin gói", "Unable to load membership")
                : quotaStatus?.packageName
                  ? `${memberText("Gói: ", "Membership: ")}${localizeSeededPackageName(quotaStatus.packageName, lang)}`
                  : hasNoPackage
                    ? `${memberText("Gói: ", "Membership: ")}${memberText("Chưa có gói", "No membership")}`
                    : `${memberText("Gói: ", "Membership: ")}…`}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {memberText("Chính sách Huấn luyện viên cá nhân (PT 1:1)")}</span>
          </div>

          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--portal-muted)' }}>
            {quotaError ? (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span>{memberText("Không thể tải thông tin hạn mức gói tập.", "Unable to load membership PT quota.")}</span>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void refreshBookingsAndQuota()}
                >
                  {memberText("Thử lại", "Retry")}
                </button>
              </span>
            ) : isTrial ? (
              lang === 'en' ? (
                <>
                  <strong>{displayedPackageName}</strong> includes <strong>01 free 1:1 coaching session</strong> for the entire trial period.
                  {quotaStatus && (
                    <>
                      {' '}You have used <strong>{quotaStatus.usedThisMonth}</strong> (remaining:{' '}
                      <strong style={{ color: quotaStatus.remainingQuota > 0 ? 'var(--portal-salmon)' : 'var(--portal-danger)' }}>
                        {quotaStatus.remainingQuota}
                      </strong>
                      ).
                    </>
                  )}
                  {quotaStatus && quotaStatus.remainingQuota <= 0 && (
                    <> Trial session used? Book extra 1:1 coaching per slot ({formatPrice(200000)} / slot).</>
                  )}
                </>
              ) : (
                <>
                  <strong>{displayedPackageName}</strong> bao gồm đặc quyền <strong>01 buổi tập HLV 1:1 miễn phí</strong> duy nhất trong suốt thời gian trải nghiệm.
                  {quotaStatus && (
                    <>
                      {' '}Bạn đã dùng <strong>{quotaStatus.usedThisMonth} lượt</strong> (còn lại:{' '}
                      <strong style={{ color: quotaStatus.remainingQuota > 0 ? 'var(--portal-salmon)' : 'var(--portal-danger)' }}>
                        {quotaStatus.remainingQuota} lượt
                      </strong>
                      ).
                    </>
                  )}
                  {quotaStatus && quotaStatus.remainingQuota <= 0 && (
                    <> Hết buổi trải nghiệm 1:1? Đặt thêm HLV theo slot ({formatPrice(200000)} / slot).</>
                  )}
                </>
              )
            ) : quotaStatus?.monthlyQuota && quotaStatus.monthlyQuota > 0 ? (
              lang === 'en' ? (
                <>
                  <strong>{displayedPackageName}</strong> includes <strong>{quotaStatus.monthlyQuota} free PT sessions/month</strong>. This month you have used{' '}
                  <strong>{quotaStatus.usedThisMonth}</strong> (remaining:{' '}
                  <strong style={{ color: quotaStatus.remainingQuota > 0 ? 'var(--portal-salmon)' : 'var(--portal-danger)' }}>
                    {quotaStatus.remainingQuota}
                  </strong>
                  ).
                  {quotaStatus.remainingQuota <= 0 && (
                    <> Once free sessions are used up, additional slots cost {formatPrice(200000)} / slot.</>
                  )}
                </>
              ) : (
                <>
                  Gói <strong>{displayedPackageName}</strong> được tặng <strong>{quotaStatus.monthlyQuota} lượt PT miễn phí/tháng</strong>. Tháng này bạn đã dùng{' '}
                  <strong>{quotaStatus.usedThisMonth} lượt</strong> (còn lại:{' '}
                  <strong style={{ color: quotaStatus.remainingQuota > 0 ? 'var(--portal-salmon)' : 'var(--portal-danger)' }}>
                    {quotaStatus.remainingQuota} lượt
                  </strong>
                  ).
                  {quotaStatus.remainingQuota <= 0 && (
                    <> Khi hết lượt miễn phí, phí đăng ký thêm là {formatPrice(200000)} / slot.</>
                  )}
                </>
              )
            ) : lang === 'en' ? (
              <>
                {hasNoPackage
                  ? 'An active membership is required to book 1:1 coaching.'
                  : `Membership ${displayedPackageName} does not include free 1:1 PT sessions.`}{' '}
                Private 1:1 coaching costs{' '}
                <strong style={{ color: 'var(--portal-salmon)', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(200000)} / slot</strong>. (Gold includes 3 sessions/month, Platinum 6 sessions/month).
              </>
            ) : (
              <>
                {hasNoPackage
                  ? 'Cần có gói tập đang hoạt động để đặt lịch HLV 1:1.'
                  : `Gói ${displayedPackageName} không bao gồm lượt tập PT 1:1 miễn phí.`}{' '}
                Phí đặt lịch HLV kèm riêng là{' '}
                <strong style={{ color: 'var(--portal-salmon)', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(200000)} / slot</strong>. (Gói Gold được tặng 3 lượt/tháng, Platinum 6 lượt/tháng).
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => navigate('/member/packages')}
            style={{ fontSize: 12 }}
          >
            {hasNoPackage ? memberText("Đăng ký gói tập ngay") : memberText("Nâng cấp gói tập")}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => navigate('/member/invoices')}
            style={{ fontSize: 12 }}
          >
            {memberText("Lịch sử hóa đơn")}</button>
        </div>
      </div>

      {/* Bước 1: Chọn Huấn Luyện Viên */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {memberText("Chọn Huấn luyện viên cá nhân (PT 1:1)")}</h3>
          <span className="row-card__meta" style={{ fontSize: 13 }}>
            {memberText("Phí tập tiêu chuẩn: ")}<strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(200000)} / slot</strong> ({isTrial ? memberText("Miễn phí 01 buổi với Gói Trải Nghiệm") : memberText("Gold giảm 10% / Platinum giảm 20%", "Gold 10% off / Platinum 20% off")})
          </span>
        </div>

        {coaches.length === 0 ? (
          !error ? (
            <div
              className="portal-card"
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                borderRadius: 14,
                background: 'var(--portal-surface)',
                border: '1px dashed var(--portal-border)',
                color: 'var(--portal-muted)',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                {memberText("Chưa có huấn luyện viên nào.")}
              </p>
            </div>
          ) : null
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {coaches.map((c) => {
              const isSelected = c.id === selectedCoachId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCoachId(c.id);
                    setError('');
                  }}
                  className="portal-card"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 16,
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    borderColor: isSelected ? 'var(--portal-salmon)' : 'var(--portal-border)',
                    background: isSelected ? 'color-mix(in srgb, var(--portal-salmon) 12%, transparent)' : 'var(--portal-surface)',
                    boxShadow: isSelected ? '0 0 0 2px var(--portal-salmon)' : undefined,
                    transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                  }}
                >
                  <img
                    src={c.avatarUrl || coachIllustration(c.specialization, c.fullName)}
                    alt={c.fullName}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '2px solid var(--portal-border-strong)',
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.fullName}
                      </h4>
                      {isSelected && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--portal-salmon)' }}>
                          {memberText("Đang chọn")}</span>
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--portal-salmon)', fontWeight: 600 }}>
                      {c.specialization || memberText("Huấn luyện cá nhân")}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--portal-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.bio || memberText("Chuyên gia huấn luyện thể hình và phục hồi thể lực.")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Chọn ngày và khung giờ (5 Slot cố định) */}
      {(() => {
        // Vẽ một thẻ Slot cố định (đang chọn, còn trống hoặc bận kèm lý do).
        const renderSlotCard = (slot: CoachAvailableSlotDto) => {
          const canonicalSlot = findSlotByNumber(slot.slotNumber) ?? findScheduleSlot(slot.startTime, slot.endTime);
          const startFmt = slot.startTime.slice(0, 5);
          const endFmt = slot.endTime.slice(0, 5);
          const slotRange = canonicalSlot?.rangeLabel ?? `${startFmt} – ${endFmt}`;
          const slotSummary = formatSlotLabel(slot.startTime, slot.endTime, slot.slotNumber);
          const isSelected = selectedSlot?.startTime === slot.startTime;

          if (slot.available) {
            return (
              <button
                key={slot.startTime}
                type="button"
                className="member-slot-btn"
                data-testid={canonicalSlot ? `pt-slot-${canonicalSlot.number}` : undefined}
                onClick={() => {
                  setSelectedSlot(slot);
                  handleOpenBookingModal(slot);
                }}
                style={{
                  minHeight: 78,
                  padding: '12px 14px',
                  borderRadius: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'transform 160ms ease, border-color 160ms ease, background-color 160ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  border: isSelected ? '1px solid transparent' : '1px solid var(--portal-border-strong)',
                  background: isSelected
                    ? 'var(--portal-salmon)'
                    : 'var(--portal-surface)',
                  color: isSelected ? 'var(--portal-on-accent)' : 'var(--portal-paper)',
                  boxShadow: isSelected
                    ? '0 4px 12px color-mix(in srgb, var(--portal-salmon) 32%, transparent)'
                    : '0 1px 3px color-mix(in srgb, var(--portal-paper) 4%, transparent)',
                }}
                title={memberText(`Còn trống: ${slotSummary} (Nhấn để đặt lịch)`, `Available: ${slotSummary} (Click to book)`)}
              >
                {canonicalSlot && (
                  <strong style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
                    {canonicalSlot.label}
                  </strong>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', opacity: isSelected ? 0.92 : 0.85 }}>
                  {slotRange}
                </span>
                <small style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--portal-on-accent)' : 'var(--portal-salmon)' }}>
                  {memberText("Còn trống", "Available")}
                </small>
              </button>
            );
          }

          let badgeText = memberText("Đã kín lịch");
          if (slot.reason === 'coach_on_leave') {
            badgeText = memberText("HLV nghỉ phép");
          } else if (slot.reason === 'too_soon') {
            badgeText = memberText("Cần đặt trước 2 tiếng");
          } else if (slot.reason === 'coach_busy') {
            badgeText = memberText("HLV đã có lịch");
          } else if (slot.reason === 'member_busy') {
            badgeText = memberText("Bạn đã có lịch trùng");
          }

          return (
            <div
              key={slot.startTime}
              data-testid={canonicalSlot ? `pt-slot-${canonicalSlot.number}` : undefined}
              aria-disabled="true"
              style={{
                minHeight: 78,
                padding: '12px 14px',
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                border: '1px solid var(--portal-border)',
                background: 'var(--portal-raised)',
                color: 'var(--portal-muted)',
                opacity: 0.65,
                cursor: 'not-allowed',
                textAlign: 'center',
              }}
              title={`${slotSummary} (${badgeText})`}
            >
              {canonicalSlot && (
                <strong style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
                  {canonicalSlot.label}
                </strong>
              )}
              <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                {slotRange}
              </span>
              <small style={{ fontSize: 12, lineHeight: 1.2 }}>
                {badgeText}
              </small>
            </div>
          );
        };

        return (
          <section
            className="portal-card"
            style={{
              padding: '24px 24px',
              borderRadius: 20,
              background: 'var(--portal-surface)',
              border: '1px solid var(--portal-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--portal-paper)' }}>
                {memberText("Chọn ngày và khung giờ")}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="row-card__meta" style={{ fontSize: 13, color: 'var(--portal-star)' }}>
                  {memberText("Quy tắc: Đặt và hủy trước ", "Rule: Book and cancel at least ")}<strong>{memberText("2 tiếng")}</strong>
                </span>
                {selectedCoach && (
                  <span className="row-card__meta" style={{ fontSize: 13 }}>
                    {memberText("HLV: ", "Coach: ")}<strong>{selectedCoach.fullName}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Hàng thẻ chọn ngày trên lịch */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  aria-label={memberText('7 ngày trước', 'Previous 7 days')}
                  disabled={stripStart <= todayIso}
                  onClick={() => shiftStrip(-7)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  aria-label={memberText('7 ngày sau', 'Next 7 days')}
                  onClick={() => shiftStrip(7)}
                >
                  ›
                </button>
                <div style={{ width: 180 }}>
                  <DatePicker
                    id="pt-booking-date"
                    value={selectedDate}
                    min={todayIso}
                    aria-label={memberText('Chọn ngày khác', 'Pick another date')}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      pickDate(e.target.value);
                      setStripStart(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  padding: '4px 2px 14px',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                }}
              >
                {daysList.map((d) => {
                  const isSelected = d.iso === selectedDate;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => pickDate(d.iso)}
                      style={{
                        minWidth: 70,
                        width: 72,
                        height: 96,
                        padding: '12px 6px',
                        borderRadius: 16,
                        border: isSelected
                          ? '1px solid transparent'
                          : '1px solid var(--portal-border)',
                        background: isSelected
                          ? 'var(--portal-salmon)'
                          : 'var(--portal-surface)',
                        color: isSelected ? 'var(--portal-on-accent)' : 'var(--portal-paper)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: isSelected
                          ? '0 6px 16px color-mix(in srgb, var(--portal-salmon) 32%, transparent)'
                          : '0 1px 3px color-mix(in srgb, var(--portal-paper) 4%, transparent)',
                        transition: 'transform 180ms ease, border-color 180ms ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isSelected ? 'color-mix(in srgb, var(--portal-on-accent) 85%, transparent)' : 'var(--portal-muted)',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {d.dayName}
                        {d.isToday && (
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: isSelected ? 'var(--portal-on-accent)' : 'var(--portal-salmon)',
                            }}
                            title={memberText("Hôm nay")}
                          />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: isSelected ? 'var(--portal-on-accent)' : 'var(--portal-paper)',
                          lineHeight: 1.1,
                        }}
                      >
                        {d.dayNumber}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: isSelected ? 'color-mix(in srgb, var(--portal-on-accent) 80%, transparent)' : 'var(--portal-muted)',
                          lineHeight: 1,
                        }}
                      >
                        {d.monthText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="row-card__meta" style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {memberText(`Khung giờ cho ngày ${formatCenterDate(slotDate)}`, `Slots for ${formatCenterDate(slotDate)}`)}
            </p>

            {/* Lưới 5 Slot cố định trong ngày */}
            {loadingSlots ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <p className="row-card__meta" style={{ margin: 0 }}>
                  {memberText("Đang kiểm tra lịch trống của huấn luyện viên...")}</p>
              </div>
            ) : slots.length === 0 ? (
              !error ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <p className="row-card__meta" style={{ margin: 0 }}>
                    {memberText("HLV không có khung giờ trong ngày này.")}</p>
                </div>
              ) : null
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div
                  data-testid="pt-slots-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(156px, 1fr))',
                    gap: 10,
                  }}
                >
                  {slots.map(renderSlotCard)}
                </div>

                {/* Tóm tắt và nút hành động cho khung giờ đã chọn */}
                {selectedSlot && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '14px 18px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--portal-salmon) 12%, transparent) 0%, color-mix(in srgb, var(--portal-salmon) 4%, transparent) 100%)',
                      border: '1px solid color-mix(in srgb, var(--portal-salmon) 35%, transparent)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--portal-salmon)',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>{memberText("Khung giờ đã chọn: ")}</span>
                        <strong style={{ fontSize: 15, color: 'var(--portal-paper)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatSlotLabel(selectedSlot.startTime, selectedSlot.endTime, selectedSlot.slotNumber)}
                        </strong>
                        <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
                          {` (${formatCenterDate(slotDate)} • ${memberText("HLV", "Coach")} ${formatCoachName(selectedCoach?.fullName)})`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: '8px 22px',
                        borderRadius: 99,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                      onClick={() => handleOpenBookingModal(selectedSlot)}
                    >
                      {memberText("Tiến hành đặt lịch")}</button>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Danh sách Lịch 1:1 đã đặt của Hội viên */}
      <section data-i18n-managed style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {memberText("Lịch tập HLV 1:1 của tôi", "My 1:1 coaching schedule")}
          </h3>
          {myBookings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DatePicker
                aria-label={memberText('Tìm lịch theo ngày', 'Filter bookings by date')}
                value={bookingDateFilter}
                onChange={(e) => setBookingDateFilter(e.target.value)}
                placeholder={memberText('Lọc theo ngày...', 'Filter by date...')}
                style={{ minWidth: 180 }}
              />
              {bookingDateFilter && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setBookingDateFilter('')}
                >
                  {memberText('Tất cả ngày', 'All days')}
                </button>
              )}
            </div>
          )}
        </div>

        {(() => {
          const nowParts = centerNowParts();
          const visibleBookings = [...myBookings]
            .filter((b) => !bookingDateFilter || b.bookingDate === bookingDateFilter)
            .sort((a, b) => `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`));

          if (myBookings.length === 0) {
            return (
              <div className="portal-card" style={{ padding: 24, textAlign: 'center' }}>
                <p className="row-card__meta" style={{ margin: 0 }}>
                  {memberText("Chưa có lịch hẹn 1:1.")}</p>
              </div>
            );
          }

          if (visibleBookings.length === 0) {
            return (
              <div className="portal-card" style={{ padding: 24, textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
                <p className="row-card__meta" style={{ margin: 0 }}>
                  {memberText(`Không có lịch hẹn 1:1 vào ngày ${formatCenterDate(bookingDateFilter)}.`, `No 1:1 bookings on ${formatCenterDate(bookingDateFilter)}.`)}
                </p>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setBookingDateFilter('')}
                >
                  {memberText('Xem tất cả ngày', 'Show all days')}
                </button>
              </div>
            );
          }

          return (
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleBookings.map((b) => {
              const isCancelled = b.status === 'cancelled';
              const hasStarted = isSessionStarted(b, nowParts);
              const hasEnded = isSessionCompleted(b, nowParts);
              const isInProgress = !isCancelled && hasStarted && !hasEnded;
              const isConfirmed = !isCancelled;
              const coachDisplayName = formatCoachName(b.coachName);

              return (
                <div
                  key={b.id}
                  className="portal-card"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 18px',
                    borderColor: isConfirmed
                      ? hasEnded
                        ? 'var(--portal-border-strong)'
                        : 'color-mix(in srgb, var(--portal-salmon) 35%, transparent)'
                      : 'var(--portal-border)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, gap: 14, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: hasEnded ? 'var(--portal-raised)' : 'var(--portal-salmon)',
                        color: hasEnded ? 'var(--portal-paper)' : 'var(--portal-on-accent)',
                        border: hasEnded ? '1px solid var(--portal-border-strong)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 750,
                        fontSize: 16,
                      }}
                    >
                      PT
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--portal-paper)' }}>
                          {memberText(`Tập 1:1 cùng HLV ${coachDisplayName}`, `1:1 session with coach ${coachDisplayName}`)}
                        </h4>
                        {isCancelled ? (
                          <span className="badge badge-danger" style={{ fontSize: 12 }}>
                            {memberText("Đã hủy")}</span>
                        ) : hasEnded ? (
                          <span
                            className="badge badge-info"
                            style={{
                              fontSize: 12,
                              background: 'color-mix(in srgb, var(--portal-info) 12%, transparent)',
                              borderColor: 'color-mix(in srgb, var(--portal-info) 30%, transparent)',
                              color: 'var(--portal-info)',
                            }}
                          >
                            {memberText("Đã kết thúc buổi")}</span>
                        ) : isInProgress ? (
                          <span className="badge badge-warning" style={{ fontSize: 12 }}>
                            {memberText("Đang diễn ra", "In progress")}</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: 12 }}>
                            {memberText("Sắp diễn ra")}</span>
                        )}
                        {!isCancelled && b.attendedAt && (
                          <span className="badge badge-success" data-testid={`pt-attended-${b.id}`} style={{ fontSize: 12 }}>
                            {memberText("Đã có mặt", "Attended")}</span>
                        )}
                        {!isCancelled && !b.attendedAt && hasEnded && (
                          <span className="badge badge-warning" data-testid={`pt-missed-${b.id}`} style={{ fontSize: 12 }}>
                            {memberText("Không có mặt", "Did not attend")}</span>
                        )}
                        {!isCancelled && b.paymentMethod !== 'package_quota' && b.paymentStatus === 'pending' && (
                          <span className="badge badge-warning" style={{ fontSize: 12 }}>
                            {memberText("Chờ thanh toán", "Awaiting payment")}</span>
                        )}
                        {!isCancelled && b.paymentMethod !== 'package_quota' && b.paymentStatus === 'paid' && (
                          <span className="badge badge-success" style={{ fontSize: 12 }}>
                            {memberText("Đã thanh toán", "Paid")}</span>
                        )}
                      </div>
                      <p className="row-card__meta" style={{ margin: '3px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                        {memberText("Ngày ")}<strong>{formatCenterDate(b.bookingDate)}</strong> • <strong>{formatSlotLabel(b.startTime, b.endTime)}</strong> • {b.paymentMethod === 'package_quota' ? memberText("Quyền lợi gói tập") : memberText(`Trả phí: ${formatPrice(b.hourlyRate)}`, `Paid session: ${formatPrice(b.hourlyRate)}`)}
                      </p>
                      {b.notes && (
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--portal-muted)', fontStyle: 'italic' }}>
                          {memberText("Ghi chú: ")}{b.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {isConfirmed && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {/* Giữ thanh toán và hủy lịch PT độc lập với chức năng đánh giá đã bỏ. */}
                      {b.paymentMethod !== 'package_quota' && b.paymentStatus === 'pending' && (
                        <VnpayPayButton
                          target={{ coachBookingId: b.id }}
                          onPaid={() => {
                            watchedPendingBookingsRef.current.add(b.id);
                            void refreshBookingsAndQuota();
                            window.dispatchEvent(new Event('member-notifications-changed'));
                            window.dispatchEvent(new CustomEvent('wallet-updated'));
                          }}
                        />
                      )}
                      {b.paymentMethod !== 'package_quota' && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setPaymentModalBooking(b)}
                        >
                          {memberText("Xem thông tin thanh toán")}</button>
                      )}

                      {!hasStarted && !hasEnded && (
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => { setCancelTarget(b); setCancelOpenedAt(Date.now()); }}
                        >
                          {memberText("Hủy lịch hẹn")}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          );
        })()}
      </section>

      {/* Modal Xác nhận Đặt lịch */}
      {modalSlot && selectedCoach && (
        <Modal
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--portal-salmon) 20%, var(--portal-surface))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--portal-salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <circle cx="8" cy="14" r="1.2" fill="var(--portal-salmon)"></circle>
                  <circle cx="12" cy="14" r="1.2" fill="var(--portal-salmon)"></circle>
                  <circle cx="16" cy="14" r="1.2" fill="var(--portal-salmon)"></circle>
                  <circle cx="8" cy="18" r="1.2" fill="var(--portal-salmon)"></circle>
                  <circle cx="12" cy="18" r="1.2" fill="var(--portal-salmon)"></circle>
                  <circle cx="16" cy="18" r="1.2" fill="var(--portal-salmon)"></circle>
                </svg>
              </span>
              <span style={{ fontSize: 22, fontWeight: 750, color: 'var(--portal-paper)', fontFamily: 'inherit' }}>
                {memberText("Xác nhận đặt lịch")}</span>
            </span>
          }
          onClose={() => setModalSlot(null)}
          busy={submitting}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            {/* Thẻ thông tin HLV và buổi tập */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 18,
                background: 'color-mix(in srgb, var(--portal-salmon) 6%, var(--portal-surface))',
                border: '1px solid color-mix(in srgb, var(--portal-salmon) 22%, var(--portal-border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {/* Huấn luyện viên */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 200, flex: '1 1 auto' }}>
                <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                  <img
                    src={selectedCoach.avatarUrl || coachIllustration(selectedCoach.specialization, selectedCoach.fullName)}
                    alt={selectedCoach.fullName}
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--portal-surface)',
                      boxShadow: '0 2px 8px color-mix(in srgb, var(--portal-paper) 8%, transparent)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--portal-salmon)',
                      border: '2px solid var(--portal-surface)',
                      color: 'var(--portal-on-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginBottom: 2 }}>
                    {memberText("Huấn luyện viên")}</div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: 'var(--portal-paper)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedCoach.fullName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
                    {selectedCoach.specialization || memberText('Huấn luyện cá nhân', 'Personal training')}
                  </div>
                </div>
              </div>

              {/* Thời gian */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 140, flex: '1 1 auto' }}>
                <span style={{ color: 'var(--portal-muted)', marginTop: 2, flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginBottom: 2 }}>
                    {memberText("Thời gian")}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--portal-paper)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCenterDate(slotDate)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--portal-paper)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatSlotLabel(modalSlot.startTime, modalSlot.endTime, modalSlot.slotNumber)}
                  </div>
                </div>
              </div>

              {/* Chi phí */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 140, flex: '1 1 auto' }}>
                <span style={{ color: 'var(--portal-muted)', marginTop: 2, flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M14.5 9a2.5 2.5 0 0 0-5 0c0 4 5 2 5 6a2.5 2.5 0 0 1-5 0"></path>
                    <line x1="12" y1="6" x2="12" y2="8"></line>
                    <line x1="12" y1="16" x2="12" y2="18"></line>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginBottom: 2 }}>
                    {memberText("Chi phí buổi tập")}</div>
                  <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--portal-paper)', fontVariantNumeric: 'tabular-nums' }} data-testid="pt-modal-slot-price">
                    {ptDiscountPercent > 0 ? (
                      <>
                        <span>{formatPrice(finalSlotPrice)} / slot</span>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--portal-muted)' }}>
                          <span style={{ textDecoration: 'line-through' }}>{formatPrice(baseSlotPrice)}</span>
                          {' '}
                          ({memberText(`Giảm ${ptDiscountPercent}%`, `${ptDiscountPercent}% off`)})
                        </span>
                      </>
                    ) : (
                      <>{formatPrice(baseSlotPrice)} / slot</>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Khu vực chọn phương thức thanh toán */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--portal-salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--portal-paper)' }}>
                  {memberText("Phương thức thanh toán")}</h4>
              </div>

              <div role="radiogroup" aria-label={memberText("Phương thức thanh toán", "Payment method")} style={{ display: 'grid', gap: 10 }}>
                {/* Lựa chọn 1: Gói tập */}
                <div
                  ref={quotaRadioRef}
                  role="radio"
                  aria-checked={paymentMethod === 'package_quota'}
                  aria-disabled={!hasRemainingQuota}
                  tabIndex={hasRemainingQuota && paymentMethod === 'package_quota' ? 0 : -1}
                  onClick={() => hasRemainingQuota && setPaymentMethod('package_quota')}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setPaymentMethod('hourly_pay');
                      hourlyRadioRef.current?.focus();
                      return;
                    }
                    if (hasRemainingQuota && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setPaymentMethod('package_quota');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: paymentMethod === 'package_quota'
                      ? '1.5px solid var(--portal-salmon)'
                      : '1px solid var(--portal-border)',
                    background: paymentMethod === 'package_quota'
                      ? 'color-mix(in srgb, var(--portal-salmon) 8%, var(--portal-surface))'
                      : 'var(--portal-surface)',
                    cursor: hasRemainingQuota ? 'pointer' : 'not-allowed',
                    opacity: hasRemainingQuota ? 1 : 0.7,
                    transition: 'border-color 160ms ease, background-color 160ms ease',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: paymentMethod === 'package_quota' ? '2px solid var(--portal-salmon)' : '2px solid var(--portal-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {paymentMethod === 'package_quota' && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--portal-salmon)' }} />
                    )}
                  </div>

                  <span style={{ color: 'var(--portal-salmon)', marginTop: 2, flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                      <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: 'var(--portal-paper)' }}>
                        {isTrial
                          ? memberText("Dùng buổi PT 1:1 miễn phí của gói trải nghiệm")
                          : memberText(`Sử dụng quyền lợi PT trong gói tập (${displayedPackageName})`, `Use membership PT benefit (${displayedPackageName})`)}
                      </strong>
                      {hasRemainingQuota ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--portal-success)',
                            background: 'color-mix(in srgb, var(--portal-success) 12%, transparent)',
                            padding: '2px 8px',
                            borderRadius: 99,
                          }}
                        >
                          {memberText(`(Còn ${quotaStatus?.remainingQuota ?? 0} lượt miễn phí)`, `(${quotaStatus?.remainingQuota ?? 0} free left)`)}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--portal-salmon)',
                            background: 'var(--portal-tint)',
                            padding: '2px 8px',
                            borderRadius: 99,
                          }}
                        >
                          {memberText("(Hết lượt hoặc không áp dụng)")}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 4, lineHeight: 1.4 }}>
                      {hasRemainingQuota
                        ? (isTrial
                            ? memberText("Áp dụng buổi PT 1:1 miễn phí của gói trải nghiệm (0 đ).")
                            : memberText("Tự động trừ 1 buổi tập PT trong hạn mức tháng của bạn (0 đ)."))
                        : isTrial
                          ? memberText(
                              `Đã dùng buổi PT 1:1 miễn phí. Tập thêm: ${formatPrice(finalSlotPrice)} / slot.`,
                              `Free 1:1 session used. Extra sessions: ${formatPrice(finalSlotPrice)} / slot.`,
                            )
                          : ptDiscountPercent > 0
                            ? memberText(
                                `Không còn lượt PT miễn phí. Giá ưu đãi hạng thành viên: ${formatPrice(finalSlotPrice)} / slot (giá gốc ${formatPrice(baseSlotPrice)}, giảm ${ptDiscountPercent}%).`,
                                `No free PT sessions left. Member rate: ${formatPrice(finalSlotPrice)} / slot (regular ${formatPrice(baseSlotPrice)}, ${ptDiscountPercent}% off).`,
                              )
                            : memberText(
                                `Không còn lượt PT miễn phí. Giá theo slot: ${formatPrice(finalSlotPrice)} / slot.`,
                                `No free PT sessions left. Slot rate: ${formatPrice(finalSlotPrice)} / slot.`,
                              )}
                    </div>
                  </div>
                </div>

                {/* Lựa chọn 2: Trả phí theo slot */}
                <div
                  ref={hourlyRadioRef}
                  role="radio"
                  aria-checked={paymentMethod === 'hourly_pay'}
                  tabIndex={paymentMethod === 'hourly_pay' || !hasRemainingQuota ? 0 : -1}
                  onClick={() => setPaymentMethod('hourly_pay')}
                  onKeyDown={(e) => {
                    if (hasRemainingQuota && (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                      e.preventDefault();
                      setPaymentMethod('package_quota');
                      quotaRadioRef.current?.focus();
                      return;
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPaymentMethod('hourly_pay');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: paymentMethod === 'hourly_pay'
                      ? '1.5px solid var(--portal-salmon)'
                      : '1px solid var(--portal-border)',
                    background: paymentMethod === 'hourly_pay'
                      ? 'color-mix(in srgb, var(--portal-salmon) 8%, var(--portal-surface))'
                      : 'var(--portal-surface)',
                    cursor: 'pointer',
                    transition: 'border-color 160ms ease, background-color 160ms ease',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: paymentMethod === 'hourly_pay' ? '2px solid var(--portal-salmon)' : '2px solid var(--portal-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {paymentMethod === 'hourly_pay' && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--portal-salmon)' }} />
                    )}
                  </div>

                  <span style={{ color: 'var(--portal-salmon)', marginTop: 2, flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12"></polyline>
                      <rect x="2" y="7" width="20" height="5"></rect>
                      <line x1="12" y1="22" x2="12" y2="7"></line>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                    </svg>
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: 'var(--portal-paper)', fontVariantNumeric: 'tabular-nums' }}>
                        {ptDiscountPercent > 0
                          ? memberText(
                              `Đăng ký trả phí theo slot qua VNPay / Ví SÖL (${formatPrice(finalSlotPrice)} / slot, giảm ${ptDiscountPercent}%)`,
                              `Book paid slot via VNPay / SÖL Wallet (${formatPrice(finalSlotPrice)} / slot, ${ptDiscountPercent}% off)`,
                            )
                          : memberText(
                              `Đăng ký trả phí theo slot qua VNPay / Ví SÖL (${formatPrice(finalSlotPrice)} / slot)`,
                              `Book paid slot via VNPay / SÖL Wallet (${formatPrice(finalSlotPrice)} / slot)`,
                            )}
                      </strong>
                      {!hasRemainingQuota && !hasNoPackage && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--portal-salmon)',
                            background: 'var(--portal-tint)',
                            padding: '2px 8px',
                            borderRadius: 99,
                          }}
                        >
                          {memberText("(Khuyến nghị cho gói của bạn)")}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 4, lineHeight: 1.4 }}>
                      {memberText("Thanh toán qua VNPay hoặc Ví SÖL; tiền mặt tại quầy Lễ tân.")}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Khu vực ghi chú */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--portal-salmon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--portal-paper)' }}>
                  {memberText("Ghi chú")}</h4>
              </div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 14,
                  border: '1px solid var(--portal-border)',
                  background: 'color-mix(in srgb, var(--portal-salmon) 4%, var(--portal-surface))',
                  padding: '12px 14px 28px',
                }}
              >
                <textarea
                  className="portal-textarea"
                  rows={3}
                  placeholder={memberText("Ví dụ: Muốn tập trung cơ bụng và lưng, từng đau khớp gối nhẹ...", "Example: Focus on core and back, mild previous knee pain...")}
                  value={notes}
                  maxLength={200}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    color: 'var(--portal-paper)',
                    lineHeight: 1.5,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 14,
                    fontSize: 12,
                    color: 'var(--portal-muted)',
                    fontWeight: 500,
                  }}
                >
                  {notes.length}/200
                </div>
              </div>
            </div>

            {hasNoPackage && (
              <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--portal-star) 45%, transparent)', background: 'color-mix(in srgb, var(--portal-star) 10%, transparent)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span><strong>{memberText("Bạn chưa có gói tập đang hoạt động.")}</strong>{memberText(" Cần có gói tập đang hoạt động để đặt lịch HLV 1:1.")}</span>
                <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/member/packages')}>{memberText("Đăng ký gói tập")}</button>
              </div>
            )}

            {bookingError && (
              <div className="form-error" role="alert" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span>{memberRenderMessage(bookingError)}</span>
                {errorCode === 'MEMBERSHIP_INACTIVE_OR_EXPIRED' && (
                  <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/member/packages')}>{memberText("Đăng ký / Kích hoạt gói tập")}</button>
                )}
              </div>
            )}

            {/* Các nút hành động cuối hộp thoại */}
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={submitting}
                onClick={() => setModalSlot(null)}
              >
                {memberText("Hủy", "Cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting}
                onClick={() => void handleConfirmBooking()}
              >
                <span>
                  {submitting
                    ? memberText("Đang xử lý…", "Processing…")
                    : memberText("Xác nhận & Đặt lịch", "Confirm booking")}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Hướng dẫn Thanh toán */}
      {paymentModalBooking && (
        <Modal
          title={memberText("Thanh toán Buổi tập PT 1:1")}
          onClose={() => setPaymentModalBooking(null)}
        >
          {paymentModalBooking.paymentStatus === 'pending' && (
            <VnpayPayButton
              target={{ coachBookingId: paymentModalBooking.id }}
              onPaid={() => {
                watchedPendingBookingsRef.current.add(paymentModalBooking.id);
                setPaymentModalBooking(null);
                void refreshBookingsAndQuota();
                window.dispatchEvent(new Event('member-notifications-changed'));
                window.dispatchEvent(new CustomEvent('wallet-updated'));
              }}
            />
          )}
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--portal-success) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--portal-success) 35%, transparent)',
              }}
            >
              <h4 style={{ margin: '0 0 6px', color: 'var(--portal-success)', fontSize: 15, fontWeight: 750 }}>
                {paymentModalBooking.paymentStatus === 'paid'
                  ? memberText("Buổi tập 1:1 đã được thanh toán!", "1:1 PT session has been paid!")
                  : memberText("Lịch tập 1:1 đã được ghi nhận thành công!")}</h4>
              <p style={{ margin: 0, fontSize: 13 }}>
                {memberText("HLV: ", "Coach: ")}<strong>{formatCoachName(paymentModalBooking.coachName)}</strong>{memberText(" • Thời gian:")}{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCenterDate(paymentModalBooking.bookingDate)} ({formatSlotLabel(paymentModalBooking.startTime, paymentModalBooking.endTime)})</strong>
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
                alignItems: 'center',
                padding: 16,
                borderRadius: 12,
                background: 'var(--portal-raised)',
              }}
            >
              <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
                {paymentModalBooking.paymentStatus === 'paid' ? (
                  <>
                    <div>{memberText("Trạng thái thanh toán: ", "Payment status: ")}<strong style={{ color: 'var(--portal-success)' }}>{memberText("Đã thanh toán", "Paid")}</strong></div>
                    <div>{memberText("Số tiền đã thanh toán: ", "Amount paid: ")}<strong style={{ color: 'var(--portal-salmon)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(paymentModalBooking.hourlyRate)}</strong></div>
                  </>
                ) : (
                  <>
                    <div>
                      {lang === 'en' ? (
                        <>Choose <strong>Pay with VNPay</strong> or <strong>Pay with SÖL Wallet</strong> above to complete online payment.</>
                      ) : (
                        <>Chọn <strong>Thanh toán VNPay</strong> hoặc <strong>Thanh toán bằng Ví SÖL</strong> ở trên để hoàn tất thanh toán trực tuyến.</>
                      )}
                    </div>
                    <div>{memberText("Số tiền cần thanh toán: ", "Amount due: ")}<strong style={{ color: 'var(--portal-salmon)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(paymentModalBooking.hourlyRate)}</strong></div>
                    <div style={{ color: 'var(--portal-muted)' }}>{memberText("Lưu ý: Nếu thanh toán bằng tiền mặt, vui lòng gặp trực tiếp Lễ tân tại quầy trước giờ tập để được hỗ trợ thu tiền.")}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPaymentModalBooking(null);
                  navigate('/member/invoices');
                }}
              >
                {memberText("Xem Hóa đơn & Lịch sử thanh toán →")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Hủy lịch */}
      {cancelTarget && (
        <Modal
          title={memberText("Hủy lịch tập 1:1")}
          onClose={() => setCancelTarget(null)}
          busy={cancelling}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <p>
              {lang === 'en' ? (
                <>
                  Are you sure you want to cancel your 1:1 session with coach{' '}
                  <strong>{formatCoachName(cancelTarget.coachName)}</strong> on{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCenterDate(cancelTarget.bookingDate)} ({formatSlotLabel(cancelTarget.startTime, cancelTarget.endTime)})
                  </strong>
                  ?
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn hủy lịch tập 1:1 với HLV{' '}
                  <strong>{formatCoachName(cancelTarget.coachName)}</strong> vào{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSlotLabel(cancelTarget.startTime, cancelTarget.endTime)} ngày {formatCenterDate(cancelTarget.bookingDate)}
                  </strong>
                  ?
                </>
              )}
            </p>
            {cancelTarget.paymentMethod === 'package_quota' && (() => {
              const sessionStart = parseCenterTime(`${cancelTarget.bookingDate}T${cancelTarget.startTime.slice(0, 5)}:00`);
              const isWithinTwoHours = sessionStart !== null && sessionStart.getTime() - cancelOpenedAt < 2 * 60 * 60 * 1000;
              return (
                <p style={{ margin: 0, fontSize: '0.88rem', color: isWithinTwoHours ? 'var(--portal-danger)' : 'var(--portal-muted)' }}>
                  {isWithinTwoHours
                    ? memberText(
                        "Lưu ý: Hủy trong vòng 2 giờ trước khi buổi tập bắt đầu sẽ không được hoàn lại lượt đăng ký HLV 1:1.",
                        "Note: Cancelling within 2 hours before the session starts will not refund your 1:1 PT booking slot.",
                      )
                    : memberText(
                        "Hủy trước ít nhất 2 giờ nên lượt đăng ký HLV 1:1 sẽ được hoàn lại vào gói.",
                        "Cancelling at least 2 hours ahead will refund your 1:1 PT booking slot.",
                      )}
                </p>
              );
            })()}
            {cancelError && <p className="form-error" role="alert">{memberRenderMessage(cancelError)}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
              >
                {memberText("Giữ lịch")}</button>
              <button
                type="button"
                className="btn-danger"
                disabled={cancelling}
                onClick={() => void handleConfirmCancel()}
              >
                {cancelling ? memberText("Đang hủy…") : memberText("Xác nhận Hủy")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
