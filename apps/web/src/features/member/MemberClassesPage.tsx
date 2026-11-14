import { memberMessage, memberText, memberRenderMessage, memberNotify } from './memberI18n';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import type { SourceMessage } from '../../shared/i18n/language';
import { useLanguage } from '../../shared/i18n/language';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Modal } from '../../shared/ui/Modal';
import { ApiError } from '../../shared/api/client';
import { MemberCoachBookingView } from './components/MemberCoachBookingView';
import { MemberCalendar } from './components/MemberCalendar';
import { centerNowParts } from '../../shared/lib/centerTime';
import { getMySubscription, type CardSubscription } from './memberCardApi';
import { cardStatus } from './cardStatus';
import { DISCIPLINES, matchesDiscipline } from '../../shared/lib/disciplines';
import {
  cancelEnrollment,
  getMyEnrollments,
  getMyQuota,
  getClasses,
  enrollCourse,
  checkoutCourse,
  type EnrollmentDto,
  type QuotaDto,
  type GymClassDto,
} from './memberClassesApi';
import './member-classes.css';

function errorMessage(error: unknown): string | SourceMessage {
  if (error instanceof ApiError) {
    if (error.code === 'SCHEDULING_SESSION_FULL')
      return memberMessage('Buổi học đã đầy chỗ. Hãy chọn buổi khác.');
    if (['SCHEDULING_CLASS_FULL', 'CLASS_CAPACITY_EXCEEDED', 'SCHEDULING_CAPACITY_EXCEEDED'].includes(error.code ?? ''))
      return memberMessage('Lớp đã đầy chỗ. Hãy chọn buổi hoặc lớp khác.');
    if (['SCHEDULING_MEMBERSHIP_INVALID', 'MEMBERSHIP_INACTIVE_OR_EXPIRED', 'SCHEDULING_NO_ACTIVE_SUBSCRIPTION'].includes(error.code ?? ''))
      return memberMessage('Cần có gói tập đang hoạt động để đặt lịch.');
    return error.message;
  }
  return memberMessage('Không thể tải lịch học. Vui lòng thử lại.');
}

/** Course fee after the member's tier discount (the server applies the same rule when it charges). */
function discountedPrice(price: number, percent?: number): number {
  return percent && percent > 0 ? Math.round((price * (100 - percent)) / 100) : price;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

interface CourseScheduleInfo {
  /** Short cadence for badges, e.g. "Khóa 4 tuần (3 buổi/tuần)". */
  courseLabel: string;
  cadenceLabel: string;
  /** Same as courseLabel with spaces around the slash, as the course list shows it. */
  courseLabelSpaced: string;
  durationWeeks: number;
  daysPerWeek: number;
  daysText: string;
  totalSessions: number;
  startDateFormatted: string;
  endDateFormatted: string;
  timeRange: string;
}

function parseCourseSchedule(
  cls?: GymClassDto | null,
  defaultDate?: string,
  defaultStart?: string,
  defaultEnd?: string,
): CourseScheduleInfo {
  const recurringDaysArr = cls?.recurringDays
    ? cls.recurringDays.split(',').map((d) => d.trim().toUpperCase()).filter(Boolean)
    : [];
  // No weekdays on record (and none derivable from sessions server-side): say so instead of guessing a default.
  const daysUnknown = recurringDaysArr.length === 0;
  const daysPerWeek = recurringDaysArr.length;

  let durationWeeks = 4;
  if (cls?.startDate && cls?.endDate) {
    const start = new Date(`${cls.startDate}T00:00:00`).getTime();
    const end = new Date(`${cls.endDate}T00:00:00`).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      const diffWeeks = Math.round((end - start) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks > 0) durationWeeks = diffWeeks;
    }
  }

  const totalSessions = durationWeeks * Math.max(daysPerWeek, 1);

  const DAY_LABELS: Record<string, string> = {
    MONDAY: 'Thứ 2',
    TUESDAY: 'Thứ 3',
    WEDNESDAY: 'Thứ 4',
    THURSDAY: 'Thứ 5',
    FRIDAY: 'Thứ 6',
    SATURDAY: 'Thứ 7',
    SUNDAY: 'Chủ Nhật',
  };

  const daysText = daysUnknown
    ? memberText('Theo lịch từng buổi', 'See each session')
    : recurringDaysArr.map((d) => DAY_LABELS[d] || d).join(', ');
  const courseLabel = daysUnknown
    ? memberText(`Khóa ${durationWeeks} tuần`, `${durationWeeks}-week course`)
    : memberText(`Khóa ${durationWeeks} tuần (${daysPerWeek} buổi/tuần)`, `${durationWeeks}-week course (${daysPerWeek} sessions/week)`);
  const courseLabelSpaced = daysUnknown
    ? courseLabel
    : memberText(`Khóa ${durationWeeks} tuần (${daysPerWeek} buổi / tuần)`, `${durationWeeks}-week course (${daysPerWeek} sessions / week)`);
  const cadenceLabel = daysUnknown
    ? memberText('Theo lịch từng buổi', 'See each session')
    : memberText(`${daysPerWeek} buổi / tuần`, `${daysPerWeek} sessions / week`);
  const startTimeStr = cls?.startTime || defaultStart || '08:00';
  const endTimeStr = cls?.endTime || defaultEnd || '09:00';
  const timeRange = `${startTimeStr.slice(0, 5)}–${endTimeStr.slice(0, 5)}`;
  const startDateIso = cls?.startDate || defaultDate || centerNowParts().date;
  const endDateIso = cls?.endDate || '';

  return {
    courseLabel,
    courseLabelSpaced,
    cadenceLabel,
    durationWeeks,
    daysPerWeek,
    daysText,
    totalSessions,
    startDateFormatted: formatShortDate(startDateIso),
    endDateFormatted: endDateIso ? formatShortDate(endDateIso) : '',
    timeRange,
  };
}

function levelLabel(level?: string | null): string {
  switch (level?.toLowerCase()) {
    case 'beginner':
      return 'Người mới bắt đầu';
    case 'intermediate':
      return 'Trung cấp';
    case 'advanced':
      return 'Nâng cao';
    default:
      return 'Mọi cấp độ (All levels)';
  }
}

/** Liên kết từ trang bộ môn (`?discipline=Boxing`); giá trị lạ quay về tất cả bộ môn. */
function disciplineFromQuery(value: string | null): string {
  const found = DISCIPLINES.find((item) => item.name.toLocaleLowerCase('vi') === value?.toLocaleLowerCase('vi'));
  return found?.name ?? 'ALL';
}

interface MemberCourseDetailModalProps {
  course: GymClassDto;
  quota: QuotaDto | null;
  subscription: CardSubscription | null;
  hasActivePackage: boolean | null;
  isEnrolled: boolean;
  onClose: () => void;
  onEnroll: (classId: number, className: string) => void;
  onCheckout: (target: { classId: number; className: string; price: number }) => void;
  onCancelCourse: (buttonEl: HTMLButtonElement) => void;
}

function MemberCourseDetailModal({
  course,
  quota,
  subscription,
  hasActivePackage,
  isEnrolled,
  onClose,
  onEnroll,
  onCheckout,
  onCancelCourse,
}: MemberCourseDetailModalProps) {
  const { lang } = useLanguage();
  const text = (vi: string, en: string) => lang === 'en' ? en : vi;
  const sched = parseCourseSchedule(course);
  const priceNum = course.price ?? 500000;
  const hasQuota = quota?.unlimited || (quota && quota.remainingCredits > 0);

  return (
    <Modal
      title={text("Thông tin khóa học & Gói tập", "Course & Membership Plan Details")}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-info">{course.disciplineName || 'Fitness'}</span>
            <span className="badge badge-outline">{levelLabel(course.level)}</span>
            <span className="badge badge-success" style={{ fontWeight: 600 }}>
              {sched.courseLabel}
            </span>
            {isEnrolled && <span className="badge badge-success">{memberText("Đã đăng ký", "Enrolled")}</span>}
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.3rem', color: 'var(--color-salmon, #eb7e6b)' }}>
            {course.name}
          </h3>
        </div>

        {/* Lịch học & thời lượng */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--color-bg-warm, #242424)',
            borderRadius: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div className="meta-label">{memberText("THỜI LƯỢNG KHÓA HỌC", "COURSE DURATION")}</div>
            <strong>{memberText(`${sched.durationWeeks} tuần (${sched.totalSessions} buổi học)`, `${sched.durationWeeks} weeks (${sched.totalSessions} sessions)`)}</strong>
          </div>
          <div>
            <div className="meta-label">{memberText("TẦN SUẤT / TUẦN", "SESSIONS / WEEK")}</div>
            <strong>{sched.cadenceLabel}</strong>
          </div>
          <div>
            <div className="meta-label">{memberText("CÁC NGÀY TẬP", "TRAINING DAYS")}</div>
            <strong>{sched.daysText}</strong>
          </div>
          <div>
            <div className="meta-label">{memberText("KHUNG GIỜ TẬP", "TIME SLOT")}</div>
            <strong>{sched.timeRange}</strong>
          </div>
          <div>
            <div className="meta-label">{memberText("NGÀY KHAI GIẢNG", "START DATE")}</div>
            <strong>{sched.startDateFormatted}</strong>
          </div>
          {sched.endDateFormatted && (
            <div>
              <div className="meta-label">{memberText("NGÀY BẾ GIẢNG", "END DATE")}</div>
              <strong>{sched.endDateFormatted}</strong>
            </div>
          )}
          <div>
            <div className="meta-label">{memberText("HUẤN LUYỆN VIÊN", "COACH")}</div>
            <strong>{course.coachName}</strong>
          </div>
          <div>
            <div className="meta-label">{memberText("PHÒNG TẬP", "ROOM")}</div>
            <strong>{course.roomName}</strong>
            {course.roomName && (
              <Link
                to={`/member/explore?focus=${encodeURIComponent(course.roomName)}`}
                className="member-classes-package-link"
                style={{ marginLeft: 8 }}
              >
                {text('3D', '3D')}
              </Link>
            )}
          </div>
        </div>

        {course.description && (
          <div>
            <div className="meta-label" style={{ marginBottom: 4 }}>{memberText("MÔ TẢ KHÓA HỌC & LƯU Ý", "COURSE DESCRIPTION & NOTES")}</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {course.description}
            </p>
          </div>
        )}

        {/* Thông tin gói tập & quyền lợi của hội viên */}
        <div
          style={{
            padding: '14px 16px',
            border: '1px solid var(--color-salmon, #eb7e6b)',
            borderRadius: 8,
            backgroundColor: 'color-mix(in srgb, var(--color-salmon, #eb7e6b) 6%, transparent)',
          }}
        >
          <div className="meta-label" style={{ color: 'var(--color-salmon, #eb7e6b)', marginBottom: 6 }}>
            {memberText("QUYỀN LỢI GÓI TẬP CỦA BẠN", "YOUR MEMBERSHIP BENEFITS")}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                {subscription?.packageName || (quota?.tier ? `${memberText("Gói ", "Plan ")}${quota.tier.toUpperCase()}` : memberText("Chưa có gói tập", "No active plan"))}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {quota?.unlimited
                  ? memberText("Platinum: không giới hạn khóa học định kỳ.", "Platinum: unlimited recurring courses.")
                  : quota && quota.remainingCredits > 0
                  ? memberText(`Bạn còn ${quota.remainingCredits}/${quota.totalCredits ?? 0} khóa học miễn phí theo hạn mức gói.`, `You have ${quota.remainingCredits}/${quota.totalCredits ?? 0} free courses remaining in your plan.`)
                  : hasActivePackage
                  ? memberText("Đã hết lượt khóa học miễn phí; khóa thêm tính học phí.", "You have used all free course credits in your plan. Additional courses are charged standard tuition.")
                  : memberText("Chưa có gói hội viên: khóa học tính học phí.", "You do not have an active membership. Please pay tuition fee or purchase a membership plan.")}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="meta-label">{memberText("CHI PHÍ ĐĂNG KÝ", "TUITION FEE")}</div>
              <strong style={{ fontSize: '1.15rem', color: hasQuota ? '#4ade80' : 'var(--color-salmon, #eb7e6b)' }}>
                {hasQuota ? memberText("0 đ (Miễn phí theo gói)", "Free with plan") : `${formatPrice(discountedPrice(priceNum, quota?.discountPercent))}${quota?.discountPercent ? ` (−${quota.discountPercent}%)` : ''}`}
              </strong>
            </div>
          </div>
        </div>

        {/* Modal footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            {text("Đóng", "Close")}
          </button>
          {isEnrolled ? (
            <button
              type="button"
              className="btn-danger"
              onClick={(event) => onCancelCourse(event.currentTarget)}
            >
              {memberText("Hủy khóa học này", "Cancel this course")}
            </button>
          ) : hasQuota ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onEnroll(course.id, course.name)}
            >
              {memberText("Xác nhận đăng ký (Miễn phí theo gói)", "Confirm enrollment (Free with plan)")}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onCheckout({ classId: course.id, className: course.name, price: priceNum })}
            >
              {memberText("Thanh toán học phí & Đăng ký", "Pay tuition & enroll")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

type ClassesTab = 'timetable' | 'schedule' | 'coach_booking';
function tabFromQuery(value: string | null): ClassesTab {
  return value === 'coach' || value === 'pt' || value === 'coach_booking' ? 'coach_booking' : value === 'list' ? 'schedule' : 'timetable';
}

export function MemberClassesPage() {
  const { lang } = useLanguage();
  const text = (vi: string, en: string) => lang === 'en' ? en : vi;
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const [tab, setTab] = useState<ClassesTab>(() => tabFromQuery(rawTab));
  // Liên kết như "Quản lý lịch PT" (?tab=pt) nằm ngay trong trang này nên không remount: đồng bộ lại tab mỗi khi URL đổi.
  // Bấm tab vẫn đổi state ngay (không chờ router), sau đó URL được cập nhật cùng giá trị.
  useEffect(() => { setTab(tabFromQuery(rawTab)); }, [rawTab]);
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [discipline, setDiscipline] = useState(() => disciplineFromQuery(searchParams.get('discipline')));
  // null: chưa biết (đang tải hoặc lỗi) — khi đó không hiện lời nhắc mua gói
  const [hasActivePackage, setHasActivePackage] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | SourceMessage>('');
  const [retry, setRetry] = useState(0);
  const [myScheduleLoading, setMyScheduleLoading] = useState(true);
  const [myScheduleError, setMyScheduleError] = useState<string | SourceMessage>('');
  const [myScheduleRetry, setMyScheduleRetry] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | SourceMessage>('');
  const [cancelTarget, setCancelTarget] = useState<{ id: number; className: string; kind: 'enrollment' } | null>(null);
  const [quota, setQuota] = useState<QuotaDto | null>(null);
  const [classes, setClasses] = useState<GymClassDto[]>([]);
  const [subscription, setSubscription] = useState<CardSubscription | null>(null);
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<GymClassDto | null>(null);
  const [courseCheckoutTarget, setCourseCheckoutTarget] = useState<{ classId: number; className: string; price: number } | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'online_wallet' | 'vnpay' | 'cash'>('online_wallet');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const cancelFocusRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef<string | null>(null);
  const actionGenRef = useRef(0);

  useEffect(() => { setCheckoutError(''); }, [courseCheckoutTarget]);

  function clearActionFeedback() {
    actionGenRef.current += 1;
  }

  function handleSelectTab(nextTab: 'timetable' | 'schedule' | 'coach_booking') {
    clearActionFeedback();
    setTab(nextTab);
    const params = new URLSearchParams(searchParams);
    if (nextTab === 'coach_booking') {
      params.set('tab', 'pt');
    } else if (nextTab === 'schedule') {
      params.set('tab', 'list');
    } else {
      params.delete('tab');
    }
    setSearchParams(params, { replace: true });
  }

  // Bỏ tham số ?week cũ (lịch theo tuần đã gỡ) và chuyển ?tab=my cũ về tab Lịch của tôi, giữ nguyên bộ môn.
  useEffect(() => {
    const hasLegacyWeek = searchParams.has('week');
    const needsTabNormalize = searchParams.get('tab') === 'my';
    if (hasLegacyWeek || needsTabNormalize) {
      const params = new URLSearchParams(searchParams);
      params.delete('week');
      if (needsTabNormalize) {
        params.delete('tab');
        setTab('timetable');
      }
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    void getMyQuota()
      .then((q) => {
        if (active) setQuota(q);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [retry, myScheduleRetry]);

  useEffect(() => {
    let active = true;
    void getMySubscription()
      .then((sub) => {
        if (active) {
          setSubscription(sub);
          setHasActivePackage(!!sub && ['active', 'warning'].includes(cardStatus(sub.status, sub.endDate)));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getClasses();
        if (active) setClasses(data ?? []);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    let active = true;
    async function loadMySchedule() {
      setMyScheduleLoading(true);
      setMyScheduleError('');
      try {
        const nextEnrollments = await getMyEnrollments();
        if (active) setEnrollments(nextEnrollments ?? []);
      } catch (cause) {
        if (active) setMyScheduleError(errorMessage(cause));
      } finally {
        if (active) setMyScheduleLoading(false);
      }
    }
    void loadMySchedule();
    return () => { active = false; };
  }, [myScheduleRetry]);

  async function handleCancelEnrollment(enrollmentId: number, className: string) {
    const key = `enroll-${enrollmentId}`;
    if (busyRef.current || !myScheduleReady) return;
    busyRef.current = key;
    setBusyKey(key);
    const gen = ++actionGenRef.current;
    try {
      await cancelEnrollment(enrollmentId);
      if (actionGenRef.current === gen) {
        memberNotify(memberMessage(`Đã hủy đăng ký khóa "${className}".`, `Enrollment in course "${className}" cancelled.`), 'success', { record: true });
      }
      setRetry((v) => v + 1);
      setMyScheduleRetry((v) => v + 1);
    } catch (cause) {
      if (actionGenRef.current === gen) {
        memberNotify(errorMessage(cause), 'error');
        if (cause instanceof ApiError && (cause.status === 409 || cause.status === 403)) { setRetry((v) => v + 1); setMyScheduleRetry((v) => v + 1); }
      }
    } finally {
      busyRef.current = null;
      setBusyKey(null);
    }
  }

  async function handleEnrollCourse(classId: number, className: string) {
    const key = `course-${classId}`;
    if (busyRef.current) return;
    busyRef.current = key;
    setBusyKey(key);
    try {
      await enrollCourse(classId);
      memberNotify(memberMessage(`Đã đăng ký khóa học "${className}" thành công!`, `Course "${className}" enrolled successfully!`), 'success', { record: true });
      setRetry((v) => v + 1);
      setMyScheduleRetry((v) => v + 1);
    } catch (cause) {
      memberNotify(errorMessage(cause), 'error');
    } finally {
      busyRef.current = null;
      setBusyKey(null);
    }
  }

  async function handleConfirmCourseCheckout() {
    if (!courseCheckoutTarget || isCheckingOut) return;
    setIsCheckingOut(true);
    setCheckoutError('');
    try {
      const res = await checkoutCourse(courseCheckoutTarget.classId, checkoutPaymentMethod);
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
        return;
      }
      if (checkoutPaymentMethod === 'cash') {
        memberNotify(
          memberMessage(
            `Đã đăng ký khóa học "${courseCheckoutTarget.className}". Vui lòng thanh toán ${res.amount ? formatPrice(Number(res.amount)) : ''} tại quầy lễ tân trước ngày khai giảng.`,
            `Registered for "${courseCheckoutTarget.className}". Please pay ${res.amount ? formatPrice(Number(res.amount)) : ''} at the reception before the course starts.`
          ),
          'success',
          { record: true }
        );
      } else {
        memberNotify(
          memberMessage(`Thanh toán và đăng ký khóa học "${courseCheckoutTarget.className}" thành công!`, `Payment & enrollment for "${courseCheckoutTarget.className}" successful!`),
          'success',
          { record: true }
        );
      }
      setCourseCheckoutTarget(null);
      setRetry((v) => v + 1);
      setMyScheduleRetry((v) => v + 1);
    } catch (cause) {
      setCheckoutError(errorMessage(cause));
    } finally {
      setIsCheckingOut(false);
    }
  }

  const disciplines = DISCIPLINES.map(item => item.name);
  const myScheduleReady = !myScheduleLoading && !myScheduleError;
  const activeEnrollments = myScheduleReady ? enrollments.filter((item) => item.status === 'booked' || item.status === 'enrolled') : [];
  const today = centerNowParts().date;
  // Khóa học đăng ký trọn gói (quy tắc phía server): qua ngày khai giảng thì không nhận thêm hội viên.
  const courseStarted = (cls: GymClassDto) => Boolean(cls.startDate && cls.startDate < today);

  // Khóa còn nhận đăng ký lên trước, khóa đã khai giảng xuống sau; trong mỗi nhóm xếp theo ngày khai giảng.
  const visibleCourses = classes
    .filter((cls) => discipline === 'ALL' || matchesDiscipline(cls.disciplineName || '', discipline))
    .map((cls) => ({ cls, started: courseStarted(cls) }))
    .sort((a, b) => Number(a.started) - Number(b.started)
      || (a.cls.startDate ?? '').localeCompare(b.cls.startDate ?? '')
      || a.cls.name.localeCompare(b.cls.name, 'vi'))
    .map(({ cls }) => cls);

  return (
    <div data-i18n-managed className="portal-container member-classes">
      <div data-i18n-managed><PageHeader
        title={text("Lịch học & đặt chỗ", 'Classes & bookings')}
      /></div>

      {quota?.enrollBlockedUntil && (
        <div className="portal-card" role="status" data-testid="course-enroll-blocked" style={{ marginBottom: 16 }}>
          <strong>{memberText("Tạm khóa đăng ký khóa học mới", "New course enrollment paused")}</strong>
          <p style={{ margin: '6px 0 0' }}>
            {memberText(
              `Bạn đã vắng quá 50% số buổi của một khóa học trước nên chưa thể đăng ký khóa mới đến ${formatShortDate(quota.enrollBlockedUntil.slice(0, 10))}. Các khóa đang học vẫn diễn ra bình thường.`,
              `You missed more than half of a previous course, so you cannot join a new course until ${formatShortDate(quota.enrollBlockedUntil.slice(0, 10))}. Your current courses continue as normal.`,
            )}
          </p>
        </div>
      )}

      {/* Quota Banner: Hiển thị số lượt đăng ký khóa học còn lại của gói. Hội viên chưa có gói thì không có hạn mức để hiển thị. */}
      {quota && (quota.unlimited || Boolean(quota.tier) || (quota.totalCredits ?? 0) > 0) && (
        <div
          className="portal-card"
          data-testid="course-quota-banner"
          style={{
            padding: '14px 18px',
            marginBottom: 18,
            backgroundColor: 'var(--color-bg-warm, #1e1e1e)',
            border: '1px solid var(--color-salmon, #eb7e6b)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-info" style={{ fontWeight: 700 }}>
                {quota.tier ? memberText(`GÓI ${quota.tier.toUpperCase()}`, `${quota.tier.toUpperCase()} PLAN`) : memberText('GÓI HỘI VIÊN', 'MEMBER PLAN')}
              </span>
              <strong style={{ fontSize: '0.96rem', color: 'var(--color-salmon, #eb7e6b)' }}>
                {quota.unlimited
                  ? memberText("Đăng ký khóa học: Không giới hạn", "Course Enrollment: Unlimited")
                  : memberText(`Hạn mức: Còn ${quota.remainingCredits}/${quota.totalCredits ?? 0} khóa học miễn phí`, `Quota: ${quota.remainingCredits}/${quota.totalCredits ?? 0} free courses left`)}
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
              {quota.unlimited
                ? memberText("Khóa fitness định kỳ miễn phí không giới hạn.", "Unlimited free recurring fitness courses.")
                : quota.remainingCredits > 0
                ? memberText("1 lượt = 1 khóa học trọn gói.", "1 credit = 1 full course.")
                : memberText("Đã hết lượt theo gói; khóa thêm tính học phí.", "Plan credits used; extra courses are charged.")}
            </p>
          </div>
          {quota.remainingCredits <= 0 && !quota.unlimited && (
            <Link to="/member/packages" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              {text('Nâng cấp gói tập', 'Upgrade membership')}
            </Link>
          )}
        </div>
      )}

      <div className="portal-tabs" data-i18n-managed role="tablist" aria-label={text("Lịch học", "Class schedule")} style={{ marginBottom: 18 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'timetable'}
          className={`portal-tab ${tab === 'timetable' ? 'active' : ''}`}
          onClick={() => handleSelectTab('timetable')}
        >
          {text("Lịch của tôi", "My schedule")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'schedule'}
          className={`portal-tab ${tab === 'schedule' ? 'active' : ''}`}
          onClick={() => {
            handleSelectTab('schedule');
          }}
        >
          {text("Lịch lớp học", "Class schedule")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'coach_booking'}
          className={`portal-tab ${tab === 'coach_booking' ? 'active' : ''}`}
          onClick={() => handleSelectTab('coach_booking')}
        >
          {text("Đặt lịch HLV 1:1 (PT)", "Book a personal trainer (PT)")}
        </button>
      </div>

      {tab === 'timetable' ? (
        <MemberCalendar onBookingChange={() => { setRetry((v) => v + 1); setMyScheduleRetry((v) => v + 1); }} />
      ) : tab === 'coach_booking' ? (
        <MemberCoachBookingView onBookingSuccess={() => { setRetry(v => v + 1); setMyScheduleRetry(v => v + 1); }} />
      ) : (
        <div>
          {myScheduleError && (
            <div data-i18n-managed className="portal-card portal-empty" role="alert" style={{ marginBottom: 16 }}>
              <h3>{text("Không tải được lịch học của tôi", "Unable to load my schedule")}</h3>
              <p>{memberRenderMessage(myScheduleError)} {text("Chưa thể xác nhận trạng thái đặt chỗ của bạn.", "Your booking status could not be confirmed.")}</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setMyScheduleRetry(value => value + 1)}>
                {text("Thử lại lịch học của tôi", "Retry my schedule")}
              </button>
            </div>
          )}

          {/* Thanh lọc gọn: bộ môn + số khóa học; lời nhắc mua gói chỉ hiện khi cần */}
          <div className="portal-card member-classes-toolbar">
            <div className="member-classes-toolbar__row">
              <div className="filter-chips" role="group" aria-label={memberText("Lọc theo bộ môn", "Filter by discipline")}>
                {['ALL', ...disciplines].map((value) => (
                  <button key={value} type="button" className={`filter-chip ${discipline === value ? 'is-active' : ''}`}
                    aria-pressed={discipline === value} onClick={() => { clearActionFeedback(); setDiscipline(value); }}>
                    {value === 'ALL' ? memberText("Tất cả bộ môn", "All disciplines") : value}
                  </button>
                ))}
              </div>
              {!loading && !error && (
                <span className="member-classes-toolbar__count" aria-live="polite" data-testid="course-count">
                  {memberText(`${visibleCourses.length} khóa học`, `${visibleCourses.length} courses`)}
                </span>
              )}
            </div>
            {hasActivePackage === false && (
              <p className="member-classes-toolbar__hint">
                {memberText("Cần gói tập đang hoạt động để được miễn phí khóa học. ", "An active membership makes courses free. ")}
                <Link className="member-classes-package-link" to="/member/packages">{memberText("Xem gói tập", "View plans")}</Link>
              </p>
            )}
          </div>

          {loading ? (
          <div className="stack" role="status" aria-busy="true">
            <span className="sr-only">{text("Đang tải khóa học...", "Loading courses...")}</span>
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="portal-card portal-card--list" aria-hidden="true">
                <div style={{ flex: 1 }}>
                  <div className="portal-skeleton-line" style={{ width: '32%', height: 14, marginBottom: 10 }} />
                  <div className="portal-skeleton-line" style={{ width: '55%', height: 22, marginBottom: 10 }} />
                  <div className="portal-skeleton-line" style={{ width: '68%', height: 14 }} />
                </div>
                <div style={{ width: 150 }}>
                  <div className="portal-skeleton-line" style={{ width: '100%', height: 16, marginBottom: 10 }} />
                  <div className="portal-skeleton-line" style={{ width: '100%', height: 34 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div data-i18n-managed className="portal-card portal-empty" role="alert">
            <h3>{text("Không tải được danh sách khóa học", "Unable to load courses")}</h3>
            <p>{memberRenderMessage(error)}</p>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setRetry((value) => value + 1)}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : (
          <div className="stack" id="member-course-results">
            {visibleCourses.length === 0 ? (
              <div data-i18n-managed className="portal-card portal-empty">
                <h3>{classes.length === 0 ? text("Chưa có khóa học", "No courses available") : text("Không có khóa học phù hợp", "No matching courses")}</h3>
                <p>{classes.length === 0 ? text("Hãy quay lại sau.", "Please check back later.") : text("Hãy thử chọn bộ môn khác.", "Try another discipline.")}</p>
              </div>
            ) : (
              visibleCourses.map((c) => {
                const sched = parseCourseSchedule(c);
                const myEnrollment = activeEnrollments.find((e) => e.classId === c.id);
                const isEnrolled = !!myEnrollment;
                const started = courseStarted(c);
                const isBusy = busyKey === `course-${c.id}` || (myEnrollment ? busyKey === `enroll-${myEnrollment.id}` : false);
                const priceNum = c.price ?? 500000;
                const hasQuota = quota?.unlimited || (quota && quota.remainingCredits > 0);

                return (
                  <div key={c.id} className="portal-card portal-card--list member-course-card" style={{ padding: '16px 20px' }}>
                    <div style={{ flex: 1 }}>
                      <div className="row-card__meta row-card__meta--inline" style={{ marginBottom: 6 }}>
                        <span className="badge badge-info">{c.disciplineName || 'Fitness'}</span>
                        <span className="badge badge-outline">{levelLabel(c.level)}</span>
                        <span className="badge badge-success" style={{ fontWeight: 600 }}>
                          {sched.courseLabelSpaced}
                        </span>
                        {isEnrolled && <span className="badge badge-success">{memberText("Đã đăng ký", "Enrolled")}</span>}
                        {started && !isEnrolled && <span className="badge badge-warning">{memberText("Đã khai giảng", "Already started")}</span>}
                        {myEnrollment?.totalSessions != null && myEnrollment.remainingSessions != null && (
                          <span className="badge" data-testid={`course-progress-${c.id}`}>
                            {memberText(
                              `Còn ${myEnrollment.remainingSessions}/${myEnrollment.totalSessions} buổi (đã học ${myEnrollment.attendedSessions ?? 0})`,
                              `${myEnrollment.remainingSessions}/${myEnrollment.totalSessions} sessions left (${myEnrollment.attendedSessions ?? 0} attended)`,
                            )}
                          </span>
                        )}
                      </div>
                      <h3 className="row-card__title" style={{ fontSize: '1.2rem', marginBottom: 6 }}>{c.name}</h3>
                      <div className="row-card__meta row-card__meta--inline" style={{ marginBottom: 6 }}>
                        <span><strong>{memberText("Lịch học: ", "Schedule: ")}</strong>{sched.daysText} ({sched.timeRange})</span>
                        <span><strong>{memberText("Tổng số: ", "Total: ")}</strong>{memberText(`${sched.totalSessions} buổi trọn gói`, `${sched.totalSessions} sessions`)}</span>
                      </div>
                      <div className="row-card__meta row-card__meta--inline" style={{ marginBottom: 6 }}>
                        <span>{memberText("Khai giảng: ", "Starts: ")}<strong>{sched.startDateFormatted}</strong></span>
                        {sched.endDateFormatted && <span>{memberText("Bế giảng: ", "Ends: ")}<strong>{sched.endDateFormatted}</strong></span>}
                        <span>{memberText("Phòng: ", "Room: ")}<strong>{c.roomName}</strong></span>
                        {c.roomName && (
                          <Link to={`/member/explore?focus=${encodeURIComponent(c.roomName)}`} className="member-classes-package-link">
                            {text('Xem trong 3D', 'View in 3D')}
                          </Link>
                        )}
                        <span>{memberText("HLV: ", "Coach: ")}<strong>{c.coachName}</strong></span>
                      </div>
                      {c.description && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                          {c.description}
                        </p>
                      )}
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-bg-warm, rgba(255,255,255,0.04))', borderRadius: 6, fontSize: '0.86rem' }}>
                        {quota?.unlimited ? (
                          <span style={{ color: 'var(--color-salmon, #eb7e6b)' }}>
                            ✓ <strong>{memberText("Gói ", "Plan ")}{quota.tier?.toUpperCase()}:</strong> {memberText("Miễn phí toàn bộ khóa học không giới hạn.", "Unlimited free courses.")}
                          </span>
                        ) : quota && quota.remainingCredits > 0 ? (
                          <span style={{ color: 'var(--color-salmon, #eb7e6b)' }}>
                            ✓ <strong>{memberText("Quyền lợi gói tập: ", "Plan benefit: ")}</strong>{memberText(`Còn ${quota.remainingCredits}/${quota.totalCredits ?? 0} khóa học miễn phí.`, `${quota.remainingCredits}/${quota.totalCredits ?? 0} free courses remaining.`)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {memberText("Học phí ngoài gói: ", "Course tuition: ")}<strong style={{ color: 'var(--color-salmon, #eb7e6b)' }}>{formatPrice(discountedPrice(priceNum, quota?.discountPercent))}</strong>{quota?.discountPercent ? ` (−${quota.discountPercent}%)` : ''} {memberText("(Áp dụng khi hết lượt gói hoặc mua lẻ)", "(Applies when quota exhausted or purchased standalone)")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 10, minWidth: 200 }}>
                      <div className="meta-label">{memberText("SỨC CHỨA KHÓA HỌC", "COURSE CAPACITY")}</div>
                      <strong>{c.capacity} {memberText("học viên tối đa", "students max")}</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setSelectedCourseForDetail(c)}
                        >
                          {memberText("Xem chi tiết & Lộ trình", "Details & Syllabus")}
                        </button>
                        {!myScheduleReady ? (
                          <button type="button" className="btn-secondary btn-sm" disabled>
                            {myScheduleLoading ? memberText("Đang kiểm tra đăng ký...", "Checking enrollment...") : memberText("Chưa thể kiểm tra đăng ký", "Cannot check enrollment")}
                          </button>
                        ) : isEnrolled ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={isBusy}
                            onClick={(event) => {
                              cancelFocusRef.current = event.currentTarget;
                              setCancelTarget({ id: myEnrollment.id, className: c.name, kind: 'enrollment' });
                            }}
                          >
                            {isBusy ? memberText("Đang xử lý...", "Processing...") : memberText("Hủy khóa học", "Cancel course")}
                          </button>
                        ) : started ? (
                          <button type="button" className="btn-secondary btn-sm" disabled title={memberText("Khóa học đã bắt đầu, không thể đăng ký thêm.", "This course has already started and no longer accepts enrollments.")}>
                            {memberText("Khóa đã bắt đầu", "Course started")}
                          </button>
                        ) : hasQuota ? (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            data-testid={`enroll-course-${c.id}`}
                            disabled={isBusy}
                            onClick={() => void handleEnrollCourse(c.id, c.name)}
                          >
                            {isBusy ? memberText("Đang đăng ký...", "Enrolling...") : memberText("Đăng ký trọn gói", "Enroll full course")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            data-testid={`pay-course-${c.id}`}
                            disabled={isBusy}
                            onClick={() => setCourseCheckoutTarget({ classId: c.id, className: c.name, price: priceNum })}
                          >
                            {isBusy ? memberText("Đang xử lý...", "Processing...") : memberText("Đăng ký & Thanh toán", "Enroll & Pay")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>)}
        </div>
      )}
      {cancelTarget && (
        <Modal title={memberText("Hủy đăng ký khóa?", "Cancel course enrollment?")} onClose={() => setCancelTarget(null)} returnFocusRef={cancelFocusRef}>
          <p className="row-card__meta">
            {memberText(`Bạn có chắc muốn hủy đăng ký khóa ${cancelTarget.className}?`, `Cancel your enrollment in the ${cancelTarget.className} course?`)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)}>{memberText("Giữ đăng ký", "Keep enrollment")}</button>
            <button type="button" className="btn-danger" onClick={() => { const target = cancelTarget; setCancelTarget(null); void handleCancelEnrollment(target.id, target.className); }}>{memberText("Xác nhận hủy")}</button>
          </div>
        </Modal>
      )}

      {selectedCourseForDetail && (
        <MemberCourseDetailModal
          course={selectedCourseForDetail}
          quota={quota}
          subscription={subscription}
          hasActivePackage={hasActivePackage}
          isEnrolled={activeEnrollments.some((e) => e.classId === selectedCourseForDetail.id)}
          onClose={() => setSelectedCourseForDetail(null)}
          onEnroll={(classId, className) => {
            setSelectedCourseForDetail(null);
            void handleEnrollCourse(classId, className);
          }}
          onCheckout={(target) => {
            setSelectedCourseForDetail(null);
            setCourseCheckoutTarget(target);
          }}
          onCancelCourse={(buttonEl) => {
            cancelFocusRef.current = buttonEl;
            const targetEnrollment = activeEnrollments.find((e) => e.classId === selectedCourseForDetail.id);
            const courseName = selectedCourseForDetail.name;
            setSelectedCourseForDetail(null);
            if (targetEnrollment) {
              setCancelTarget({ id: targetEnrollment.id, className: courseName, kind: 'enrollment' });
            }
          }}
        />
      )}

      {courseCheckoutTarget && (
        <Modal
          title={text("Thanh toán học phí khóa học", "Course fee payment")}
          onClose={() => setCourseCheckoutTarget(null)}
          busy={isCheckingOut}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem' }}>{courseCheckoutTarget.className}</h3>
              <p className="row-card__meta" style={{ margin: 0 }}>
                {text("Học phí khóa học trọn gói:", "Full course tuition fee:")}{' '}
                <strong style={{ color: 'var(--color-salmon, #eb7e6b)', fontSize: '1.1rem' }}>
                  {formatPrice(discountedPrice(courseCheckoutTarget.price, quota?.discountPercent))}
                </strong>
              </p>
            </div>

            <div className="portal-form-group">
              <label className="portal-label">{text("Phương thức thanh toán", "Payment method")}</label>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                  <input
                    type="radio"
                    name="coursePaymentMethod"
                    value="online_wallet"
                    checked={checkoutPaymentMethod === 'online_wallet'}
                    onChange={() => setCheckoutPaymentMethod('online_wallet')}
                  />
                  <div>
                    <strong>{text("Ví điện tử SÖL", "SÖL Member Wallet")}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{text("Thanh toán trừ số dư ví tức thì", "Instant wallet debit")}</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                  <input
                    type="radio"
                    name="coursePaymentMethod"
                    value="vnpay"
                    checked={checkoutPaymentMethod === 'vnpay'}
                    onChange={() => setCheckoutPaymentMethod('vnpay')}
                  />
                  <div>
                    <strong>{text("Cổng thanh toán VNPay (Thẻ ATM / QR)", "VNPay Gateway (ATM / QR)")}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{text("Chuyển sang trang thanh toán bảo mật VNPay", "Redirect to VNPay portal")}</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                  <input
                    type="radio"
                    name="coursePaymentMethod"
                    value="cash"
                    checked={checkoutPaymentMethod === 'cash'}
                    onChange={() => setCheckoutPaymentMethod('cash')}
                  />
                  <div>
                    <strong>{text("Tiền mặt tại quầy lễ tân", "Cash at reception")}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{text("Giữ chỗ trước và nộp tiền tại quầy trước khai giảng", "Hold seat and pay at counter")}</div>
                  </div>
                </label>
              </div>
            </div>

            {checkoutError && <p className="form-error" role="alert">{memberRenderMessage(checkoutError)}</p>}

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setCourseCheckoutTarget(null)} disabled={isCheckingOut}>
                {text("Hủy bỏ", "Cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleConfirmCourseCheckout()}
                disabled={isCheckingOut}
                data-testid="confirm-course-checkout-btn"
              >
                {isCheckingOut ? text("Đang xử lý...", "Processing...") : text("Xác nhận thanh toán", "Confirm payment")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
