import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { toast } from '../../shared/ui/toast';
import {
  attendanceApi,
  type AttendanceStudent,
  type AttendanceStatus,
  type CoachClassSession,
} from './attendanceApi';
import './coach-attendance.css';

const STATUS_CONFIG: {
  value: AttendanceStatus;
  label: string;
  className: string;
  indicatorColor: string;
}[] = [
  { value: 'present', label: 'Có mặt', className: 'is-present', indicatorColor: '#4ade80' },
  { value: 'absent', label: 'Vắng mặt', className: 'is-absent', indicatorColor: '#f87171' },
  { value: 'late', label: 'Đi muộn', className: 'is-late', indicatorColor: '#fbbf24' },
  { value: 'excused', label: 'Có phép', className: 'is-excused', indicatorColor: '#9ca3af' },
];

export function CoachAttendancePage() {
  const [sessions, setSessions] = useState<CoachClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Load danh sách buổi học của HLV
  useEffect(() => {
    let mounted = true;
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const data = await attendanceApi.getCoachSessions();
        if (mounted) {
          setSessions(data);
          if (data.length > 0) {
            setSelectedSessionId((prev) => (prev === null ? data[0].id : prev));
          }
        }
      } catch {
        if (mounted) {
          toast.error('Không thể tải danh sách buổi học của HLV.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSessions();
    return () => {
      mounted = false;
    };
  }, []);

  // Load danh sách học viên khi chọn buổi học khác
  useEffect(() => {
    if (!selectedSessionId) return;

    let mounted = true;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const list = await attendanceApi.getSessionStudents(selectedSessionId);
        if (mounted) {
          setStudents(list);
        }
      } catch {
        if (mounted) {
          toast.error('Không thể tải danh sách học viên của buổi học.');
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

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0];
  }, [sessions, selectedSessionId]);

  // Cập nhật trạng thái điểm danh cho 1 học viên
  const handleUpdateStatus = (studentId: number, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Cập nhật điểm tiến bộ (slider 1-100)
  const handleUpdateScore = (studentId: number, score: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, progressScore: score } : s))
    );
  };

  // Cập nhật nhận xét kỹ thuật
  const handleUpdateNotes = (studentId: number, notes: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, notes } : s))
    );
  };

  // Điểm danh nhanh: Đặt tất cả thành Có mặt
  const handleMarkAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })));
    toast.success('Đã chọn nhanh trạng thái Có mặt cho toàn bộ học viên.');
  };

  // Lưu điểm danh & Đánh giá hàng loạt (Batch Save)
  const handleSaveBatchAttendance = async () => {
    if (!selectedSessionId) {
      toast.error('Vui lòng chọn buổi học cần lưu điểm danh.');
      return;
    }

    setSaving(true);
    try {
      const payload = students.map((s) => ({
        memberId: s.memberId,
        status: s.status,
        progressScore: s.progressScore,
        notes: s.notes.trim(),
      }));

      const res = await attendanceApi.saveBatchAttendance(selectedSessionId, payload);
      toast.success(res.message || 'Lưu điểm danh & đánh giá thành công!');
    } catch {
      toast.error('Có lỗi xảy ra khi lưu điểm danh. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  // Thống kê nhanh trạng thái
  const summaryCounts = useMemo(() => {
    return {
      present: students.filter((s) => s.status === 'present').length,
      absent: students.filter((s) => s.status === 'absent').length,
      late: students.filter((s) => s.status === 'late').length,
      excused: students.filter((s) => s.status === 'excused').length,
    };
  }, [students]);

  return (
    <div className="coach-attendance-page portal-container">
      <PageHeader
        title="Điểm Danh Buổi Học & Đánh Giá"
        subtitle="Quản lý chuyên biệt cho HLV: Ghi nhận chuyên cần và chấm điểm tiến bộ kỹ thuật học viên."
      />

      {/* Header Selector & Session Info */}
      <div className="attendance-header-card">
        <div className="attendance-session-meta">
          <h3 className="session-name-title">
            {activeSession?.className || 'Buổi tập Huấn luyện viên'}
          </h3>
          <div className="session-details-row">
            <span>
              📍 Phòng: <strong>{activeSession?.roomName || 'Studio chính'}</strong>
            </span>
            <span>
              ⏰ Giờ: <strong>{activeSession?.startTime} - {activeSession?.endTime}</strong>
            </span>
            <span>
              👥 Đã book: <strong>{students.length} học viên</strong>
            </span>
            {activeSession?.disciplineName && (
              <span>Bộ môn: <strong>{activeSession.disciplineName}</strong></span>
            )}
          </div>
        </div>

        <div className="attendance-session-selector">
          <Select
            className="portal-select"
            value={String(selectedSessionId || '')}
            onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            aria-label="Chọn buổi học cần điểm danh"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.className} ({s.startTime} - {s.endTime})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="attendance-quick-summary">
        <div className="summary-pill-card is-present">
          <span className="pill-label">Có mặt (Xanh)</span>
          <span className="pill-value">{summaryCounts.present}</span>
        </div>
        <div className="summary-pill-card is-absent">
          <span className="pill-label">Vắng mặt (Đỏ)</span>
          <span className="pill-value">{summaryCounts.absent}</span>
        </div>
        <div className="summary-pill-card is-late">
          <span className="pill-label">Đi muộn (Vàng)</span>
          <span className="pill-value">{summaryCounts.late}</span>
        </div>
        <div className="summary-pill-card is-excused">
          <span className="pill-label">Có phép (Xám)</span>
          <span className="pill-value">{summaryCounts.excused}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="attendance-toolbar">
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Danh sách <strong>{students.length}</strong> học viên đã ghi danh:
        </span>
        <button
          type="button"
          className="btn-quick-present"
          onClick={handleMarkAllPresent}
          disabled={loading || students.length === 0}
        >
          ✓ Điểm danh nhanh tất cả Có mặt
        </button>
      </div>

      {/* Students Attendance List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
          <div className="portal-spinner" style={{ margin: '0 auto 12px' }} />
          <p>Đang tải danh sách học viên buổi học...</p>
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
          <p>Chưa có học viên nào book buổi học này.</p>
        </div>
      ) : (
        <div className="attendance-students-list">
          {students.map((student) => {
            return (
              <div key={student.id} className="attendance-student-card">
                <div className="student-card-top-row">
                  <div className="student-identity-group">
                    <div className="student-avatar-circle">
                      {student.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="student-meta-text">
                      <h4 className="student-full-name">{student.fullName}</h4>
                      <span className="student-code-badge">{student.membershipCode}</span>
                    </div>
                  </div>

                  {/* Radio button chọn nhanh 4 trạng thái */}
                  <div
                    className="attendance-radio-group"
                    role="radiogroup"
                    aria-label={`Trạng thái điểm danh của ${student.fullName}`}
                  >
                    {STATUS_CONFIG.map((cfg) => {
                      const isSelected = student.status === cfg.value;
                      return (
                        <label
                          key={cfg.value}
                          className={`radio-status-label ${cfg.className} ${isSelected ? 'is-active' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`attendance-status-${student.id}`}
                            value={cfg.value}
                            checked={isSelected}
                            onChange={() => handleUpdateStatus(student.id, cfg.value)}
                          />
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: cfg.indicatorColor,
                              display: 'inline-block',
                            }}
                          />
                          {cfg.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Form con đánh giá nhanh từng học viên */}
                <div className="student-eval-subform">
                  <div className="slider-container">
                    <div className="slider-header">
                      <span>Thang điểm tiến bộ (Progress Score):</span>
                      <span className="score-badge">{student.progressScore}/100</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      className="eval-score-slider"
                      value={student.progressScore}
                      onChange={(e) => handleUpdateScore(student.id, Number(e.target.value))}
                      aria-label={`Điểm tiến bộ của ${student.fullName}`}
                    />
                  </div>

                  <input
                    type="text"
                    className="eval-comment-input"
                    placeholder="Nhận xét kỹ thuật, tư thế động tác và lưu ý sức khỏe buổi tập..."
                    value={student.notes}
                    onChange={(e) => handleUpdateNotes(student.id, e.target.value)}
                    aria-label={`Nhận xét kỹ thuật của ${student.fullName}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Batch Save Action */}
      <div className="attendance-bottom-actions">
        <button
          type="button"
          className="btn-batch-save"
          onClick={handleSaveBatchAttendance}
          disabled={saving || loading || students.length === 0}
        >
          {saving ? 'Đang lưu...' : '💾 Lưu điểm danh & Đánh giá'}
        </button>
      </div>
    </div>
  );
}
