import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Modal } from '../../shared/ui/Modal';
import { Select } from '../../shared/ui/Select';
import {
  coachingApi,
  type CoachSession,
  type EnrolledStudent,
} from './coachingApi';
import './coach-classes.css';

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

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export function CoachClassesPage() {
  const currentUser = getCurrentUser();

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getWeekMonday(new Date()));
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal xem danh sách học viên
  const [activeSession, setActiveSession] = useState<CoachSession | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedFitnessFilter, setSelectedFitnessFilter] = useState<string>('all');

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + idx);
      return {
        idx,
        name: DAY_NAMES[idx],
        dateStr: formatYmd(d),
        displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
        rawDate: d,
      };
    });
  }, [currentMonday]);

  const selectedDateStr = daysOfWeek[selectedDayOffset]?.dateStr;

  const loadWeeklySessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mondayStr = formatYmd(currentMonday);
      const res = await coachingApi.getCoachWeeklySchedule(mondayStr);
      setSessions(res);
    } catch {
      setError('Không thể tải lịch dạy của tuần này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [currentMonday]);

  useEffect(() => {
    void loadWeeklySessions();
  }, [loadWeeklySessions]);

  const handlePrevWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleThisWeek = () => {
    const todayMonday = getWeekMonday(new Date());
    setCurrentMonday(todayMonday);
    const today = new Date();
    const dayOfWeek = today.getDay();
    setSelectedDayOffset(dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  };

  const dailySessions = useMemo(() => {
    return sessions.filter((s) => s.sessionDate === selectedDateStr);
  }, [sessions, selectedDateStr]);

  const handleOpenStudentsModal = async (session: CoachSession) => {
    setActiveSession(session);
    setStudentsLoading(true);
    setStudents([]);
    setStudentsError(null);
    setStudentSearch('');
    setSelectedFitnessFilter('all');
    try {
      const res = await coachingApi.getSessionStudents(session.id, session.classId);
      setStudents(res);
    } catch {
      setStudentsError('Không thể tải danh sách học viên buổi học này.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setActiveSession(null);
    setStudents([]);
  };

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const matchSearch =
        st.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (st.membershipCode ?? '').toLowerCase().includes(studentSearch.toLowerCase()) ||
        (st.phone && st.phone.includes(studentSearch));
      const matchLevel =
        selectedFitnessFilter === 'all' || st.fitnessLevel === selectedFitnessFilter;
      return matchSearch && matchLevel;
    });
  }, [students, studentSearch, selectedFitnessFilter]);

  const weekRangeLabel = useMemo(() => {
    const sunday = new Date(currentMonday);
    sunday.setDate(sunday.getDate() + 6);
    return `${currentMonday.getDate()}/${currentMonday.getMonth() + 1} - ${sunday.getDate()}/${sunday.getMonth() + 1}/${sunday.getFullYear()}`;
  }, [currentMonday]);

  return (
    <div className="portal-container coach-page">
      <PageHeader
        eyebrow="Huấn luyện viên"
        title="Thời Khóa Biểu & Học Viên Phụ Trách"
        subtitle={`HLV: ${currentUser?.name || 'Huấn luyện viên'} | Theo dõi lịch đứng lớp và quản lý sức khỏe, mục tiêu học viên.`}
      />

      <div className="coach-week-bar">
        <div className="coach-week-nav">
          <span className="coach-week-range">Tuần {weekRangeLabel}</span>
        </div>
        <div className="coach-week-actions">
          <button
            type="button"
            className="btn-nav-week"
            onClick={handlePrevWeek}
            aria-label="Tuần trước"
          >
            ← Tuần trước
          </button>
          <button
            type="button"
            className="btn-nav-week is-today"
            onClick={handleThisWeek}
          >
            Tuần hiện tại
          </button>
          <button
            type="button"
            className="btn-nav-week"
            onClick={handleNextWeek}
            aria-label="Tuần sau"
          >
            Tuần sau →
          </button>
        </div>

        <div className="coach-day-strip">
          {daysOfWeek.map((day) => {
            const countForDay = sessions.filter((s) => s.sessionDate === day.dateStr).length;
            const isActive = day.idx === selectedDayOffset;
            return (
              <button
                key={day.dateStr}
                type="button"
                className={`coach-day-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => setSelectedDayOffset(day.idx)}
              >
                <span className="coach-day-name">{day.name}</span>
                <span className="coach-day-date">{day.displayDate}</span>
                {countForDay > 0 && (
                  <span className="coach-day-badge">{countForDay} lớp</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="coach-loading-box">
          <div className="portal-spinner" />
          <p>Đang tải lịch dạy của huấn luyện viên...</p>
        </div>
      )}

      {error && !loading && (
        <div className="coach-error-box">
          <p>{error}</p>
          <button type="button" className="btn-retry" onClick={loadWeeklySessions}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="coach-session-section">
          <div className="coach-section-header">
            <h3>
              Lịch đứng lớp ngày {daysOfWeek[selectedDayOffset]?.name} (
              {daysOfWeek[selectedDayOffset]?.displayDate})
            </h3>
            <span className="session-count-tag">{dailySessions.length} buổi học</span>
          </div>

          {dailySessions.length === 0 ? (
            <div className="coach-empty-box">
              <p>Không có buổi dạy nào trong ngày này.</p>
              <span>HLV có thể nghỉ ngơi hoặc chuẩn bị giáo án cho các buổi tiếp theo.</span>
            </div>
          ) : (
            <div className="coach-session-grid">
              {dailySessions.map((session) => (
                <div key={session.id} className="coach-session-card">
                  <div className="coach-session-top">
                    <div className="coach-session-time">
                      <span className="time-icon" aria-hidden="true" />
                      <span className="time-text">
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                    <span className={`status-pill status-${session.status}`}>
                      {session.status === 'scheduled'
                        ? 'Sắp diễn ra'
                        : session.status === 'completed'
                        ? 'Đã xong'
                        : 'Hủy'}
                    </span>
                  </div>

                  <h4 className="coach-class-title">{session.className}</h4>
                  <p className="coach-discipline-tag">{session.disciplineName || 'Fitness'}</p>

                  <div className="coach-session-info">
                    <div className="info-row">
                      <span className="info-label">Phòng:</span>
                      <span className="info-value">{session.roomName || 'Studio chính'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Sĩ số:</span>
                      <span className="info-value">
                        {session.bookedCount} / {session.capacity} học viên
                      </span>
                    </div>
                    {session.level && (
                      <div className="info-row">
                        <span className="info-label">Trình độ:</span>
                        <span className="info-value">{session.level}</span>
                      </div>
                    )}
                  </div>

                  <div className="coach-card-actions">
                    <button
                      type="button"
                      className="btn-view-students"
                      onClick={() => handleOpenStudentsModal(session)}
                    >
                      Xem danh sách học viên ({session.bookedCount})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSession && (
        <Modal
          title={`Học viên lớp ${activeSession.className} (${activeSession.startTime} - ${activeSession.endTime})`}
          onClose={handleCloseModal}
        >
          <div className="students-modal-body">
            <div className="students-modal-filter-bar">
              <input
                type="text"
                className="portal-input student-search-input"
                placeholder="Tìm theo tên học viên, mã thẻ hoặc SĐT..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <Select
                className="portal-select student-level-filter"
                value={selectedFitnessFilter}
                onChange={(e) => setSelectedFitnessFilter(e.target.value)}
              >
                <option value="all">Tất cả trình độ</option>
                <option value="beginner">Mới bắt đầu (Beginner)</option>
                <option value="intermediate">Trung cấp (Intermediate)</option>
                <option value="advanced">Nâng cao (Advanced)</option>
              </Select>
            </div>

            {studentsLoading ? (
              <div className="students-loading-state">
                <div className="portal-spinner" />
                <p>Đang tải thông tin sức khỏe và mục tiêu của học viên...</p>
              </div>
            ) : studentsError ? (
              <div className="students-empty-state" role="alert"><p>{studentsError}</p></div>
            ) : filteredStudents.length === 0 ? (
              <div className="students-empty-state">
                <p>Không tìm thấy học viên nào phù hợp.</p>
              </div>
            ) : (
              <div className="students-list-wrap">
                {filteredStudents.map((st) => (
                  <div key={st.id} className="student-card-item">
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
                              ? 'Cơ bản'
                              : st.fitnessLevel === 'intermediate'
                              ? 'Trung cấp'
                              : st.fitnessLevel === 'advanced' ? 'Nâng cao' : 'Chưa cập nhật'}
                          </span>
                        </div>
                        <div className="student-contact-row">
                          <span>{st.email}</span>
                          {st.phone && <span>{st.phone}</span>}
                          {st.emergencyContactName && (
                            <span className="emergency-tag">
                              SOS: {st.emergencyContactName} ({st.emergencyContactPhone || 'N/A'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="student-details-grid">
                      <div className="student-detail-box goal-box">
                        <span className="box-title">Mục tiêu thể lực (fitness_goal):</span>
                        <p className="box-content">{st.fitnessGoal || 'Chưa cập nhật'}</p>
                      </div>

                      <div className="student-detail-box health-box">
                        <span className="box-title">Lưu ý sức khỏe & Chấn thương (health_notes):</span>
                        <p className="box-content warning-text">
                          {st.healthNotes || 'Chưa cập nhật'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="students-modal-footer">
              <span className="footer-count">
                Hiển thị {filteredStudents.length} / {students.length} học viên
              </span>
              <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
