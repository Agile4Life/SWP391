import { memberText } from '../member/memberI18n';
import { useI18n } from '../../shared/i18n';
import { useLanguage } from '../../shared/i18n/language';
import { Modal } from '../../shared/ui/Modal';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  SCHEDULE_SLOTS,
  formatSlotLabel,
  isSlotPast,
  isWithinScheduleSlots,
  nowSlotPercent,
  resolveSlotIndex,
} from './slots';
import {
  addDays,
  blockClass,
  groupVisibleLanes,
  layoutDaySlotEvents,
  mondayOf,
  shortDate,
  todayISO,
  weekRangeLabel,
  weekdayLabel,
  weekDays,
  type OverflowCluster,
  type TimetableEvent,
  type TimetableTone,
} from './timetable';
import './calendar.css';

/** Một khung giờ trống được bấm trên lịch: ngày, giờ bắt đầu và kết thúc theo 5 Slot cố định. */
export interface TimetableSlot {
  date: string;
  startTime: string;
  endTime: string;
}

/** Một mục chú giải màu của lịch: tông màu (hoặc "free") và nhãn. */
export interface TimetableLegendItem {
  tone: TimetableTone | 'free';
  label: string;
}

/**
 * Props của lịch tuần: tuần đang xem, danh sách buổi, trạng thái tải/lỗi, các sự kiện đổi tuần/bấm buổi/bấm ô
 * trống, khối đang chọn và phần chú giải.
 */
interface WeeklyTimetableProps {
  /** Thứ Hai (YYYY-MM-DD) của tuần đang xem. */
  weekStart: string;
  events: TimetableEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // Gọi khi người dùng chuyển sang tuần khác (truyền thứ Hai của tuần đó).
  onWeekChange: (weekStart: string) => void;
  // Gọi khi bấm một khối buổi học.
  onEventClick: (eventId: string) => void;
  /** Khối đang được chọn (ví dụ buổi đang điểm danh). */
  selectedId?: string;
  /** Khóa việc chọn khối khi đang có thao tác ghi dở. */
  disabled?: boolean;
  /** Câu hiển thị khi tuần không có buổi nào. */
  emptyLabel?: string;
  /** Có hàm này thì ô slot trống bấm được (Manager tạo lịch); không có thì ô chỉ để xem. */
  onSlotClick?: (slot: TimetableSlot) => void;
  slotActionLabel?: string;
  legend: TimetableLegendItem[];
  /** Dòng giải thích nằm cuối chú thích, ví dụ cách đọc số chỗ. */
  legendNote?: string;
  /** Vùng bộ lọc thêm, đặt cạnh điều hướng tuần. */
  toolbar?: ReactNode;
  /** Giới hạn số làn hiển thị song song tối đa trong 1 cột ngày; vượt quá sẽ gom thành nút "+N lớp". */
  maxVisibleLanes?: number;
  label: string;
}

const MINUTE_MS = 60_000;
/** Dưới mốc này bảng chuyển sang xem từng ngày thay vì 7 cột hẹp cuộn ngang. */
const NARROW_QUERY = '(max-width: 767px)';
const SLOT_ROW_PX = 104;
const WEEKDAY_HEAD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const WEEKDAY_CHIP: [string, string][] = [['T2', 'Mon'], ['T3', 'Tue'], ['T4', 'Wed'], ['T5', 'Thu'], ['T6', 'Fri'], ['T7', 'Sat'], ['CN', 'Sun']];
/** Nhãn số buổi học theo ngôn ngữ ("3 buổi học" / "3 sessions"). */
const sessionCount = (count: number) => memberText(`${count} buổi học`, `${count} ${count === 1 ? 'session' : 'sessions'}`);

/** Hook trả về thời điểm hiện tại, cập nhật mỗi phút. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Hook theo dõi một media query và trả về có đang khớp hay không. */
function useMediaQuery(query: string): boolean {
  // Đọc trạng thái khớp hiện tại của media query.
  const read = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    // Cập nhật khi media query đổi trạng thái.
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Khóa duy nhất của một ô Slot theo ngày và số thứ tự Slot (1..5). */
function slotKey(date: string, slotNumber: number) {
  return `${date}|${slotNumber}`;
}

/**
 * Lịch tuần dạng lưới 5 Slot cố định (07:00 – 19:30) × 7 ngày:
 * xếp các buổi trùng Slot thành làn song song, hỗ trợ gom cụm "+N lớp", đánh dấu Slot đã qua,
 * hiển thị vạch giờ hiện tại, điều khiển bằng phím mũi tên và chế độ một ngày trên màn hẹp.
 */
export function WeeklyTimetable({
  weekStart, events, loading = false, error = null, onRetry, onWeekChange, onEventClick, selectedId, disabled = false,
  emptyLabel = 'Tuần này chưa có buổi học nào', onSlotClick, slotActionLabel = 'tạo lịch', legend, legendNote, toolbar,
  maxVisibleLanes, label,
}: WeeklyTimetableProps) {
  useLanguage();
  const { t } = useI18n();
  const [overflowCluster, setOverflowCluster] = useState<OverflowCluster | null>(null);
  const now = useNow();
  const today = todayISO(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // Danh sách 7 ngày của tuần đang xem.
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const selectedDate = events.find((event) => event.id === selectedId)?.date;
  const activeDay = focusDay && days.includes(focusDay) ? focusDay
    : selectedDate && days.includes(selectedDate) ? selectedDate
    : days.includes(today) ? today : days[0];
  const visibleDays = narrow ? [activeDay] : days;
  const gridRef = useRef<HTMLDivElement>(null);
  const [rovingKey, setRovingKey] = useState<string | null>(null);

  // Gom các buổi theo ngày.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimetableEvent[]>();
    for (const day of days) map.set(day, []);
    for (const event of events) map.get(event.date)?.push(event);
    return map;
  }, [days, events]);

  const outsideRange = events.filter(
    (event) => days.includes(event.date) && !isWithinScheduleSlots(event.startTime, event.endTime),
  ).length;
  const visibleCount = events.filter(
    (event) => days.includes(event.date) && isWithinScheduleSlots(event.startTime, event.endTime),
  ).length;
  const thisWeek = mondayOf(today);
  const emptyText = emptyLabel.replace(/\.$/, '');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  // Cập nhật dấu hiệu "còn nội dung phía dưới" theo vị trí cuộn.
  const syncScrollCue = useCallback(() => {
    const box = scrollRef.current;
    if (!box) {
      setHasMoreBelow(false);
      return;
    }
    setHasMoreBelow(box.scrollTop + box.clientHeight < box.scrollHeight - 8);
  }, []);

  useEffect(() => {
    syncScrollCue();
    const box = scrollRef.current;
    if (!box) return;
    window.addEventListener('resize', syncScrollCue);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(syncScrollCue) : null;
    observer?.observe(box);
    return () => {
      window.removeEventListener('resize', syncScrollCue);
      observer?.disconnect();
    };
  }, [visibleDays.length, loading, syncScrollCue]);

  const firstKey = slotKey(visibleDays[0], SCHEDULE_SLOTS[0].number);
  const activeKey = rovingKey && visibleDays.some((day) => rovingKey.startsWith(`${day}|`)) ? rovingKey : firstKey;

  // Di chuyển focus giữa các ô Slot bằng phím mũi tên, Home và End.
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, dayIndex: number, slotIndex: number) {
    let nextDay = dayIndex;
    let nextSlot = slotIndex;
    switch (event.key) {
      case 'ArrowLeft': nextDay = Math.max(0, dayIndex - 1); break;
      case 'ArrowRight': nextDay = Math.min(visibleDays.length - 1, dayIndex + 1); break;
      case 'ArrowUp': nextSlot = Math.max(0, slotIndex - 1); break;
      case 'ArrowDown': nextSlot = Math.min(SCHEDULE_SLOTS.length - 1, slotIndex + 1); break;
      case 'Home': nextSlot = 0; break;
      case 'End': nextSlot = SCHEDULE_SLOTS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const key = slotKey(visibleDays[nextDay], SCHEDULE_SLOTS[nextSlot].number);
    setRovingKey(key);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-slot="${key}"]`)?.focus();
  }

  const rowsPx = SCHEDULE_SLOTS.length * SLOT_ROW_PX;

  return (
    <section data-i18n-managed className="mcal" aria-label={label}>
      <header className="mcal__toolbar">
        <div className="mcal__nav" role="group" aria-label={memberText("Điều hướng tuần")}>
          <button type="button" className="mcal__icon-btn" aria-label={memberText("Tuần trước")} onClick={() => onWeekChange(addDays(weekStart, -7))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" className="mcal__icon-btn" aria-label={memberText("Tuần sau")} onClick={() => onWeekChange(addDays(weekStart, 7))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button
            type="button"
            className="mcal__today-btn"
            disabled={weekStart === thisWeek}
            onClick={() => { setFocusDay(null); onWeekChange(thisWeek); }}
          >
            {memberText("Hôm nay")}</button>
          <h2 className="mcal__range" aria-live="polite">{weekRangeLabel(weekStart)}</h2>
        </div>
        <div className="mcal__side">
          <ul className="mcal__legend" aria-label={memberText("Chú thích")}>
            {legend.map((item) => (
              <li key={item.tone}>
                <i className={`mcal__dot mcal__dot--${item.tone}`} aria-hidden="true" />
                {item.label}
              </li>
            ))}
            {legendNote && <li className="mcal__legend-note">{legendNote}</li>}
          </ul>
          {toolbar && <div className="mcal__extra">{toolbar}</div>}
        </div>
      </header>

      {error && (
        <div className="mcal__state" role="alert">
          <strong>{memberText("Không tải được thời khóa biểu")}</strong>
          <p>{error}</p>
          {onRetry && <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>{memberText("Thử lại")}</button>}
        </div>
      )}

      {narrow && (
        <div className="mcal__daystrip" role="group" aria-label={memberText("Chọn ngày")}>
          {days.map((day) => {
            const count = (eventsByDay.get(day) ?? []).filter(
              (event) => event.tone !== 'cancelled' && isWithinScheduleSlots(event.startTime, event.endTime),
            ).length;
            return (
              <button
                key={day}
                type="button"
                className={`mcal__daychip${day === activeDay ? ' is-active' : ''}${day === today ? ' is-today' : ''}`}
                aria-pressed={day === activeDay}
                aria-label={`${memberText(weekdayLabel(day))} ${shortDate(day)}, ${sessionCount(count)}`}
                onClick={() => setFocusDay(day)}
              >
                <span>{memberText(...WEEKDAY_CHIP[days.indexOf(day)])}</span>
                <strong>{shortDate(day).slice(0, 2)}</strong>
                <small aria-hidden="true">{count > 0 ? count : '–'}</small>
              </button>
            );
          })}
        </div>
      )}

      {loading && <span className="sr-only" role="status">{memberText("Đang tải thời khóa biểu...")}</span>}

      <div className={`mcal__frame${hasMoreBelow ? ' has-more-below' : ''}`}>
        <div className={`mcal__scroll${loading ? ' is-loading' : ''}`} aria-busy={loading} ref={scrollRef} onScroll={syncScrollCue}>
        <div
          className={`mcal__week${narrow ? ' is-single' : ''}`}
          style={{ '--mcal-hour': `${SLOT_ROW_PX}px`, '--mcal-rows': SCHEDULE_SLOTS.length, '--mcal-days': visibleDays.length } as CSSProperties}
          ref={gridRef}
        >
          <div className="mcal__corner" aria-hidden="true" />
          {visibleDays.map((day) => {
            const dayEvents = (eventsByDay.get(day) ?? []).filter((event) => isWithinScheduleSlots(event.startTime, event.endTime));
            return (
              <div key={day} className={`mcal__dayhead${day === today ? ' is-today' : ''}`} aria-current={day === today ? 'date' : undefined}>
                <span className="mcal__dayname">{memberText(WEEKDAY_HEAD[days.indexOf(day)])}</span>
                <strong className="mcal__daynum">{day.slice(8)}</strong>
                <span className="mcal__dots" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((event) => <i key={event.id} className={`mcal__dot mcal__dot--${event.tone}`} />)}
                </span>
              </div>
            );
          })}

          <div className="mcal__gutter" aria-hidden="true">
            {SCHEDULE_SLOTS.map((slot) => (
              <div key={slot.code} className="mcal__slot-head" data-testid={`timetable-slot-head-${slot.number}`}>
                <strong className="mcal__slot-name">{slot.label}</strong>
                <span className="mcal__slot-time">{slot.rangeLabel}</span>
              </div>
            ))}
          </div>

          {visibleDays.map((day, dayIndex) => {
            const dayEvents = eventsByDay.get(day) ?? [];
            const busyEvents = dayEvents.filter((event) => event.tone !== 'cancelled');
            const positioned = layoutDaySlotEvents(dayEvents);
            const grouped = maxVisibleLanes ? groupVisibleLanes(positioned, maxVisibleLanes) : { visible: positioned, overflows: [] };
            const nowPct = day === today ? nowSlotPercent(nowMinutes) : null;
            const weekend = days.indexOf(day) >= 5;
            return (
              <div
                key={day}
                className={`mcal__col${day === today ? ' is-today' : ''}${weekend ? ' is-weekend' : ''}`}
                role="group"
                aria-label={`${memberText(weekdayLabel(day))} ${shortDate(day)}`}
              >
                {onSlotClick && SCHEDULE_SLOTS.map((slot, slotIndex) => {
                  const busy = busyEvents.some((event) => resolveSlotIndex(event.startTime, event.endTime) === slotIndex);
                  const past = isSlotPast(day, slot, today, nowMinutes);
                  const key = slotKey(day, slot.number);
                  const slotDisplay = `${slot.label} (${slot.rangeLabel})`;
                  return (
                    <button
                      key={slot.code}
                      type="button"
                      className={`mcal__slot${busy ? ' is-busy' : ' is-free'}${past ? ' is-past' : ''}`}
                      style={{ top: slotIndex * SLOT_ROW_PX }}
                      data-slot={key}
                      tabIndex={key === activeKey ? 0 : -1}
                      aria-disabled={past || undefined}
                      aria-label={
                        past
                          ? `${memberText(weekdayLabel(day))} ${shortDate(day)}, ${slotDisplay}: ${memberText('Đã qua')}`
                          : `${memberText(weekdayLabel(day))} ${shortDate(day)}, ${slotDisplay}: ${busy ? memberText("đã có lịch, ") : memberText("trống, ")}${slotActionLabel === 'tạo lịch' ? memberText(slotActionLabel) : slotActionLabel}`
                      }
                      onFocus={() => setRovingKey(key)}
                      onKeyDown={(event) => moveFocus(event, dayIndex, slotIndex)}
                      onClick={() => {
                        if (past) return;
                        onSlotClick({ date: day, startTime: slot.startTime, endTime: slot.endTime });
                      }}
                    >
                      <span className="mcal__slot-plus" aria-hidden="true">+ {slot.label}</span>
                    </button>
                  );
                })}

                {nowPct !== null && (
                  <span
                    className="mcal__now"
                    aria-hidden="true"
                    style={{ top: `${nowPct}%` }}
                  />
                )}

                {grouped.visible.map(({ event, lane, lanes, topPct, heightPct }) => {
                  const slotText = formatSlotLabel(event.startTime, event.endTime);
                  const eventStyle: CSSProperties & { '--event-accent'?: string } = {
                    top: `calc(${topPct}% + 3px)`,
                    height: `calc(${heightPct}% - 6px)`,
                    left: `calc(${(lane / lanes) * 100}% + 5px)`,
                    width: `calc(${100 / lanes}% - 10px)`,
                  };
                  if (event.accentColor) {
                    eventStyle['--event-accent'] = event.accentColor;
                  }
                  return (
                    <button
                      key={event.id}
                      type="button"
                      data-accent={event.accentColor ? 'true' : undefined}
                      className={`mcal__event mcal__event--${event.tone}${event.id === selectedId ? ' is-selected' : ''}${blockClass((heightPct / 100) * rowsPx)}`}
                      style={eventStyle}
                      aria-label={event.ariaLabel}
                      disabled={disabled}
                      aria-pressed={selectedId === undefined ? undefined : event.id === selectedId}
                      title={[event.title, slotText, event.meta, event.detail, event.badge].filter(Boolean).join(' · ')}
                      onClick={() => onEventClick(event.id)}
                    >
                      <strong className="mcal__event-title">{event.title}</strong>
                      {event.meta && <span className="mcal__event-place">{event.meta}</span>}
                      {event.detail && <span className="mcal__event-coach">{event.detail}</span>}
                    </button>
                  );
                })}

                {grouped.overflows.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    className="mcal__overflow-btn"
                    data-testid="timetable-overflow-btn"
                    style={{
                      top: `calc(${cluster.topPct}% + 3px)`,
                      height: `calc(${cluster.heightPct}% - 6px)`,
                      left: `calc(${(cluster.lane / cluster.lanes) * 100}% + 5px)`,
                      width: `calc(${100 / cluster.lanes}% - 10px)`,
                    }}
                    disabled={disabled}
                    aria-label={t(
                      `Xem thêm ${cluster.hiddenEvents.length} lớp (${cluster.allEvents.length} lớp trong khung ${cluster.rangeLabel})`,
                      `View ${cluster.hiddenEvents.length} more classes (${cluster.allEvents.length} classes in ${cluster.rangeLabel})`,
                    )}
                    onClick={() => setOverflowCluster(cluster)}
                  >
                    <strong>{cluster.hiddenEvents.length === 1 ? t('+1 lớp', '+1 class') : `+${cluster.hiddenEvents.length} ${t('lớp', 'classes')}`}</strong>
                    <span>{cluster.rangeLabel}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {!loading && !error && visibleCount === 0 && (
          <p className="mcal__empty" role="status">
            {emptyText}.{onSlotClick ? memberText(" Bấm vào một ô giờ để tạo lịch.") : ''}
          </p>
        )}
        </div>
        {hasMoreBelow && !loading && (
          <div className="mcal__scroll-cue" data-testid="timetable-scroll-cue" aria-hidden="true">
            <span>{t('↓ Cuộn xem thêm khung giờ', '↓ Scroll for later slots')}</span>
          </div>
        )}
      </div>

      {outsideRange > 0 && (
        <p className="mcal__note" role="status">
          {outsideRange}{' '}
          {t(
            'buổi học nằm ngoài khung 5 slot (07:00–19:30) nên không hiện trên bảng.',
            'sessions outside the 5-slot schedule (07:00–19:30) are not shown.',
          )}
        </p>
      )}

      {overflowCluster && (
        <Modal
          title={t(
            `${memberText(weekdayLabel(overflowCluster.date))} ${shortDate(overflowCluster.date)} · ${overflowCluster.rangeLabel} (${overflowCluster.allEvents.length} lớp)`,
            `${memberText(weekdayLabel(overflowCluster.date))} ${shortDate(overflowCluster.date)} · ${overflowCluster.rangeLabel} (${overflowCluster.allEvents.length} classes)`,
          )}
          onClose={() => setOverflowCluster(null)}
        >
          <p className="mcal__note" style={{ marginBottom: 12 }}>
            {t('Chọn một buổi học bên dưới để xem chi tiết đầy đủ, dời lịch hoặc hủy buổi.', 'Select a session below to view full details, reschedule, or cancel.')}
          </p>
          <div className="mcal__overflow-list" data-testid="timetable-overflow-list">
            {overflowCluster.allEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`mcal__overflow-row mcal__overflow-row--${ev.tone}`}
                onClick={() => {
                  setOverflowCluster(null);
                  onEventClick(ev.id);
                }}
              >
                <span
                  className="mcal__overflow-swatch"
                  style={ev.accentColor ? { background: ev.accentColor } : undefined}
                  aria-hidden="true"
                />
                <span className="mcal__overflow-main">
                  <strong>{ev.title}</strong>
                  <small>
                    {[
                      formatSlotLabel(ev.startTime, ev.endTime),
                      ev.disciplineName,
                      ev.meta,
                      ev.detail,
                    ].filter(Boolean).join(' · ')}
                  </small>
                </span>
                {ev.badge && <span className="mcal__overflow-badge">{ev.badge}</span>}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
