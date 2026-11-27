import { staffMessage, useStaffI18n, type StaffMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { DatePicker } from '../../shared/ui/DatePicker';
import { centerNowParts, formatCenterDate, formatCenterTime, parseCenterTime } from '../../shared/lib/centerTime';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import {
  attendanceApi,
  type AttendanceStudent,
  type CoachClassSession,
  type CoachSessionHistoryItem,
} from './attendanceApi';
import { formatSlotLabel } from '../schedule/slots';
import { addIsoDays } from './coachTimetable';
import { coachingError } from './coachingApi';
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

type AttendanceTab = 'sessions-list' | 'attendance' | 'attendance-history';

/**
 * Quản lý buổi học (`/coach/attendance`): danh sách buổi dạy lớp nhóm & lịch sử điểm danh.
 * Trang riêng `/coach/attendance/:sessionId` dùng để điểm danh buổi cụ thể.
 */
export function CoachAttendancePage() {
  const { sessionId } = useParams();
  return <SessionManagement key={sessionId ?? 'list'} routeSessionId={sessionId} />;
}

function SessionManagement({ routeSessionId }: { routeSessionId?: string }) {
  const { t } = useStaffI18n();
  const sessionMode = routeSessionId !== undefined;
  const [activeTab, setActiveTab] = useState<AttendanceTab>(sessionMode ? 'attendance' : 'sessions-list');
  const [sessions, setSessions] = useState<CoachClassSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'TODAY' | 'PENDING' | 'UPCOMING'>('ALL');
  const [sessionSearch, setSessionSearch] = useState('');
  const selectedSessionId: number | null = sessionMode && Number.isInteger(Number(routeSessionId)) ? Number(routeSessionId) : null;
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);
  const [rosterError, setRosterError] = useState<StaffMessage | null>(null);
  const [rosterAttempt, setRosterAttempt] = useState(0);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState<boolean>(sessionMode);
  const [saving, setSaving] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // Modal sửa điểm danh giữa màn hình (ở lại tab Lịch sử)
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceHistoryRecord | null>(null);

  const [sessionsError, setSessionsError] = useState<StaffMessage | null>(null);
  const [sessionsAttempt, setSessionsAttempt] = useState(0);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const showCenterNotification = useCallback(
    (msg: StaffMessage = staffMessage('Cập nhật thành công', 'Updated successfully')) => notify(msg, 'success'),
    [],
  );

  const mountedRef = useRef(true);
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
  const [historyFrom, setHistoryFrom] = useState(() => addIsoDays(centerNowParts().date, -30));
  const [historyTo, setHistoryTo] = useState(() => centerNowParts().date);
  const [historySearch, setHistorySearch] = useState('');

  const historyDatePresets = [
    { id: 'today', label: t('Hôm nay', 'Today'), days: 0 },
    { id: '7d', label: t('7 ngày qua', 'Last 7 days'), days: 7 },
    { id: '14d', label: t('14 ngày qua', 'Last 14 days'), days: 14 },
    { id: '30d', label: t('30 ngày qua', 'Last 30 days'), days: 30 },
  ];

  const applyHistoryPreset = (days: number) => {
    const todayDate = centerNowParts().date;
    setHistoryFrom(days === 0 ? todayDate : addIsoDays(todayDate, -days));
    setHistoryTo(todayDate);
  };

  const isHistoryPresetActive = (days: number) => {
    const todayDate = centerNowParts().date;
    const targetFrom = days === 0 ? todayDate : addIsoDays(todayDate, -days);
    return historyFrom === targetFrom && historyTo === todayDate;
  };

  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      if (historyFrom && record.sessionDate < historyFrom) return false;
      if (historyTo && record.sessionDate > historyTo) return false;
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase().trim();
        const matchName = record.className.toLowerCase().includes(query);
        const matchRoom = (record.roomName ?? '').toLowerCase().includes(query);
        if (!matchName && !matchRoom) return false;
      }
      return true;
    });
  }, [history, historyFrom, historyTo, historySearch]);
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

  // Load danh sách buổi học của HLV
  useEffect(() => {
    let mounted = true;
    const fetchSessions = async () => {
      setSessionsError(null);
      try {
        const data = await attendanceApi.getCoachSessions();
        if (mounted) {
          setSessions(data);
        }
      } catch (err) {
        if (mounted) {
          setSessionsError(
            coachingError(err, 'Không thể tải danh sách buổi học của bạn.', 'Unable to load your teaching sessions.'),
          );
        }
      } finally {
        if (mounted) {
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

  const recordedSessionIds = useMemo(() => new Set(history.map((h) => Number(h.sessionId))), [history]);

  const sessionCounts = useMemo(() => {
    const today = centerNowParts(now).date;
    let all = 0;
    let todayCount = 0;
    let pending = 0;
    let upcoming = 0;
    for (const s of sessions) {
      if (s.status?.toLowerCase() === 'cancelled') continue;
      all++;
      const isRecorded = recordedSessionIds.has(s.id);
      const startDt = parseCenterTime(`${s.sessionDate}T${s.startTime}`);
      const hasStarted = Boolean(startDt && startDt.getTime() <= now.getTime());
      if (s.sessionDate === today) todayCount++;
      if (hasStarted && !isRecorded) pending++;
      if (!hasStarted) upcoming++;
    }
    return { all, today: todayCount, pending, upcoming };
  }, [sessions, recordedSessionIds, now]);

  const filteredSessions = useMemo(() => {
    const today = centerNowParts(now).date;
    return sessions
      .filter((session) => {
        if (session.status?.toLowerCase() === 'cancelled') {
          if (sessionFilter !== 'ALL') return false;
        }
        const isRecorded = recordedSessionIds.has(session.id);
        const startDt = parseCenterTime(`${session.sessionDate}T${session.startTime}`);
        const hasStarted = Boolean(startDt && startDt.getTime() <= now.getTime());

        if (sessionFilter === 'TODAY' && session.sessionDate !== today) {
          return false;
        }
        if (sessionFilter === 'PENDING') {
          if (isRecorded || !hasStarted) return false;
        }
        if (sessionFilter === 'UPCOMING') {
          if (hasStarted) return false;
        }
        if (sessionSearch.trim()) {
          const query = sessionSearch.toLowerCase().trim();
          const matchName = session.className.toLowerCase().includes(query);
          const matchRoom = (session.roomName ?? '').toLowerCase().includes(query);
          const matchDiscipline = (session.disciplineName ?? '').toLowerCase().includes(query);
          if (!matchName && !matchRoom && !matchDiscipline) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dtA = `${a.sessionDate}T${a.startTime}`;
        const dtB = `${b.sessionDate}T${b.startTime}`;
        return dtA.localeCompare(dtB);
      });
  }, [sessions, recordedSessionIds, now, sessionFilter, sessionSearch]);

  if (sessionMode && sessionsLoaded && !sessionsError && !activeSession) {
    return (
      <div data-i18n-managed className="coach-attendance-page portal-container">
        <PageHeader title={t("Điểm danh buổi học")} />
        <div className="portal-card" role="alert">
          <p>{t("Không tìm thấy buổi học này trong lịch dạy của bạn.")}</p>
          <Link to="/coach/attendance" className="btn-secondary">{t("Quay lại danh sách buổi học", "Back to sessions list")}</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AttendanceTab; label: string; count?: number }[] = sessionMode
    ? [
        { id: 'attendance', label: t("Điểm danh buổi học", "Session attendance") },
        { id: 'attendance-history', label: t("Lịch sử điểm danh", "Attendance history"), count: history.length },
      ]
    : [
        { id: 'sessions-list', label: t("Điểm danh", "Attendance"), count: sessionCounts.all },
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
        actions={
          sessionMode ? (
            <Link to="/coach/attendance" className="btn-secondary">
              {t("Quay lại danh sách buổi học", "Back to sessions list")}
            </Link>
          ) : (
            <Link to="/coach/classes" className="btn-secondary">
              {t("Xem lịch dạy & học viên →", "View schedule & classes →")}
            </Link>
          )
        }
      />

      {/* Quản lý buổi học: danh sách buổi dạy + lịch sử điểm danh. Trang một buổi: điểm danh. */}
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

      {/* =========================================================================
          TAB 1: DANH SÁCH BUỔI LỚP NHÓM CẦN ĐIỂM DANH (Dạng thẻ danh sách đơn giản, giống PT 1:1)
          ========================================================================= */}
      {!sessionMode && activeTab === 'sessions-list' && (
        <div data-i18n-managed className="attendance-sessions-list-section" style={{ marginTop: 16 }}>
          {/* Toolbar lọc kết quả & tìm kiếm */}
          <div className="pt-filter-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="portal-tabs" role="tablist" aria-label={t("Lọc danh sách buổi học", "Filter class sessions")} style={{ margin: 0 }}>
              <button
                type="button"
                role="tab"
                aria-selected={sessionFilter === 'ALL'}
                className={`portal-tab ${sessionFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSessionFilter('ALL')}
              >
                <span>{t("Tất cả", "All")}</span>
                <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{sessionCounts.all}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sessionFilter === 'TODAY'}
                className={`portal-tab ${sessionFilter === 'TODAY' ? 'active' : ''}`}
                onClick={() => setSessionFilter('TODAY')}
              >
                <span>{t("Hôm nay", "Today")}</span>
                <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{sessionCounts.today}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sessionFilter === 'PENDING'}
                className={`portal-tab ${sessionFilter === 'PENDING' ? 'active' : ''}`}
                onClick={() => setSessionFilter('PENDING')}
              >
                <span>{t("Chưa điểm danh", "Pending")}</span>
                <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{sessionCounts.pending}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sessionFilter === 'UPCOMING'}
                className={`portal-tab ${sessionFilter === 'UPCOMING' ? 'active' : ''}`}
                onClick={() => setSessionFilter('UPCOMING')}
              >
                <span>{t("Sắp diễn ra", "Upcoming")}</span>
                <span className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>{sessionCounts.upcoming}</span>
              </button>
            </div>

            <div className="pt-search-box" style={{ display: 'flex', alignItems: 'center', minWidth: 260, flex: '1 1 300px', maxWidth: 440 }}>
              <input
                type="search"
                className="portal-input"
                style={{ width: '100%' }}
                placeholder={t("Tìm theo tên lớp, phòng hoặc bộ môn…", "Search by class, room or discipline…")}
                aria-label={t("Tìm theo tên lớp, phòng hoặc bộ môn", "Search by class, room or discipline")}
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
              />
            </div>
          </div>

          {!sessionsLoaded ? (
            <LoadingSkeleton label={t("Đang tải danh sách buổi học…", "Loading sessions…")} count={3} />
          ) : sessionsError ? (
            <div data-i18n-managed className="coach-error-box" role="alert">
              <p>{t(sessionsError)}</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSessionsAttempt((n) => n + 1)}>
                {t("Thử lại", "Retry")}
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>
                {sessionSearch.trim() || sessionFilter !== 'ALL'
                  ? t("Không tìm thấy buổi học phù hợp với bộ lọc.", "No class sessions match the filter.")
                  : t("Hiện bạn chưa có buổi dạy lớp nhóm nào.", "You have no scheduled group class sessions.")}
              </p>
            </div>
          ) : (
            <div data-i18n-managed className="history-cards-grid">
              {filteredSessions.map((session) => {
                const isCancelled = session.status?.toLowerCase() === 'cancelled';
                const hasRecorded = recordedSessionIds.has(session.id);
                const startDt = parseCenterTime(`${session.sessionDate}T${session.startTime}`);
                const notStarted = Boolean(startDt && startDt.getTime() > now.getTime());

                return (
                  <div data-i18n-managed key={session.id} className="history-record-card" data-testid={`session-row-${session.id}`}>
                    <div className="history-card-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <h4 className="history-class-name" style={{ margin: 0 }}>{session.className}</h4>
                          {session.disciplineName && (
                            <span className="badge badge-info" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {session.disciplineName}
                            </span>
                          )}
                        </div>
                        <div className="history-meta-sub">
                          <span>{t("Phòng: ")}{session.roomName}</span>
                          <span>•</span>
                          <span>{formatSlotLabel(session.startTime, session.endTime)}</span>
                          <span>•</span>
                          <span>{t("Ngày: ")}{formatCenterDate(session.sessionDate)}</span>
                        </div>
                      </div>

                      <div>
                        {isCancelled ? (
                          <span className="session-status-badge is-cancelled">{t("Đã hủy", "Cancelled")}</span>
                        ) : hasRecorded ? (
                          <span className="session-status-badge is-saved">{t("Đã điểm danh", "Attendance recorded")}</span>
                        ) : notStarted ? (
                          <span
                            className="session-status-badge"
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: 'var(--portal-info, #3b82f6)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                            }}
                          >
                            {t("Sắp diễn ra", "Upcoming")}
                          </span>
                        ) : (
                          <span className="session-status-badge is-pending">{t("Chưa điểm danh", "Attendance pending")}</span>
                        )}
                      </div>
                    </div>

                    <div className="history-stat-row">
                      <div className="stat-pill">
                        <span className="stat-label">{t("Sĩ số đã đăng ký:", "Enrolled capacity:")}</span>
                        <span className="stat-num">{session.bookedCount} / {session.capacity} {t("học viên", "students")}</span>
                      </div>
                    </div>

                    <div className="history-actions-row">
                      {!isCancelled && (
                        hasRecorded ? (
                          <Link to={`/coach/attendance/${session.id}`} className="btn-secondary btn-sm">
                            {t("Xem / Sửa điểm danh", "View / edit attendance")}
                          </Link>
                        ) : notStarted ? (
                          <span className="muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                            {t('Điểm danh khi bắt đầu', 'Take attendance once started')}
                          </span>
                        ) : (
                          <Link to={`/coach/attendance/${session.id}`} className="btn-primary btn-sm">
                            {t("Điểm danh buổi này", "Take attendance")}
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {sessionsError && sessionMode && (
        <div data-i18n-managed className="coach-error-box" role="alert">
          {t(sessionsError)}{' '}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setSessionsAttempt((n) => n + 1)}>{t("Thử lại")}</button>
        </div>
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
          <div className="history-header-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 className="section-title">{t("Lịch sử các buổi đã điểm danh")}</h3>
                <p className="section-desc">{t("Danh sách các buổi học lớp nhóm đã lưu điểm danh.", "List of group class sessions with saved attendance.")}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="history-presets-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {historyDatePresets.map((preset) => {
                    const active = isHistoryPresetActive(preset.days);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', borderRadius: 20 }}
                        onClick={() => applyHistoryPreset(preset.days)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="portal-label" htmlFor="history-from" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{t('Từ ngày', 'From')}</label>
                  <DatePicker id="history-from" max={historyTo || undefined} value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="portal-label" htmlFor="history-to" style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{t('Đến ngày', 'To')}</label>
                  <DatePicker id="history-to" min={historyFrom || undefined} value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <input
                type="search"
                className="portal-input"
                style={{ width: '100%' }}
                placeholder={t("Tìm theo tên lớp, phòng…", "Search by class, room…")}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
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
          ) : filteredHistory.length === 0 ? (
            <div data-i18n-managed className="attendance-empty-state">
              <p>
                {historySearch.trim() || historyFrom || historyTo
                  ? t("Không tìm thấy buổi học nào phù hợp trong khoảng thời gian này.", "No class sessions found matching this date range.")
                  : t("Chưa có buổi nào được điểm danh.", "No class sessions have been recorded.")}
              </p>
            </div>
          ) : (
            <div data-i18n-managed className="history-cards-grid">
              {filteredHistory.map((record) => {
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
