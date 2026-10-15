import { useEffect, useState } from 'react';
import { StatusMark } from '../../shared/ui/StatusMark';
import { PageHeader } from '../../shared/ui/PageHeader';

interface ClassSessionItem {
  id: number;
  className: string;
  discipline: string;
  coach: string;
  room: string;
  time: string;
  date: string;
  capacity: number;
  enrolled: number;
  isBooked: boolean;
  isWaitlist: boolean;
}

export function MemberClassesPage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'my-bookings'>('schedule');
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));

  const [classes, setClasses] = useState<ClassSessionItem[]>([
    {
      id: 1,
      className: 'Reformer Core Architecture',
      discipline: 'Pilates',
      coach: 'Master Elena Vũ',
      room: 'Studio 01 (Level 2)',
      time: '17:30 - 18:30',
      date: 'Hôm nay (26/09)',
      capacity: 12,
      enrolled: 10,
      isBooked: true,
      isWaitlist: false,
    },
    {
      id: 2,
      className: 'Olympic Barbell & Plyometrics',
      discipline: 'Strength',
      coach: 'Coach Minh Trí',
      room: 'Arena 02 (Level 1)',
      time: '08:00 - 09:30',
      date: 'Ngày mai (27/09)',
      capacity: 16,
      enrolled: 16,
      isBooked: false,
      isWaitlist: false,
    },
    {
      id: 3,
      className: 'Yin Yoga & Sound Bath Healing',
      discipline: 'Yoga',
      coach: 'Master An Nhiên',
      room: 'Zen Garden Studio',
      time: '19:00 - 20:15',
      date: 'Thứ Sáu (28/09)',
      capacity: 15,
      enrolled: 15,
      isBooked: false,
      isWaitlist: true,
    },
    {
      id: 4,
      className: 'Tactile Boxing Padwork & Footwork',
      discipline: 'Boxing',
      coach: 'Coach Alex Dương',
      room: 'Ring Arena 01',
      time: '18:00 - 19:15',
      date: 'Thứ Bảy (29/09)',
      capacity: 12,
      enrolled: 8,
      isBooked: false,
      isWaitlist: false,
    },
    {
      id: 5,
      className: 'Hydrodynamic Lap & Flow Training',
      discipline: 'Aquatics',
      coach: 'Coach Hải Đăng',
      room: 'Sub-level Oasis Lap Pool',
      time: '06:30 - 07:30',
      date: 'Chủ Nhật (30/09)',
      capacity: 14,
      enrolled: 6,
      isBooked: false,
      isWaitlist: false,
    },
  ]);

  const handleBook = (id: number) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isBooked: true, enrolled: c.enrolled + 1 } : c))
    );
    showToast('Đặt chỗ thành công! Mã QR buổi tập đã sẵn sàng.');
  };

  const handleWaitlist = (id: number) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, isWaitlist: true } : c)));
    showToast('Đã vào hàng chờ. Khi có học viên hủy chỗ, hệ thống sẽ tự động thông báo!');
  };

  const handleCancelBooking = (id: number) => {
    if (confirm('Bạn có chắc chắn muốn hủy đặt chỗ buổi học này?')) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, isBooked: false, isWaitlist: false, enrolled: Math.max(0, c.enrolled - 1) } : c
        )
      );
    }
  };

  const filteredClasses = classes.filter((c) => {
    if (selectedDiscipline === 'ALL') return true;
    return c.discipline.toUpperCase() === selectedDiscipline.toUpperCase();
  });

  const myBookings = classes.filter((c) => c.isBooked || c.isWaitlist);

  return (
    <div className="portal-container">
      {toast && (
        <div key={toast.id} className="sol-toast" role="status">
          <StatusMark size={30} />
          <span>{toast.message}</span>
        </div>
      )}
      <PageHeader
        eyebrow="Hội viên"
        title="Lịch học & đặt chỗ"
        actions={
          <div className="filter-chips" role="group" aria-label="Lọc theo bộ môn">
            {['ALL', 'Pilates', 'Strength', 'Yoga', 'Boxing', 'Aquatics'].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={selectedDiscipline === d}
                className={`filter-chip ${selectedDiscipline === d ? 'is-active' : ''}`}
                onClick={() => setSelectedDiscipline(d)}
              >
                {d === 'ALL' ? 'Tất cả' : d}
              </button>
            ))}
          </div>
        }
      />

      {/* Tabs */}
      <div className="portal-tabs">
        <button
          type="button"
          className={`portal-tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Lịch Lớp Trong Tuần ({filteredClasses.length})
        </button>
        <button
          type="button"
          className={`portal-tab ${activeTab === 'my-bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-bookings')}
        >
          Lớp Tôi Đang Đặt Chỗ ({myBookings.length})
        </button>
      </div>

      {/* Content based on Tab */}
      {activeTab === 'schedule' ? (
        <div className="stack">
          {filteredClasses.length === 0 && (
            <div className="portal-card portal-empty">
              <h3>Chưa có lớp phù hợp</h3>
              <p>Thử chọn bộ môn khác để xem thêm buổi học.</p>
            </div>
          )}
          {filteredClasses.map((item, index) => {
            const isFull = item.enrolled >= item.capacity;

            return (
              <div
                key={item.id}
                className="portal-card portal-card--list row-in"
                style={{ ['--i' as string]: index } as React.CSSProperties}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="badge badge-info">{item.discipline}</span>
                    <span className="meta-label">{item.date}</span>
                  </div>

                  <h3 className="row-card__title" style={{ fontSize: '1.5rem' }}>
                    {item.className}
                  </h3>

                  <div style={{ fontSize: '0.82rem', color: 'var(--portal-muted, #6A635D)', lineHeight: 1.6 }}>
                    🕒 <strong>{item.time}</strong> • 📍 {item.room} • 🏋️ HLV: <strong>{item.coach}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {/* Capacity Meter */}
                  <div style={{ textAlign: 'right' }}>
                    <div className="meta-label">SỨC CHỨA</div>
                    <div
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.3rem',
                        fontWeight: 600,
                        color: isFull ? 'var(--portal-danger, #b91c1c)' : 'var(--portal-text, #1A1614)',
                      }}
                    >
                      {item.enrolled} / {item.capacity}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {item.isBooked ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge badge-success anim-pop">✓ ĐÃ ĐẶT CHỖ</span>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => handleCancelBooking(item.id)}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : item.isWaitlist ? (
                      <span className="badge badge-warning anim-pop">ĐANG Ở HÀNG CHỜ</span>
                    ) : isFull ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => handleWaitlist(item.id)}
                      >
                        Tham Gia Hàng Chờ
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => handleBook(item.id)}
                      >
                        Đặt Chỗ Ngay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* My Bookings Tab */
        <div className="stack">
          {myBookings.length === 0 ? (
            <div className="portal-card portal-empty">
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📅</div>
              <h3>Bạn chưa có buổi học nào được đặt trước</h3>
              <p>Hãy chuyển sang tab "Lịch Lớp Trong Tuần" để chọn buổi học ưng ý.</p>
            </div>
          ) : (
            myBookings.map((item) => (
              <div key={item.id} className="portal-card portal-card--list">
                <div>
                  <h3 className="row-card__title">{item.className}</h3>
                  <div className="row-card__meta">
                    {item.date} • {item.time} • {item.room}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {item.isBooked ? (
                    <span className="badge badge-success">SẴN SÀNG CHECK-IN</span>
                  ) : (
                    <span className="badge badge-warning">HÀNG CHỜ #1</span>
                  )}
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => handleCancelBooking(item.id)}
                  >
                    Hủy Lịch Đặt
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
