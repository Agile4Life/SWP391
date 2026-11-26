import { useCallback, useEffect, useRef, useState } from 'react';
import { DatePicker } from '../../shared/ui/DatePicker';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { getCurrentUser } from '../../shared/api/client';
import { localizableError } from '../../shared/lib/errorMessage';
import { centerNowParts, formatCenterDate, formatCenterDateTime, formatCenterTime, parseCenterTime } from '../../shared/lib/centerTime';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import type { CoachBookingDto } from '../member/coachBookingApi';
import { notify } from '../../shared/lib/portalNotices';
import { getPtAttendance, markPtAttended, unmarkPtAttended, type PtOutcome } from './ptAttendanceApi';
import { addIsoDays } from './coachTimetable';
import { matchPtSearch } from './ptSearch';
import { formatSlotLabel } from '../schedule/slots';

type PtFilter = PtOutcome | 'IN_PROGRESS';

const FILTERS: PtFilter[] = ['ALL', 'IN_PROGRESS', 'ATTENDED', 'MISSED', 'UPCOMING'];

/** Buổi kèm đã bắt đầu chưa (theo giờ trung tâm). */
function hasStarted(booking: CoachBookingDto, now: Date): boolean {
  return (parseCenterTime(`${booking.bookingDate}T${booking.startTime}`)?.getTime() ?? Infinity) <= now.getTime();
}

/** Kết quả một buổi: đã có mặt, đã kết thúc mà không có mặt (vắng), đang diễn ra hoặc sắp tới. */
function outcomeOf(booking: CoachBookingDto, now: Date): Exclude<PtFilter, 'ALL'> {
  if (booking.attendedAt) return 'ATTENDED';
  const ended = (parseCenterTime(`${booking.bookingDate}T${booking.endTime}`)?.getTime() ?? Infinity) <= now.getTime();
  if (ended) return 'MISSED';
  return hasStarted(booking, now) ? 'IN_PROGRESS' : 'UPCOMING';
}


/**
 * Trang điểm danh buổi kèm 1:1: HLV thấy của mình, lễ tân và quản lý thấy của mọi HLV; lọc theo khoảng ngày,
 * kết quả và tìm kiếm, ghi nhận hoặc bỏ ghi nhận có mặt.
 */
export function PtAttendancePage() {
  const { t } = useI18n();
  const isCoach = getCurrentUser()?.role === 'COACH';
  const [now, setNow] = useState(() => new Date());
  const today = centerNowParts(now).date;
  const [from, setFrom] = useState(() => addIsoDays(centerNowParts().date, -13));
  const [to, setTo] = useState(() => centerNowParts().date);
  const [filter, setFilter] = useState<PtFilter>('ALL');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CoachBookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | Error | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const busy = useRef(false);
  const requestId = useRef(0);
  const loadedRangeRef = useRef<string | null>(null);
  const rowsRef = useRef<CoachBookingDto[]>([]);
  const mountedRef = useRef(true);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Tải danh sách buổi trong khoảng ngày; giữ nguyên rows cũ nếu refresh cùng khoảng ngày thất bại.
  const load = useCallback(async () => {
    const current = ++requestId.current;
    const rangeKey = `${from}|${to}`;
    setError(null);
    if (!from || !to || from > to) {
      loadedRangeRef.current = null;
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPtAttendance(from, to, 'ALL');
      if (mountedRef.current && current === requestId.current) {
        loadedRangeRef.current = rangeKey;
        setRows(data.filter((row) => row.status?.toLowerCase() !== 'cancelled'));
        setNow(new Date());
      }
    } catch (cause) {
      if (mountedRef.current && current === requestId.current) {
        if (loadedRangeRef.current !== rangeKey) {
          loadedRangeRef.current = null;
          setRows([]);
        }
        setError(localizableError(cause, 'Không tải được danh sách điểm danh. Vui lòng thử lại.'));
      }
    } finally {
      if (mountedRef.current && current === requestId.current) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
    // Làm các lần tải đang bay trở nên vô hiệu.
    const invalidateRequests = () => { requestId.current++; };
    // Tự tải lại khi tab hiện lại hoặc lấy lại focus, trừ lúc đang thao tác.
    const refresh = () => { if (!busy.current && document.visibilityState !== 'hidden') void load(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      invalidateRequests();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const counts = { ATTENDED: 0, MISSED: 0, UPCOMING: 0, IN_PROGRESS: 0 };
  for (const row of rows) counts[outcomeOf(row, now)] += 1;
  const visible = rows.filter((row) => {
    const matchFilter = filter === 'ALL' || outcomeOf(row, now) === filter;
    const matchSearch = matchPtSearch(row, search);
    return matchFilter && matchSearch;
  });

  const tabLabel: Record<PtFilter, string> = {
    ALL: t('Tất cả', 'All'),
    IN_PROGRESS: t('Đang diễn ra', 'In progress'),
    ATTENDED: t('Đã có mặt', 'Attended'),
    MISSED: t('Không có mặt', 'Did not attend'),
    UPCOMING: t('Sắp diễn ra', 'Upcoming'),
  };
  const badgeLabel: Record<Exclude<PtFilter, 'ALL'>, string> = {
    ATTENDED: t('Đã có mặt', 'Attended'),
    MISSED: t('Không có mặt', 'Did not attend'),
    UPCOMING: t('Sắp diễn ra', 'Upcoming'),
    IN_PROGRESS: t('Đang diễn ra · Chưa có mặt', 'In progress · Attendance unmarked'),
  };
  const badge = { ATTENDED: 'badge-success', MISSED: 'badge-warning', UPCOMING: 'badge-info', IN_PROGRESS: 'badge-info' };
  const invalidRange = Boolean(from && to && from > to);

  // Ghi nhận hoặc bỏ ghi nhận có mặt; giữ busy=true suốt cả hộp thoại xác nhận để chặn race refresh.
  async function markAttended(row: CoachBookingDto, attended: boolean) {
    if (busy.current || loading) return;
    const currentToday = centerNowParts().date;
    if (isCoach && row.bookingDate !== currentToday) {
      setError(t('Buổi tập đã qua ngày. Huấn luyện viên chỉ được điểm danh và sửa trong ngày diễn ra buổi tập.', 'The session date has passed. Coaches can only mark and edit attendance on the day of the session.'));
      return;
    }
    busy.current = true;
    try {
      // Hội viên đã quét mã vào cổng quanh thời điểm buổi tập này: cần xác nhận lại trước khi bỏ ghi nhận.
      if (!attended && row.gateCheckinAt) {
        const confirmed = await confirm({
          title: { vi: 'Bỏ ghi nhận có mặt?', en: 'Remove the attended mark?' },
          message: {
            vi: `${row.memberName} đã quét QR vào trung tâm trong khung giờ buổi tập. Bạn chắc chắn bỏ ghi nhận có mặt?`,
            en: `${row.memberName} checked in at the gate during this session. Remove the attended mark anyway?`,
          },
          confirmLabel: { vi: 'Vẫn bỏ ghi nhận', en: 'Remove anyway' },
          cancelLabel: { vi: 'Xem lại', en: 'Review' },
          danger: true,
        });
        if (!confirmed || !mountedRef.current) return;
        const latestToday = centerNowParts().date;
        if (isCoach && row.bookingDate !== latestToday) {
          setError(t('Buổi tập đã qua ngày. Huấn luyện viên chỉ được điểm danh và sửa trong ngày diễn ra buổi tập.', 'The session date has passed. Coaches can only mark and edit attendance on the day of the session.'));
          return;
        }
        if (!rowsRef.current.some((item) => item.id === row.id && item.status?.toLowerCase() !== 'cancelled')) {
          return;
        }
      }
      setBusyId(row.id);
      setError(null);
      if (attended) await markPtAttended(row.id); else await unmarkPtAttended(row.id);
      if (!mountedRef.current) return;
      notify(attended ? t('Đã ghi nhận hội viên có mặt.', 'The member has been marked as attended.') : t('Đã bỏ ghi nhận có mặt.', 'The attendance mark has been removed.'), 'success');
      await load();
    } catch (cause) {
      if (mountedRef.current) {
        setError(localizableError(cause, attended ? 'Không thể ghi nhận có mặt. Vui lòng thử lại.' : 'Không thể bỏ ghi nhận có mặt. Vui lòng thử lại.'));
      }
    } finally {
      busy.current = false;
      if (mountedRef.current) setBusyId(null);
    }
  }

  return (
    <div data-i18n-managed className="portal-container pt-attendance">
      {confirmDialog}
      <PageHeader title={t('Điểm danh buổi PT 1:1', '1:1 session attendance')} />
      <div className="portal-card pt-range">
        <div className="pt-range__fields">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="pt-from">{t('Từ ngày', 'From')}</label>
            <DatePicker id="pt-from" disabled={busyId !== null} max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="pt-to">{t('Đến ngày', 'To')}</label>
            <DatePicker id="pt-to" disabled={busyId !== null} min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      </div>
      {invalidRange && <div className="portal-alert" role="alert">{t('Ngày bắt đầu phải trước ngày kết thúc.', 'The start date must be before the end date.')}</div>}
      <div className="pt-filter-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <div className="portal-tabs" role="tablist" aria-label={t('Lọc theo kết quả', 'Filter by outcome')} style={{ margin: 0 }}>
          {FILTERS.map((value) => {
            const count = value === 'ALL' ? rows.length : counts[value];
            return (
              <button key={value} type="button" role="tab" aria-selected={filter === value}
                className={`portal-tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
                <span>{tabLabel[value]}</span>
                <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="pt-search-box" style={{ display: 'flex', alignItems: 'center', minWidth: 260, flex: '1 1 320px', maxWidth: 460 }}>
          <input
            type="search"
            className="portal-input"
            style={{ width: '100%' }}
            placeholder={t("Tìm theo tên học viên, mã thẻ, SĐT hoặc email…", "Search by student name, card code, phone or email…")}
            aria-label={t("Tìm theo tên học viên, mã thẻ, SĐT hoặc email", "Search by student name, card code, phone or email")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      {error && <div className="portal-alert" role="alert"><strong>{t(error)}</strong> <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null || loading} onClick={() => void load()}>{t('Thử lại', 'Retry')}</button></div>}
      {busyId !== null && <p role="status">{t('Đang cập nhật điểm danh…', 'Updating attendance…')}</p>}
      {loading && rows.length === 0 ? (
        <LoadingSkeleton label={t('Đang tải điểm danh', 'Loading attendance')} />
      ) : visible.length > 0 ? (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Danh sách buổi PT', '1:1 sessions')}>
          {visible.map((row) => {
            const outcome = outcomeOf(row, now);
            return (
              <li key={row.id} className="portal-card" data-testid={`pt-row-${row.id}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCenterDate(row.bookingDate)} · {formatSlotLabel(row.startTime, row.endTime)}</strong>
                  <div>
                    {t('Hội viên', 'Member')}: <strong>{row.memberName}</strong>
                    {row.membershipCode ? <span className="muted" style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>({row.membershipCode})</span> : row.memberId ? <span className="muted" style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>(#{row.memberId})</span> : null}
                    {!isCoach && <> · {t('HLV', 'Coach')}: {row.coachName}</>}
                  </div>
                  {(row.memberPhone || row.memberEmail) && (
                    <div className="muted" style={{ fontSize: '0.82rem', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {row.memberPhone}
                      {((row.memberPhone) && (row.memberEmail)) ? ' · ' : ''}
                      {row.memberEmail}
                    </div>
                  )}
                  {row.gateCheckinAt && (
                    <span className="badge badge-info pt-gate-tag" style={{ fontVariantNumeric: 'tabular-nums' }}>{t(`Đã check-in ${formatCenterTime(row.gateCheckinAt)}`, `Checked in ${formatCenterTime(row.gateCheckinAt)}`)}</span>
                  )}
                  {row.attendedAt && <small style={{ fontSize: '0.75rem', display: 'block', marginTop: 4, color: 'var(--portal-muted)', fontVariantNumeric: 'tabular-nums' }}>{t('Đánh dấu có mặt lúc', 'Marked attended at')} {formatCenterDateTime(row.attendedAt)}</small>}
                  {!row.attendedAt && row.attendanceLocked && <small style={{ fontSize: '0.75rem', display: 'block', marginTop: 4, color: 'var(--portal-muted)' }}>{t('Đã bỏ ghi nhận có mặt', 'Attendance mark removed')}</small>}
                </div>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${badge[outcome]}`}>{badgeLabel[outcome]}</span>
                  {outcome === 'ATTENDED' && (
                    !isCoach || row.bookingDate === today ? (
                      <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null || loading} onClick={() => void markAttended(row, false)}>
                        {t('Bỏ đánh dấu có mặt', 'Remove attended mark')}
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                        {t('Đã khóa (chỉ sửa trong ngày)', 'Locked (same-day only)')}
                      </span>
                    )
                  )}
                  {outcome !== 'ATTENDED' && hasStarted(row, now) && (
                    !isCoach || row.bookingDate === today ? (
                      <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null || loading} onClick={() => void markAttended(row, true)}>
                        {t('Đánh dấu có mặt', 'Mark as attended')}
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                        {t('Đã khóa (chỉ sửa trong ngày)', 'Locked (same-day only)')}
                      </span>
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : !error && !invalidRange ? (
        <div className="portal-card" role="status">
          {search.trim()
            ? t('Không tìm thấy học viên phù hợp.', 'No matching student found.')
            : t('Không có buổi PT nào trong khoảng này.', 'No 1:1 sessions in this range.')}
        </div>
      ) : null}
    </div>
  );
}
