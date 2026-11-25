import { useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { Select } from '../../../shared/ui/Select';
import { DatePicker } from '../../../shared/ui/DatePicker';
import { TimePicker } from '../../../shared/ui/TimePicker';
import { useI18n } from '../../../shared/i18n';
import { errorMessage } from '../../../shared/lib/errorMessage';
import { addDays } from '../../../shared/lib/recurrence';
import type { Discipline, Room } from '../../manager/catalogApi';
import { hhmm, todayISO } from '../../schedule/timetable';
import {
  classesApi,
  type ClassItem,
  type ClassSessionDto,
  type CoachUser,
} from '../classesApi';

const WEEKDAYS: { code: string; vi: string; en: string }[] = [
  { code: 'MONDAY', vi: 'Thứ 2', en: 'Mon' },
  { code: 'TUESDAY', vi: 'Thứ 3', en: 'Tue' },
  { code: 'WEDNESDAY', vi: 'Thứ 4', en: 'Wed' },
  { code: 'THURSDAY', vi: 'Thứ 5', en: 'Thu' },
  { code: 'FRIDAY', vi: 'Thứ 6', en: 'Fri' },
  { code: 'SATURDAY', vi: 'Thứ 7', en: 'Sat' },
  { code: 'SUNDAY', vi: 'Chủ nhật', en: 'Sun' },
];

const JS_DAY_TO_CODE = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function weekdayCodeForIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return JS_DAY_TO_CODE[new Date(y, m - 1, d, 12).getDay()] ?? 'MONDAY';
}

function normalizeTime(value: string): string {
  if (!value) return '08:00:00';
  return value.length === 5 ? `${value}:00` : value;
}

export interface CreateSlotPrefill {
  date?: string;
  startTime?: string;
  endTime?: string;
  roomId?: number;
  disciplineId?: number;
  classId?: number;
}

interface CreateClassOrSessionModalProps {
  modeInitial?: 'course' | 'session';
  prefill?: CreateSlotPrefill;
  classes: ClassItem[];
  disciplines: Discipline[];
  rooms: Room[];
  coaches: CoachUser[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại tạo khóa học định kỳ mới hoặc thêm buổi lẻ vào khóa có sẵn (dùng Select/DatePicker/TimePicker chuẩn). */
export function CreateClassOrSessionModal({
  modeInitial = 'course',
  prefill,
  classes,
  disciplines,
  rooms,
  coaches,
  onClose,
  onSuccess,
}: CreateClassOrSessionModalProps) {
  const { t } = useI18n();
  const activeClasses = classes.filter((c) => String(c.status).toLowerCase() === 'active');
  const activeDisciplineIds = new Set(activeClasses.map((c) => c.disciplineId));
  const availableDisciplines = disciplines.filter((d) => !activeDisciplineIds.has(d.id));
  const [mode, setMode] = useState<'course' | 'session'>(prefill?.classId ? 'session' : modeInitial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultStart = prefill?.date ?? addDays(todayISO(), 14);
  const defaultEnd = addDays(defaultStart, 28);
  const defaultDay = weekdayCodeForIso(defaultStart);

  // State khóa học định kỳ — tự chọn sẵn bộ môn chưa có lớp đang hoạt động (quy tắc 1 lớp/môn).
  const [name, setName] = useState('');
  const [disciplineId, setDisciplineId] = useState(() => {
    if (prefill?.disciplineId && !activeDisciplineIds.has(prefill.disciplineId)) {
      return String(prefill.disciplineId);
    }
    return availableDisciplines[0]?.id ? String(availableDisciplines[0].id) : '';
  });
  const [roomId, setRoomId] = useState(
    prefill?.roomId ? String(prefill.roomId) : (rooms[0]?.id ? String(rooms[0].id) : ''),
  );
  const [coachId, setCoachId] = useState(coaches[0]?.id ? String(coaches[0].id) : '');
  const [capacity, setCapacity] = useState(() => {
    const selectedRoom = rooms.find((r) => String(r.id) === String(prefill?.roomId ?? rooms[0]?.id));
    return String(selectedRoom?.capacity ?? 15);
  });
  const [level, setLevel] = useState('all');
  const [price, setPrice] = useState('150000');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [recurringDays, setRecurringDays] = useState<string[]>([defaultDay]);
  const [startTime, setStartTime] = useState(hhmm(prefill?.startTime ?? '18:00'));
  const [endTime, setEndTime] = useState(hhmm(prefill?.endTime ?? '19:00'));
  const [description, setDescription] = useState('');

  // State thêm buổi cho khóa có sẵn
  const [targetClassId, setTargetClassId] = useState(
    prefill?.classId ? String(prefill.classId) : (activeClasses[0]?.id ? String(activeClasses[0].id) : ''),
  );
  const [sessionDate, setSessionDate] = useState(prefill?.date ?? addDays(todayISO(), 1));

  const toggleDay = (code: string) => {
    setRecurringDays((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (endTime <= startTime) {
      setError(t('Giờ kết thúc phải sau giờ bắt đầu.', 'End time must be after start time.'));
      return;
    }

    setBusy(true);
    try {
      if (mode === 'course') {
        if (!name.trim()) {
          setError(t('Vui lòng nhập tên khóa học.', 'Please enter a course name.'));
          setBusy(false);
          return;
        }
        if (!disciplineId || !roomId || !coachId) {
          setError(t('Vui lòng chọn đầy đủ bộ môn, phòng tập và HLV.', 'Please select discipline, room, and coach.'));
          setBusy(false);
          return;
        }
        if (activeDisciplineIds.has(Number(disciplineId))) {
          setError(
            t(
              'Bộ môn này đã có một lớp đang hoạt động. Mỗi bộ môn chỉ được mở một lớp duy nhất.',
              'This discipline already has an active class. Each discipline allows only one active class.',
            ),
          );
          setBusy(false);
          return;
        }
        if (recurringDays.length === 0) {
          setError(t('Vui lòng chọn ít nhất một thứ trong tuần.', 'Please select at least one weekday.'));
          setBusy(false);
          return;
        }
        if (endDate < startDate) {
          setError(t('Ngày kết thúc phải sau hoặc bằng ngày khai giảng.', 'End date must be on or after start date.'));
          setBusy(false);
          return;
        }
        await classesApi.createRecurringClass({
          name: name.trim(),
          disciplineId: Number(disciplineId),
          roomId: Number(roomId),
          coachId: Number(coachId),
          capacity: Math.max(1, Number(capacity) || 1),
          level,
          description: description.trim() || undefined,
          price: Math.max(0, Number(price) || 0),
          startDate,
          endDate,
          recurringDays,
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
        });
        onSuccess(t('Đã tạo khóa học định kỳ thành công.', 'Recurring course created successfully.'));
      } else {
        if (!targetClassId) {
          setError(t('Vui lòng chọn khóa học.', 'Please select a course.'));
          setBusy(false);
          return;
        }
        await classesApi.createSession({
          classId: Number(targetClassId),
          sessionDate,
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
        });
        onSuccess(t('Đã thêm buổi học mới thành công.', 'Class session added successfully.'));
      }
    } catch (err) {
      setError(errorMessage(err, t('Không thể lưu lịch học. Vui lòng kiểm tra xung đột lịch.', 'Could not save schedule. Please check for conflicts.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={mode === 'course' ? t('Tạo khóa học định kỳ', 'Create recurring course') : t('Thêm buổi học cho khóa', 'Add session to course')}
      onClose={onClose}
      busy={busy}
    >
      <div className="filter-chips" role="group" aria-label={t('Kiểu tạo lịch', 'Creation mode')} style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={`filter-chip${mode === 'course' ? ' is-active' : ''}`}
          aria-pressed={mode === 'course'}
          onClick={() => { setMode('course'); setError(null); }}
        >
          {t('Tạo khóa học mới', 'New recurring course')}
        </button>
        <button
          type="button"
          className={`filter-chip${mode === 'session' ? ' is-active' : ''}`}
          aria-pressed={mode === 'session'}
          disabled={activeClasses.length === 0}
          onClick={() => { setMode('session'); setError(null); }}
        >
          {t('Thêm buổi vào khóa có sẵn', 'Add session to existing course')}
        </button>
      </div>

      {error && (
        <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="portal-form-stack">
        {mode === 'course' ? (
          <>
            {availableDisciplines.length === 0 && (
              <div className="portal-alert portal-alert--error" role="status" data-testid="all-disciplines-taken-notice">
                {t(
                  'Cả tất cả bộ môn hiện đều đã có 1 lớp đang hoạt động. Hãy lưu trữ/hủy lớp cũ ở Danh sách lớp trước khi tạo mới, hoặc chuyển sang "Thêm buổi vào khóa có sẵn".',
                  'Every discipline already has an active class. Archive or cancel an existing class first, or switch to "Add session to existing course".',
                )}
              </div>
            )}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-name">{t('Tên khóa học', 'Course name')}</label>
              <input
                id="cls-name"
                className="portal-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Ví dụ: Yoga Phục hồi sáng', 'e.g. Morning Restorative Yoga')}
                required
              />
            </div>

            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-discipline">{t('Bộ môn (mỗi môn tối đa 1 lớp)', 'Discipline (max 1 active class)')}</label>
                <Select id="cls-discipline" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
                  {availableDisciplines.length === 0 && (
                    <option value="">{t('Không còn bộ môn trống', 'No available discipline')}</option>
                  )}
                  {disciplines.map((d) => {
                    const taken = activeDisciplineIds.has(d.id);
                    return (
                      <option key={d.id} value={String(d.id)} disabled={taken}>
                        {taken ? `${d.name} (${t('Đã có lớp đang mở', 'Already active')})` : d.name}
                      </option>
                    );
                  })}
                </Select>
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-room">{t('Phòng tập', 'Room')}</label>
                <Select
                  id="cls-room"
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    const picked = rooms.find((r) => String(r.id) === e.target.value);
                    if (picked) setCapacity(String(picked.capacity));
                  }}
                >
                  {rooms.map((r) => <option key={r.id} value={String(r.id)}>{`${r.name} (${r.capacity})`}</option>)}
                </Select>
              </div>
            </div>

            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-coach">{t('Huấn luyện viên', 'Coach')}</label>
                <Select id="cls-coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
                  {coaches.map((c) => <option key={c.id} value={String(c.id)}>{c.fullName}</option>)}
                </Select>
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-capacity">{t('Sĩ số tối đa', 'Max capacity')}</label>
                <input
                  id="cls-capacity"
                  className="portal-input"
                  type="number"
                  min={1}
                  max={200}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>

            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-level">{t('Trình độ', 'Level')}</label>
                <Select id="cls-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="all">{t('Mọi trình độ', 'All levels')}</option>
                  <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
                  <option value="intermediate">{t('Trung cấp', 'Intermediate')}</option>
                  <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
                </Select>
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-price">{t('Học phí ngoài gói (VND)', 'Extra fee (VND)')}</label>
                <input
                  id="cls-price"
                  className="portal-input"
                  type="number"
                  min={0}
                  step={10000}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-start-date">{t('Ngày khai giảng', 'Start date')}</label>
                <DatePicker id="cls-start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-end-date">{t('Ngày kết thúc', 'End date')}</label>
                <DatePicker id="cls-end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="portal-form-group">
              <span className="portal-label">{t('Các thứ học trong tuần', 'Weekly schedule days')}</span>
              <div className="filter-chips" role="group" aria-label={t('Chọn các thứ trong tuần', 'Select weekdays')}>
                {WEEKDAYS.map((day) => {
                  const selected = recurringDays.includes(day.code);
                  return (
                    <button
                      key={day.code}
                      type="button"
                      className={`filter-chip${selected ? ' is-active' : ''}`}
                      aria-pressed={selected}
                      onClick={() => toggleDay(day.code)}
                    >
                      {t(day.vi, day.en)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="sess-class">{t('Khóa học', 'Course')}</label>
              <Select id="sess-class" value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                {activeClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {`${c.name} · ${c.roomName ?? ''} · ${c.coachName ?? ''}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="sess-date">{t('Ngày học', 'Session date')}</label>
              <DatePicker id="sess-date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
          </>
        )}

        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="cls-start-time">{t('Giờ bắt đầu', 'Start time')}</label>
            <TimePicker id="cls-start-time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="cls-end-time">{t('Giờ kết thúc', 'End time')}</label>
            <TimePicker id="cls-end-time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        {mode === 'course' && (
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="cls-desc">{t('Mô tả (tùy chọn)', 'Description (optional)')}</label>
            <textarea
              id="cls-desc"
              className="portal-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t('Hủy', 'Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || (mode === 'course' && availableDisciplines.length === 0)}>
            {busy ? t('Đang lưu...', 'Saving...') : mode === 'course' ? t('Tạo khóa học', 'Create course') : t('Thêm buổi học', 'Add session')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface EditClassModalProps {
  gymClass: ClassItem;
  classes: ClassItem[];
  disciplines: Discipline[];
  rooms: Room[];
  coaches: CoachUser[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại chỉnh sửa khóa học (tự kiểm tra xung đột phòng/HLV/PT và quy tắc 1 lớp active/bộ môn). */
export function EditClassModal({ gymClass, classes, disciplines, rooms, coaches, onClose, onSuccess }: EditClassModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(gymClass.name);
  const [disciplineId, setDisciplineId] = useState(String(gymClass.disciplineId));
  const [roomId, setRoomId] = useState(String(gymClass.roomId));
  const [coachId, setCoachId] = useState(String(gymClass.coachId));
  const [capacity, setCapacity] = useState(String(gymClass.capacity));
  const [level, setLevel] = useState(gymClass.level ?? 'all');
  const [status, setStatus] = useState(String(gymClass.status).toLowerCase());
  const [description, setDescription] = useState(gymClass.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherActiveDisciplineIds = new Set(
    classes
      .filter((c) => c.id !== gymClass.id && String(c.status).toLowerCase() === 'active')
      .map((c) => c.disciplineId),
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('Tên khóa học không được để trống.', 'Course name is required.'));
      return;
    }
    if (status === 'active' && otherActiveDisciplineIds.has(Number(disciplineId))) {
      setError(
        t(
          'Bộ môn này đã có một lớp đang hoạt động khác. Mỗi bộ môn chỉ được mở một lớp duy nhất.',
          'Another active class already exists for this discipline. Each discipline allows only one active class.',
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await classesApi.updateClass(gymClass.id, {
        name: name.trim(),
        disciplineId: Number(disciplineId),
        roomId: Number(roomId),
        coachId: Number(coachId),
        capacity: Math.max(1, Number(capacity) || 1),
        level,
        status,
        description: description.trim() || undefined,
      });
      onSuccess(t('Đã cập nhật khóa học thành công.', 'Course updated successfully.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể cập nhật khóa học.', 'Could not update course.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Chỉnh sửa khóa học', 'Edit course')} onClose={onClose} busy={busy}>
      {error && <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} className="portal-form-stack">
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="edit-cls-name">{t('Tên khóa học', 'Course name')}</label>
          <input id="edit-cls-name" className="portal-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-disc">{t('Bộ môn', 'Discipline')}</label>
            <Select id="edit-cls-disc" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
              {disciplines.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-room">{t('Phòng tập', 'Room')}</label>
            <Select id="edit-cls-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-coach">{t('Huấn luyện viên', 'Coach')}</label>
            <Select id="edit-cls-coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              {coaches.map((c) => <option key={c.id} value={String(c.id)}>{c.fullName}</option>)}
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-cap">{t('Sĩ số tối đa', 'Max capacity')}</label>
            <input id="edit-cls-cap" className="portal-input" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-level">{t('Trình độ', 'Level')}</label>
            <Select id="edit-cls-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">{t('Mọi trình độ', 'All levels')}</option>
              <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
              <option value="intermediate">{t('Trung cấp', 'Intermediate')}</option>
              <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-status">{t('Trạng thái', 'Status')}</label>
            <Select id="edit-cls-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">{t('Đang hoạt động', 'Active')}</option>
              <option value="archived">{t('Lưu trữ', 'Archived')}</option>
              <option value="cancelled">{t('Đã hủy', 'Cancelled')}</option>
            </Select>
          </div>
        </div>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="edit-cls-desc">{t('Mô tả', 'Description')}</label>
          <textarea id="edit-cls-desc" className="portal-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Hủy', 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang lưu...', 'Saving...') : t('Lưu thay đổi', 'Save changes')}</button>
        </div>
      </form>
    </Modal>
  );
}

interface RescheduleSessionModalProps {
  session: ClassSessionDto;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại dời lịch một buổi học (gửi thông báo schedule_change cho học viên và HLV). */
export function RescheduleSessionModal({ session, onClose, onSuccess }: RescheduleSessionModalProps) {
  const { t } = useI18n();
  const [date, setDate] = useState(session.sessionDate);
  const [startTime, setStartTime] = useState(hhmm(session.startTime));
  const [endTime, setEndTime] = useState(hhmm(session.endTime));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (endTime <= startTime) {
      setError(t('Giờ kết thúc phải sau giờ bắt đầu.', 'End time must be after start time.'));
      return;
    }
    setBusy(true);
    try {
      await classesApi.rescheduleSession({
        classId: session.classId,
        sessionId: session.id,
        sessionDate: date,
        startTime: normalizeTime(startTime),
        endTime: normalizeTime(endTime),
      });
      onSuccess(t('Đã dời lịch buổi học và gửi thông báo tới học viên, HLV.', 'Session rescheduled and notifications sent.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể dời lịch buổi học.', 'Could not reschedule session.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Dời lịch buổi học', 'Reschedule session')} onClose={onClose} busy={busy}>
      {error && <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} className="portal-form-stack">
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="resch-date">{t('Ngày học mới', 'New date')}</label>
          <DatePicker id="resch-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="resch-start">{t('Giờ bắt đầu', 'Start time')}</label>
            <TimePicker id="resch-start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="resch-end">{t('Giờ kết thúc', 'End time')}</label>
            <TimePicker id="resch-end" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Hủy', 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang lưu...', 'Saving...') : t('Xác nhận dời lịch', 'Confirm reschedule')}</button>
        </div>
      </form>
    </Modal>
  );
}

interface CancelSessionModalProps {
  session: ClassSessionDto;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại hủy một buổi học kèm lý do bắt buộc (tự gửi thông báo tới học viên và HLV). */
export function CancelSessionModal({ session, onClose, onSuccess }: CancelSessionModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError(t('Vui lòng nhập lý do hủy buổi học.', 'Please enter a cancellation reason.'));
      return;
    }
    setBusy(true);
    try {
      await classesApi.cancelSession(session.id, reason.trim());
      onSuccess(t('Đã hủy buổi học và gửi thông báo tới học viên, HLV.', 'Session cancelled and notifications sent.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể hủy buổi học.', 'Could not cancel session.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Hủy buổi học', 'Cancel session')} onClose={onClose} busy={busy}>
      {error && <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} className="portal-form-stack">
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="cancel-reason">{t('Lý do hủy buổi', 'Cancellation reason')}</label>
          <textarea
            id="cancel-reason"
            className="portal-textarea"
            rows={3}
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('Ví dụ: Bảo trì phòng tập hoặc HLV có việc đột xuất', 'e.g. Room maintenance or coach emergency')}
            required
          />
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Quay lại', 'Back')}</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy ? t('Đang hủy...', 'Cancelling...') : t('Xác nhận hủy buổi', 'Confirm cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}
