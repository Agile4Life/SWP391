import { useStaffI18n, type StaffMessage, staffMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { Select } from '../../shared/ui/Select';
import {
  coachingApi,
  coachingError,
  type CoachSession,
  type EnrolledStudent,
} from './coachingApi';
import {
  getCoachSchedule,
  type CoachBookingDto,
} from '../member/coachBookingApi';
import { WeeklyTimetable } from '../schedule/WeeklyTimetable';
import { formatSlotLabel } from '../schedule/slots';
import { coachSessionEvents, mondayOfIso, ptBookingEvents } from './coachTimetable';
import './coach-classes.css';
import { centerNowParts, formatCenterDate } from '../../shared/lib/centerTime';
import { matchPtSearch } from './ptSearch';

/**
 * Trang lịch dạy của HLV: thời khóa biểu tuần các buổi kèm 1:1 và lớp nhóm (có tìm kiếm, xem chi tiết, hủy buổi
 * kèm lý do) và danh sách học viên mình phụ trách.
 */
export function CoachClassesPage() {
  const { t } = useStaffI18n();
  const currentUser = getCurrentUser();

  // Tab chuyển đổi: 'schedule' (Thời khóa biểu) hoặc 'students' (Học viên phụ trách)
  const [activeTab, setActiveTab] = useState<'schedule' | 'students'>('schedule');
  const [scheduleSearch, setScheduleSearch] = useState('');

  const [weekStart, setWeekStart] = useState<string>(() => mondayOfIso(centerNowParts().date));
  const [selectedPt, setSelectedPt] = useState<CoachBookingDto | null>(null);
  const [selectedClassSession, setSelectedClassSession] = useState<CoachSession | null>(null);
  const [coach1on1Bookings, setCoach1on1Bookings] = useState<CoachBookingDto[]>([]);
  const [classSessions, setClassSessions] = useState<CoachSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StaffMessage | null>(null);

  // Tab Học viên phụ trách
  const [allStudents, setAllStudents] = useState<EnrolledStudent[]>([]);
  const [allStudentsError, setAllStudentsError] = useState<StaffMessage | null>(null);
  const [allStudentsLoading, setAllStudentsLoading] = useState<boolean>(false);
  const [allStudentsSearch, setAllStudentsSearch] = useState<string>('');
  const [allStudentsLevelFilter, setAllStudentsLevelFilter] = useState<string>('all');

  // Cancel 1:1 booking or group class session
  const [cancellingPt, setCancellingPt] = useState<CoachBookingDto | null>(null);
  const [cancellingSession, setCancellingSession] = useState<CoachSession | null>(null);
  const [cancelPtReason, setCancelPtReason] = useState<string>('');
  const [cancelPtError, setCancelPtError] = useState<StaffMessage | null>(null);
  const [cancelBusy, setCancelBusy] = useState<boolean>(false);

  const mountedRef = useRef(true);
  const scheduleReqIdRef = useRef(0);
  const studentsReqIdRef = useRef(0);
  const cancelBusyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải danh sách toàn bộ học viên phụ trách (gồm cả PT 1:1 và lớp nhóm).
  const loadAssignedStudents = useCallback(async () => {
    const reqId = ++studentsReqIdRef.current;
    setAllStudentsLoading(true);
    setAllStudentsError(null);
    try {
      const res = await coachingApi.getAllAssignedStudents();
      if (mountedRef.current && reqId === studentsReqIdRef.current) {
        setAllStudents(Array.isArray(res) ? res : []);
      }
    } catch (err: unknown) {
      if (mountedRef.current && reqId === studentsReqIdRef.current) {
        setAllStudentsError(
          coachingError(
            err,
            'Không thể tải danh sách học viên phụ trách.',
            'Unable to load assigned trainees.',
          ),
        );
      }
    } finally {
      if (mountedRef.current && reqId === studentsReqIdRef.current) {
        setAllStudentsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAssignedStudents();
  }, [loadAssignedStudents, currentUser?.id]);

  // Bổ sung thông tin liên hệ (email/SĐT) từ lịch PT 1:1 đã tải nếu danh bạ `/coaching/members` chưa kèm.
  const enrichedStudents = useMemo(() => {
    if (coach1on1Bookings.length === 0) return allStudents;
    const ptContactByMember = new Map<number, { email?: string | null; phone?: string | null }>();
    for (const booking of coach1on1Bookings) {
      if (booking.memberId == null) continue;
      const existing = ptContactByMember.get(booking.memberId);
      ptContactByMember.set(booking.memberId, {
        email: existing?.email || booking.memberEmail,
        phone: existing?.phone || booking.memberPhone,
      });
    }
    return allStudents.map((st) => {
      const contact = ptContactByMember.get(st.memberId);
      if (!contact) return st;
      return {
        ...st,
        email: st.email || contact.email || '',
        phone: st.phone || contact.phone || null,
      };
    });
  }, [allStudents, coach1on1Bookings]);

  // Học viên sau khi lọc theo từ khóa tìm kiếm và trình độ (kiểm tra null an toàn).
  const filteredAllStudents = useMemo(() => {
    const q = allStudentsSearch.trim().toLowerCase();
    return enrichedStudents.filter((st) => {
      const name = (st.fullName ?? '').toLowerCase();
      const code = (st.membershipCode ?? '').toLowerCase();
      const phone = (st.phone ?? '').toLowerCase();
      const email = (st.email ?? '').toLowerCase();
      const level = (st.fitnessLevel ?? '').trim().toLowerCase();
      const matchSearch =
        !q ||
        name.includes(q) ||
        code.includes(q) ||
        phone.includes(q) ||
        email.includes(q);
      const matchLevel =
        allStudentsLevelFilter === 'all' || level === allStudentsLevelFilter;
      return matchSearch && matchLevel;
    });
  }, [enrichedStudents, allStudentsSearch, allStudentsLevelFilter]);

  // Các buổi kèm 1:1 khớp từ khóa tìm kiếm.
  const filteredPtBookings = useMemo(() => {
    return coach1on1Bookings.filter((b) => matchPtSearch(b, scheduleSearch));
  }, [coach1on1Bookings, scheduleSearch]);

  // Các buổi lớp nhóm khớp từ khóa tìm kiếm (tên lớp, phòng, bộ môn).
  const filteredClassSessions = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    if (!q) return classSessions;
    return classSessions.filter((s) =>
      [s.className, s.roomName, s.disciplineName].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [classSessions, scheduleSearch]);

  // Tải song song lịch PT 1:1 và lịch dạy lớp nhóm của HLV (backend tự lọc theo JWT principal của COACH).
  const loadWeeklySessions = useCallback(async () => {
    const reqId = ++scheduleReqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [ptResult, classResult] = await Promise.allSettled([
        getCoachSchedule(),
        typeof coachingApi.getCoachSchedule === 'function'
          ? coachingApi.getCoachSchedule()
          : Promise.resolve([] as CoachSession[]),
      ]);
      if (!mountedRef.current || reqId !== scheduleReqIdRef.current) return;
      const ptList = ptResult.status === 'fulfilled' && Array.isArray(ptResult.value) ? ptResult.value : [];
      const classList = classResult.status === 'fulfilled' && Array.isArray(classResult.value) ? classResult.value : [];
      setCoach1on1Bookings(ptList);
      setClassSessions(classList);
      if (ptResult.status === 'rejected' && classResult.status === 'rejected') {
        setError(
          staffMessage(
            'Không thể tải lịch dạy của tuần này. Vui lòng thử lại.',
            'Unable to load this week’s teaching schedule. Please try again.',
          ),
        );
      } else if (ptResult.status === 'rejected') {
        setError(
          staffMessage(
            'Không thể tải lịch kèm PT 1:1. Các buổi lớp nhóm đã tải vẫn hiển thị bên dưới.',
            'Unable to load 1:1 PT sessions. Loaded group class sessions are still shown below.',
          ),
        );
      } else if (classResult.status === 'rejected') {
        setError(
          staffMessage(
            'Không thể tải lịch dạy lớp nhóm. Các buổi PT 1:1 đã tải vẫn hiển thị bên dưới.',
            'Unable to load group class sessions. Loaded 1:1 PT sessions are still shown below.',
          ),
        );
      }
    } finally {
      if (mountedRef.current && reqId === scheduleReqIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWeeklySessions();
  }, [loadWeeklySessions]);

  // Bấm một khối trên lịch: pt-<id> mở buổi PT 1:1, ngược lại mở chi tiết buổi lớp nhóm.
  const handleEventClick = (eventId: string) => {
    if (eventId.startsWith('pt-')) {
      setSelectedPt(coach1on1Bookings.find((booking) => `pt-${booking.id}` === eventId) ?? null);
      return;
    }
    setSelectedClassSession(classSessions.find((session) => String(session.id) === eventId) ?? null);
  };

  // Xác nhận hủy buổi lớp nhóm do HLV phụ trách.
  const handleConfirmCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSession || cancelBusyRef.current) return;
    const reason = cancelPtReason.trim();
    if (!reason) {
      setCancelPtError(staffMessage('Vui lòng nhập lý do hủy buổi học.', 'Please enter a session cancellation reason.'));
      return;
    }
    cancelBusyRef.current = true;
    setCancelPtError(null);
    setCancelBusy(true);
    try {
      await apiFetch(`/classes/sessions/${cancellingSession.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!mountedRef.current) return;
      notify(
        staffMessage(
          'Đã hủy buổi học và gửi thông báo tới học viên.',
          'Session cancelled and enrolled members have been notified.',
        ),
        'success',
      );
      setCancellingSession(null);
      setCancelPtReason('');
      setSelectedClassSession(null);
      await loadWeeklySessions();
    } catch (err: unknown) {
      if (mountedRef.current) {
        setCancelPtError(coachingError(err, 'Không thể hủy buổi học này.', 'Unable to cancel this session.'));
      }
    } finally {
      cancelBusyRef.current = false;
      if (mountedRef.current) setCancelBusy(false);
    }
  };

  // Xác nhận hủy buổi kèm 1:1: bắt buộc nhập lý do, gửi yêu cầu xóa rồi tải lại lịch.
  const handleConfirmCancelPt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingPt || cancelBusyRef.current) return;
    const reason = cancelPtReason.trim();
    if (!reason) {
      setCancelPtError(staffMessage('Vui lòng nhập lý do hủy buổi kèm 1:1.', 'Please enter a cancellation reason for this 1:1 session.'));
      return;
    }
    cancelBusyRef.current = true;
    setCancelPtError(null);
    setCancelBusy(true);
    try {
      await apiFetch(`/coach-bookings/${cancellingPt.id}?reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE',
      });
      if (!mountedRef.current) return;
      notify(staffMessage('Đã hủy buổi kèm 1:1 thành công!', '1:1 session cancelled successfully!'), 'success');
      setCancellingPt(null);
      setCancelPtReason('');
      setSelectedPt(null);
      await loadWeeklySessions();
    } catch (err: unknown) {
      if (mountedRef.current) {
        setCancelPtError(coachingError(err, 'Không thể hủy buổi kèm 1:1 này.', 'Unable to cancel this 1:1 session.'));
      }
    } finally {
      cancelBusyRef.current = false;
      if (mountedRef.current) setCancelBusy(false);
    }
  };

  return (
    <div data-i18n-managed className="portal-container coach-page">
      <PageHeader
        title={t("Lịch dạy & học viên", "Teaching schedule & trainees")}
      />

      {/* Phân hệ Tab: Thời khóa biểu vs Học viên phụ trách */}
      <div className="portal-tabs coach-nav-tabs" role="tablist" aria-label={t("Phân hệ chức năng HLV", "Coach feature tabs")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schedule'}
          className={`portal-tab coach-tab-btn ${activeTab === 'schedule' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          {t("Thời khóa biểu", "Timetable")}</button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'students'}
          className={`portal-tab coach-tab-btn ${activeTab === 'students' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          {t("Học viên phụ trách", "Assigned trainees")}</button>
      </div>

      {/* ====================================================================
          TAB 1: THỜI KHÓA BIỂU LỚP NHÓM & PT 1:1
          ==================================================================== */}
      {activeTab === 'schedule' && (
        <div className="coach-schedule-section">
          <div className="coach-schedule-filter-bar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: '1 1 320px', maxWidth: 460 }}>
              <input
                type="search"
                className="portal-input"
                style={{ width: '100%' }}
                placeholder={t("Tìm theo tên học viên, lớp, phòng, mã thẻ, SĐT hoặc email…", "Search by student, class, room, card code, phone or email…")}
                aria-label={t("Tìm kiếm lịch dạy", "Search teaching schedule")}
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
              />
            </div>
            {scheduleSearch.trim() && (
              <span className="coach-students-count" style={{ fontSize: '0.88rem', color: 'var(--portal-muted)' }}>
                {t("Kết quả tìm kiếm: ", "Search results: ")}<strong>{filteredPtBookings.length + filteredClassSessions.length} {t("buổi tập", "sessions")}</strong>
              </span>
            )}
          </div>
          <WeeklyTimetable
            label={t("Thời khóa biểu giảng dạy của tôi", "My teaching timetable")}
            weekStart={weekStart}
            events={[...coachSessionEvents(filteredClassSessions, 'schedule'), ...ptBookingEvents(filteredPtBookings)]}
            loading={loading}
            error={t(error)}
            onRetry={() => void loadWeeklySessions()}
            onWeekChange={(iso) => setWeekStart(mondayOfIso(iso))}
            onEventClick={handleEventClick}
            emptyLabel={
              scheduleSearch.trim()
                ? t("Không tìm thấy buổi dạy nào phù hợp trong tuần này.", "No matching sessions found this week.")
                : t("Tuần này bạn chưa có buổi dạy nào.", "You have no sessions scheduled this week.")
            }
            legendNote={t("Bấm vào từng buổi dạy để xem chi tiết, điểm danh hoặc hủy lịch", "Click a session to view details, take attendance, or cancel")}
            legend={[
              { tone: 'open', label: t('Lớp nhóm còn chỗ', 'Open group class') },
              { tone: 'full', label: t('Lớp nhóm đã đầy', 'Full group class') },
              { tone: 'mine', label: t('Kèm riêng 1:1', '1:1 coaching') },
              { tone: 'past', label: t('Đã qua', 'Past') },
              { tone: 'cancelled', label: t('Đã hủy', 'Cancelled') },
            ]}
          />
        </div>
      )}

      {selectedClassSession && (
        <Modal title={selectedClassSession.className} onClose={() => setSelectedClassSession(null)}>
          <div className="kv-list">
            {selectedClassSession.disciplineName && (
              <div className="kv-row"><span>{t("Bộ môn", "Discipline")}</span><strong>{selectedClassSession.disciplineName}</strong></div>
            )}
            <div className="kv-row"><span>{t("Thời gian", "Time")}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCenterDate(selectedClassSession.sessionDate)} · {formatSlotLabel(selectedClassSession.startTime, selectedClassSession.endTime)}</strong></div>
            {selectedClassSession.roomName && (
              <div className="kv-row"><span>{t("Phòng tập", "Room")}</span><strong>{selectedClassSession.roomName}</strong></div>
            )}
            <div className="kv-row"><span>{t("Sĩ số", "Attendance")}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{`${selectedClassSession.bookedCount}/${selectedClassSession.capacity}`}</strong></div>
            {selectedClassSession.cancelReason && (
              <div className="kv-row"><span>{t("Lý do hủy", "Cancellation reason")}</span><strong>{selectedClassSession.cancelReason}</strong></div>
            )}
          </div>
          <div className="mcal__dialog-actions">
            {selectedClassSession.status === 'scheduled' && selectedClassSession.sessionDate >= centerNowParts().date && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setCancelPtError(null);
                  setCancelPtReason('');
                  setCancellingSession(selectedClassSession);
                }}
              >
                {t("Hủy buổi học", "Cancel session")}
              </button>
            )}
            {selectedClassSession.status?.toLowerCase() !== 'cancelled' && (
              selectedClassSession.sessionDate < centerNowParts().date ? (
                <span className="muted" style={{ fontStyle: 'italic', fontSize: '0.88rem' }}>
                  {t("Buổi học đã kết thúc", "Session has ended")}
                </span>
              ) : (
                <Link to={`/coach/attendance/${selectedClassSession.id}`} className="btn-primary">
                  {t("Điểm danh buổi này", "Take attendance")}
                </Link>
              )
            )}
          </div>
        </Modal>
      )}

      {cancellingSession && (
        <Modal
          title={t(`Hủy buổi học: ${cancellingSession.className}`, `Cancel session: ${cancellingSession.className}`)}
          onClose={() => { if (!cancelBusy) setCancellingSession(null); }}
          busy={cancelBusy}
        >
          <form onSubmit={handleConfirmCancelSession} style={{ display: 'grid', gap: 12 }}>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cancel-class-session-reason">
                {t("Lý do hủy buổi học *", "Cancellation reason *")}
              </label>
              <textarea
                id="cancel-class-session-reason"
                rows={3}
                required
                className="portal-textarea"
                placeholder={t("Nhập lý do hủy buổi học để thông báo tới học viên...", "Enter a cancellation reason to notify enrolled members...")}
                value={cancelPtReason}
                onChange={(e) => setCancelPtReason(e.target.value)}
                disabled={cancelBusy}
              />
            </div>
            {cancelPtError && (
              <div className="portal-alert portal-alert--error" role="alert">{t(cancelPtError)}</div>
            )}
            <div className="mcal__dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setCancellingSession(null)} disabled={cancelBusy}>
                {t("Quay lại", "Back")}
              </button>
              <button type="submit" className="btn-danger" disabled={cancelBusy}>
                {cancelBusy ? t("Đang hủy...", "Cancelling...") : t("Xác nhận hủy buổi", "Confirm cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedPt && (
        <Modal title={t("Buổi kèm riêng 1:1")} onClose={() => setSelectedPt(null)}>
          <div className="kv-list">
            <div className="kv-row"><span>{t("Học viên")}</span><strong>{selectedPt.memberName}</strong></div>
            <div className="kv-row"><span>{t("Thời gian")}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCenterDate(selectedPt.bookingDate)} · {formatSlotLabel(selectedPt.startTime, selectedPt.endTime)}</strong></div>
            <div className="kv-row"><span>{t("Bộ môn")}</span><strong>{selectedPt.disciplineName || t('Huấn luyện cá nhân')}</strong></div>
            <div className="kv-row"><span>{t("Hình thức")}</span><strong>{selectedPt.paymentMethod === 'package_quota' ? t('Quyền lợi gói tập') : t('Hội viên trả phí')}</strong></div>
            {selectedPt.notes && <div className="kv-row"><span>{t("Ghi chú của học viên")}</span><strong>{selectedPt.notes}</strong></div>}
          </div>
          <div className="mcal__dialog-actions">
            {(selectedPt.status === 'confirmed' || (selectedPt.status as string) === 'pending') && selectedPt.bookingDate >= centerNowParts().date && (
              <button data-i18n-managed
                type="button"
                className="btn-danger"
                onClick={() => {
                  setCancelPtError(null);
                  setCancelPtReason('');
                  setCancellingPt(selectedPt);
                }}
                data-testid="cancel-pt-btn"
              >
                {t("Hủy buổi kèm 1:1")}</button>
            )}
            {selectedPt.status?.toLowerCase() !== 'cancelled' && (
              selectedPt.bookingDate < centerNowParts().date ? (
                <span className="muted" style={{ fontStyle: 'italic', fontSize: '0.88rem' }}>
                  {t("Buổi tập đã kết thúc", "Session has ended")}
                </span>
              ) : (
                <Link
                  to={`/coach/pt-attendance?date=${selectedPt.bookingDate}&search=${encodeURIComponent(selectedPt.memberName || '')}`}
                  className="btn-primary"
                  data-testid="pt-attendance-btn"
                >
                  {t("Điểm danh buổi này", "Take attendance")}
                </Link>
              )
            )}
          </div>
        </Modal>
      )}

      {cancellingPt && (
        <Modal
          title={t(`Hủy buổi kèm 1:1: ${cancellingPt.memberName}`, `Cancel one-to-one session: ${cancellingPt.memberName}`)}
          onClose={() => { if (!cancelBusy) setCancellingPt(null); }}
          busy={cancelBusy}
        >
          <form onSubmit={handleConfirmCancelPt} style={{ display: 'grid', gap: 12 }}>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cancel-pt-reason">
                {t("Lý do hủy buổi kèm 1:1 *")}</label>
              <textarea
                id="cancel-pt-reason"
                rows={3}
                required
                className="portal-textarea"
                placeholder={t("Nhập lý do hủy buổi kèm 1:1 để thông báo cho học viên...")}
                value={cancelPtReason}
                onChange={(e) => setCancelPtReason(e.target.value)}
                disabled={cancelBusy}
              />
            </div>
            {cancelPtError && (
              <div data-i18n-managed className="portal-alert portal-alert--error" role="alert">
                {t(cancelPtError)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setCancellingPt(null)} disabled={cancelBusy}>
                {t("Quay lại")}</button>
              <button type="submit" className="btn-danger" disabled={cancelBusy} data-testid="confirm-cancel-pt-btn">
                {cancelBusy ? t('Đang hủy...') : t('Xác nhận hủy buổi')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ====================================================================
          TAB 2: HỌC VIÊN PHỤ TRÁCH (Tách riêng biệt)
          ==================================================================== */}
      {activeTab === 'students' && (
        <div data-i18n-managed className="coach-students-section">
          <div className="coach-students-header">
            <div>
              <h3 className="coach-students-title">{t("Danh sách học viên phụ trách")}</h3>
            </div>
            <span className="coach-students-count">
              {t("Tổng số: ")}<strong>{enrichedStudents.length} {t(" học viên")}</strong>
            </span>
          </div>

          <div className="coach-students-filter-bar">
            <input
              type="text"
              className="portal-input"
              style={{ flex: '1 1 280px' }}
              placeholder={t("Tìm theo tên học viên, mã thẻ, SĐT hoặc email...")}
              value={allStudentsSearch}
              onChange={(e) => setAllStudentsSearch(e.target.value)}
            />
            <Select
              className="portal-select"
              style={{ flex: '0 0 200px' }}
              value={allStudentsLevelFilter}
              onChange={(e) => setAllStudentsLevelFilter(e.target.value)}
            >
              <option value="all">{t("Tất cả trình độ")}</option>
              <option value="beginner">{t("Cơ bản", "Beginner")}</option>
              <option value="intermediate">{t("Trung cấp", "Intermediate")}</option>
              <option value="advanced">{t("Nâng cao", "Advanced")}</option>
            </Select>
          </div>

          {allStudentsLoading ? (
            <LoadingSkeleton label={t("Đang tải danh sách học viên phụ trách…")} variant="cards" count={4} />
          ) : allStudentsError ? (
            <div data-i18n-managed className="portal-alert portal-alert--error" role="alert">
              <span>{t(allStudentsError)}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void loadAssignedStudents()}>
                {t("Thử lại", "Retry")}
              </button>
            </div>
          ) : filteredAllStudents.length === 0 ? (
            <div data-i18n-managed className="coach-empty-box">
              <p>{t("Không tìm thấy học viên nào phù hợp.")}</p>
              <span>{t("Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc trình độ.")}</span>
            </div>
          ) : (
            <div data-i18n-managed className="coach-students-grid">
              {filteredAllStudents.map((st, index) => {
                const displayName = st.fullName?.trim() || '—';
                const avatarInitial = (st.fullName?.trim().charAt(0) || '?').toUpperCase();
                const normalizedLevel = (st.fitnessLevel ?? '').trim().toLowerCase();
                const levelLabel =
                  normalizedLevel === 'beginner'
                    ? t('Cơ bản', 'Beginner')
                    : normalizedLevel === 'intermediate'
                    ? t('Trung cấp', 'Intermediate')
                    : normalizedLevel === 'advanced'
                    ? t('Nâng cao', 'Advanced')
                    : '—';
                const levelClass =
                  normalizedLevel === 'beginner' || normalizedLevel === 'intermediate' || normalizedLevel === 'advanced'
                    ? `level-${normalizedLevel}`
                    : 'level-unknown';
                const hasHealthNotes = Boolean(st.healthNotes?.trim());
                return (
                  <div data-i18n-managed key={`${st.id}-${index}`} className="student-card-item">
                    <div className="student-card-header">
                      <div className="student-avatar-col">
                        <div className="student-avatar-fallback">
                          {avatarInitial}
                        </div>
                      </div>
                      <div className="student-main-col">
                        <div className="student-name-row">
                          <h4 className="student-name">{displayName}</h4>
                          {st.membershipCode && <span className="student-code-tag">{st.membershipCode}</span>}
                          <span className={`fitness-level-pill ${levelClass}`}>
                            {levelLabel}
                          </span>
                        </div>
                        <div className="student-contact-row">
                          {st.email && <span>Email: {st.email}</span>}
                          {st.phone && <span>{t("SĐT: ")}{st.phone}</span>}
                          {st.emergencyContactName && (
                            <span data-i18n-managed className="emergency-tag">
                              {t("Khẩn cấp: ")}{st.emergencyContactName} ({st.emergencyContactPhone || '—'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="student-details-grid">
                      <div className="student-detail-box goal-box">
                        <span className="box-title">{t("Mục tiêu thể lực:", "Fitness goal:")}</span>
                        <p className="box-content">{st.fitnessGoal?.trim() || t('Chưa cập nhật')}</p>
                      </div>

                      <div className={`student-detail-box health-box${hasHealthNotes ? ' health-box--alert' : ''}`}>
                        <span className="box-title">{t("Lưu ý sức khỏe & chấn thương:", "Health & injury notes:")}</span>
                        <p className={`box-content${hasHealthNotes ? ' warning-text' : ''}`}>
                          {st.healthNotes?.trim() || t('Sức khỏe bình thường, không có ghi chú chấn thương.')}
                        </p>
                      </div>
                    </div>

                    <div className="student-card-item-footer">
                      <span>{t("Học viên chính thức của trung tâm")}</span>
                      <Link to="/coach/training-plans" className="btn-secondary btn-sm btn-plan-for-student">
                        {t("Soạn giáo án bài tập →")}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
