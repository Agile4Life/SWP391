import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Modal } from '../../shared/ui/Modal';
import { Select } from '../../shared/ui/Select';
import { toast } from '../../shared/ui/toast';
import {
  classesApi,
  type ClassItem,
  type ClassSessionDto,
  type CoachUser,
} from './classesApi';
import type { Discipline, Room } from '../manager/catalogApi';

interface ClassFormData {
  name: string;
  disciplineId: string;
  coachId: string;
  roomId: string;
  capacity: number;
  level: string;
  description: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const defaultFormData = (): ClassFormData => ({
  name: '',
  disciplineId: '',
  coachId: '',
  roomId: '',
  capacity: 15,
  level: 'all',
  description: '',
  sessionDate: getTodayString(),
  startTime: '08:00',
  endTime: '09:30',
});

export function StaffClassesPage() {
  const currentUser = getCurrentUser();

  // BR-01: Chỉ CENTER_MANAGER và Staff được cấp quyền thấy màn hình
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'MANAGER' || currentUser.role === 'STAFF';
  }, [currentUser]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<ClassSessionDto[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [coaches, setCoaches] = useState<CoachUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ClassFormData>(defaultFormData());
  const [modalError, setModalError] = useState<string | null>(null);

  // Tải dữ liệu các danh mục phụ trợ (Phòng available, HLV active, Bộ môn)
  const loadCatalogs = useCallback(async () => {
    try {
      const [discList, roomList, coachList] = await Promise.all([
        classesApi.getDisciplines().catch(() => []),
        classesApi.getAvailableRooms().catch(() => []),
        classesApi.getActiveCoaches().catch(() => []),
      ]);
      setDisciplines(discList);
      setRooms(roomList);
      setCoaches(coachList);
    } catch {
      // Bỏ qua lỗi phụ trợ, màn hình chính vẫn xử lý được
    }
  }, []);

  // Tải danh sách lớp học và các buổi học
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classList, sessionList] = await Promise.all([
        classesApi.getClasses(),
        classesApi.getSessions().catch(() => []),
      ]);
      setClasses(classList);
      setSessions(sessionList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách lớp học.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      void loadCatalogs();
      void loadData();
    }
  }, [hasAccess, loadCatalogs, loadData]);

  // BR-01: Forbidden Guard khi vai trò không hợp lệ
  if (!hasAccess) {
    return (
      <div className="portal-container" data-testid="forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }} role="img" aria-label="Forbidden">
              🚫
            </div>
            <h2 className="portal-state__title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              403 - Quyền truy cập bị từ chối
            </h2>
            <p style={{ color: '#7E7771', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              Chỉ Quản lý trung tâm (Center Manager) và Nhân viên được cấp quyền mới có thể truy cập và quản lý lớp học.
            </p>
            <a href="/portal" className="btn-secondary">
              Về trang chủ Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenModal = () => {
    setModalError(null);
    // Đặt mặc định nếu chưa chọn
    setFormData((prev) => ({
      ...prev,
      disciplineId: prev.disciplineId || (disciplines[0] ? String(disciplines[0].id) : ''),
      roomId: prev.roomId || (rooms[0] ? String(rooms[0].id) : ''),
      coachId: prev.coachId || (coaches[0] ? String(coaches[0].id) : ''),
      sessionDate: prev.sessionDate || getTodayString(),
    }));
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setModalError(null);
    setShowModal(false);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    // BR-05: Chặn bấm đúp
    if (isSubmitting) return;

    // BR-03: Validate phía Frontend trước khi gửi
    if (!formData.name.trim()) {
      const msg = 'Vui lòng nhập tên lớp học.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    if (!formData.disciplineId) {
      const msg = 'Vui lòng chọn bộ môn thể thao.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    if (!formData.coachId) {
      const msg = 'Vui lòng chọn huấn luyện viên phụ trách.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    if (!formData.roomId) {
      const msg = 'Vui lòng chọn phòng tập.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    const capacityNum = Number(formData.capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      const msg = 'Sức chứa tối đa (capacity) phải lớn hơn 0.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    const today = getTodayString();
    if (formData.sessionDate < today) {
      const msg = 'Ngày học không được ở trong quá khứ.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    if (formData.endTime <= formData.startTime) {
      const msg = 'Giờ kết thúc phải sau giờ bắt đầu.';
      setModalError(msg);
      toast(msg, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await classesApi.createClass({
        name: formData.name.trim(),
        disciplineId: Number(formData.disciplineId),
        coachId: Number(formData.coachId),
        roomId: Number(formData.roomId),
        capacity: capacityNum,
        level: formData.level,
        description: formData.description.trim() || undefined,
        sessionDate: formData.sessionDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
      });

      toast('Đã tạo lớp học và xếp lịch thành công!', 'success');
      setShowModal(false);
      setFormData(defaultFormData());
      setModalError(null);
      await loadData();
    } catch (err: unknown) {
      // BR-04: Bắt lỗi trùng lịch phòng/HLV (P3, error.scheduling.session_conflict)
      // GIỮ NGUYÊN dữ liệu đã nhập trong form (không reset form, không đóng modal)
      const apiErr = err as { code?: string; message?: string; status?: number };
      const isConflict =
        apiErr?.code === 'error.scheduling.session_conflict' ||
        apiErr?.code === 'SCHEDULE_CONFLICT' ||
        apiErr?.status === 409 ||
        (typeof apiErr?.message === 'string' &&
          (apiErr.message.includes('trùng lịch') ||
            apiErr.message.includes('session_conflict') ||
            apiErr.message.includes('khung giờ')));

      const errMessage = isConflict
        ? 'Trùng lịch: Huấn luyện viên hoặc phòng học đã có lịch trong khung giờ này. Vui lòng chọn thời gian khác.'
        : apiErr?.message || 'Có lỗi xảy ra khi tạo lớp học.';

      setModalError(errMessage);
      toast(errMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper tìm tên bộ môn, HLV, phòng hiển thị nếu backend chưa trả kèm
  const getDisciplineName = (cls: ClassItem) => {
    if (cls.disciplineName) return cls.disciplineName;
    const found = disciplines.find((d) => d.id === cls.disciplineId);
    return found ? found.name : `Bộ môn #${cls.disciplineId}`;
  };

  const getCoachName = (cls: ClassItem) => {
    if (cls.coachName) return cls.coachName;
    const found = coaches.find((c) => c.id === cls.coachId);
    return found ? found.fullName : `HLV #${cls.coachId}`;
  };

  const getRoomName = (cls: ClassItem) => {
    if (cls.roomName) return cls.roomName;
    const found = rooms.find((r) => r.id === cls.roomId);
    return found ? found.name : `Phòng #${cls.roomId}`;
  };

  const getClassSchedule = (cls: ClassItem) => {
    if (cls.schedule) return cls.schedule;
    const classSessions = sessions.filter((s) => s.classId === cls.id);
    if (classSessions.length > 0) {
      const first = classSessions[0];
      return `${first.sessionDate} (${first.startTime} - ${first.endTime})`;
    }
    return 'Chưa có lịch';
  };

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Huấn luyện"
        title="Quản lý lớp học & Xếp lịch"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenModal}
            data-testid="create-class-button"
          >
            + Tạo lớp học &amp; Xếp lịch
          </button>
        }
      />

      {/* State 3: Error retry */}
      {error && (
        <div
          className="portal-alert portal-alert--error"
          style={{
            marginBottom: 20,
            padding: '16px 20px',
            backgroundColor: '#FDF2F2',
            border: '1px solid #F8B4B4',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
          data-testid="classes-error"
        >
          <div style={{ color: '#9B1C1C' }}>
            <strong>Lỗi tải dữ liệu:</strong> {error}
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void loadData()}
            data-testid="retry-button"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* State 1: Loading skeleton */}
      {loading ? (
        <div className="portal-card portal-card--flush" data-testid="classes-skeleton">
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1.5fr 1fr 1fr',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 20, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                  <div style={{ height: 28, backgroundColor: '#EDE8E3', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : classes.length === 0 && !error ? (
        /* State 2: Empty list */
        <div className="portal-card" data-testid="classes-empty">
          <div className="portal-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <h3 className="portal-state__title" style={{ marginBottom: 6 }}>
              Chưa có lớp học nào
            </h3>
            <p style={{ color: '#7E7771', maxWidth: 460, margin: '0 auto 16px auto' }}>
              Hiện chưa có lớp học nào trong hệ thống. Hãy tạo lớp học mới để bắt đầu sắp xếp lịch tập cho hội viên và huấn luyện viên.
            </p>
            <button type="button" className="btn-primary" onClick={handleOpenModal}>
              + Tạo lớp học đầu tiên
            </button>
          </div>
        </div>
      ) : (
        /* Danh sách lớp học */
        <div className="portal-card portal-card--flush" data-testid="classes-table-wrapper">
          <div className="portal-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Tên Lớp Học</th>
                  <th>Bộ Môn</th>
                  <th>Huấn Luyện Viên</th>
                  <th>Phòng Tập</th>
                  <th>Lịch Học</th>
                  <th>Sức Chứa</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td>
                      <strong>{cls.name}</strong>
                      <div className="muted" style={{ marginTop: 2, fontSize: '0.8rem' }}>
                        ID: CLS-{cls.id}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{getDisciplineName(cls)}</span>
                    </td>
                    <td>{getCoachName(cls)}</td>
                    <td>{getRoomName(cls)}</td>
                    <td>{getClassSchedule(cls)}</td>
                    <td>
                      <strong>{cls.capacity} học viên</strong>
                    </td>
                    <td>
                      <span className={`badge ${cls.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                        {cls.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => toast(`Đang tải danh sách học viên lớp ${cls.name}...`, 'success')}
                      >
                        Danh Sách
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Tạo lớp học và xếp lịch */}
      {showModal && (
        <Modal title="Tạo Lớp Học &amp; Xếp Lịch HLV" onClose={handleCloseModal}>
          <form onSubmit={handleCreateClass} style={{ display: 'grid', gap: 14 }}>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="class-name">
                Tên Lớp Học *
              </label>
              <input
                id="class-name"
                type="text"
                required
                autoFocus
                placeholder="Ví dụ: Reformer Pilates Level 2..."
                className="portal-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="class-discipline">
                  Bộ Môn *
                </label>
                <Select
                  id="class-discipline"
                  className="portal-select"
                  value={formData.disciplineId}
                  onChange={(e) => setFormData({ ...formData, disciplineId: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="">-- Chọn bộ môn --</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="portal-form-group">
                <label className="portal-label" htmlFor="class-capacity">
                  Sức Chứa Tối Đa * (Capacity &gt; 0)
                </label>
                <input
                  id="class-capacity"
                  type="number"
                  min={1}
                  max={100}
                  required
                  className="portal-input"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* BR-02: Dropdown HLV chỉ liệt kê HLV đang active */}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="class-coach">
                Huấn Luyện Viên Phụ Trách * (Chỉ HLV active)
              </label>
              <Select
                id="class-coach"
                className="portal-select"
                value={formData.coachId}
                onChange={(e) => setFormData({ ...formData, coachId: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">-- Chọn huấn luyện viên --</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </option>
                ))}
              </Select>
            </div>

            {/* BR-02: Dropdown Phòng chỉ liệt kê phòng available */}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="class-room">
                Phòng Tập * (Chỉ phòng available)
              </label>
              <Select
                id="class-room"
                className="portal-select"
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">-- Chọn phòng tập --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} - Sức chứa: {r.capacity} ({r.location || 'Khu trung tâm'})
                  </option>
                ))}
              </Select>
            </div>

            {/* Khung giờ và ngày học */}
            <div style={{ padding: '12px', backgroundColor: '#F9F8F6', borderRadius: 8, border: '1px solid #ECE7E1' }}>
              <strong style={{ display: 'block', marginBottom: 10, fontSize: '0.9rem', color: '#4A4541' }}>
                Xếp lịch buổi học đầu tiên
              </strong>

              <div className="grid-2" style={{ marginBottom: 10 }}>
                <div className="portal-form-group">
                  <label className="portal-label" htmlFor="session-date">
                    Ngày Học * (Không ở quá khứ)
                  </label>
                  <input
                    id="session-date"
                    type="date"
                    required
                    min={getTodayString()}
                    className="portal-input"
                    value={formData.sessionDate}
                    onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="portal-form-group">
                  <label className="portal-label" htmlFor="class-level">
                    Cấp Độ
                  </label>
                  <Select
                    id="class-level"
                    className="portal-select"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    disabled={isSubmitting}
                  >
                    <option value="all">Mọi cấp độ (All levels)</option>
                    <option value="beginner">Người mới bắt đầu (Beginner)</option>
                    <option value="intermediate">Trung cấp (Intermediate)</option>
                    <option value="advanced">Nâng cao (Advanced)</option>
                  </Select>
                </div>
              </div>

              <div className="grid-2">
                <div className="portal-form-group">
                  <label className="portal-label" htmlFor="session-start">
                    Giờ Bắt Đầu *
                  </label>
                  <input
                    id="session-start"
                    type="time"
                    required
                    className="portal-input"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="portal-form-group">
                  <label className="portal-label" htmlFor="session-end">
                    Giờ Kết Thúc * (&gt; Giờ bắt đầu)
                  </label>
                  <input
                    id="session-end"
                    type="time"
                    required
                    className="portal-input"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="class-desc">
                Mô Tả / Ghi Chú
              </label>
              <textarea
                id="class-desc"
                rows={2}
                className="portal-textarea"
                placeholder="Ghi chú về trang phục hoặc dụng cụ cần chuẩn bị..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            {/* Hiển thị lỗi form trực tiếp trong Modal */}
            {modalError && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FDF2F2',
                  border: '1px solid #F8B4B4',
                  borderRadius: '6px',
                  color: '#9B1C1C',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '4px',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <span>{modalError}</span>
              </div>
            )}

            {/* BR-05: Chặn bấm đúp (disable nút khi đang gửi) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                data-testid="submit-class-button"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  'Lưu & Xếp Lịch'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
