import { useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../../shared/i18n';
import { centerNowParts } from '../../shared/lib/centerTime';
import { Modal } from '../../shared/ui/Modal';
import { formatSlotLabel } from './slots';
import { addDays, addMonths, monthStartOf, mondayOf, shortDate, toMinutes, weekdayLabel, type TimetableEvent } from './timetable';
import './calendar.css';

const WEEKDAY_HEAD: [string, string][] = [
  ['T2', 'Mon'], ['T3', 'Tue'], ['T4', 'Wed'], ['T5', 'Thu'], ['T6', 'Fri'], ['T7', 'Sat'], ['CN', 'Sun'],
];
const WEEKDAY_EN: Record<string, string> = {
  'Thứ 2': 'Mon', 'Thứ 3': 'Tue', 'Thứ 4': 'Wed', 'Thứ 5': 'Thu', 'Thứ 6': 'Fri', 'Thứ 7': 'Sat', 'Chủ nhật': 'Sun',
};

interface MonthOverviewProps {
  /** Ngày 1 của tháng đang xem (YYYY-MM-01). */
  monthStart: string;
  events: TimetableEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onMonthChange: (monthStart: string) => void;
  onEventClick: (eventId: string) => void;
  /** Mở lịch tuần chứa ngày được chọn. */
  onOpenWeek: (day: string) => void;
  /** Vùng điều khiển thêm trên thanh công cụ (ví dụ nút chuyển Tuần/Tháng). */
  toolbar?: ReactNode;
  legendNote?: string;
  label: string;
}

interface DayGroup {
  name: string;
  color?: string;
  count: number;
}

/**
 * Lịch tháng tổng quát: lưới 6 hàng × 7 ngày, mỗi ô đếm số buổi theo bộ môn trong ngày (không tính buổi hủy);
 * bấm ô để xem danh sách buổi của ngày đó rồi mở chi tiết hoặc chuyển sang lịch tuần.
 */
export function MonthOverview({
  monthStart, events, loading = false, error = null, onRetry, onMonthChange, onEventClick, onOpenWeek,
  toolbar, legendNote, label,
}: MonthOverviewProps) {
  const { t } = useI18n();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const today = centerNowParts().date;
  const gridStart = mondayOf(monthStart);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const [year, month] = monthStart.split('-');

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TimetableEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || a.title.localeCompare(b.title));
    }
    return map;
  }, [events]);

  const dayName = (iso: string) => {
    const vi = weekdayLabel(iso);
    return t(vi, WEEKDAY_EN[vi] ?? vi);
  };
  const monthEventCount = days.filter((d) => d.slice(0, 7) === monthStart.slice(0, 7))
    .reduce((sum, d) => sum + (eventsByDay.get(d)?.filter((e) => e.tone !== 'cancelled').length ?? 0), 0);
  const openList = openDay ? eventsByDay.get(openDay) ?? [] : [];

  return (
    <section data-i18n-managed className="mcal" aria-label={label}>
      <header className="mcal__toolbar">
        <div className="mcal__nav" role="group" aria-label={t('Điều hướng tháng', 'Month navigation')}>
          <button type="button" className="mcal__icon-btn" aria-label={t('Tháng trước', 'Previous month')} onClick={() => onMonthChange(addMonths(monthStart, -1))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" className="mcal__icon-btn" aria-label={t('Tháng sau', 'Next month')} onClick={() => onMonthChange(addMonths(monthStart, 1))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button
            type="button"
            className="mcal__today-btn"
            disabled={monthStart === monthStartOf(today)}
            onClick={() => onMonthChange(monthStartOf(today))}
          >
            {t('Tháng này', 'This month')}
          </button>
          <h2 className="mcal__range" aria-live="polite">{t(`Tháng ${Number(month)}/${year}`, `${Number(month)}/${year}`)}</h2>
        </div>
        <div className="mcal__side">
          {legendNote && <p className="mcal__note">{legendNote}</p>}
          {toolbar && <div className="mcal__extra">{toolbar}</div>}
        </div>
      </header>

      {error && (
        <div className="mcal__state" role="alert">
          <strong>{t('Không tải được lịch tháng', 'Unable to load month calendar')}</strong>
          <p>{error}</p>
          {onRetry && <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>{t('Thử lại', 'Retry')}</button>}
        </div>
      )}

      {!error && (
        <div className={`mcal__month${loading ? ' is-loading' : ''}`} aria-busy={loading} data-testid="month-overview-grid">
          {WEEKDAY_HEAD.map(([vi, en]) => <span key={vi} className="mcal__month-head">{t(vi, en)}</span>)}
          {days.map((day) => {
            const list = eventsByDay.get(day) ?? [];
            const active = list.filter((e) => e.tone !== 'cancelled');
            const groups = new Map<string, DayGroup>();
            for (const event of active) {
              const name = event.disciplineName || event.title;
              const group = groups.get(name) ?? { name, color: event.accentColor, count: 0 };
              group.count += 1;
              groups.set(name, group);
            }
            const outside = day.slice(0, 7) !== monthStart.slice(0, 7);
            return (
              <div key={day} className={`mcal__cell${outside ? ' is-outside' : ''}${day === today ? ' is-today' : ''}`}>
                <button
                  type="button"
                  className="mcal__month-day"
                  data-testid={`month-day-${day}`}
                  disabled={list.length === 0}
                  aria-label={t(
                    `${dayName(day)} ${shortDate(day)}: ${active.length} buổi học${list.length ? '. Xem danh sách' : ''}`,
                    `${dayName(day)} ${shortDate(day)}: ${active.length} ${active.length === 1 ? 'session' : 'sessions'}${list.length ? '. View list' : ''}`,
                  )}
                  onClick={() => setOpenDay(day)}
                >
                  <span className="mcal__cell-day" aria-hidden="true">{Number(day.slice(8))}</span>
                  {[...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map((group) => (
                    <span key={group.name} className="mcal__summary-row" aria-hidden="true">
                      <i className="mcal__summary-dot" style={group.color ? { background: group.color } : undefined} />
                      <span className="mcal__summary-name">{group.name}</span>
                      <small>{t(`${group.count} buổi`, `${group.count}`)}</small>
                    </span>
                  ))}
                  {list.length > 0 && active.length === 0 && (
                    <span className="mcal__summary-note" aria-hidden="true">{t('Đã hủy', 'Cancelled')}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && monthEventCount === 0 && (
        <p className="mcal__note" role="status">{t('Tháng này chưa có buổi học nào.', 'No sessions scheduled this month.')}</p>
      )}

      {openDay && (
        <Modal
          title={t(
            `${dayName(openDay)} ${shortDate(openDay)} (${openList.length} buổi)`,
            `${dayName(openDay)} ${shortDate(openDay)} (${openList.length} ${openList.length === 1 ? 'session' : 'sessions'})`,
          )}
          onClose={() => setOpenDay(null)}
        >
          <div className="mcal__overflow-list" data-testid="month-day-list">
            {openList.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`mcal__overflow-row mcal__overflow-row--${ev.tone}`}
                onClick={() => {
                  setOpenDay(null);
                  onEventClick(ev.id);
                }}
              >
                <span className="mcal__overflow-swatch" style={ev.accentColor ? { background: ev.accentColor } : undefined} aria-hidden="true" />
                <span className="mcal__overflow-main">
                  <strong>{ev.title}</strong>
                  <small>{[formatSlotLabel(ev.startTime, ev.endTime), ev.disciplineName, ev.meta, ev.detail].filter(Boolean).join(' · ')}</small>
                </span>
                {ev.tone === 'cancelled'
                  ? <span className="mcal__overflow-badge">{t('Đã hủy', 'Cancelled')}</span>
                  : ev.badge && <span className="mcal__overflow-badge">{ev.badge}</span>}
              </button>
            ))}
          </div>
          <div className="mcal__dialog-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const day = openDay;
                setOpenDay(null);
                onOpenWeek(day);
              }}
            >
              {t('Xem tuần này', 'View this week')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
