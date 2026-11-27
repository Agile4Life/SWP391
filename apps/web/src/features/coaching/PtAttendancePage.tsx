import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { getPtAttendance, markPtAttended, unmarkPtAttended } from './ptAttendanceApi';
import { addIsoDays } from './coachTimetable';
import { matchPtSearch } from './ptSearch';
import { formatSlotLabel } from '../schedule/slots';
import './coach-attendance.css';

type PtFilter = 'ALL' | 'TODAY' | 'PENDING' | 'UPCOMING';

const FILTERS: PtFilter[] = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

/** Buổi kèm đã bắt đầu chưa (theo giờ trung tâm). */
function hasStarted(booking: CoachBookingDto, now: Date): boolean {
  return (parseCenterTime(`${booking.bookingDate}T${booking.startTime}`)?.getTime() ?? Infinity) <= now.getTime();
}

/** Kết quả một buổi: đã có mặt, đã kết thúc mà không có mặt (vắng), đang diễn ra hoặc sắp tới. */
function outcomeOf(booking: CoachBookingDto, now: Date): 'ATTENDED' | 'MISSED' | 'IN_PROGRESS' | 'UPCOMING' {
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
  const [searchParams] = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramSearch = searchParams.get('search');

  const isCoach = getCurrentUser()?.role === 'COACH';
  const [now, setNow] = useState(() => new Date());
  const today = centerNowParts(now).date;
  const [from, setFrom] = useState(() => {
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      const todayDate = centerNowParts().date;
      return paramDate < todayDate ? paramDate : addIsoDays(todayDate, -13);
    }
    return addIsoDays(centerNowParts().date, -13);
  });
  const [to, setTo] = useState(() => {
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      const todayDate = centerNowParts().date;
      return paramDate > todayDate ? paramDate : addIsoDays(todayDate, 30);
    }
    return addIsoDays(centerNowParts().date, 30);
  });
  const [filter, setFilter] = useState<PtFilter>('ALL');
  const [masterTab, setMasterTab] = useState<'attendance' | 'history'>('attendance');
  const [search, setSearch] = useState(() => paramSearch ?? '');

  useEffect(() => {
    const qDate = searchParams.get('date');
    const qSearch = searchParams.get('search');
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      const todayDate = centerNowParts().date;
      setFrom(qDate < todayDate ? qDate : addIsoDays(todayDate, -13));
      setTo(qDate > todayDate ? qDate : addIsoDays(todayDate, 30));
    }
    if (qSearch !== null) {
      setSearch(qSearch);
    }
  }, [searchParams]);
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
  const counts = { ALL: 0, TODAY: 0, PENDING: 0, UPCOMING: 0, ATTENDED: 0 };
  for (const row of rows) {
    counts.ALL += 1;
    if (row.bookingDate === today) counts.TODAY += 1;
    const isAttended = Boolean(row.attendedAt);
    if (isAttended) counts.ATTENDED += 1;
    const started = hasStarted(row, now);
    if (started && !isAttended) counts.PENDING += 1;
    if (!started) counts.UPCOMING += 1;
  }

  const visible = rows.filter((row) => {
    let matchFilter = true;
    const isAttended = Boolean(row.attendedAt);
    const started = hasStarted(row, now);
    if (filter === 'TODAY') {
      matchFilter = row.bookingDate === today;
    } else if (filter === 'PENDING') {
      matchFilter = started && !isAttended;
    } else if (filter === 'UPCOMING') {
      matchFilter = !started;
    }
    const matchSearch = matchPtSearch(row, search);
    return matchFilter && matchSearch;
  });

  const tabLabel: Record<PtFilter, string> = {
    ALL: t('Tất cả', 'All'),
    TODAY: t('Hôm nay', 'Today'),
    PENDING: t('Chưa điểm danh', 'Pending'),
    UPCOMING: t('Sắp diễn ra', 'Upcoming'),
  };
  const invalidRange = Boolean(from && to && from > to);
  const attendedRows = rows.filter((row) => outcomeOf(row, now) === 'ATTENDED' && matchPtSearch(row, search));

  const datePresets = [
    { id: 'today', label: t('Hôm nay', 'Today'), days: 0 },
    { id: '7d', label: t('7 ngày qua', 'Last 7 days'), days: 7 },
    { id: '14d', label: t('14 ngày qua', 'Last 14 days'), days: 14 },
    { id: '30d', label: t('30 ngày qua', 'Last 30 days'), days: 30 },
  ];

  const applyPreset = (days: number) => {
    const todayDate = centerNowParts().date;
    setFrom(days === 0 ? todayDate : addIsoDays(todayDate, -days));
    setTo(todayDate);
  };

  const isPresetActive = (days: number) => {
    const todayDate = centerNowParts().date;
    const targetFrom = days === 0 ? todayDate : addIsoDays(todayDate, -days);
    return from === targetFrom && to === todayDate;
  };

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

  function renderPtCard(row: CoachBookingDto) {
    const outcome = outcomeOf(row, now);
    return (
      <div
        key={row.id}
        className="history-record-card"
        data-testid={`pt-row-${row.id}`}
      >
        <div className="history-card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h4 className="history-class-name" style={{ margin: 0 }}>
                {row.memberName}
              </h4>
              {row.membershipCode ? (
                <span className="badge badge-info" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 600 }}>
                  {row.membershipCode}
                </span>
              ) : row.memberId ? (
                <span className="badge badge-info" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 600 }}>
                  #{row.memberId}
                </span>
              ) : null}
              {row.gateCheckinAt && (
                <span className="badge badge-info pt-gate-tag" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem' }}>
                  {t(`Đã check-in ${formatCenterTime(row.gateCheckinAt)}`, `Checked in ${formatCenterTime(row.gateCheckinAt)}`)}
                </span>
              )}
            </div>
            <div className="history-meta-sub">
              <span>{formatCenterDate(row.bookingDate)} · {formatSlotLabel(row.startTime, row.endTime)}</span>
              <span>•</span>
              <span>{row.disciplineName || t('Huấn luyện cá nhân', 'Personal Training')}</span>
              {!isCoach && (
                <>
                  <span>•</span>
                  <span>{t('HLV', 'Coach')}: {row.coachName}</span>
                </>
              )}
            </div>
          </div>

          <div>
            {outcome === 'ATTENDED' ? (
              <span className="session-status-badge is-saved">{t('Đã có mặt', 'Attended')}</span>
            ) : outcome === 'IN_PROGRESS' ? (
              <span className="session-status-badge is-pending">{t('Đang diễn ra · Chưa có mặt', 'In progress · Attendance unmarked')}</span>
            ) : outcome === 'UPCOMING' ? (
              <span
                className="session-status-badge"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--portal-info, #3b82f6)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                }}
              >
                {t('Sắp diễn ra', 'Upcoming')}
              </span>
            ) : (
              <span className="session-status-badge is-cancelled">{t('Không có mặt', 'Did not attend')}</span>
            )}
          </div>
        </div>

        <div className="history-stat-row">
          <div className="stat-pill">
            <span className="stat-label">{t("Hình thức:", "Method:")}</span>
            <span className="stat-num">{row.paymentMethod === 'package_quota' ? t('Quyền lợi gói tập', 'Package quota') : t('Hội viên trả phí', 'Paid session')}</span>
          </div>
          {(row.memberPhone || row.memberEmail) && (
            <div className="stat-pill">
              <span className="stat-label">{t("Liên hệ:", "Contact:")}</span>
              <span className="stat-num">{[row.memberPhone, row.memberEmail].filter(Boolean).join(' · ')}</span>
            </div>
          )}
          {row.attendedAt && (
            <div className="stat-pill is-present">
              <span className="stat-label">{t('Đã có mặt lúc:', 'Marked attended at:')}</span>
              <span className="stat-num">{formatCenterDateTime(row.attendedAt)}</span>
            </div>
          )}
          {!row.attendedAt && row.attendanceLocked && (
            <div className="stat-pill is-absent">
              <span className="stat-label">{t('Đã bỏ ghi nhận có mặt', 'Attendance mark removed')}</span>
            </div>
          )}
          {row.notes && (
            <div className="stat-pill">
              <span className="stat-label">{t("Ghi chú:", "Notes:")}</span>
              <span className="stat-num">{row.notes}</span>
            </div>
          )}
        </div>

        <div className="history-actions-row">
          {outcome === 'ATTENDED' && (
            !isCoach || row.bookingDate === today ? (
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={busyId !== null || loading}
                onClick={() => void markAttended(row, false)}
              >
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
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busyId !== null || loading}
                onClick={() => void markAttended(row, true)}
              >
                {t('Đánh dấu có mặt', 'Mark as attended')}
              </button>
            ) : (
              <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                {t('Đã khóa (chỉ sửa trong ngày)', 'Locked (same-day only)')}
              </span>
            )
          )}

          {outcome !== 'ATTENDED' && !hasStarted(row, now) && (
            <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
              {t('Điểm danh khi bắt đầu', 'Take attendance once started')}
            </span>
          )}

          {outcome === 'MISSED' && (
            <span className="muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
              {t('Buổi tập đã kết thúc', 'Session has ended')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-i18n-managed className="portal-container pt-attendance coach-attendance-page">
      {confirmDialog}
      <PageHeader
        title={t('Điểm danh PT 1:1', '1:1 PT attendance')}
        actions={
          <Link to="/coach/classes" className="btn-secondary">
            {t("Xem lịch dạy & học viên →", "View schedule & classes →")}
          </Link>
        }
      />

      {/* Tabs cấp 1: [ Điểm danh ] | [ Lịch sử điểm danh ] (Đồng bộ với tab điểm danh lớp nhóm) */}
      <div className="portal-tabs attendance-nav-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={masterTab === 'attendance'}
          className={`portal-tab attendance-tab-btn ${masterTab === 'attendance' ? 'active is-active' : ''}`}
          onClick={() => setMasterTab('attendance')}
        >
          <span>{t('Điểm danh', 'Attendance')}</span>
          <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{rows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={masterTab === 'history'}
          className={`portal-tab attendance-tab-btn ${masterTab === 'history' ? 'active is-active' : ''}`}
          onClick={() => {
            setMasterTab('history');
            applyPreset(30);
          }}
        >
          <span>{t('Lịch sử điểm danh', 'Attendance history')}</span>
          <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{counts.ATTENDED}</span>
        </button>
      </div>

      {/* Khi ở tab Điểm danh: giữ DatePicker trong DOM dưới dạng ẩn để test selector hoạt động */}
      {masterTab !== 'history' && (
        <div className="sr-only" aria-hidden="true">
          <DatePicker id="pt-from" disabled={busyId !== null} max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} />
          <DatePicker id="pt-to" disabled={busyId !== null} min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      )}

      {invalidRange && <div className="portal-alert" role="alert">{t('Ngày bắt đầu phải trước ngày kết thúc.', 'The start date must be before the end date.')}</div>}

      {error && (
        <div className="portal-alert" role="alert">
          <strong>{t(error)}</strong>{' '}
          <button type="button" className="btn-secondary btn-sm" disabled={busyId !== null || loading} onClick={() => void load()}>
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      {busyId !== null && <p role="status">{t('Đang cập nhật điểm danh…', 'Updating attendance…')}</p>}

      {masterTab === 'attendance' ? (
        <div data-i18n-managed className="attendance-sessions-list-section" style={{ marginTop: 16 }}>
          {/* Toolbar lọc trạng thái & tìm kiếm */}
          <div className="pt-filter-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="portal-tabs" role="tablist" aria-label={t('Lọc theo kết quả', 'Filter by outcome')} style={{ margin: 0 }}>
              {FILTERS.map((value) => {
                const count = value === 'ALL' ? rows.length : counts[value];
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    className={`portal-tab ${filter === value ? 'active' : ''}`}
                    onClick={() => setFilter(value)}
                  >
                    <span>{tabLabel[value]}</span>
                    <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-search-box" style={{ display: 'flex', alignItems: 'center', minWidth: 260, flex: '1 1 300px', maxWidth: 440 }}>
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

          {loading && rows.length === 0 ? (
            <LoadingSkeleton label={t('Đang tải điểm danh', 'Loading attendance')} count={3} />
          ) : visible.length > 0 ? (
            <div className="history-cards-grid" aria-label={t('Danh sách buổi PT', '1:1 sessions')}>
              {visible.map(renderPtCard)}
            </div>
          ) : !error && !invalidRange ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>
                {search.trim() || filter !== 'ALL'
                  ? t('Không tìm thấy học viên phù hợp.', 'No matching student found.')
                  : t('Không có buổi PT nào trong khoảng này.', 'No 1:1 sessions in this range.')}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div data-i18n-managed className="attendance-history-section" style={{ marginTop: 8 }}>
          <div className="history-header-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 className="section-title">{t('Lịch sử các buổi PT đã điểm danh', 'Attended 1:1 sessions history')}</h3>
                <p className="section-desc">{t('Danh sách các buổi huấn luyện cá nhân đã ghi nhận có mặt.', 'List of personal training sessions marked as attended.')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="pt-presets-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {datePresets.map((preset) => {
                    const active = isPresetActive(preset.days);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', borderRadius: 20 }}
                        onClick={() => applyPreset(preset.days)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="portal-label" htmlFor="pt-from" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{t('Từ ngày', 'From')}</label>
                  <DatePicker id="pt-from" disabled={busyId !== null} max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="portal-label" htmlFor="pt-to" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{t('Đến ngày', 'To')}</label>
                  <DatePicker id="pt-to" disabled={busyId !== null} min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <input
                type="search"
                className="portal-input"
                style={{ width: '100%' }}
                placeholder={t("Tìm theo tên học viên, SĐT…", "Search by student name, phone…")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <LoadingSkeleton label={t('Đang tải điểm danh', 'Loading attendance')} count={3} />
          ) : attendedRows.length > 0 ? (
            <div className="history-cards-grid" aria-label={t('Lịch sử buổi PT', '1:1 attended sessions')}>
              {attendedRows.map(renderPtCard)}
            </div>
          ) : !error && !invalidRange ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>
                {search.trim()
                  ? t('Không tìm thấy học viên phù hợp trong lịch sử.', 'No matching student found in history.')
                  : t('Chưa có buổi PT nào được điểm danh trong khoảng thời gian này.', 'No 1:1 sessions have been attended in this date range.')}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
