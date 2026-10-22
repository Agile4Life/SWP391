import { Select } from '../../shared/ui/Select';
import { useState } from 'react';
import { toast } from '../../shared/ui/toast';
import { PageHeader } from '../../shared/ui/PageHeader';

interface AttendanceStudent {
  id: number;
  name: string;
  code: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  evaluation: string;
}

export function CoachAttendancePage() {
  const [selectedSession, setSelectedSession] = useState('session-1');

  const [students, setStudents] = useState<AttendanceStudent[]>([
    {
      id: 1,
      name: 'Nguyễn Văn An',
      code: 'MB-2026-089',
      status: 'PRESENT',
      evaluation: 'Thực hiện động tác Elephant & Long Stretch rất chuẩn, kiểm soát hơi thở tốt.',
    },
    {
      id: 2,
      name: 'Trần Thị Mai',
      code: 'MB-2026-054',
      status: 'PRESENT',
      evaluation: 'Cơ vai còn hơi gồng, đã nhắc nhở thả lỏng trong động tác Chest Expansion.',
    },
    {
      id: 3,
      name: 'Lê Quốc Bảo',
      code: 'MB-2026-112',
      status: 'LATE',
      evaluation: 'Đến trễ 10 phút, đã bù phần khởi động làm ấm khớp cổ chân.',
    },
    {
      id: 4,
      name: 'Vũ Minh Hằng',
      code: 'MB-2026-077',
      status: 'ABSENT',
      evaluation: 'Có báo nghỉ trước 2h vì lịch công tác đột xuất.',
    },
  ]);

  const updateStatus = (id: number, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const updateEval = (id: number, evaluation: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, evaluation } : s)));
  };

  const handleSaveAttendance = () => {
    toast('Đây là bản xem thử. Thay đổi chỉ giữ trong trang này và sẽ mất khi tải lại.', 'success');
  };

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Huấn luyện"
        title="Điểm danh buổi học"
        actions={
          <button type="button" className="btn-primary" onClick={handleSaveAttendance}>
            Giữ bản xem thử
          </button>
        }
      />

      {/* Session Header Selector */}
      <div className="portal-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="meta-label">Buổi học minh họa</div>
            <h3 className="row-card__title" style={{ fontSize: '1.5rem', margin: '8px 0 6px' }}>
              Reformer Core • 17:30 - 18:30
            </h3>
            <div className="row-card__meta">
              📍 Studio 01 (Level 2) • Sĩ số: <strong>4 học viên đăng ký</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Select
              className="portal-select"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="session-1">Minh họa: Reformer Core, 17:30</option>
              <option value="session-2">Minh họa: Yin Yoga, 19:00 (chưa có danh sách riêng)</option>
              <option value="session-3">Minh họa: Barbell, 08:00 (chưa có danh sách riêng)</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Attendance List */}
        <div className="portal-card" style={{ flex: 1.4 }}>
          <div className="portal-card-header">
            <h2 className="portal-card-title">Danh sách học viên</h2>
          </div>

          <div className="stack" style={{ gap: '18px' }}>
            {students.map((stu, index) => (
              <div
                key={stu.id}
                className="row-card row-in"
                style={{ ['--i' as string]: index, display: 'block' } as React.CSSProperties}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{stu.name}</strong>
                    <span className="meta-label" style={{ marginLeft: '10px', fontFamily: 'monospace' }}>
                      {stu.code}
                    </span>
                  </div>

                  {/* Attendance segmented pills */}
                  <div className="seg-group" role="group" aria-label={`Điểm danh ${stu.name}`}>
                    {([
                      ['PRESENT', 'Có mặt', 'seg-btn--ok'],
                      ['LATE', 'Trễ', 'seg-btn--warn'],
                      ['ABSENT', 'Vắng', 'seg-btn--bad'],
                    ] as const).map(([value, label, tone]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={stu.status === value}
                        className={`seg-btn ${tone} ${stu.status === value ? 'is-active' : ''}`}
                        onClick={() => updateStatus(stu.id, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    className="portal-input"
                    placeholder="Ghi chú buổi học"
                    value={stu.evaluation}
                    onChange={(e) => updateEval(stu.id, e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Coaching Assistant Panel */}
        <div className="portal-card portal-card--feature">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Hướng dẫn điểm danh</h2>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
            Chọn trạng thái và nhập ghi chú cho từng học viên. Dữ liệu của{' '}
            <strong>Nguyễn Văn An (MB-2026-089)</strong> và danh sách bên cạnh chỉ dùng để minh họa.
          </p>

          <div
            style={{
              background: 'var(--color-bg-card)',
              borderRadius: '6px',
              padding: '16px',
              border: '1px solid rgba(33, 28, 24, 0.08)',
              marginTop: '16px',
              marginBottom: '16px',
              fontSize: '0.82rem',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Cách sử dụng bản xem thử</div>
            <div>• Chọn Có mặt, Trễ hoặc Vắng cho từng học viên.</div>
            <div>• Ghi lại nhận xét buổi học trong ô bên dưới tên học viên.</div>
            <div style={{ marginTop: '8px', color: 'var(--color-text-muted)' }}>
              Thay đổi <strong>chỉ giữ trong trang này</strong> và sẽ mất khi tải lại.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => toast('Bản xem thử chưa lưu điểm danh hoặc giao bài tập vào hệ thống.', 'success')}
          >
            Thông tin bản xem thử
          </button>
        </div>
      </div>
    </div>
  );
}
