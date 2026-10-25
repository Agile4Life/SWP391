import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Modal } from '../../shared/ui/Modal';
import { StatusMark } from '../../shared/ui/StatusMark';
import { toast } from '../../shared/ui/toast';
import { coachingApi, type CoachSession, type EnrolledStudent } from './coachingApi';
import './coach-classes.css';

// Helper tính ngày đầu tuần (Thứ Hai)
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateDM(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export function CoachClassesPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Quyền truy cập: COACH hoặc MANAGER
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'COACH' || currentUser.role === 'MANAGER';
  }, [currentUser]);

  // Quản lý tuần hiện tại
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null); // null = cả tuần
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'scheduled' | 'completed'>('all');

  // Dữ liệu buổi học
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal danh sách học viên
  const [activeSession, setActiveSession] = useState<CoachSession | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // 7 ngày trong tuần
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  const sunday = useMemo(() => {
    const s = new Date(monday);
    s.setDate(monday.getDate() + 6);
    return s;
  }, [monday]);

  const weekRangeText = useMemo(() => {
    return `${formatDateDM(monday)}/${monday.getFullYear()} – ${formatDateDM(sunday)}/${sunday.getFullYear()}`;
  }, [monday, sunday]);

  // Tải danh sách lịch dạy
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromStr = formatDateYMD(monday);
      const toStr = formatDateYMD(sunday);
      const coachId = currentUser?.role === 'COACH' ? currentUser.id : undefined;
      const data = await coachingApi.getCoachSchedule(coachId, fromStr, toStr);
      setSessions(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải lịch dạy của huấn luyện viên.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [monday, sunday, currentUser]);

  useEffect(() => {
    if (hasAccess) {
      void loadSchedule();
    }
  }, [hasAccess, loadSchedule]);

  // Chuyển tuần
  const handlePrevWeek = () => {
    setMonday((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setMonday((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setMonday(getMonday(new Date()));
    setSelectedDayIndex(null);
  };

  // Mở modal học viên
  const handleViewStudents = async (session: CoachSession) => {
    setActiveSession(session);
    setLoadingStudents(true);
    setStudentSearch('');
    try {
      const list = await coachingApi.getSessionStudents(session.id, session.classId);
      setStudents(list);
    } catch {
      toast('Không thể tải danh sách học viên của lớp này.', 'error');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Lọc buổi học hiển thị
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Lọc theo ngày được chọn
      if (selectedDayIndex !== null) {
        const targetDate = formatDateYMD(weekDays[selectedDayIndex]);
        if (s.sessionDate !== targetDate) return false;
      }
      // Lọc theo trạng thái
      if (scheduleFilter !== 'all' && s.status !== scheduleFilter) {
        return false;
      }
      return true;
    });
  }, [sessions, selectedDayIndex, weekDays, scheduleFilter]);

  // Thống kê tuần
  const totalSessions = sessions.length;
  const totalBooked = sessions.reduce((acc, s) => acc + (s.bookedCount || 0), 0);
  const totalCapacity = sessions.reduce((acc, s) => acc + (s.capacity || 0), 0);
  const avgFillRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  // Số lượng lớp theo từng ngày
  const countPerDay = useMemo(() => {
    return weekDays.map((d) => {
      const ymd = formatDateYMD(d);
      return sessions.filter((s) => s.sessionDate === ymd).length;
    });
  }, [weekDays, sessions]);

  // Lọc học viên trong modal
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (stu) =>
        stu.fullName.toLowerCase().includes(q) ||
        stu.membershipCode.toLowerCase().includes(q) ||
        stu.fitnessGoal.toLowerCase().includes(q) ||
        stu.healthNotes.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const studentsWithHealthAlerts = useMemo(() => {
    return students.filter(
      (s) =>
        s.healthNotes &&
        !s.healthNotes.toLowerCase().includes('không có') &&
        !s.healthNotes.toLowerCase().includes('bình thường')
    ).length;
  }, [students]);

  // Phân quyền: Cấm người dùng không có vai trò phù hợp
  if (!hasAccess) {
    return (
      <div className="portal-container">
        <PageHeader eyebrow="Huấn luyện" title="Lịch Dạy & Học Viên" />
        <div className="portal-card" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <StatusMark type="error" size={56} />
          </div>
          <h2 style={{ color: '#ef4444', marginBottom: '8px' }}>Truy cập bị từ chối (403 Forbidden)</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '520px', margin: '0 auto' }}>
            Chức năng xem thời khóa biểu dạy và thông tin thể lực học viên chỉ dành riêng cho tài khoản{' '}
            <strong>Huấn Luyện Viên (COACH)</strong> hoặc <strong>Quản Lý (MANAGER)</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-container coach-page">
      <PageHeader
        eyebrow="Huấn luyện &amp; Lịch dạy"
        title="Lớp học &amp; Học viên phụ trách"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void loadSchedule()}
              disabled={loading}
              title="Cập nhật lại lịch dạy từ máy chủ"
            >
              Làm mới
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/staff/attendance')}
            >
              Điểm danh buổi học
            </button>
          </div>
        }
      />

      {/* Overview KPI Cards */}
      <div className="coach-metrics-grid">
        <div className="coach-metric-card">
          <div className="coach-metric-kicker">Lịch dạy tuần này</div>
          <div className="coach-metric-value highlight">{totalSessions} buổi</div>
          <div className="coach-metric-desc">Các lớp được phân công phụ trách</div>
        </div>

        <div className="coach-metric-card">
          <div className="coach-metric-kicker">Học viên đã ghi danh</div>
          <div className="coach-metric-value">{totalBooked} lượt</div>
          <div className="coach-metric-desc">Tổng học viên đăng ký trong tuần</div>
        </div>

        <div className="coach-metric-card">
          <div className="coach-metric-kicker">Tỷ lệ lấp đầy lớp</div>
          <div className="coach-metric-value highlight">{avgFillRate}%</div>
          <div className="coach-metric-desc">Trung bình sĩ số trên sức chứa</div>
        </div>

        <div className="coach-metric-card">
          <div className="coach-metric-kicker">Huấn luyện viên</div>
          <div className="coach-metric-value" style={{ fontSize: '1.4rem' }}>
            {currentUser?.name || 'HLV Chuyên Nghiệp'}
          </div>
          <div className="coach-metric-desc">Mã định danh: {currentUser?.identifier || 'COACH-SCMS'}</div>
        </div>
      </div>

      {/* Week Navigator Bar */}
      <div className="coach-week-bar">
        <div className="coach-week-nav">
          <span style={{ fontSize: '1.2rem', marginRight: '4px' }}>📅</span>
          <span className="coach-week-range">{weekRangeText}</span>
        </div>

        <div className="coach-week-actions">
          <button type="button" className="btn-nav-week" onClick={handlePrevWeek} aria-label="Tuần trước">
            ← Tuần trước
          </button>
          <button type="button" className="btn-nav-week is-today" onClick={handleCurrentWeek}>
            Tuần này
          </button>
          <button type="button" className="btn-nav-week" onClick={handleNextWeek} aria-label="Tuần sau">
            Tuần sau →
          </button>

          <div style={{ marginLeft: '12px', borderLeft: '1px solid #3d3d3d', paddingLeft: '12px' }}>
            <button
              type="button"
              className={`btn-nav-week ${selectedDayIndex === null ? 'is-today' : ''}`}
              onClick={() => setSelectedDayIndex(null)}
            >
              Xem cả tuần
            </button>
          </div>
        </div>

        {/* 7 Days Strip */}
        <div className="coach-day-strip">
          {weekDays.map((day, idx) => {
            const isToday = formatDateYMD(day) === formatDateYMD(new Date());
            const isActive = selectedDayIndex === idx;
            const count = countPerDay[idx];

            return (
              <button
                key={idx}
                type="button"
                className={`coach-day-tab ${isActive ? 'is-active' : ''} ${isToday ? 'is-current-day' : ''}`}
                onClick={() => setSelectedDayIndex(isActive ? null : idx)}
                title={`Xem lịch ngày ${DAY_NAMES[idx]}`}
              >
                <span className="coach-day-name">{DAY_NAMES[idx]}</span>
                <span className="coach-day-num">{day.getDate()}</span>
                <span className="coach-day-count">{count} lớp</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions Section */}
      <div className="coach-sessions-section">
        <div className="coach-sessions-header">
          <h2 className="coach-sessions-title">
            {selectedDayIndex !== null
              ? `Lịch dạy ${DAY_NAMES[selectedDayIndex]} (${formatDateDM(weekDays[selectedDayIndex])})`
              : 'Toàn bộ lịch dạy trong tuần'}
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: '10px' }}>
              ({filteredSessions.length} buổi học)
            </span>
          </h2>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn-secondary btn-sm ${scheduleFilter === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setScheduleFilter('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm ${scheduleFilter === 'scheduled' ? 'btn-primary' : ''}`}
              onClick={() => setScheduleFilter('scheduled')}
            >
              Sắp diễn ra
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm ${scheduleFilter === 'completed' ? 'btn-primary' : ''}`}
              onClick={() => setScheduleFilter('completed')}
            >
              Đã hoàn thành
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '16px 20px',
              background: '#3d2828',
              border: '1px solid #f87171',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>⚠️ {error}</span>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void loadSchedule()}>
              Thử lại
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="coach-sessions-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="portal-skeleton"
                style={{ height: '220px', borderRadius: '10px', background: '#252525' }}
              />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          /* Empty State */
          <div className="coach-empty-state">
            <div className="coach-empty-icon">🧘‍♂️</div>
            <div className="coach-empty-title">Không có lịch dạy trong khoảng thời gian này</div>
            <p style={{ margin: '4px 0 16px 0', fontSize: '0.88rem' }}>
              Huấn luyện viên chưa được xếp lịch dạy nào trong{' '}
              {selectedDayIndex !== null ? DAY_NAMES[selectedDayIndex] : 'tuần này'}.
            </p>
            {selectedDayIndex !== null && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedDayIndex(null)}>
                Xem tất cả các ngày trong tuần
              </button>
            )}
          </div>
        ) : (
          /* Session Cards Grid */
          <div className="coach-sessions-grid">
            {filteredSessions.map((session) => {
              const fillPct = Math.min(
                100,
                Math.round(((session.bookedCount || 0) / (session.capacity || 1)) * 100)
              );
              const isFull = (session.bookedCount || 0) >= (session.capacity || 1);

              return (
                <div key={session.id} className="coach-session-card">
                  <div>
                    <div className="coach-session-card-top">
                      <div>
                        <div className="coach-session-time">
                          <span>⏱</span>
                          <span>
                            {session.startTime?.slice(0, 5)} – {session.endTime?.slice(0, 5)}
                          </span>
                        </div>
                        <div className="coach-session-date">
                          {session.sessionDate} • {session.disciplineName || 'Bộ môn trung tâm'}
                        </div>
                      </div>

                      <span
                        className={`coach-session-badge status-${session.status?.toLowerCase() || 'scheduled'}`}
                      >
                        {session.status === 'completed'
                          ? 'Đã xong'
                          : session.status === 'cancelled'
                          ? 'Đã hủy'
                          : 'Sắp tới'}
                      </span>
                    </div>

                    <h3 className="coach-session-name">{session.className}</h3>

                    <div className="coach-session-meta">
                      <div className="coach-session-meta-row">
                        <span>📍</span>
                        <span>{session.roomName || 'Phòng tập trung tâm'}</span>
                      </div>
                      <div className="coach-session-meta-row">
                        <span>🏷️</span>
                        <span>Cấp độ: {session.level || 'Mọi cấp độ'}</span>
                      </div>
                      {session.description && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--color-text-muted)',
                            fontStyle: 'italic',
                            marginTop: '2px',
                          }}
                        >
                          "{session.description}"
                        </div>
                      )}
                    </div>

                    {/* Sĩ số Progress Bar */}
                    <div className="coach-capacity-box">
                      <div className="coach-capacity-header">
                        <span className="coach-capacity-label">Sĩ số học viên đã book</span>
                        <span className="coach-capacity-numbers">
                          {session.bookedCount} / {session.capacity}
                        </span>
                      </div>
                      <div className="coach-capacity-bar-track">
                        <div
                          className={`coach-capacity-bar-fill ${isFull ? 'is-full' : ''}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="coach-session-actions">
                    <button
                      type="button"
                      className="btn-session-students"
                      onClick={() => void handleViewStudents(session)}
                    >
                      <span>👥</span>
                      <span>Xem học viên ({session.bookedCount})</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => navigate('/staff/attendance')}
                      title="Chuyển đến điểm danh buổi học"
                      style={{ padding: '8px 12px' }}
                    >
                      Điểm danh
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Danh sách học viên & Mục tiêu thể lực & Lưu ý sức khỏe */}
      {activeSession && (
        <Modal
          title={`Danh sách học viên: ${activeSession.className}`}
          onClose={() => setActiveSession(null)}
        >
          <div>
            {/* Header tóm tắt buổi học */}
            <div className="roster-header-summary">
              <div className="roster-class-info">
                <h3>{activeSession.className}</h3>
                <p>
                  ⏱ {activeSession.startTime?.slice(0, 5)} - {activeSession.endTime?.slice(0, 5)} • Ngày:{' '}
                  {activeSession.sessionDate} • Phòng: {activeSession.roomName || 'Sảnh chính'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-success" style={{ fontSize: '0.82rem' }}>
                  {students.length} học viên đăng ký
                </span>
                {studentsWithHealthAlerts > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px', fontWeight: 600 }}>
                    ⚠️ {studentsWithHealthAlerts} học viên có lưu ý y tế
                  </div>
                )}
              </div>
            </div>

            {/* Ô tìm kiếm học viên */}
            <div className="roster-search-bar">
              <input
                type="text"
                className="roster-search-input"
                placeholder="Tìm theo tên học viên, mã thẻ, mục tiêu hoặc tiền sử chấn thương..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>

            {/* Danh sách học viên */}
            {loadingStudents ? (
              <div style={{ display: 'grid', gap: '10px', padding: '16px 0' }}>
                {[1, 2, 3].map((n) => (
                  <div key={n} className="portal-skeleton" style={{ height: '100px', borderRadius: '8px' }} />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)' }}>
                {studentSearch ? 'Không tìm thấy học viên khớp với từ khóa tìm kiếm.' : 'Chưa có học viên nào đăng ký lớp này.'}
              </div>
            ) : (
              <div className="roster-students-list">
                {filteredStudents.map((stu) => {
                  const hasHealthAlert =
                    stu.healthNotes &&
                    !stu.healthNotes.toLowerCase().includes('không có') &&
                    !stu.healthNotes.toLowerCase().includes('bình thường');

                  return (
                    <div key={stu.id} className="roster-student-card">
                      {/* Identity & Header */}
                      <div className="roster-student-header">
                        <div className="roster-student-identity">
                          <div className="roster-student-avatar">
                            {stu.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="roster-student-name">{stu.fullName}</h4>
                            <div className="roster-student-code">Mã thẻ: {stu.membershipCode}</div>
                          </div>
                        </div>

                        <span
                          className={`roster-level-badge roster-level-${
                            stu.fitnessLevel?.toLowerCase() || 'beginner'
                          }`}
                        >
                          Cấp độ: {stu.fitnessLevel}
                        </span>
                      </div>

                      {/* AC: Mục tiêu thể lực (fitness_goal) */}
                      <div className="roster-detail-row">
                        <div className="roster-goal-box">
                          <div className="roster-detail-label">
                            <span>🎯</span>
                            <span>Mục tiêu thể lực (Fitness Goal)</span>
                          </div>
                          <div>{stu.fitnessGoal || 'Duy trì sức khỏe và thể lực dẻo dai tổng thể.'}</div>
                        </div>
                      </div>

                      {/* AC: Lưu ý sức khỏe (health_notes) */}
                      <div className="roster-detail-row">
                        <div className={hasHealthAlert ? 'roster-health-box' : 'roster-goal-box'}>
                          <div className="roster-detail-label">
                            <span>{hasHealthAlert ? '⚠️' : '🩺'}</span>
                            <span>Lưu ý sức khỏe &amp; Tiền sử chấn thương (Health Notes)</span>
                          </div>
                          <div style={{ fontWeight: hasHealthAlert ? 600 : 400 }}>
                            {stu.healthNotes || 'Không có ghi nhận tiền sử chấn thương đặc biệt.'}
                          </div>
                        </div>
                      </div>

                      {/* Contact & Emergency info */}
                      <div className="roster-contact-bar">
                        <div>
                          <span>📞 SĐT: </span>
                          <strong style={{ color: 'var(--color-text-main)' }}>{stu.phone || '—'}</strong>
                          {stu.email && <span style={{ marginLeft: '12px' }}>✉️ {stu.email}</span>}
                        </div>
                        {stu.emergencyContactName && (
                          <div style={{ fontSize: '0.75rem', color: '#a8a29e' }}>
                            Khẩn cấp: <strong>{stu.emergencyContactName}</strong> ({stu.emergencyContactPhone || '—'})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer Modal */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                * HLV lưu ý rà soát tiền sử chấn thương để điều chỉnh bài tập an toàn cho từng học viên.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setActiveSession(null)}>
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setActiveSession(null);
                    navigate('/staff/attendance');
                  }}
                >
                  Điểm danh lớp này
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
