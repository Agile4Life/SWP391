import { staffMessage, useStaffI18n, type StaffMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { Modal } from '../../shared/ui/Modal';
import { centerNowParts, formatCenterDate, formatCenterTime, parseCenterTime } from '../../shared/lib/centerTime';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import {
  attendanceApi,
  type AttendanceStudent,
  type CoachClassSession,
  type CoachSessionHistoryItem,
} from './attendanceApi';
import { WeeklyTimetable } from '../schedule/WeeklyTimetable';
import { formatSlotLabel } from '../schedule/slots';
import { addIsoDays, coachSessionEvents, isoDayToUtcMs, mondayOfIso, ptBookingEvents } from './coachTimetable';
import { coachingError } from './coachingApi';
import { getCoachSchedule, type CoachBookingDto } from '../member/coachBookingApi';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import './coach-attendance.css';

/** Số ngày ân hạn sửa điểm danh sau buổi học (khớp `SessionCompletionScheduler.GRACE_DAYS`). */
const ATTENDANCE_EDIT_GRACE_DAYS = 7;

/** Roster as the page edits it: only Có mặt / Vắng mặt (late counts as present), default score 80. */
const normalizeRoster = (list: AttendanceStudent[]): AttendanceStudent[] => list.map((item) => ({
  ...item,
  status: (item.status === 'present' || item.status === 'late' ? 'present' : 'absent') as 'present' | 'absent',
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
  const [rosterAttempt, setRosterAttempt] = useState(0);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [rosterLoading, setRosterLoading] = useState<boolean>(sessionMode);
  const [saving, setSaving] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // Modal sửa điểm danh giữa màn hình (ở lại tab Lịch sử)
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceHistoryRecord | null>(null);

  const [sessionsError, setSessionsError] = useState<StaffMessage | null>(null);
  const [sessionsAttempt, setSessionsAttempt] = useState(0);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [weekStart, setWeekStart] = useState(() => mondayOfIso(centerNowParts().date));
  const [classFilter, setClassFilter] = useState('ALL');
  const [confirm, confirmDialog] = useConfirm();
  const showCenterNotification = useCallback(
    (msg: StaffMessage = staffMessage('Cập nhật thành công', 'Updated successfully')) => notify(msg, 'success'),
    [],
  );

  const mountedRef = useRef(true);
  const weekStartInitializedRef = useRef(false);
  const savingRef = useRef(false);
  const openingEditRef = useRef(false);
  const historyReqIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Lịch sử điểm danh: đọc từ server, không lưu trên trình duyệt.
  const [history, setHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState(false);
  const loadHistory = useCallback(async () => {
    const reqId = ++historyReqIdRef.current;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const items = await attendanceApi.getHistory();
      if (!mountedRef.current || reqId !== historyReqIdRef.current) return;
      setHistory(items.filter((i) => i.presentCount + i.lateCount + i.absentCount + i.excusedCount > 0).map(toAttendanceHistory));
      setHistoryError(false);
    } catch {
      if (mountedRef.current && reqId === historyReqIdRef.current) {
        setHistoryError(true);
      }
    } finally {
      if (mountedRef.current && reqId === historyReqIdRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Load danh sách buổi học & buổi PT 1:1 của HLV
  useEffect(() => {
    let mounted = true;
    const fetchSessions = async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const [data, ptData] = await Promise.all([
          attendanceApi.getCoachSessions(),
          getCoachSchedule().catch(() => []),
        ]);
        if (mounted) {
          setSessions(data);
          setPtBookings(ptData);
          if (!weekStartInitializedRef.current) {
            weekStartInitializedRef.current = true;
            const allActiveDates: string[] = [
              ...data.map((s) => s.sessionDate),
              ...ptData.filter((b) => b.status?.toLowerCase() !== 'cancelled').map((b) => b.bookingDate),
            ];
            if (allActiveDates.length > 0) {
              // Chỉ tự căn tuần gần hôm nay nhất 1 lần lúc khởi tạo để focus/visibility refresh không giật tuần đang xem.
              const withStudents = data.filter((s) => (s.bookedCount ?? 0) > 0);
              const poolDates = withStudents.length > 0
                ? [...withStudents.map((s) => s.sessionDate), ...ptData.filter((b) => b.status?.toLowerCase() !== 'cancelled').map((b) => b.bookingDate)]
                : allActiveDates;
              const todayMs = isoDayToUtcMs(centerNowParts().date);
              const distance = (d: string) => Math.abs(isoDayToUtcMs(d) - todayMs);
              const preferred = poolDates.reduce((best, d) => (distance(d) < distance(best) ? d : best), poolDates[0]);
              setWeekStart(mondayOfIso(preferred));
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setSessionsError(
            coachingError(err, 'Không thể tải danh sách buổi học của bạn.', 'Unable to load your teaching sessions.'),
          );
        }
      } finally {
        if (mounted) {
          setSessionsLoading(false);
          setSessionsLoaded(true);
        }
      }
    };

    void fetchSessions();
    return () => {
      mounted = false;
    };
  }, [sessionsAttempt]);

  // Tự động làm mới danh sách buổi trên nền khi quay lại tab trình duyệt (không đụng rosterLoading hay weekStart).
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

  // Load danh sách học viên khi chọn buổi học khác hoặc bấm Thử lại.
  useEffect(() => {
    if (!selectedSessionId) {
      setRosterLoading(false);
      return;
    }

    let mounted = true;
    const fetchStudents = async () => {
      setRosterLoading(true);
      setStudents([]);
      setLoadedSessionId(null);
      setRosterError(null);
      try {
        const list = await attendanceApi.getSessionStudents(selectedSessionId);
        if (mounted) {
          setStudents(normalizeRoster(list));
          setLoadedSessionId(selectedSessionId);
        }
      } catch (err) {
        if (mounted) {
          setRosterError(
            coachingError(
              err,
              'Không thể tải danh sách học viên. Hãy thử lại.',
              'Unable to load the student list. Please try again.',
            ),
          );
        }
      } finally {
        if (mounted) setRosterLoading(false);
      }
    };

    void fetchStudents();
    return () => {
      mounted = false;
    };
  }, [selectedSessionId, rosterAttempt]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId);
  }, [sessions, selectedSessionId]);

  // Kiểm tra buổi hiện tại đã được lưu hay chưa
  const currentSavedRecord = useMemo(() => {
    return history.find((h) => h.sessionId === selectedSessionId);
  }, [history, selectedSessionId]);

  // Kiểm tra trạng thái khóa điểm danh của buổi (hủy, chưa bắt đầu, quá 7 ngày sau buổi học) theo giờ trung tâm.
  const { isCancelled, notStarted, isExpired, isAttendanceLocked } = useMemo(() => {
    if (!activeSession) {
      return { isCancelled: false, notStarted: false, isExpired: false, isAttendanceLocked: false };
    }
    const cancelled = activeSession.status?.toLowerCase() === 'cancelled';
    const startDt = parseCenterTime(`${activeSession.sessionDate}T${activeSession.startTime}`);
    const upcoming = Boolean(!cancelled && startDt && startDt.getTime() > now.getTime());
    const cutoffDate = addIsoDays(centerNowParts(now).date, -ATTENDANCE_EDIT_GRACE_DAYS);
    const expired = Boolean(
      !cancelled && (
        activeSession.sessionDate < cutoffDate
        || currentSavedRecord?.attendanceEditable === false
      ),
    );
    return {
      isCancelled: cancelled,
      notStarted: upcoming,
      isExpired: expired,
      isAttendanceLocked: cancelled || upcoming || expired,
    };
  }, [activeSession, currentSavedRecord, now]);

  const rosterReady = selectedSessionId !== null && loadedSessionId === selectedSessionId && !rosterLoading && !rosterError;

  // Cập nhật trạng thái điểm danh cho 1 học viên (chỉ có Có mặt hoặc Vắng mặt)
  const handleUpdateStatus = (studentId: number, status: 'present' | 'absent') => {
    if (saving || isAttendanceLocked) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Điểm danh nhanh: Đặt tất cả thành Có mặt
  const handleMarkAllPresent = () => {
    if (saving || isAttendanceLocked) return;
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })));
  };

  // Lưu hoặc Cập nhật điểm danh (Tab Điểm danh)
  const handleSaveAttendance = async () => {
    if (savingRef.current) return;
    if (!selectedSessionId || !activeSession || !rosterReady) {
      notify(staffMessage('Vui lòng chọn buổi học cần lưu điểm danh.', 'Please select a session to save attendance.'), 'error');
      return;
    }
    if (isAttendanceLocked) return;

    savingRef.current = true;
    try {
      if (!(await confirmAbsentDespiteCheckin(checkedInButAbsent(students)))) return;
      if (!mountedRef.current) return;

      setSaving(true);
      const payload = students.map((s) => ({
        memberId: s.memberId,
        status: s.status,
        progressScore: s.progressScore,
        notes: s.notes.trim(),
      }));

      await attendanceApi.saveBatchAttendance(selectedSessionId, payload);
      if (!mountedRef.current) return;

      void loadHistory();

      showCenterNotification(
        currentSavedRecord
          ? staffMessage('Đã cập nhật lại điểm danh thành công!', 'Attendance updated successfully!')
          : staffMessage('Lưu điểm danh thành công!', 'Attendance saved successfully!')
      );
    } catch (err) {
      if (mountedRef.current) {
        notify(
          coachingError(err, 'Có lỗi xảy ra khi lưu điểm danh. Vui lòng thử lại.', 'An error occurred while saving attendance. Please try again.'),
          'error',
        );
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
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
    if (openingEditRef.current) return;
    openingEditRef.current = true;
    try {
      const list = await attendanceApi.getSessionStudents(record.sessionId);
      if (mountedRef.current) {
        setEditingAttendanceRecord({ ...record, students: normalizeRoster(list) });
      }
    } catch (err) {
      if (mountedRef.current) {
        notify(
          coachingError(err, 'Không thể tải danh sách học viên. Hãy thử lại.', 'Unable to load the student list. Please try again.'),
          'error',
        );
      }
    } finally {
      openingEditRef.current = false;
    }
  };

  // Thay đổi trạng thái học viên trong Modal sửa điểm danh
  const handleUpdateModalAttendanceStatus = (studentId: number, status: 'present' | 'absent') => {
    if (!editingAttendanceRecord || saving) return;
    setEditingAttendanceRecord({
      ...editingAttendanceRecord,
      students: editingAttendanceRecord.students.map((s) =>
        s.id === studentId ? { ...s, status } : s
      ),
    });
  };

  // Lưu cập nhật từ Modal sửa điểm danh
  const handleSaveModalAttendance = async () => {
    if (!editingAttendanceRecord || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const latest = await attendanceApi.getSessionStudents(editingAttendanceRecord.sessionId);
      if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
      await attendanceApi.saveBatchAttendance(editingAttendanceRecord.sessionId, updatedStudents.map(student => ({
        memberId: student.memberId,
        status: student.status,
        progressScore: student.progressScore,
        notes: student.notes.trim(),
      })));
      if (!mountedRef.current) return;

      void loadHistory();
      if (selectedSessionId === editingAttendanceRecord.sessionId) {
        setStudents(updatedStudents);
      }

      setEditingAttendanceRecord(null);
      showCenterNotification(staffMessage('Cập nhật thành công', 'Updated successfully'));
    } catch (err) {
      if (mountedRef.current) {
        notify(
          coachingError(err, 'Không thể lưu cập nhật. Vui lòng thử lại.', 'Unable to save updates. Please try again.'),
          'error',
        );
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
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

  const tabs: { id: AttendanceTab; label: string; count?: number }[] = sessionMode
    ? [
        { id: 'attendance', label: t("Điểm danh buổi học") },
      ]
    : [
        { id: 'timetable', label: t("Thời khóa biểu") },
        { id: 'attendance-history', label: t("Lịch sử điểm danh", "Attendance history"), count: history.length },
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

      {/* Quản lý buổi học: thời khóa biểu + lịch sử điểm danh. Trang một buổi: điểm danh. */}
      <div className="portal-tabs attendance-nav-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab" aria-selected={activeTab === tab.id} className={`portal-tab attendance-tab-btn ${activeTab === tab.id ? 'active is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {sessionsError && (sessionMode || activeTab === 'timetable') && (
        <div data-i18n-managed className="coach-error-box" role="alert">
          {t(sessionsError)}{' '}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setSessionsAttempt((n) => n + 1)}>{t("Thử lại")}</button>
        </div>
      )}

      {/* Chọn buổi học trên thời khóa biểu tuần */}
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
                  now,
                )),
            ...(classFilter === 'ALL' || classFilter === 'PT_1ON1'
              ? ptBookingEvents(ptBookings, now)
              : []),
          ]}
          loading={!sessionsLoaded}
          onWeekChange={(iso) => {
            weekStartInitializedRef.current = true;
            setWeekStart(mondayOfIso(iso));
          }}
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
                disabled={sessionsLoading}
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
              {isCancelled ? (
                <span data-i18n-managed className="session-status-badge is-cancelled">
                  {t("Đã hủy", "Cancelled")}
                </span>
              ) : currentSavedRecord ? (
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
                {t("Giờ: ")}<strong>{activeSession ? formatSlotLabel(activeSession.startTime, activeSession.endTime) : '—'}</strong>
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

      {sessionMode && isAttendanceLocked && (
        <div
          data-i18n-managed
          className={`portal-alert${isCancelled ? '' : ' portal-alert--info'}`}
          role={isCancelled ? 'alert' : 'status'}
          data-testid="attendance-lock-banner"
          style={{ marginBottom: 16 }}
        >
          {isCancelled
            ? t(
                'Buổi học này đã bị hủy. Không thể điểm danh hoặc chỉnh sửa điểm danh.',
                'This session has been cancelled. Attendance cannot be recorded or edited.',
              )
            : notStarted
            ? t(
                'Buổi học chưa đến giờ bắt đầu. Chỉ có thể điểm danh sau khi buổi học bắt đầu.',
                'This session has not started yet. Attendance can only be recorded once the session begins.',
              )
            : isExpired
            ? t(
                'Buổi học đã quá thời hạn 7 ngày chỉnh sửa điểm danh. Danh sách hiện chỉ ở chế độ xem.',
                'This session is past the 7-day attendance edit window. The roster is now read-only.',
              )
            : ''}
        </div>
      )}

      {rosterError && sessionMode && (
        <div data-i18n-managed className="coach-error-box" role="alert">
          <p>{t(rosterError)}</p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setRosterAttempt((n) => n + 1)}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
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
              <span className="pill-value" style={{ color: 'var(--sol-accent-text)' }}>
                {summaryCounts.rate}%
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div data-i18n-managed className="attendance-toolbar">
            <span style={{ fontSize: '0.9rem', color: 'var(--portal-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {t("Danh sách ")}<strong>{students.length}</strong> {t(" học viên đã ghi danh:")}</span>
            <div className="toolbar-btn-group">
              <button
                type="button"
                className="btn-secondary btn-sm btn-quick-present"
                onClick={handleMarkAllPresent}
                disabled={!rosterReady || saving || students.length === 0 || isAttendanceLocked}
              >
                {t("Điểm danh nhanh tất cả Có mặt")}</button>
            </div>
          </div>

          {/* Danh sách học viên ĐIỂM DANH */}
          {rosterLoading ? (
            <LoadingSkeleton label={t("Đang tải danh sách học viên buổi học…")} count={5} />
          ) : rosterError ? null : students.length === 0 ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>{t("Chưa có học viên nào đăng ký buổi học này.", "No members have enrolled in this session.")}</p>
            </div>
          ) : (
            <div data-i18n-managed className="attendance-students-list">
              {students.map((student) => {
                return (
                  <div data-i18n-managed key={student.id} className="attendance-student-card">
                    <div className="student-card-top-row">
                      <div className="student-identity-group">
                        <div className="student-avatar-circle">
                          {(student.fullName?.trim().charAt(0) || '?').toUpperCase()}
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
                                disabled={saving || isAttendanceLocked}
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
              disabled={saving || !rosterReady || students.length === 0 || isAttendanceLocked}
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

          {historyLoading && history.length === 0 ? (
            <LoadingSkeleton label={t("Đang tải lịch sử điểm danh…", "Loading attendance history…")} count={4} />
          ) : historyError ? (
            <div data-i18n-managed className="coach-error-box" role="alert">
              <p>{t("Không tải được lịch sử điểm danh.", "Could not load the attendance history.")}</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void loadHistory()}>
                {t("Thử lại", "Retry")}
              </button>
            </div>
          ) : history.length === 0 ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>
                {t(
                  `Chưa có buổi nào được điểm danh trong tháng ${Number(centerNowParts().date.slice(5, 7))}.`,
                  `No sessions recorded in month ${Number(centerNowParts().date.slice(5, 7))}.`,
                )}
              </p>
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
                            {formatSlotLabel(record.startTime, record.endTime)}
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
                          className="btn-secondary btn-sm btn-history-edit"
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
          onClose={() => { if (!saving) setEditingAttendanceRecord(null); }}
        >
          <div className="modal-edit-container">
            <div className="modal-record-meta-bar">
              <span>{t("Phòng: ")}<strong>{editingAttendanceRecord.roomName}</strong></span>
              <span>{t("Giờ: ")}<strong>{formatSlotLabel(editingAttendanceRecord.startTime, editingAttendanceRecord.endTime)}</strong></span>
              <span>{t("Ngày: ")}<strong>{formatCenterDate(editingAttendanceRecord.sessionDate)}</strong></span>
            </div>

            <div className="modal-students-edit-list">
              {editingAttendanceRecord.students.map((student) => {
                return (
                  <div data-i18n-managed key={student.id} className="modal-student-edit-item">
                    <div className="student-identity-group">
                      <div className="student-avatar-circle">
                        {(student.fullName?.trim().charAt(0) || '?').toUpperCase()}
                      </div>
                      <div className="student-meta-text">
                        <h4 className="student-full-name">{student.fullName}</h4>
                        <span className="student-code-badge">{student.membershipCode}</span>
                        {student.gateCheckinAt && (
                          <span className="badge badge-info student-gate-tag">
                            {t(`Đã check-in ${formatCenterTime(student.gateCheckinAt)}`, `Checked in ${formatCenterTime(student.gateCheckinAt)}`)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Radio 2 trạng thái: Có mặt / Vắng mặt */}
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
                              name={`modal-status-${student.id}`}
                              value={cfg.value}
                              checked={isSelected}
                              disabled={saving}
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
