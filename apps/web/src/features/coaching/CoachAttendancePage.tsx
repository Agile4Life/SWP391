import { staffMessage, useStaffI18n, type StaffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { Modal } from '../../shared/ui/Modal';
import { formatCenterDate, formatCenterTime, formatTimeRange } from '../../shared/lib/centerTime';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import {
  attendanceApi,
  type AttendanceStudent,
  type CoachClassSession,
  type CoachSessionHistoryItem,
} from './attendanceApi';
import { WeeklyTimetable } from '../schedule/WeeklyTimetable';
import { mondayOf, parseISODate, todayISO } from '../schedule/timetable';
import { coachSessionEvents, ptBookingEvents } from './coachTimetable';
import { getCoachSchedule, type CoachBookingDto } from '../member/coachBookingApi';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import './coach-attendance.css';

/** Roster as the page edits it: only Có mặt / Vắng mặt, default score 80. */
const normalizeRoster = (list: AttendanceStudent[]): AttendanceStudent[] => list.map((item) => ({
  ...item,
  status: (item.status === 'present' ? 'present' : 'absent') as 'present' | 'absent',
  progressScore: item.progressScore || 80,
  notes: item.notes || '',
}));

const toAttendanceHistory = (item: CoachSessionHistoryItem): AttendanceHistoryRecord => ({
  id: `att-${item.sessionId}`,
  sessionId: item.sessionId,
  className: item.className,
  roomName: item.roomName ?? '',
  sessionDate: item.sessionDate,
  startTime: item.startTime,
  endTime: item.endTime,
  presentCount: item.presentCount + item.lateCount,
  absentCount: item.absentCount,
  totalStudents: item.presentCount + item.lateCount + item.absentCount + item.excusedCount,
  attendanceEditable: item.attendanceEditable,
  students: [],
});

/** Names of members marked absent although a gate check-in covered the session. */
const checkedInButAbsent = (list: AttendanceStudent[]) =>
  list.filter((s) => s.status === 'absent' && s.gateCheckinAt).map((s) => s.fullName);

// Chỉ giữ lại 2 trạng thái điểm danh: Có mặt và Vắng mặt (đã bỏ Đi muộn & Có phép)
const STATUS_CONFIG: {
  value: 'present' | 'absent';
  label: string;
  className: string;
  indicatorColor: string;
}[] = [
  { value: 'present', label: 'Có mặt', className: 'is-present', indicatorColor: 'var(--portal-success)' },
  { value: 'absent', label: 'Vắng mặt', className: 'is-absent', indicatorColor: 'var(--portal-danger)' },
];

export interface AttendanceHistoryRecord {
  id: string;
  sessionId: number;
  className: string;
  roomName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
  /** False once the session is more than 7 days old: statuses can no longer change. */
  attendanceEditable: boolean;
  students: AttendanceStudent[];
}

type AttendanceTab = 'timetable' | 'attendance' | 'attendance-history';

/**
 * Quản lý buổi học (`/coach/attendance`): thời khóa biểu và lịch sử điểm danh.
 * Bấm một buổi trên thời khóa biểu mở trang riêng `/coach/attendance/:sessionId` để điểm danh buổi đó.
 */
export function CoachAttendancePage() {
  const { sessionId } = useParams();
  return <SessionManagement key={sessionId ?? 'list'} routeSessionId={sessionId} />;
}

function SessionManagement({ routeSessionId }: { routeSessionId?: string }) {
  const { t } = useStaffI18n();
  const navigate = useNavigate();
  const sessionMode = routeSessionId !== undefined;
  const [activeTab, setActiveTab] = useState<AttendanceTab>(sessionMode ? 'attendance' : 'timetable');
  const [sessions, setSessions] = useState<CoachClassSession[]>([]);
  const [ptBookings, setPtBookings] = useState<CoachBookingDto[]>([]);
  const selectedSessionId: number | null = sessionMode && Number.isInteger(Number(routeSessionId)) ? Number(routeSessionId) : null;
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);
  const [rosterError, setRosterError] = useState<StaffMessage | null>(null);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Modal sửa điểm danh giữa màn hình (ở lại tab Lịch sử)
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceHistoryRecord | null>(null);

  const [sessionsError, setSessionsError] = useState<StaffMessage | null>(null);
  const [sessionsAttempt, setSessionsAttempt] = useState(0);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [classFilter, setClassFilter] = useState('ALL');
  const [confirm, confirmDialog] = useConfirm();
  const showCenterNotification = useCallback((msg: string = 'Cập nhật thành công') => notify(msg, 'success'), []);

  // Lịch sử điểm danh: đọc từ server, không lưu trên trình duyệt.
  const [history, setHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const loadHistory = useCallback(async () => {
    try {
      const items = await attendanceApi.getHistory();
      setHistory(items.filter((i) => i.presentCount + i.lateCount + i.absentCount + i.excusedCount > 0).map(toAttendanceHistory));
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Load danh sách buổi học & buổi PT 1:1 của HLV
  useEffect(() => {
    let mounted = true;
    const fetchSessions = async () => {
      setLoading(true);
      setSessionsError(null);
      try {
        const [data, ptData] = await Promise.all([
          attendanceApi.getCoachSessions(),
          getCoachSchedule().catch(() => []),
        ]);
        if (mounted) {
          setSessions(data);
          setPtBookings(ptData);
          const allActiveDates: string[] = [
            ...data.map((s) => s.sessionDate),
            ...ptData.filter((b) => b.status?.toLowerCase() !== 'cancelled').map((b) => b.bookingDate),
          ];
          if (allActiveDates.length > 0) {
            // Mở sẵn buổi gần hôm nay nhất (ưu tiên buổi đã có học viên hoặc buổi PT 1:1) và tuần chứa buổi đó.
            const withStudents = data.filter((s) => (s.bookedCount ?? 0) > 0);
            const poolDates = withStudents.length > 0
              ? [...withStudents.map((s) => s.sessionDate), ...ptData.filter((b) => b.status?.toLowerCase() !== 'cancelled').map((b) => b.bookingDate)]
              : allActiveDates;
            const today = parseISODate(todayISO()).getTime();
            const distance = (d: string) => Math.abs(parseISODate(d).getTime() - today);
            const preferred = poolDates.reduce((best, d) => (distance(d) < distance(best) ? d : best), poolDates[0]);
            setWeekStart(mondayOf(preferred));
          }
        }
      } catch {
        if (mounted) setSessionsError('Không thể tải danh sách buổi học của bạn.');
      } finally {
        if (mounted) { setLoading(false); setSessionsLoaded(true); }
      }
    };

    fetchSessions();
    return () => {
      mounted = false;
    };
  }, [sessionsAttempt]);

  // Tự động làm mới lịch khi quay lại tab trình duyệt
  useEffect(() => {
    const handleRefresh = () => {
      if (document.visibilityState === 'visible') {
        setSessionsAttempt((n) => n + 1);
      }
    };
    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, []);

  // Load danh sách học viên khi chọn buổi học khác
  useEffect(() => {
    if (!selectedSessionId) return;

    let mounted = true;
    const fetchStudents = async () => {
      setLoading(true);
      setStudents([]);
      setLoadedSessionId(null);
      setRosterError(null);
      try {
        const list = await attendanceApi.getSessionStudents(selectedSessionId);
        if (mounted) {
          setStudents(normalizeRoster(list));
          setLoadedSessionId(selectedSessionId);
        }
      } catch {if (mounted) {
          setRosterError('Không thể tải danh sách học viên. Hãy chọn lại buổi học.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStudents();
    return () => {
      mounted = false;
    };
  }, [selectedSessionId]);

  const rosterReady = selectedSessionId !== null && loadedSessionId === selectedSessionId && !loading && !rosterError;

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) ;
  }, [sessions, selectedSessionId]);

  // Kiểm tra buổi hiện tại đã được lưu hay chưa
  const currentSavedRecord = useMemo(() => {
    return history.find((h) => h.sessionId === selectedSessionId);
  }, [history, selectedSessionId]);

  // Cập nhật trạng thái điểm danh cho 1 học viên (chỉ có Có mặt hoặc Vắng mặt)
  const handleUpdateStatus = (studentId: number, status: 'present' | 'absent') => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Điểm danh nhanh: Đặt tất cả thành Có mặt
  const handleMarkAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })));
  };

  // Lưu hoặc Cập nhật điểm danh (Tab Điểm danh)
  const handleSaveAttendance = async () => {
    if (!selectedSessionId || !activeSession || !rosterReady || saving) {
      notify('Vui lòng chọn buổi học cần lưu điểm danh.', 'error');
      return;
    }
    if (!(await confirmAbsentDespiteCheckin(checkedInButAbsent(students)))) return;

    setSaving(true);
    try {
      const payload = students.map((s) => ({
        memberId: s.memberId,
        status: s.status,
        progressScore: s.progressScore,
        notes: s.notes.trim(),
      }));

      await attendanceApi.saveBatchAttendance(selectedSessionId, payload);

      void loadHistory();

      showCenterNotification(
        currentSavedRecord
          ? 'Đã cập nhật lại điểm danh thành công!'
          : 'Lưu điểm danh thành công!'
      );
    } catch (err) { notify(errorMessage(err, 'Có lỗi xảy ra khi lưu điểm danh. Vui lòng thử lại.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Hội viên đã quét cổng trong khung giờ buổi học mà vẫn bị đánh vắng: HLV phải xác nhận lại.
  const confirmAbsentDespiteCheckin = (names: string[]) => names.length === 0 ? Promise.resolve(true) : confirm({
    title: staffMessage('Đánh vắng hội viên đã check-in?', 'Mark checked-in members absent?'),
    message: staffMessage(
      `${names.join(', ')} đã quét QR vào trung tâm trong khung giờ buổi học. Bạn chắc chắn vẫn đánh vắng?`,
      `${names.join(', ')} checked in at the gate during this session. Mark them absent anyway?`),
    confirmLabel: staffMessage('Vẫn đánh vắng', 'Mark absent'),
    cancelLabel: staffMessage('Xem lại', 'Review'),
    danger: true,
  });

  // Mở modal sửa điểm danh trực tiếp giữa màn hình (Không chuyển tab)
  const handleOpenEditAttendanceModal = async (record: AttendanceHistoryRecord) => {
    try {
      const list = await attendanceApi.getSessionStudents(record.sessionId);
      setEditingAttendanceRecord({ ...record, students: normalizeRoster(list) });
    } catch (err) {
      notify(errorMessage(err, 'Không thể tải danh sách học viên. Hãy thử lại.'), 'error');
    }
  };

  // Thay đổi trạng thái học viên trong Modal sửa điểm danh
  const handleUpdateModalAttendanceStatus = (studentId: number, status: 'present' | 'absent') => {
    if (!editingAttendanceRecord) return;
    setEditingAttendanceRecord({
      ...editingAttendanceRecord,
      students: editingAttendanceRecord.students.map((s) =>
        s.id === studentId ? { ...s, status } : s
      ),
    });
  };

  // Lưu cập nhật từ Modal sửa điểm danh
  const handleSaveModalAttendance = async () => {
    if (!editingAttendanceRecord) return;
    setSaving(true);
    try {
      const latest = await attendanceApi.getSessionStudents(editingAttendanceRecord.sessionId);
      const latestByMember = new Map(latest.map(student => [student.memberId, student]));
      const updatedStudents = editingAttendanceRecord.students.map(student => {
        const current = latestByMember.get(student.memberId);
        return {
          ...student,
          progressScore: current?.progressScore ?? student.progressScore,
          notes: current?.notes ?? student.notes,
          gateCheckinAt: current?.gateCheckinAt ?? null,
        };
      });
      if (!(await confirmAbsentDespiteCheckin(checkedInButAbsent(updatedStudents)))) return;
      await attendanceApi.saveBatchAttendance(editingAttendanceRecord.sessionId, updatedStudents.map(student => ({
        memberId: student.memberId,
        status: student.status,
        progressScore: student.progressScore,
        notes: student.notes.trim(),
      })));

      void loadHistory();
      if (selectedSessionId === editingAttendanceRecord.sessionId) {
        setStudents(updatedStudents);
      }

      setEditingAttendanceRecord(null);
      showCenterNotification('Cập nhật thành công');
    } catch (err) { notify(errorMessage(err, 'Không thể lưu cập nhật. Vui lòng thử lại.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Thống kê nhanh trạng thái (chỉ Có mặt và Vắng mặt)
  const summaryCounts = useMemo(() => {
    const present = students.filter((s) => s.status === 'present').length;
    const absent = students.filter((s) => s.status === 'absent').length;
    const total = students.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, rate };
  }, [students]);

  if (sessionMode && sessionsLoaded && !sessionsError && !activeSession) {
    return (
      <div data-i18n-managed className="coach-attendance-page portal-container">
        <PageHeader title={t("Điểm danh buổi học")} />
        <div className="portal-card" role="alert">
          <p>{t("Không tìm thấy buổi học này trong lịch dạy của bạn.")}</p>
          <Link to="/coach/attendance" className="btn-secondary">{t("Quay lại thời khóa biểu")}</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AttendanceTab; label: string }[] = sessionMode
    ? [
        { id: 'attendance', label: t("Điểm danh buổi học") },
      ]
    : [
        { id: 'timetable', label: t("Thời khóa biểu") },
        { id: 'attendance-history', label: `${t("Lịch sử điểm danh (")}${history.length})` },
      ];

  return (
    <div data-i18n-managed className="coach-attendance-page portal-container">
      <PageHeader
        title={
          !sessionMode
            ? t('Điểm danh lớp nhóm', 'Group class attendance')
            : t('Điểm danh buổi học')
        }
        actions={sessionMode ? <Link to="/coach/attendance" className="btn-secondary">{t("Quay lại thời khóa biểu")}</Link> : undefined}
      />

      {/* Quản lý buổi học: thời khóa biểu + 2 lịch sử. Trang một buổi: điểm danh + đánh giá. */}
      <div className="portal-tabs attendance-nav-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab" aria-selected={activeTab === tab.id} className={`portal-tab attendance-tab-btn ${activeTab === tab.id ? 'active is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sessionsError && (sessionMode || activeTab === 'timetable') && (
        <div data-i18n-managed className="coach-error-box" role="alert">
          {t(sessionsError)}{' '}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setSessionsAttempt((n) => n + 1)}>{t("Thử lại")}</button>
        </div>
      )}

      {/* Chọn buổi học trên thời khóa biểu tuần (Dùng cho tab Điểm danh & Đánh giá) */}
      {!sessionsError && !sessionMode && activeTab === 'timetable' && (
        <WeeklyTimetable
          label={t("Thời khóa biểu buổi dạy cần điểm danh")}
          weekStart={weekStart}
          events={[
            ...(classFilter === 'PT_1ON1'
              ? []
              : coachSessionEvents(
                  sessions.filter((s) => classFilter === 'ALL' || s.className === classFilter),
                  'attendance',
                  new Set(history.map((h) => Number(h.sessionId))),
                )),
            ...(classFilter === 'ALL' || classFilter === 'PT_1ON1'
              ? ptBookingEvents(ptBookings)
              : []),
          ]}
          loading={!sessionsLoaded}
          onWeekChange={setWeekStart}
          onEventClick={(id) => {
            if (id.startsWith('pt-')) {
              navigate('/coach/pt-attendance');
              return;
            }
            navigate(`/coach/attendance/${id}`);
          }}
          emptyLabel={t("Tuần này bạn chưa có buổi dạy nào.")}
          toolbar={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="attendance-class-filter">
                <Select
                  className="portal-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  aria-label={t("Lọc theo lớp", "Filter by class")}
                >
                  <option value="ALL">{t("Tất cả lớp", "All classes")}</option>
                  {ptBookings.length > 0 && <option value="PT_1ON1">{t("Buổi PT 1:1", "1:1 PT session")}</option>}
                  {[...new Set(sessions.map((s) => s.className))].sort((a, b) => a.localeCompare(b)).map((name) => (
                    <option data-i18n-managed key={name} value={name}>{name}</option>
                  ))}
                </Select>
              </div>
              <RefreshButton
                label={t("Làm mới thời khóa biểu", "Refresh timetable") as string}
                onClick={() => setSessionsAttempt((n) => n + 1)}
                disabled={loading}
              />
            </div>
          }
          legend={[
            { tone: 'open', label: t('Sắp diễn ra') },
            { tone: 'full', label: t('Đã diễn ra, chưa điểm danh') },
            { tone: 'mine', label: t('Đã điểm danh / Buổi PT 1:1', 'Attended / 1:1 PT session') },
            { tone: 'cancelled', label: t('Đã hủy') },
          ]}
        />
      )}

      {/* Thông tin buổi học (trang điểm danh một buổi) */}
      {!sessionsError && sessionMode && (
        <div data-i18n-managed className="attendance-header-card">
          <div className="attendance-session-meta">
            <div className="session-title-wrap">
              <h3 className="session-name-title">
                {activeSession?.className || t('Buổi tập Huấn luyện viên')}
              </h3>
              {currentSavedRecord ? (
                <span data-i18n-managed className="session-status-badge is-saved">
                  {t("Đã có điểm danh", "Attendance recorded")}
                </span>
              ) : (
                <span data-i18n-managed className="session-status-badge is-pending">
                  {t("Chưa lưu điểm danh")}</span>
              )}
            </div>
            <div className="session-details-row">
              <span>
                {t("Phòng: ")}<strong>{activeSession?.roomName || t('Studio chính')}</strong>
              </span>
              <span>
                {t("Ngày: ")}<strong>{activeSession ? formatCenterDate(activeSession.sessionDate) : '—'}</strong>
              </span>
              <span>
                {t("Giờ: ")}<strong>{activeSession ? formatTimeRange(activeSession.startTime, activeSession.endTime) : '—'}</strong>
              </span>
              <span>
                {t("Đã đăng ký: ")}<strong>{students.length} {t(" học viên")}</strong>
              </span>
              {activeSession?.disciplineName && (
                <span data-i18n-managed>
                  {t("Bộ môn: ")}<strong>{activeSession.disciplineName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {rosterError && sessionMode && (
        <div data-i18n-managed className="coach-error-box" role="alert">{t(rosterError)}</div>
      )}

      {/* =========================================================================
          TAB 1: ĐIỂM DANH BUỔI HỌC (Thuần túy điểm danh Có mặt / Vắng mặt)
          ========================================================================= */}
      {activeTab === 'attendance' && (
        <>
          {/* Quick Summary: Chỉ giữ Có mặt và Vắng mặt */}
          <div data-i18n-managed className="attendance-quick-summary">
            <div className="summary-pill-card is-present">
              <span className="pill-label">{t("Có mặt")}</span>
              <span className="pill-value">{summaryCounts.present}</span>
            </div>
            <div className="summary-pill-card is-absent">
              <span className="pill-label">{t("Vắng mặt")}</span>
              <span className="pill-value">{summaryCounts.absent}</span>
            </div>
            <div className="summary-pill-card">
              <span className="pill-label">{t("Tổng học viên")}</span>
              <span className="pill-value">{summaryCounts.total}</span>
            </div>
            <div className="summary-pill-card">
              <span className="pill-label">{t("Tỷ lệ chuyên cần")}</span>
              <span className="pill-value" style={{ color: 'var(--portal-salmon)' }}>
                {summaryCounts.rate}%
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div data-i18n-managed className="attendance-toolbar">
            <span style={{ fontSize: '0.9rem', color: 'var(--portal-muted)' }}>
              {t("Danh sách ")}<strong>{students.length}</strong> {t(" học viên đã ghi danh:")}</span>
            <div className="toolbar-btn-group">
              <button
                type="button"
                className="btn-secondary btn-sm btn-quick-present"
                onClick={handleMarkAllPresent}
                disabled={!rosterReady || saving || students.length === 0}
              >
                {t("Điểm danh nhanh tất cả Có mặt")}</button>
            </div>
          </div>

          {/* Danh sách học viên ĐIỂM DANH */}
          {loading ? (
            <LoadingSkeleton label={t("Đang tải danh sách học viên buổi học…")} count={5} />
          ) : students.length === 0 ? (
            <div data-i18n-managed style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
              <p>{t("Chưa có học viên nào book buổi học này.")}</p>
            </div>
          ) : (
            <div data-i18n-managed className="attendance-students-list">
              {students.map((student) => {
                return (
                  <div data-i18n-managed key={student.id} className="attendance-student-card">
                    <div className="student-card-top-row">
                      <div className="student-identity-group">
                        <div className="student-avatar-circle">
                          {student.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="student-meta-text">
                          <h4 className="student-full-name">{student.fullName}</h4>
                          <span className="student-code-badge">{student.membershipCode}</span>
                          {student.gateCheckinAt && (
                            <span className="badge badge-info student-gate-tag">{t(`Đã check-in ${formatCenterTime(student.gateCheckinAt)}`, `Checked in ${formatCenterTime(student.gateCheckinAt)}`)}</span>
                          )}
                        </div>
                      </div>

                      {/* Chỉ có Radio chọn Có mặt / Vắng mặt */}
                      <div
                        className="attendance-radio-group"
                        role="radiogroup"
                        aria-label={t(`Trạng thái điểm danh của ${student.fullName}`, `Attendance status for ${student.fullName}`)}
                      >
                        {STATUS_CONFIG.map((cfg) => {
                          const isSelected = student.status === cfg.value;
                          return (
                            <label data-i18n-managed
                              key={cfg.value}
                              className={`radio-status-label ${cfg.className} ${isSelected ? 'is-active' : ''}`}
                            >
                              <input data-i18n-managed
                                type="radio"
                                name={`attendance-status-${student.id}`}
                                value={cfg.value}
                                checked={isSelected}
                                onChange={() => handleUpdateStatus(student.id, cfg.value)}
                              />
                              <span data-i18n-managed
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: cfg.indicatorColor,
                                  display: 'inline-block',
                                }}
                              />
                              {t(cfg.label)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Save Action */}
          <div data-i18n-managed className="attendance-bottom-actions">
            <button
              type="button"
              className="btn-primary btn-batch-save"
              onClick={handleSaveAttendance}
              disabled={saving || !rosterReady || students.length === 0}
            >
              {saving
                ? t('Đang lưu...')
                : currentSavedRecord
                ? t('Cập nhật điểm danh')
                : t('Lưu điểm danh')}
            </button>
          </div>
        </>
      )}

      {/* =========================================================================
          TAB 2: LỊCH SỬ ĐIỂM DANH (Sửa trực tiếp bằng khung giữa màn hình, không nhảy tab)
          ========================================================================= */}
      {activeTab === 'attendance-history' && (
        <div data-i18n-managed className="attendance-history-section">
          <div className="history-header-bar">
            <div>
              <h3 className="section-title">{t("Lịch sử các buổi đã điểm danh")}</h3>
            </div>
          </div>

          {history.length === 0 ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>{historyError ? t("Không tải được lịch sử điểm danh.", "Could not load the attendance history.") : t("Chưa có buổi nào được điểm danh trong 31 ngày qua.", "No sessions recorded in the last 31 days.")}</p>
            </div>
          ) : (
            <div data-i18n-managed className="history-cards-grid">
              {history.map((record) => {
                const rate =
                  record.totalStudents > 0
                    ? Math.round((record.presentCount / record.totalStudents) * 100)
                    : 0;

                return (
                  <div data-i18n-managed key={record.id} className="history-record-card">
                    <div className="history-card-header">
                      <div>
                        <h4 className="history-class-name">{record.className}</h4>
                        <div className="history-meta-sub">
                          <span>{t("Phòng: ")}{record.roomName}</span>
                          <span>•</span>
                          <span>
                            {formatTimeRange(record.startTime, record.endTime)}
                          </span>
                          <span>•</span>
                          <span>{t("Ngày: ")}{formatCenterDate(record.sessionDate)}</span>
                        </div>
                      </div>
                      {!record.attendanceEditable && (
                        <span className="history-saved-badge">{t("Đã khóa sửa (quá 7 ngày)", "Locked (over 7 days)")}</span>
                      )}
                    </div>

                    <div className="history-stat-row">
                      <div className="stat-pill is-present">
                        <span className="stat-label">{t("Có mặt:")}</span>
                        <span className="stat-num">{record.presentCount}</span>
                      </div>
                      <div className="stat-pill is-absent">
                        <span className="stat-label">{t("Vắng mặt:")}</span>
                        <span className="stat-num">{record.absentCount}</span>
                      </div>
                      <div className="stat-pill is-total">
                        <span className="stat-label">{t("Tổng học viên:")}</span>
                        <span className="stat-num">{record.totalStudents}</span>
                      </div>
                      <div className="stat-pill is-rate">
                        <span className="stat-label">{t("Tỷ lệ:")}</span>
                        <span className="stat-num">{rate}%</span>
                      </div>
                    </div>

                    <div className="history-actions-row">
                      {record.attendanceEditable && (
                        <button
                          type="button"
                          className="btn-history-edit"
                          onClick={() => void handleOpenEditAttendanceModal(record)}
                        >
                          {t("Sửa điểm danh")}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL SỬA ĐIỂM DANH NGAY GIỮA MÀN HÌNH (Không chuyển tab)
          ========================================================================= */}
      {editingAttendanceRecord && (
        <Modal
          title={t(`Sửa điểm danh: ${editingAttendanceRecord.className}`, `Edit attendance: ${editingAttendanceRecord.className}`)}
          busy={saving}
          onClose={() => setEditingAttendanceRecord(null)}
        >
          <div className="modal-edit-container">
            <div className="modal-record-meta-bar">
              <span>{t("Phòng: ")}<strong>{editingAttendanceRecord.roomName}</strong></span>
              <span>{t("Giờ: ")}<strong>{formatTimeRange(editingAttendanceRecord.startTime, editingAttendanceRecord.endTime)}</strong></span>
              <span>{t("Ngày: ")}<strong>{formatCenterDate(editingAttendanceRecord.sessionDate)}</strong></span>
            </div>

            <div className="modal-students-edit-list">
              {editingAttendanceRecord.students.map((student) => {
                return (
                  <div data-i18n-managed key={student.id} className="modal-student-edit-item">
                    <div className="student-identity-group">
                      <div className="student-avatar-circle">
                        {student.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="student-meta-text">
                        <h4 className="student-full-name">{student.fullName}</h4>
                        <span className="student-code-badge">{student.membershipCode}</span>
                      </div>
                    </div>

                    {/* Radio 2 trạng thái: Có mặt / Vắng mặt */}
                    <div className="attendance-radio-group">
                      {STATUS_CONFIG.map((cfg) => {
                        const isSelected = student.status === cfg.value;
                        return (
                          <label data-i18n-managed
                            key={cfg.value}
                            className={`radio-status-label ${cfg.className} ${isSelected ? 'is-active' : ''}`}
                          >
                            <input data-i18n-managed
                              type="radio"
                              name={`modal-status-${student.id}`}
                              value={cfg.value}
                              checked={isSelected}
                              onChange={() => handleUpdateModalAttendanceStatus(student.id, cfg.value)}
                            />
                            <span data-i18n-managed
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: cfg.indicatorColor,
                                display: 'inline-block',
                              }}
                            />
                            {t(cfg.label)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setEditingAttendanceRecord(null)}
              >
                {t("Hủy bỏ")}</button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={handleSaveModalAttendance}
              >
                {saving ? t('Đang lưu...') : t("Lưu cập nhật")}</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}
