import { memberError, memberRenderMessage } from '../memberI18n';
import type { SourceMessage } from '../../../shared/i18n/language';
import { useLanguage } from '../../../shared/i18n/language';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { centerNowParts } from '../../../shared/lib/centerTime';
import { getMyCoachBookings, type CoachBookingDto } from '../coachBookingApi';
import { formatCoachName } from '../coachBookingUtils';
import { getMyEnrollments, getSessionsBetween, type ClassSessionDto, type EnrollmentDto } from '../memberClassesApi';
import {
  SCHEDULE_SLOTS,
  findScheduleSlot,
  formatSlotLabel,
  formatSlotShort,
} from '../../schedule/slots';
import {
  addDays, blockClass, layoutDaySlotEvents, mondayOf, parseISODate, shortDate, toMinutes,
  weekDays, weekdayLabel, type TimetableEvent,
} from '../../schedule/timetable';
import '../../schedule/calendar.css';
import './MemberCalendar.css';

/** Kiểu xem lịch: tuần hoặc tháng. */
type View = 'week' | 'month';
/** Loại sự kiện trên lịch: lớp học nhóm và buổi PT 1:1. */
type Kind = 'class' | 'pt';

/** Một sự kiện trên lịch của hội viên: buổi lớp nhóm hoặc buổi PT kèm nơi tập, HLV, cờ đã hủy và mã đặt lịch. */
export interface CalendarEvent extends TimetableEvent {
  kind: Kind;
  place: string;
  coach?: string;
  specialization?: string;
  paymentLabel?: string;
  statusLabel?: string;
  notes?: string;
  cancelled: boolean;
  /** Mã bản ghi để đối chiếu sự kiện trên lịch. */
  seat: { type: 'enrollment' | 'pt'; id: number };
}

const SLOT_ROW_PX = 104;
const MINUTE_MS = 60_000;
const WEEKDAY_HEAD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

/** Thời điểm hiện tại theo giờ trung tâm: ngày và số phút trong ngày. */
function centerNow() {
  const { date, time } = centerNowParts();
  return { date, minutes: toMinutes(time) };
}

/** Hook trả về thời điểm hiện tại theo giờ trung tâm, cập nhật mỗi phút. */
function useCenterNow() {
  const [now, setNow] = useState(centerNow);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(centerNow()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Hook cho biết màn hình đang hẹp (dưới 768px) hay không. */
function useNarrow(): boolean {
  const query = "(max-width: 767px)";
  // Đọc trạng thái khớp hiện tại của media query.
  const read = () => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    // Cập nhật khi media query đổi trạng thái.
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return matches;
}

/** Ngày đầu tháng của ngày cho trước. */
function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

/** Cộng/trừ số tháng vào ngày, trả về ngày 1 của tháng kết quả. */
function addMonths(iso: string, months: number) {
  const date = parseISODate(monthStart(iso));
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Khoảng ngày đang xem: một tuần, hoặc 6 hàng tuần phủ trọn tháng. */
function rangeOf(view: View, anchor: string): { from: string; to: string } {
  if (view === 'week') {
    const from = mondayOf(anchor);
    return { from, to: addDays(from, 6) };
  }
  const from = mondayOf(monthStart(anchor));
  return { from, to: addDays(from, 41) };
}

/** Nhãn khoảng thời gian đang xem (tháng hoặc tuần) theo ngôn ngữ. */
function rangeLabel(view: View, anchor: string, english = false) {
  if (view === 'month') {
    const [year, month] = anchor.split('-');
    return `${english ? "Month" : "Tháng"} ${Number(month)}/${year}`;
  }
  const from = mondayOf(anchor);
  const to = addDays(from, 6);
  return `${shortDate(from)} - ${shortDate(to)}/${to.slice(0, 4)}`;
}

/** Sự kiện đã kết thúc so với thời điểm hiện tại chưa. */
function isEnded(event: Pick<CalendarEvent, 'date' | 'endTime'>, now: { date: string; minutes: number }) {
  return event.date < now.date || (event.date === now.date && toMinutes(event.endTime) <= now.minutes);
}

/** Chuỗi đếm ngược tới giờ bắt đầu ("còn x ngày y giờ", "đang diễn ra"...). */
function countdown(event: CalendarEvent, now: { date: string; minutes: number }, english = false) {
  const days = Math.round((parseISODate(event.date).getTime() - parseISODate(now.date).getTime()) / 86_400_000);
  const total = days * 1440 + toMinutes(event.startTime) - now.minutes;
  if (total <= 0) return english ? 'in progress' : 'đang diễn ra';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (english) return d > 0 ? `in ${d}d${h > 0 ? ` ${h}h` : ''}` : h > 0 ? `in ${h}h${m > 0 ? ` ${m}m` : ''}` : `in ${m}m`;
  if (d > 0) return `còn ${d} ngày${h > 0 ? ` ${h} giờ` : ''}`;
  if (h > 0) return `còn ${h} giờ${m > 0 ? ` ${m} phút` : ''}`;
  return `còn ${m} phút`;
}

/** Nhãn thứ viết tắt (T2...CN). */
function weekdayShort(iso: string) {
  return weekdayLabel(iso).replace('Thứ ', 'T').replace('Chủ nhật', 'CN');
}

/** Sắp xếp sự kiện theo ngày, giờ bắt đầu rồi id. */
function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}

/** Chuyển một buổi PT thành sự kiện lịch (chuẩn hóa tên HLV không lặp "HLV " ở chế độ EN). */
function ptEvent(booking: CoachBookingDto, lang: 'vi' | 'en'): CalendarEvent {
  const coachName = formatCoachName(booking.coachName);
  const title = lang === 'en' ? '1:1 PT Session' : 'Tập PT 1:1';
  const isQuota = booking.paymentMethod === 'package_quota';
  const paymentLabel = isQuota
    ? (lang === 'en' ? 'Included in membership' : 'Miễn phí theo gói')
    : booking.paymentStatus === 'paid'
    ? (lang === 'en' ? 'Paid' : 'Đã thanh toán')
    : booking.paymentStatus === 'pending'
    ? (lang === 'en' ? 'Payment pending' : 'Chờ thanh toán')
    : undefined;
  const statusLabel = booking.attendedAt
    ? (lang === 'en' ? 'Attended' : 'Đã điểm danh')
    : (lang === 'en' ? 'Not attended yet' : 'Chưa điểm danh');
  return {
    id: `pt-${booking.id}`, kind: 'pt', date: booking.bookingDate, startTime: booking.startTime, endTime: booking.endTime,
    title, place: '', coach: coachName,
    specialization: booking.coachSpecialization || undefined,
    paymentLabel,
    statusLabel,
    notes: booking.notes?.trim() || undefined,
    cancelled: false, seat: { type: 'pt', id: booking.id }, tone: 'neutral',
    ariaLabel: `${title}, ${weekdayLabel(booking.bookingDate)} ${shortDate(booking.bookingDate)}, ${formatSlotShort(booking.startTime, booking.endTime)}`,
  };
}

/** Chuyển một buổi lớp nhóm thành sự kiện lịch. */
function classEvent(session: ClassSessionDto, enrollmentId: number, lang: 'vi' | 'en'): CalendarEvent {
  const cancelled = session.status === 'cancelled';
  const coach = session.coachName
    ? (lang === 'en' ? formatCoachName(session.coachName) : session.coachName)
    : undefined;
  return {
    id: `class-${session.id}`,
    kind: 'class',
    date: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    title: session.className,
    place: session.roomName || '',
    coach,
    cancelled,
    seat: { type: 'enrollment', id: enrollmentId },
    tone: cancelled ? 'cancelled' : 'mine',
    ariaLabel: `${session.className}, ${weekdayLabel(session.sessionDate)} ${shortDate(session.sessionDate)}, ${formatSlotShort(session.startTime, session.endTime)}`,
  };
}

/** Lấy lịch PT thật; lỗi được báo trên lịch để hội viên có thể thử lại. */
async function loadPtBookings(): Promise<CoachBookingDto[]> {
  return (await getMyCoachBookings()).filter(item => item.status !== 'cancelled');
}

const NEXT_UP_LOOKAHEAD_DAYS = 30;

/**
 * Lịch của hội viên (tuần 5 Slot cố định / tháng): gộp buổi lớp học nhóm đã đăng ký và buổi PT 1:1,
 * buổi sắp tới, chi tiết sự kiện trong hộp thoại, chuyển tuần/tháng và chế độ một ngày trên màn hẹp.
 */
export function MemberCalendar() {
  const { lang } = useLanguage();
  const labels = lang === 'en'
    ? { thisWeek: 'This week', class: 'Group class', pt: '1:1 session', empty: 'No bookings this week.' }
    : { thisWeek: 'Tuần này', class: 'Lớp học nhóm', pt: 'Buổi PT 1:1', empty: 'Tuần này bạn chưa có lịch nào.' };
  const english = lang === 'en';
  // Chọn chuỗi theo ngôn ngữ.
  const text = (vi: string, en: string) => english ? en : vi;
  // Tên thứ đầy đủ theo ngôn ngữ.
  const dayLabel = (day: string) => english ? new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(parseISODate(day)) : weekdayLabel(day);
  // Tiêu đề của sự kiện.
  const title = (event: CalendarEvent) => event.title;
  // Nhãn trợ năng của sự kiện: loại, tiêu đề, thứ, ngày và Slot.
  const eventLabel = (event: CalendarEvent) => [
    labels[event.kind],
    title(event),
    dayLabel(event.date),
    shortDate(event.date),
    formatSlotShort(event.startTime, event.endTime),
    event.place,
    event.coach,
    event.cancelled ? text('đã hủy', 'cancelled') : '',
  ].filter(Boolean).join(', ');
  const weekdayHead = english ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : WEEKDAY_HEAD;
  const now = useCenterNow();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(now.date);
  const [pts, setPts] = useState<CoachBookingDto[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<ClassSessionDto[]>([]);
  const [rangeSessions, setRangeSessions] = useState<ClassSessionDto[]>([]);
  const [coreLoading, setCoreLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [ptLoadError, setPtLoadError] = useState<unknown>(null);
  const [upcomingClassError, setUpcomingClassError] = useState<unknown>(null);
  const [rangeClassError, setRangeClassError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const { from, to } = rangeOf(view, anchor);
  const today = now.date;

  // Quay lại tab/cửa sổ (ví dụ vừa đặt PT hoặc đăng ký lớp ở trang khác): tải lại lặng lẽ để lịch mới tự hiện.
  const retryRef = useRef(0);
  useEffect(() => { retryRef.current = retry; }, [retry]);
  const quietRetryRef = useRef(-1);
  useEffect(() => {
    // Làm mới ngầm khi tab đang hiển thị.
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      quietRetryRef.current = retryRef.current + 1;
      setRetry((value) => value + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Tải độc lập lịch PT 1:1, danh sách ghi danh và lịch lớp nhóm 30 ngày tới cho banner "Tiếp theo"
  // (không phụ thuộc tuần/tháng đang xem).
  useEffect(() => {
    let active = true;
    const quiet = quietRetryRef.current === retry;
    if (!quiet) setCoreLoading(true);
    setPtLoadError(null);
    setUpcomingClassError(null);
    const lookaheadTo = addDays(today, NEXT_UP_LOOKAHEAD_DAYS);
    Promise.allSettled([
      loadPtBookings(),
      getMyEnrollments(),
      getSessionsBetween(today, lookaheadTo),
    ])
      .then(([ptResult, enrollResult, upcomingResult]) => {
        if (!active) return;
        if (ptResult.status === 'fulfilled') {
          setPts(ptResult.value);
        } else {
          setPts([]);
          setPtLoadError(ptResult.reason ?? new Error(''));
        }
        if (enrollResult.status === 'fulfilled') {
          setEnrollments(Array.isArray(enrollResult.value) ? enrollResult.value : []);
        } else {
          setEnrollments([]);
        }
        if (upcomingResult.status === 'fulfilled') {
          setUpcomingSessions(Array.isArray(upcomingResult.value) ? upcomingResult.value : []);
        } else {
          setUpcomingSessions([]);
        }
        if (enrollResult.status === 'rejected') {
          setUpcomingClassError(enrollResult.reason ?? new Error(''));
        } else if (upcomingResult.status === 'rejected') {
          setUpcomingClassError(upcomingResult.reason ?? new Error(''));
        }
      })
      .finally(() => { if (active) setCoreLoading(false); });
    return () => { active = false; };
  }, [retry, today]);

  // Tải buổi lớp nhóm trong khoảng tuần/tháng đang xem.
  useEffect(() => {
    let active = true;
    const quiet = quietRetryRef.current === retry;
    if (!quiet) setRangeLoading(true);
    setRangeClassError(null);
    getSessionsBetween(from, to)
      .then((sessions) => {
        if (!active) return;
        setRangeSessions(Array.isArray(sessions) ? sessions : []);
      })
      .catch((reason) => {
        if (!active) return;
        setRangeSessions([]);
        setRangeClassError(reason ?? new Error(''));
      })
      .finally(() => { if (active) setRangeLoading(false); });
    return () => { active = false; };
  }, [retry, from, to]);

  const loading = coreLoading || rangeLoading;
  const ptFailed = ptLoadError !== null;
  const classErrorReason = rangeClassError ?? upcomingClassError;
  const classFailed = classErrorReason !== null;
  const error: string | SourceMessage = useMemo(() => {
    if (ptFailed && classFailed) {
      return memberError(ptLoadError, 'Không thể tải lịch của bạn.');
    }
    if (ptFailed) {
      return memberError(ptLoadError, 'Không thể tải lịch PT 1:1 của bạn.', 'Unable to load your 1:1 PT schedule.');
    }
    if (classFailed) {
      return memberError(classErrorReason, 'Không thể tải lịch lớp học nhóm của bạn.', 'Unable to load your group class schedule.');
    }
    return '';
  }, [ptFailed, classFailed, ptLoadError, classErrorReason]);

  const bookedByClass = useMemo(() => {
    const map = new Map<number, EnrollmentDto>();
    for (const item of enrollments) {
      if (String(item.status).toLowerCase() === 'booked') {
        map.set(item.classId, item);
      }
    }
    return map;
  }, [enrollments]);

  // Gộp sự kiện PT và lớp học nhóm theo ngôn ngữ hiện tại.
  const ptEvents = useMemo(() => pts.map((item) => ptEvent(item, lang)), [pts, lang]);
  const classEvents = useMemo(
    () => rangeSessions
      .filter((s) => bookedByClass.has(s.classId))
      .map((s) => classEvent(s, bookedByClass.get(s.classId)!.id, lang)),
    [rangeSessions, bookedByClass, lang],
  );
  const upcomingClassEvents = useMemo(
    () => upcomingSessions
      .filter((s) => bookedByClass.has(s.classId))
      .map((s) => classEvent(s, bookedByClass.get(s.classId)!.id, lang)),
    [upcomingSessions, bookedByClass, lang],
  );
  // Sự kiện nằm trong khoảng đang xem.
  const events = useMemo(
    () => sortEvents([...ptEvents, ...classEvents]).filter(item => item.date >= from && item.date <= to),
    [ptEvents, classEvents, from, to],
  );
  // Sự kiện sắp tới gần nhất chưa kết thúc (độc lập với tuần/tháng đang xem).
  const nextUp = useMemo(() => {
    const upcoming = sortEvents([...ptEvents, ...upcomingClassEvents]);
    return upcoming.find(item => !item.cancelled && !isEnded(item, now)) ?? null;
  }, [ptEvents, upcomingClassEvents, now]);

  // Bảy ngày của tuần đang xem.
  const days = useMemo(() => weekDays(mondayOf(anchor)), [anchor]);
  // Màn hẹp: xem từng ngày, chọn ngày ở dải phía trên.
  const narrow = useNarrow();
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const activeDay = focusDay && days.includes(focusDay) ? focusDay : days.includes(today) ? today : days[0];
  const visibleDays = narrow ? [activeDay] : days;

  // Chuyển tuần/tháng tiến hoặc lùi.
  function shift(step: number) {
    setFocusDay(null);
    setAnchor((value) => (view === 'week' ? addDays(value, step * 7) : addMonths(value, step)));
  }

  // Mở chi tiết một sự kiện và nhớ phần tử để trả focus.
  function openEvent(event: CalendarEvent) {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setSelected(event);
  }

  // Đóng hộp thoại chi tiết.
  function closeDialog() {
    setSelected(null);
  }

  // Gom sự kiện theo ngày.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const item of events) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [events]);

  // Vẽ các chấm màu (tối đa 3) cho sự kiện của một ngày.
  const renderDots = (day: string) => {
    const list = eventsByDay.get(day) ?? [];
    const kinds = list.slice(0, 3).map((item) => item.kind);
    return (
      <span className="mcal__dots" aria-hidden="true">
        {kinds.map((kind, index) => <i key={index} className={`mcal__dot mcal__dot--${kind}`} />)}
      </span>
    );
  };

  const isEmpty = !loading && !error && events.length === 0;
  const rowsPx = SCHEDULE_SLOTS.length * SLOT_ROW_PX;

  return (
    <section data-i18n-managed className="mcal mcal--member" aria-label={text("Lịch của tôi", "My schedule")}>
      <header className="mcal__toolbar">
        <div className="mcal__nav">
          <button type="button" className="mcal__icon-btn" aria-label={view === 'week' ? text("Tuần trước", 'Previous week') : text("Tháng trước", 'Previous month')} onClick={() => shift(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" className="mcal__icon-btn" aria-label={view === 'week' ? text("Tuần sau", 'Next week') : text("Tháng sau", 'Next month')} onClick={() => shift(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button type="button" className="mcal__today-btn" onClick={() => { setFocusDay(null); setView('week'); setAnchor(centerNowParts().date); }}>{labels.thisWeek}</button>
          <h2 className="mcal__range" aria-live="polite">{rangeLabel(view, anchor, english)}</h2>
        </div>
        <div className="mcal__side">
          <ul className="mcal__legend" aria-label={text("Chú thích", "Legend")}>
            <li><i className="mcal__dot mcal__dot--class" aria-hidden="true" />{labels.class}</li>
            <li><i className="mcal__dot mcal__dot--pt" aria-hidden="true" />{labels.pt}</li>
          </ul>
          <div className="mcal__switch" role="group" aria-label={text("Chế độ xem", "View")}>
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>{text("Tuần", "Week")}</button>
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>{text("Tháng", "Month")}</button>
          </div>
        </div>
      </header>

      {nextUp && (
        <button type="button" className="mcal__next" onClick={() => openEvent(nextUp)}>
          <span className="mcal__next-tag">{text("Tiếp theo", "Next up")}</span>
          <span className={`mcal__type mcal__type--${nextUp.kind}`}>{labels[nextUp.kind]}</span>
          <strong className="mcal__next-title">{title(nextUp)}</strong>
          <span className="mcal__next-meta">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {english ? dayLabel(nextUp.date).slice(0, 3) : weekdayShort(nextUp.date)} {shortDate(nextUp.date)} · {formatSlotLabel(nextUp.startTime, nextUp.endTime)}
          </span>
          {nextUp.place && (
            <span className="mcal__next-meta">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {nextUp.place}
            </span>
          )}
          <span className="mcal__next-count">{countdown(nextUp, now, english)}</span>
        </button>
      )}

      {error && (
        <div className="mcal__state" role="alert">
          <strong>{text("Không tải được lịch", "Unable to load schedule")}</strong>
          <p>{memberRenderMessage(error)}</p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setRetry((value) => value + 1)}>{text("Thử lại", "Retry")}</button>
        </div>
      )}
      {loading && <span className="sr-only" role="status">{text("Đang tải lịch...", "Loading schedule...")}</span>}

      {!error && view === 'week' && narrow && (
        <div className="mcal__daystrip" role="group" aria-label={text("Chọn ngày", "Choose day")}>
          {days.map((day) => {
            const count = (eventsByDay.get(day) ?? []).length;
            return (
              <button
                key={day}
                type="button"
                className={`mcal__daychip${day === activeDay ? ' is-active' : ''}${day === today ? ' is-today' : ''}`}
                aria-pressed={day === activeDay}
                aria-label={`${dayLabel(day)} ${shortDate(day)}, ${count} ${text("lịch", 'bookings')}`}
                onClick={() => setFocusDay(day)}
              >
                <span>{english ? dayLabel(day).slice(0, 3) : weekdayShort(day)}</span>
                <strong>{day.slice(8)}</strong>
                {renderDots(day)}
              </button>
            );
          })}
        </div>
      )}

      {!error && view === 'week' && (
        <div className={`mcal__scroll${loading ? ' is-loading' : ''}`} aria-busy={loading}>
          <div
            className={`mcal__week${narrow ? ' is-single' : ''}`}
            style={{ '--mcal-hour': `${SLOT_ROW_PX}px`, '--mcal-rows': SCHEDULE_SLOTS.length, '--mcal-days': visibleDays.length } as CSSProperties}
          >
            <div className="mcal__corner" aria-hidden="true" />
            {visibleDays.map((day) => (
              <div key={day} className={`mcal__dayhead${day === today ? ' is-today' : ''}`} aria-current={day === today ? 'date' : undefined}>
                <span className="mcal__dayname">{weekdayHead[days.indexOf(day)]}</span>
                <strong className="mcal__daynum">{day.slice(8)}</strong>
                {renderDots(day)}
              </div>
            ))}

            <div className="mcal__gutter" aria-hidden="true">
              {SCHEDULE_SLOTS.map((slot) => (
                <div key={slot.code} className="mcal__slot-head" data-testid={`timetable-slot-head-${slot.number}`}>
                  <strong className="mcal__slot-name">{slot.label}</strong>
                  <span className="mcal__slot-time">{slot.rangeLabel}</span>
                </div>
              ))}
            </div>
            {visibleDays.map((day) => {
              const positioned = layoutDaySlotEvents(eventsByDay.get(day) ?? []);
              return (
                <div
                  key={day}
                  className={`mcal__col${day === today ? ' is-today' : ''}${days.indexOf(day) >= 5 ? ' is-weekend' : ''}`}
                  role="group"
                  aria-label={`${dayLabel(day)} ${shortDate(day)}`}
                >
                  {positioned.map(({ event, lane, lanes, topPct, heightPct }) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`mcal__event mcal__event--${event.kind}${isEnded(event, now) ? ' is-past' : ''}${event.cancelled ? ' is-cancelled' : ''}${blockClass((heightPct / 100) * rowsPx)}`}
                      style={{
                        top: `calc(${topPct}% + 3px)`,
                        height: `calc(${heightPct}% - 6px)`,
                        left: `calc(${(lane / lanes) * 100}% + 6px)`,
                        width: `calc(${100 / lanes}% - 12px)`,
                      }}
                      aria-label={eventLabel(event)}
                      title={[labels[event.kind], formatSlotLabel(event.startTime, event.endTime), title(event), event.place, event.coach].filter(Boolean).join(' · ')}
                      onClick={() => openEvent(event)}
                    >
                      <strong className="mcal__event-title">{title(event)}</strong>
                      {event.place && <span className="mcal__event-place">{event.place}</span>}
                      {event.coach && !title(event).includes(event.coach) && (
                        <span className="mcal__event-coach">
                          {event.kind === 'pt'
                            ? (english ? `Coach ${event.coach}` : `HLV ${event.coach}`)
                            : event.coach}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          {isEmpty && <p className="mcal__empty" role="status">{labels.empty}</p>}
        </div>
      )}

      {!error && view === 'month' && (
        <div className={`mcal__month${loading ? ' is-loading' : ''}`} aria-busy={loading}>
          {weekdayHead.map((label) => <span key={label} className="mcal__month-head">{label}</span>)}
          {Array.from({ length: 42 }, (_, index) => addDays(from, index)).map((day) => {
            const list = eventsByDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== anchor.slice(0, 7);
            return (
              <div key={day} className={`mcal__cell${outside ? ' is-outside' : ''}${day === today ? ' is-today' : ''}`}>
                <button
                  type="button"
                  className="mcal__cell-day"
                  aria-label={`${text("Xem tuần có", 'View week containing')} ${dayLabel(day)} ${shortDate(day)}, ${list.length} ${text("lịch", 'bookings')}`}
                  onClick={() => { setAnchor(day); setView('week'); }}
                >
                  {Number(day.slice(8))}
                </button>
                <div className="mcal__chips">
                  {list.slice(0, 3).map((event) => {
                    const matchedSlot = findScheduleSlot(event.startTime, event.endTime);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`mcal__chip mcal__chip--${event.kind}${isEnded(event, now) ? ' is-past' : ''}${event.cancelled ? ' is-cancelled' : ''}`}
                        aria-label={eventLabel(event)}
                        title={[labels[event.kind], formatSlotLabel(event.startTime, event.endTime), title(event), event.place, event.coach].filter(Boolean).join(' · ')}
                        onClick={() => openEvent(event)}
                      >
                        {matchedSlot ? <span>{matchedSlot.label} · </span> : null}
                        {title(event)}
                      </button>
                    );
                  })}
                  {list.length > 3 && (
                    <button type="button" className="mcal__more" onClick={() => { setAnchor(day); setView('week'); }}>
                      +{list.length - 3} {text("lịch khác", 'more bookings')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <Modal title={title(selected)} onClose={closeDialog} returnFocusRef={returnFocusRef}>
          <div className="kv-list">
            <div className="kv-row"><span>{text("Loại", "Type")}</span><strong>{labels[selected.kind]}</strong></div>
            <div className="kv-row"><span>{text("Thời gian", "Time")}</span><strong>{dayLabel(selected.date)} {shortDate(selected.date)} · {formatSlotLabel(selected.startTime, selected.endTime)}</strong></div>
            {selected.place && <div className="kv-row"><span>{text("Địa điểm", "Location")}</span><strong>{selected.place}</strong></div>}
            {selected.coach && <div className="kv-row"><span>{text("Huấn luyện viên", "Coach")}</span><strong>{selected.coach}</strong></div>}
            {selected.specialization && <div className="kv-row"><span>{text("Chuyên môn", "Specialty")}</span><strong>{selected.specialization}</strong></div>}
            {selected.paymentLabel && <div className="kv-row"><span>{text("Thanh toán", "Payment")}</span><strong>{selected.paymentLabel}</strong></div>}
            {selected.cancelled
              ? <div className="kv-row"><span>{text("Trạng thái", "Status")}</span><strong>{text("Buổi học đã bị hủy", "Class session cancelled")}</strong></div>
              : selected.statusLabel && <div className="kv-row"><span>{text("Trạng thái", "Status")}</span><strong>{selected.statusLabel}</strong></div>}
            {selected.notes && <div className="kv-row"><span>{text("Ghi chú", "Notes")}</span><strong>{selected.notes}</strong></div>}
          </div>
          <div className="mcal__dialog-actions">
            <button type="button" className="btn-primary" onClick={closeDialog}>
              {text("Đóng", "Close")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
