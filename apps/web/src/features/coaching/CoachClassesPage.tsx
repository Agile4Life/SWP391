import { useStaffI18n, type StaffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { Select } from '../../shared/ui/Select';
import {
  coachingApi,
  type EnrolledStudent,
} from './coachingApi';
import {
  getCoachSchedule,
  type CoachBookingDto,
} from '../member/coachBookingApi';
import { WeeklyTimetable } from '../schedule/WeeklyTimetable';
import { parseISODate } from '../schedule/timetable';
import { ptBookingEvents } from './coachTimetable';
import './coach-classes.css';
import { formatCenterDate } from '../../shared/lib/centerTime';

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CoachClassesPage() {
  const { t } = useStaffI18n();
  const currentUser = getCurrentUser();

  // Tab chuyển đổi: 'schedule' (Thời khóa biểu PT 1-1) hoặc 'students' (Học viên phụ trách)
  const [activeTab, setActiveTab] = useState<'schedule' | 'students'>('schedule');

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getWeekMonday(new Date()));
  const [selectedPt, setSelectedPt] = useState<CoachBookingDto | null>(null);
  const [coach1on1Bookings, setCoach1on1Bookings] = useState<CoachBookingDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StaffMessage | null>(null);

  // Tab Học viên phụ trách
  const [allStudents, setAllStudents] = useState<EnrolledStudent[]>([]);
  const [allStudentsError, setAllStudentsError] = useState<StaffMessage | null>(null);
  const [allStudentsLoading, setAllStudentsLoading] = useState<boolean>(false);
  const [allStudentsSearch, setAllStudentsSearch] = useState<string>('');
  const [allStudentsLevelFilter, setAllStudentsLevelFilter] = useState<string>('all');

  // Cancel 1:1 booking
  const [cancellingPt, setCancellingPt] = useState<CoachBookingDto | null>(null);
  const [cancelPtReason, setCancelPtReason] = useState<string>('');
  const [cancelPtError, setCancelPtError] = useState<StaffMessage | null>(null);
  const [cancelBusy, setCancelBusy] = useState<boolean>(false);

  // Tải danh sách toàn bộ học viên phụ trách
  useEffect(() => {
    let mounted = true;
    const fetchAllStudents = async () => {
      setAllStudentsLoading(true);
      setAllStudentsError(null);
      try {
        const res = await coachingApi.getAllAssignedStudents();
        if (mounted) setAllStudents(res);
      } catch {
        if (mounted) setAllStudentsError('Không thể tải danh sách học viên phụ trách.');
      } finally {
        if (mounted) setAllStudentsLoading(false);
      }
    };
    void fetchAllStudents();
    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  const filteredAllStudents = useMemo(() => {
    return allStudents.filter((st) => {
      const q = allStudentsSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        st.fullName.toLowerCase().includes(q) ||
        st.membershipCode.toLowerCase().includes(q) ||
        (st.phone && st.phone.includes(q)) ||
        st.email.toLowerCase().includes(q);
      const matchLevel =
        allStudentsLevelFilter === 'all' || st.fitnessLevel === allStudentsLevelFilter;
      return matchSearch && matchLevel;
    });
  }, [allStudents, allStudentsSearch, allStudentsLevelFilter]);

  const loadWeeklySessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ptBookings = await getCoachSchedule().catch(() => []);
      setCoach1on1Bookings(ptBookings);
    } catch {
      setError('Không thể tải lịch dạy PT 1-1 của tuần này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeeklySessions();
  }, [loadWeeklySessions]);

  const handleEventClick = (eventId: string) => {
    if (eventId.startsWith('pt-')) {
      setSelectedPt(coach1on1Bookings.find((booking) => `pt-${booking.id}` === eventId) ?? null);
    }
  };

  const handleConfirmCancelPt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingPt || cancelBusy) return;
    const reason = cancelPtReason.trim();
    if (!reason) {
      setCancelPtError('Vui lòng nhập lý do hủy buổi kèm 1:1.');
      return;
    }
    setCancelPtError(null);
    setCancelBusy(true);
    try {
      await apiFetch(`/coach-bookings/${cancellingPt.id}?reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE',
      });
      notify('Đã hủy buổi kèm 1:1 thành công!', 'success');
      setCancellingPt(null);
      setCancelPtReason('');
      setSelectedPt(null);
      await loadWeeklySessions();
    } catch (err: unknown) {
      setCancelPtError(errorMessage(err, 'Không thể hủy buổi kèm 1:1 này.'));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div data-i18n-managed className="portal-container coach-page">
      <PageHeader
        title={t("Lịch dạy PT 1-1 & học viên", "1:1 PT Schedule & Trainees")}
      />

      {/* Phân hệ Tab: Thời khóa biểu PT 1-1 vs Học viên phụ trách */}
      <div className="portal-tabs coach-nav-tabs" role="tablist" aria-label={t("Phân hệ chức năng HLV", "Coach feature tabs")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schedule'}
          className={`portal-tab coach-tab-btn ${activeTab === 'schedule' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          {t("Thời khóa biểu PT 1-1", "1:1 PT Timetable")}</button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'students'}
          className={`portal-tab coach-tab-btn ${activeTab === 'students' ? 'active is-active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          {t("Học viên phụ trách", "Assigned Trainees")}</button>
      </div>

      {/* ====================================================================
          TAB 1: THỜI KHÓA BIỂU DẠY KÈM PT 1-1
          ==================================================================== */}
      {activeTab === 'schedule' && (
        <WeeklyTimetable
          label={t("Thời khóa biểu dạy kèm PT 1-1 của tôi", "My 1:1 PT Timetable")}
          weekStart={formatYmd(currentMonday)}
          events={ptBookingEvents(coach1on1Bookings)}
          loading={loading}
          error={t(error)}
          onRetry={() => void loadWeeklySessions()}
          onWeekChange={(iso) => setCurrentMonday(getWeekMonday(parseISODate(iso)))}
          onEventClick={handleEventClick}
          emptyLabel={t("Tuần này bạn chưa có buổi kèm PT 1-1 nào.", "You have no 1:1 sessions scheduled this week.")}
          legendNote={t("Bấm vào buổi kèm để xem chi tiết học viên hoặc hủy lịch", "Click a session to view trainee details or cancel")}
          legend={[
            { tone: 'mine', label: t('Kèm riêng 1:1') },
            { tone: 'past', label: t('Đã qua') },
            { tone: 'cancelled', label: t('Đã hủy') },
          ]}
        />
      )}

      {selectedPt && (
        <Modal title={t("Buổi kèm riêng 1:1")} onClose={() => setSelectedPt(null)}>
          <div className="kv-list">
            <div className="kv-row"><span>{t("Học viên")}</span><strong>{selectedPt.memberName}</strong></div>
            <div className="kv-row"><span>{t("Thời gian")}</span><strong>{formatCenterDate(selectedPt.bookingDate)} · {selectedPt.startTime.slice(0, 5)}–{selectedPt.endTime.slice(0, 5)}</strong></div>
            <div className="kv-row"><span>{t("Bộ môn")}</span><strong>{selectedPt.disciplineName || t('Huấn luyện cá nhân')}</strong></div>
            <div className="kv-row"><span>{t("Hình thức")}</span><strong>{selectedPt.paymentMethod === 'package_quota' ? t('Quyền lợi gói tập') : t('Hội viên trả phí')}</strong></div>
            {selectedPt.notes && <div className="kv-row"><span>{t("Ghi chú của học viên")}</span><strong>{selectedPt.notes}</strong></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <div>
              {(selectedPt.status === 'confirmed' || (selectedPt.status as string) === 'pending') && (
                <button data-i18n-managed
                  type="button"
                  className="btn-secondary"
                  style={{ color: 'var(--portal-danger, #fca5a5)' }}
                  onClick={() => {
                    setCancelPtError(null);
                    setCancelPtReason('');
                    setCancellingPt(selectedPt);
                  }}
                  data-testid="cancel-pt-btn"
                >
                  {t("Hủy buổi kèm 1:1")}</button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {cancellingPt && (
        <Modal
          title={t(`Hủy buổi kèm 1:1: ${cancellingPt.memberName}`, `Cancel one-to-one session: ${cancellingPt.memberName}`)}
          onClose={() => { if (!cancelBusy) setCancellingPt(null); }}
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
              <div data-i18n-managed role="alert" style={{ color: 'var(--portal-danger, #fca5a5)', fontSize: '0.88rem' }}>
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
              {t("Tổng số: ")}<strong>{allStudents.length} {t(" học viên")}</strong>
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
            <div data-i18n-managed className="coach-error-box" role="alert"><p>{t(allStudentsError)}</p></div>
          ) : filteredAllStudents.length === 0 ? (
            <div data-i18n-managed className="coach-empty-box">
              <p>{t("Không tìm thấy học viên nào phù hợp.")}</p>
              <span>{t("Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc trình độ.")}</span>
            </div>
          ) : (
            <div data-i18n-managed className="coach-students-grid">
              {filteredAllStudents.map((st, index) => (
                <div data-i18n-managed key={`${st.id}-${index}`} className="student-card-item">
                  <div className="student-card-header">
                    <div className="student-avatar-col">
                      <div className="student-avatar-fallback">
                        {st.fullName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="student-main-col">
                      <div className="student-name-row">
                        <h4 className="student-name">{st.fullName}</h4>
                        <span className="student-code-tag">{st.membershipCode}</span>
                        <span className={`fitness-level-pill level-${st.fitnessLevel}`}>
                          {st.fitnessLevel === 'beginner'
                            ? t('Cơ bản')
                            : st.fitnessLevel === 'intermediate'
                            ? t('Trung cấp')
                            : t('Nâng cao')}
                        </span>
                      </div>
                      <div className="student-contact-row">
                        <span>Email: {st.email}</span>
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
                      <p className="box-content">{st.fitnessGoal || t('Chưa cập nhật')}</p>
                    </div>

                    <div className="student-detail-box health-box">
                      <span className="box-title">{t("Lưu ý sức khỏe & chấn thương:", "Health & injury notes:")}</span>
                      <p className="box-content warning-text">
                        {st.healthNotes || t('Sức khỏe bình thường, không có ghi chú chấn thương.')}
                      </p>
                    </div>
                  </div>

                  <div className="student-card-item-footer">
                    <span>{t("Học viên chính thức của trung tâm")}</span>
                    <Link to="/coach/training-plans" className="btn-plan-for-student">
                      {t("Soạn giáo án bài tập →")}</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
