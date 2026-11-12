import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatePicker } from '../../shared/ui/DatePicker';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { getCurrentUser } from '../../shared/api/client';
import { localizableError } from '../../shared/lib/errorMessage';
import { centerNowParts, formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import type { CoachBookingDto } from '../member/coachBookingApi';
import { notify } from '../../shared/lib/portalNotices';
import { getPtAttendance, markPtAttended, unmarkPtAttended, type PtOutcome } from './ptAttendanceApi';

const FILTERS: PtOutcome[] = ['ALL', 'ATTENDED', 'MISSED', 'UPCOMING'];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Outcome of one session: arrived, finished without an arrival, or still ahead. */
function outcomeOf(booking: CoachBookingDto, now: { date: string; time: string }): Exclude<PtOutcome, 'ALL'> {
  if (booking.attendedAt) return 'ATTENDED';
  const ended = booking.bookingDate < now.date || (booking.bookingDate === now.date && booking.endTime.slice(0, 5) <= now.time);
  return ended ? 'MISSED' : 'UPCOMING';
}

/** Attendance of 1:1 sessions for coaches (their own) and for the front desk and managers (everyone's). */
export function PtAttendancePage() {
  const { t } = useI18n();
  const isCoach = getCurrentUser()?.role === 'COACH';
  const today = centerNowParts().date;
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [filter, setFilter] = useState<PtOutcome>('ALL');
  const [rows, setRows] = useState<CoachBookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPtAttendance(from, to, 'ALL'));
    } catch (cause) {
      setRows([]);
      setError(localizableError(cause, 'Không tải được danh sách điểm danh. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const now = centerNowParts();
  const counts = useMemo(() => {
    const result = { ATTENDED: 0, MISSED: 0, UPCOMING: 0 };
    for (const row of rows) result[outcomeOf(row, centerNowParts())] += 1;
    return result;
  }, [rows]);
  const visible = rows.filter((row) => filter === 'ALL' || outcomeOf(row, now) === filter);

  const filterLabel: Record<PtOutcome, string> = {
    ALL: t('Tất cả', 'All'),
    ATTENDED: t('Đã có mặt', 'Attended'),
    MISSED: t('Không có mặt', 'Did not attend'),
    UPCOMING: t('Sắp diễn ra', 'Upcoming'),
  };
  const badge: Record<Exclude<PtOutcome, 'ALL'>, string> = { ATTENDED: 'badge-success', MISSED: 'badge-warning', UPCOMING: 'badge-info' };
  const invalidRange = from > to;

  async function markAttended(row: CoachBookingDto, attended: boolean) {
    if (busyId !== null) return;
    setBusyId(row.id);
    setError(null);
    try {
      if (attended) await markPtAttended(row.id); else await unmarkPtAttended(row.id);
      notify(attended ? t('Đã ghi nhận hội viên có mặt.', 'The member has been marked as attended.') : t('Đã bỏ ghi nhận có mặt.', 'The attendance mark has been removed.'), 'success');
      await load();
    } catch (cause) {
      setError(localizableError(cause, 'Không thể ghi nhận có mặt. Vui lòng thử lại.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div data-i18n-managed className="portal-container pt-attendance">
      <PageHeader title={t('Điểm danh buổi PT 1:1', '1:1 session attendance')} />
      <div className="portal-card pt-range">
        <div className="pt-range__fields">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="pt-from">{t('Từ ngày', 'From')}</label>
            <DatePicker id="pt-from" max={to} value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="pt-to">{t('Đến ngày', 'To')}</label>
            <DatePicker id="pt-to" min={from} value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <p className="form-hint">{t('Tối đa 62 ngày mỗi lần xem.', 'Up to 62 days at a time.')}</p>
      </div>
      {invalidRange && <div className="portal-card" role="alert">{t('Ngày bắt đầu phải trước ngày kết thúc.', 'The start date must be before the end date.')}</div>}
      <div className="portal-tabs" role="tablist" aria-label={t('Lọc theo kết quả', 'Filter by outcome')} style={{ marginTop: 16 }}>
        {FILTERS.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value}
            className={`portal-tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
            {filterLabel[value]}{value !== 'ALL' ? ` (${counts[value]})` : ` (${rows.length})`}
          </button>
        ))}
      </div>
      {error && <div className="portal-card" role="alert"><strong>{t(error)}</strong></div>}
      {loading ? <LoadingSkeleton label={t('Đang tải điểm danh', 'Loading attendance')} /> : visible.length === 0 ? (
        <div className="portal-card" role="status">{t('Không có buổi PT nào trong khoảng này.', 'No 1:1 sessions in this range.')}</div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Danh sách buổi PT', '1:1 sessions')}>
          {visible.map((row) => {
            const outcome = outcomeOf(row, now);
            return (
              <li key={row.id} className="portal-card" data-testid={`pt-row-${row.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <strong>{formatCenterDate(row.bookingDate)} · {row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}</strong>
                  <div>{t('Hội viên', 'Member')}: {row.memberName}{!isCoach && <> · {t('HLV', 'Coach')}: {row.coachName}</>}</div>
                  {row.attendedAt && <small>{t('Có mặt lúc', 'Arrived')} {formatCenterDateTime(row.attendedAt)}</small>}
                </div>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${badge[outcome]}`}>{filterLabel[outcome]}</span>
                  {outcome === 'ATTENDED' && (
                    <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null} onClick={() => void markAttended(row, false)}>
                      {t('Bỏ đánh dấu có mặt', 'Remove attended mark')}
                    </button>
                  )}
                  {outcome !== 'ATTENDED' && (row.bookingDate < now.date || (row.bookingDate === now.date && row.startTime.slice(0, 5) <= now.time)) && (
                    <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null} onClick={() => void markAttended(row, true)}>
                      {t('Đánh dấu có mặt', 'Mark as attended')}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
