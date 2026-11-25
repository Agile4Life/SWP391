import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { memberText } from '../member/memberI18n';
import { useI18n } from '../../shared/i18n';
import { useLanguage } from '../../shared/i18n/language';
import {
  TIMETABLE_HOURS,
  addDays,
  blockClass,
  hhmm,
  hourLabel,
  isWithinRange,
  layoutDayEvents,
  mondayOf,
  overlapsHour,
  shortDate,
  todayISO,
  weekDays,
  weekdayLabel,
  type TimetableEvent,
} from './timetable';
import type { TimetableLegendItem } from './WeeklyTimetable';
import './calendar.css';

/** Một cột phòng tập trong chế độ Tổng quan theo phòng. */
export interface RoomColumn {
  id: number;
  name: string;
  capacity?: number;
}

/** Khung giờ trống trên một phòng cụ thể khi Manager bấm để tạo lịch mới. */
export interface RoomSlotClick {
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
}

interface RoomDayTimetableProps {
  /** Ngày đang xem dạng YYYY-MM-DD. */
  date: string;
  rooms: RoomColumn[];
  /** Mọi sự kiện của tuần chứa `date` (dùng để đếm số buổi trên thanh chọn nhanh T2–CN và vẽ ngày đang chọn). */
  events: TimetableEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDateChange: (nextDate: string) => void;
  onEventClick: (eventId: string) => void;
  onSlotClick?: (slot: RoomSlotClick) => void;
  selectedId?: string;
  disabled?: boolean;
  legend: TimetableLegendItem[];
  toolbar?: ReactNode;
  emptyRoomsLabel?: string;
  label: string;
}

const HOUR_PX = 64;
const WEEKDAY_CHIP: [string, string][] = [
  ['T2', 'Mon'],
  ['T3', 'Tue'],
  ['T4', 'Wed'],
  ['T5', 'Thu'],
  ['T6', 'Fri'],
  ['T7', 'Sat'],
  ['CN', 'Sun'],
];

/**
 * Lịch ngày theo Phòng (Phòng × Khung giờ 06:00–22:00):
 * mỗi phòng có một cột riêng biệt nên các bộ môn dạy song song ở các phòng khác nhau 100% không bao giờ bị đè.
 */
export function RoomDayTimetable({
  date,
  rooms,
  events,
  loading = false,
  error = null,
  onRetry,
  onDateChange,
  onEventClick,
  onSlotClick,
  selectedId,
  disabled = false,
  legend,
  toolbar,
  emptyRoomsLabel,
  label,
}: RoomDayTimetableProps) {
  useLanguage();
  const { t } = useI18n();
  const today = todayISO();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekStart = useMemo(() => mondayOf(date), [date]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of days) map.set(d, 0);
    for (const ev of events) {
      if (ev.tone === 'cancelled' || !isWithinRange(ev)) continue;
      if (map.has(ev.date)) map.set(ev.date, (map.get(ev.date) ?? 0) + 1);
    }
    return map;
  }, [days, events]);

  const dayEvents = useMemo(
    () => events.filter((ev) => ev.date === date && isWithinRange(ev)),
    [events, date],
  );

  const eventsByRoom = useMemo(() => {
    const map = new Map<number, TimetableEvent[]>();
    for (const room of rooms) map.set(room.id, []);
    for (const ev of dayEvents) {
      if (ev.roomId !== undefined && map.has(ev.roomId)) {
        map.get(ev.roomId)!.push(ev);
      }
    }
    return map;
  }, [rooms, dayEvents]);

  const hours = TIMETABLE_HOURS;
  const firstHour = hours[0];
  const endHour = hours[hours.length - 1] + 1;
  const rowsPx = hours.length * HOUR_PX;
  const showNow = date === today && nowMinutes >= firstHour * 60 && nowMinutes < endHour * 60;
  const isPastSlot = (hour: number) => date < today || (date === today && (hour + 1) * 60 <= nowMinutes);

  return (
    <section data-i18n-managed className="mcal rcal" aria-label={label}>
      <header className="mcal__toolbar">
        <div className="mcal__nav" role="group" aria-label={t('Điều hướng ngày', 'Date navigation')}>
          <button
            type="button"
            className="mcal__icon-btn"
            aria-label={t('Ngày trước', 'Previous day')}
            onClick={() => onDateChange(addDays(date, -1))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            className="mcal__icon-btn"
            aria-label={t('Ngày sau', 'Next day')}
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button
            type="button"
            className="mcal__today-btn"
            disabled={date === today}
            onClick={() => onDateChange(today)}
          >
            {t('Hôm nay', 'Today')}
          </button>
          <h2 className="mcal__range" aria-live="polite">
            {`${memberText(weekdayLabel(date))}, ${shortDate(date)}/${date.slice(0, 4)}`}
          </h2>
        </div>

        <div className="mcal__side">
          <ul className="mcal__legend" aria-label={t('Chú thích', 'Legend')}>
            {legend.map((item) => (
              <li key={item.tone}>
                <i className={`mcal__dot mcal__dot--${item.tone}`} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
          {toolbar && <div className="mcal__extra">{toolbar}</div>}
        </div>
      </header>

      <div className="rcal__daystrip" role="group" aria-label={t('Chọn ngày trong tuần', 'Select day of week')}>
        {days.map((d, index) => {
          const count = countsByDay.get(d) ?? 0;
          return (
            <button
              key={d}
              type="button"
              className={`mcal__daychip${d === date ? ' is-active' : ''}${d === today ? ' is-today' : ''}`}
              aria-pressed={d === date}
              aria-label={`${memberText(weekdayLabel(d))} ${shortDate(d)} (${count} ${t('buổi', count === 1 ? 'session' : 'sessions')})`}
              onClick={() => onDateChange(d)}
            >
              <span>{memberText(...WEEKDAY_CHIP[index])}</span>
              <strong>{shortDate(d).slice(0, 2)}</strong>
              <small aria-hidden="true">{count > 0 ? `${count} ${t('buổi', 'cls')}` : '–'}</small>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mcal__state" role="alert">
          <strong>{t('Không tải được lịch theo phòng', 'Could not load room schedule')}</strong>
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
              {t('Thử lại', 'Retry')}
            </button>
          )}
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="portal-empty" role="status">
          <p>{emptyRoomsLabel ?? t('Không có phòng tập phù hợp bộ lọc hiện tại.', 'No rooms match the current filter.')}</p>
        </div>
      ) : (
        <div className="mcal__frame">
          <div className={`mcal__scroll rcal__scroll${loading ? ' is-loading' : ''}`} aria-busy={loading}>
            <div
              className="rcal__grid"
              style={{
                '--mcal-hour': `${HOUR_PX}px`,
                '--mcal-rows': hours.length,
                '--rcal-rooms': rooms.length,
              } as CSSProperties}
            >
              <div className="mcal__corner" aria-hidden="true" />
              {rooms.map((room) => {
                const count = (eventsByRoom.get(room.id) ?? []).filter((e) => e.tone !== 'cancelled').length;
                return (
                  <div key={room.id} className="mcal__dayhead rcal__roomhead" data-testid={`room-col-head-${room.id}`}>
                    <strong className="rcal__roomname">{room.name}</strong>
                    <span className="rcal__roommeta">
                      {count > 0
                        ? t(`${count} buổi hôm nay`, `${count} ${count === 1 ? 'session' : 'sessions'}`)
                        : t('Trống cả ngày', 'Free all day')}
                    </span>
                  </div>
                );
              })}

              <div className="mcal__gutter" aria-hidden="true">
                {hours.map((hour) => <span key={hour}>{hourLabel(hour)}</span>)}
              </div>

              {rooms.map((room) => {
                const roomEvents = eventsByRoom.get(room.id) ?? [];
                const busyEvents = roomEvents.filter((e) => e.tone !== 'cancelled');
                const positioned = layoutDayEvents(roomEvents, firstHour, endHour);
                return (
                  <div
                    key={room.id}
                    className="mcal__col rcal__col"
                    role="group"
                    aria-label={room.name}
                    data-testid={`room-col-${room.id}`}
                  >
                    {onSlotClick && hours.map((hour, hourIndex) => {
                      const busy = busyEvents.some((ev) => overlapsHour(ev, hour));
                      const past = isPastSlot(hour);
                      const range = `${hourLabel(hour)}–${hourLabel(hour + 1)}`;
                      return (
                        <button
                          key={hour}
                          type="button"
                          className={`mcal__slot${busy ? ' is-busy' : ' is-free'}${past ? ' is-past' : ''}`}
                          style={{ top: hourIndex * HOUR_PX }}
                          data-room-slot={`${room.id}|${hour}`}
                          aria-disabled={past || undefined}
                          aria-label={
                            past
                              ? `${room.name}, ${range}: ${t('Đã qua', 'Past')}`
                              : `${room.name}, ${range}: ${busy ? t('đã có lịch', 'occupied') : t('trống, bấm để tạo lịch', 'free, click to schedule')}`
                          }
                          onClick={() => {
                            if (past) return;
                            onSlotClick({
                              date,
                              startTime: hourLabel(hour),
                              endTime: hourLabel(hour + 1),
                              roomId: room.id,
                            });
                          }}
                        >
                          <span className="mcal__slot-plus" aria-hidden="true">+ {hourLabel(hour)}</span>
                        </button>
                      );
                    })}

                    {showNow && (
                      <span
                        className="mcal__now"
                        aria-hidden="true"
                        style={{ top: `${((nowMinutes - firstHour * 60) / (hours.length * 60)) * 100}%` }}
                      />
                    )}

                    {positioned.map(({ event, lane, lanes, topPct, heightPct }) => {
                      const range = `${hhmm(event.startTime)}–${hhmm(event.endTime)}`;
                      const eventStyle: CSSProperties & { '--event-accent'?: string } = {
                        top: `calc(${topPct}% + 3px)`,
                        height: `calc(${heightPct}% - 6px)`,
                        left: `calc(${(lane / lanes) * 100}% + 6px)`,
                        width: `calc(${100 / lanes}% - 12px)`,
                      };
                      if (event.accentColor) {
                        eventStyle['--event-accent'] = event.accentColor;
                      }
                      return (
                        <button
                          key={event.id}
                          type="button"
                          data-accent={event.accentColor ? 'true' : undefined}
                          className={`mcal__event rcal__event mcal__event--${event.tone}${event.id === selectedId ? ' is-selected' : ''}${blockClass((heightPct / 100) * rowsPx)}`}
                          style={eventStyle}
                          aria-label={event.ariaLabel}
                          disabled={disabled}
                          title={[event.title, range, event.disciplineName, event.detail, event.badge].filter(Boolean).join(' · ')}
                          onClick={() => onEventClick(event.id)}
                        >
                          <strong className="mcal__event-title">{event.title}</strong>
                          <span className="rcal__event-sub">
                            {[event.disciplineName, event.detail, event.badge].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
