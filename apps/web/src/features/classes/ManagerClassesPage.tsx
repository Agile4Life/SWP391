import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useI18n } from '../../shared/i18n';
import { useLanguage } from '../../shared/i18n/language';
import { errorMessage } from '../../shared/lib/errorMessage';
import { notify } from '../../shared/lib/portalNotices';
import type { Discipline, Room } from '../manager/catalogApi';
import { WeeklyTimetable, type TimetableLegendItem } from '../schedule/WeeklyTimetable';
import { RoomDayTimetable, type RoomColumn } from '../schedule/RoomDayTimetable';
import {
  disciplineAccentColor,
  hhmm,
  mondayOf,
  todayISO,
  weekDays,
  type TimetableEvent,
  type TimetableTone,
} from '../schedule/timetable';
import { classesApi, type ClassItem, type ClassSessionDto, type CoachUser } from './classesApi';
import { ClassSessionDetailModal } from './components/ClassSessionDetailModal';
import {
  CancelSessionModal,
  CreateClassOrSessionModal,
  EditClassModal,
  RescheduleSessionModal,
  type CreateSlotPrefill,
} from './components/ClassFormModals';
import { ClassListTable } from './components/ClassListTable';

type ViewTab = 'by_discipline' | 'week_all' | 'room_day' | 'list';

/**
 * Trang Quản lý lớp học & xếp lịch cho Manager (`/manager/classes`):
 * - Lọc 1 chạm theo bộ môn (bấm Yoga/Boxing… hiện full lịch tuần của riêng môn/lớp đó).
 * - Chế độ Lịch tổng cả tuần chống đè bằng gom cụm "+N lớp".
 * - Chế độ Tổng quan theo phòng (Phòng × Khung giờ) đảm bảo 100% không bao giờ bị đè.
 * - Click bất kỳ buổi học nhỏ nào trên timetable đều mở hộp thoại chi tiết đầy đủ + danh sách học viên.
 */
export function ManagerClassesPage() {
  useLanguage();
  const { t } = useI18n();
  const [confirm, confirmDialog] = useConfirm();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<ClassSessionDto[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [coaches, setCoaches] = useState<CoachUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewTab>('week_all');
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [selectedDay, setSelectedDay] = useState(() => todayISO());

  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [coachFilter, setCoachFilter] = useState<string>('');
  const [showEmptyRooms, setShowEmptyRooms] = useState(true);

  const [detailSession, setDetailSession] = useState<ClassSessionDto | null>(null);
  const [createModal, setCreateModal] = useState<{ mode: 'course' | 'session'; prefill?: CreateSlotPrefill } | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<ClassSessionDto | null>(null);
  const [cancellingSession, setCancellingSession] = useState<ClassSessionDto | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clsList, sessList, discList, roomList, coachList] = await Promise.all([
        classesApi.getClasses(),
        classesApi.getSessions(),
        classesApi.getDisciplines(),
        classesApi.getAvailableRooms(),
        classesApi.getActiveCoaches(),
      ]);
      setClasses(Array.isArray(clsList) ? clsList : []);
      setSessions(Array.isArray(sessList) ? sessList : []);
      setDisciplines(Array.isArray(discList) ? discList : []);
      setRooms(Array.isArray(roomList) ? roomList : []);
      setCoaches(Array.isArray(coachList) ? coachList : []);
    } catch (err) {
      setError(errorMessage(err, t('Không thể tải dữ liệu lớp học và lịch tập.', 'Could not load classes and schedule data.')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const classById = useMemo(() => new Map(classes.map((cls) => [cls.id, cls])), [classes]);

  const enrichedSessions = useMemo(() => {
    return sessions.map((session) => {
      const parent = classById.get(session.classId);
      return {
        ...session,
        className: session.className || parent?.name,
        disciplineId: session.disciplineId ?? parent?.disciplineId,
        disciplineName: session.disciplineName || parent?.disciplineName,
        coachId: session.coachId ?? parent?.coachId,
        coachName: session.coachName || parent?.coachName,
        roomId: session.roomId ?? parent?.roomId,
        roomName: session.roomName || parent?.roomName,
        capacity: session.capacity ?? parent?.capacity ?? 0,
      };
    });
  }, [sessions, classById]);

  const activeWeekDays = useMemo(() => new Set(weekDays(weekStart)), [weekStart]);

  /** Số buổi đang hoạt động trong tuần hiện tại cho từng bộ môn (hiển thị trên chip chọn nhanh). */
  const weeklyCountsByDiscipline = useMemo(() => {
    const map = new Map<number, number>();
    let total = 0;
    for (const s of enrichedSessions) {
      if (s.status === 'cancelled' || !activeWeekDays.has(s.sessionDate)) continue;
      total += 1;
      if (s.disciplineId !== undefined) {
        map.set(s.disciplineId, (map.get(s.disciplineId) ?? 0) + 1);
      }
    }
    return { map, total };
  }, [enrichedSessions, activeWeekDays]);

  /** Nếu người dùng chuyển sang tab "Lịch theo môn / lớp" khi chưa chọn bộ môn, tự chọn bộ môn đầu tiên. */
  const effectiveDisciplineId = useMemo(() => {
    if (view === 'week_all') return null;
    if (selectedDisciplineId !== null) return selectedDisciplineId;
    if (view === 'by_discipline' && disciplines.length > 0) {
      const withSessions = disciplines.find((d) => (weeklyCountsByDiscipline.map.get(d.id) ?? 0) > 0);
      return (withSessions ?? disciplines[0]).id;
    }
    return null;
  }, [view, selectedDisciplineId, disciplines, weeklyCountsByDiscipline]);

  /** Danh sách khóa học con thuộc bộ môn đang chọn (để lọc sâu hơn nếu 1 bộ môn có nhiều khóa). */
  const disciplineClasses = useMemo(() => {
    if (effectiveDisciplineId === null) return classes;
    return classes.filter((cls) => cls.disciplineId === effectiveDisciplineId);
  }, [classes, effectiveDisciplineId]);

  /** Danh sách buổi học sau khi áp dụng toàn bộ bộ lọc hiện tại. */
  const filteredSessions = useMemo(() => {
    return enrichedSessions.filter((s) => {
      if (effectiveDisciplineId !== null && s.disciplineId !== effectiveDisciplineId) return false;
      if (selectedClassId && String(s.classId) !== selectedClassId) return false;
      if (roomFilter && String(s.roomId) !== roomFilter) return false;
      if (coachFilter && String(s.coachId) !== coachFilter) return false;
      return true;
    });
  }, [enrichedSessions, effectiveDisciplineId, selectedClassId, roomFilter, coachFilter]);

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (effectiveDisciplineId !== null && cls.disciplineId !== effectiveDisciplineId) return false;
      if (selectedClassId && String(cls.id) !== selectedClassId) return false;
      if (roomFilter && String(cls.roomId) !== roomFilter) return false;
      if (coachFilter && String(cls.coachId) !== coachFilter) return false;
      return true;
    });
  }, [classes, effectiveDisciplineId, selectedClassId, roomFilter, coachFilter]);

  const today = todayISO();

  const toTimetableEvents = useCallback(
    (list: typeof enrichedSessions): TimetableEvent[] =>
      list.map((s) => {
        const capacity = s.capacity ?? 0;
        const booked = s.bookedCount ?? 0;
        const isPast = s.sessionDate < today;
        const tone: TimetableTone =
          s.status === 'cancelled'
            ? 'cancelled'
            : s.status === 'completed' || isPast
              ? 'past'
              : capacity > 0 && booked >= capacity
                ? 'full'
                : 'open';
        const title = s.className || t(`Lớp #${s.classId}`, `Class #${s.classId}`);
        const badge = capacity > 0 ? `${booked}/${capacity}` : `${booked}`;
        const range = `${hhmm(s.startTime)}–${hhmm(s.endTime)}`;
        return {
          id: String(s.id),
          date: s.sessionDate,
          startTime: s.startTime,
          endTime: s.endTime,
          title,
          meta: s.roomName,
          detail: s.coachName,
          badge,
          disciplineName: s.disciplineName,
          roomId: s.roomId,
          accentColor: disciplineAccentColor(s.disciplineId ?? s.disciplineName),
          tone,
          ariaLabel: `${title} (${s.disciplineName ?? ''}) · ${range} · ${s.roomName ?? ''} · ${badge}`,
        };
      }),
    [today, t],
  );

  const filteredEvents = useMemo(() => toTimetableEvents(filteredSessions), [filteredSessions, toTimetableEvents]);

  /** Cột phòng hiển thị trong chế độ Tổng quan theo phòng. */
  const roomColumns = useMemo<RoomColumn[]>(() => {
    const base = roomFilter ? rooms.filter((r) => String(r.id) === roomFilter) : rooms;
    const mapped = base.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }));
    if (showEmptyRooms || effectiveDisciplineId === null) return mapped;
    const activeRoomIds = new Set(
      filteredSessions.filter((s) => s.sessionDate === selectedDay && s.roomId !== undefined).map((s) => s.roomId!),
    );
    const occupied = mapped.filter((r) => activeRoomIds.has(r.id));
    return occupied.length > 0 ? occupied : mapped;
  }, [rooms, roomFilter, showEmptyRooms, effectiveDisciplineId, filteredSessions, selectedDay]);

  const legend = useMemo<TimetableLegendItem[]>(
    () => [
      { tone: 'open', label: t('Còn chỗ', 'Open') },
      { tone: 'full', label: t('Đã đầy', 'Full') },
      { tone: 'past', label: t('Đã qua', 'Past') },
      { tone: 'cancelled', label: t('Đã hủy', 'Cancelled') },
      { tone: 'free', label: t('Ô trống: bấm để tạo lịch', 'Free slot: click to schedule') },
    ],
    [t],
  );

  const handleOpenEventDetail = (eventId: string) => {
    const found = enrichedSessions.find((s) => String(s.id) === eventId);
    if (found) setDetailSession(found);
  };

  const handleSelectDisciplineChip = (disciplineId: number | null) => {
    setSelectedDisciplineId(disciplineId);
    setSelectedClassId('');
    if (disciplineId === null) {
      if (view === 'by_discipline') setView('week_all');
    } else if (view === 'week_all') {
      setView('by_discipline');
    }
  };

  const handleMutationSuccess = (message: string) => {
    notify(message, 'success');
    setCreateModal(null);
    setEditingClass(null);
    setReschedulingSession(null);
    setCancellingSession(null);
    setDetailSession(null);
    void loadAll();
  };

  const handleDeleteClass = async (cls: ClassItem) => {
    const accepted = await confirm({
      title: t('Xóa khóa học?', 'Delete course?'),
      message: t(
        `Bạn có chắc muốn xóa hoặc ngừng mở khóa "${cls.name}"? Các buổi chưa diễn ra sẽ được hủy và thông báo tới học viên.`,
        `Are you sure you want to delete or deactivate "${cls.name}"? Upcoming sessions will be cancelled and members notified.`,
      ),
      confirmLabel: t('Xóa khóa học', 'Delete course'),
      cancelLabel: t('Hủy', 'Cancel'),
      danger: true,
    });
    if (!accepted) return;
    try {
      await classesApi.deleteClass(cls.id);
      handleMutationSuccess(t(`Đã xóa/ngừng mở khóa "${cls.name}".`, `Course "${cls.name}" deleted/deactivated.`));
    } catch (err) {
      notify(errorMessage(err, t('Không thể xóa khóa học.', 'Could not delete course.')), 'error');
    }
  };

  const activeDisciplineObj = disciplines.find((d) => d.id === effectiveDisciplineId) ?? null;

  return (
    <div data-i18n-managed className="portal-container manager-classes-page">
      <PageHeader
        title={t('Lớp học & xếp lịch', 'Classes & schedule')}
        subtitle={t(
          'Chọn từng bộ môn để xem full lịch tuần của môn đó, hoặc chuyển sang Lịch tổng cả tuần / Tổng quan theo phòng.',
          'Select a discipline to view its full weekly schedule, or switch to Full week overview / Room overview.',
        )}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RefreshButton onClick={() => void loadAll()} disabled={loading} />
            <button
              type="button"
              className="btn-primary"
              data-testid="create-class-btn"
              onClick={() =>
                setCreateModal({
                  mode: 'course',
                  prefill: {
                    disciplineId: effectiveDisciplineId ?? undefined,
                    roomId: roomFilter ? Number(roomFilter) : undefined,
                  },
                })
              }
            >
              {t('+ Tạo khóa học', '+ Create course')}
            </button>
          </div>
        }
      />

      {/* Dải chip chọn nhanh Bộ môn (1 chạm: Lịch tổng cả tuần | Yoga | Boxing | ...) */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div
          className="class-discipline-chips"
          role="group"
          aria-label={t('Lọc nhanh theo bộ môn', 'Quick filter by discipline')}
          data-testid="discipline-filter-chips"
        >
          <button
            type="button"
            className={`filter-chip${effectiveDisciplineId === null ? ' is-active' : ''}`}
            aria-pressed={effectiveDisciplineId === null}
            onClick={() => handleSelectDisciplineChip(null)}
          >
            {t(`Tất cả bộ môn (${weeklyCountsByDiscipline.total})`, `All disciplines (${weeklyCountsByDiscipline.total})`)}
          </button>
          {disciplines.map((disc) => {
            const selected = effectiveDisciplineId === disc.id;
            const count = weeklyCountsByDiscipline.map.get(disc.id) ?? 0;
            const color = disciplineAccentColor(disc.id);
            return (
              <button
                key={disc.id}
                type="button"
                data-testid={`discipline-chip-${disc.id}`}
                className={`filter-chip${selected ? ' is-active' : ''}`}
                aria-pressed={selected}
                onClick={() => handleSelectDisciplineChip(disc.id)}
              >
                <span className="class-discipline-dot" style={{ background: color }} aria-hidden="true" />
                {`${disc.name} (${count})`}
              </button>
            );
          })}
        </div>

        {/* Bộ lọc chi tiết: Khóa học cụ thể (thuộc bộ môn), Phòng tập, HLV */}
        <div className="class-filter-bar" style={{ marginTop: 14, marginBottom: 0 }}>
          <div className="class-filter-field">
            <label className="portal-label" htmlFor="filter-class-select">
              {activeDisciplineObj
                ? t(`Khóa học thuộc ${activeDisciplineObj.name}`, `${activeDisciplineObj.name} courses`)
                : t('Khóa học', 'Course')}
            </label>
            <Select
              id="filter-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">{t('Tất cả khóa học', 'All courses')}</option>
              {disciplineClasses.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>{cls.name}</option>
              ))}
            </Select>
          </div>

          <div className="class-filter-field">
            <label className="portal-label" htmlFor="filter-room-select">{t('Phòng tập', 'Room')}</label>
            <Select id="filter-room-select" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">{t('Tất cả phòng', 'All rooms')}</option>
              {rooms.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
            </Select>
          </div>

          <div className="class-filter-field">
            <label className="portal-label" htmlFor="filter-coach-select">{t('Huấn luyện viên', 'Coach')}</label>
            <Select id="filter-coach-select" value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)}>
              <option value="">{t('Tất cả HLV', 'All coaches')}</option>
              {coaches.map((c) => <option key={c.id} value={String(c.id)}>{c.fullName}</option>)}
            </Select>
          </div>

          {(selectedClassId || roomFilter || coachFilter) && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setSelectedClassId('');
                setRoomFilter('');
                setCoachFilter('');
              }}
            >
              {t('Xóa bộ lọc phụ', 'Reset filters')}
            </button>
          )}
        </div>
      </div>

      {/* 4 chế độ xem lịch & quản lý */}
      <div className="portal-tabs" role="tablist" aria-label={t('Chế độ xem lịch học', 'Schedule view modes')} style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'by_discipline'}
          className={`portal-tab${view === 'by_discipline' ? ' active' : ''}`}
          onClick={() => setView('by_discipline')}
        >
          {activeDisciplineObj
            ? t(`Lịch ${activeDisciplineObj.name}`, `${activeDisciplineObj.name} schedule`)
            : t('Lịch theo môn / lớp', 'By discipline / class')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'week_all'}
          className={`portal-tab${view === 'week_all' ? ' active' : ''}`}
          onClick={() => {
            setSelectedDisciplineId(null);
            setSelectedClassId('');
            setView('week_all');
          }}
        >
          {t('Lịch tổng cả tuần', 'Full week overview')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'room_day'}
          className={`portal-tab${view === 'room_day' ? ' active' : ''}`}
          onClick={() => setView('room_day')}
        >
          {t('Tổng quan theo phòng', 'Room overview')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={`portal-tab${view === 'list' ? ' active' : ''}`}
          onClick={() => setView('list')}
        >
          {t('Danh sách khóa học', 'Courses list')}
          <span className="portal-tab-count">{filteredClasses.length}</span>
        </button>
      </div>

      {loading && sessions.length === 0 ? (
        <LoadingSkeleton rows={6} />
      ) : error && sessions.length === 0 ? (
        <div className="portal-state" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void loadAll()}>
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      ) : view === 'by_discipline' ? (
        <WeeklyTimetable
          label={
            activeDisciplineObj
              ? t(`Thời khóa biểu bộ môn ${activeDisciplineObj.name}`, `${activeDisciplineObj.name} weekly timetable`)
              : t('Thời khóa biểu theo bộ môn', 'Discipline weekly timetable')
          }
          weekStart={weekStart}
          events={filteredEvents}
          loading={loading}
          error={error}
          onRetry={() => void loadAll()}
          onWeekChange={(next) => {
            setWeekStart(next);
            setSelectedDay(next);
          }}
          onEventClick={handleOpenEventDetail}
          selectedId={detailSession ? String(detailSession.id) : undefined}
          onSlotClick={(slot) =>
            setCreateModal({
              mode: selectedClassId ? 'session' : 'course',
              prefill: {
                ...slot,
                disciplineId: effectiveDisciplineId ?? undefined,
                roomId: roomFilter ? Number(roomFilter) : undefined,
                classId: selectedClassId ? Number(selectedClassId) : undefined,
              },
            })
          }
          maxVisibleLanes={2}
          legend={legend}
          legendNote={t('Bấm vào từng buổi học để xem chi tiết lớp, phòng, HLV và danh sách học viên.', 'Click any session to inspect class, room, coach, and enrolled members.')}
          emptyLabel={
            activeDisciplineObj
              ? t(`Tuần này bộ môn ${activeDisciplineObj.name} chưa có buổi học nào`, `No ${activeDisciplineObj.name} sessions this week`)
              : t('Tuần này chưa có buổi học nào', 'No sessions scheduled this week')
          }
        />
      ) : view === 'week_all' ? (
        <WeeklyTimetable
          label={t('Lịch tổng cả tuần toàn trung tâm', 'Full center weekly overview')}
          weekStart={weekStart}
          events={filteredEvents}
          loading={loading}
          error={error}
          onRetry={() => void loadAll()}
          onWeekChange={(next) => {
            setWeekStart(next);
            setSelectedDay(next);
          }}
          onEventClick={handleOpenEventDetail}
          selectedId={detailSession ? String(detailSession.id) : undefined}
          onSlotClick={(slot) =>
            setCreateModal({
              mode: 'course',
              prefill: {
                ...slot,
                roomId: roomFilter ? Number(roomFilter) : undefined,
              },
            })
          }
          maxVisibleLanes={2}
          legend={legend}
          legendNote={t(
            'Khi khung giờ có từ 3 lớp song song trở lên, lịch tự gom thành nút "+N lớp" để không đè nhau — bấm vào để xem đủ và chọn lớp.',
            'Time slots with 3+ concurrent classes group into a "+N classes" button to prevent overlap — click to inspect every class.',
          )}
          emptyLabel={t('Tuần này chưa có buổi học nào', 'No sessions scheduled this week')}
        />
      ) : view === 'room_day' ? (
        <RoomDayTimetable
          label={t('Tổng quan lịch học theo phòng', 'Room-by-room schedule overview')}
          date={selectedDay}
          rooms={roomColumns}
          events={filteredEvents}
          loading={loading}
          error={error}
          onRetry={() => void loadAll()}
          onDateChange={(nextDate) => {
            setSelectedDay(nextDate);
            setWeekStart(mondayOf(nextDate));
          }}
          onEventClick={handleOpenEventDetail}
          selectedId={detailSession ? String(detailSession.id) : undefined}
          onSlotClick={(slot) =>
            setCreateModal({
              mode: selectedClassId ? 'session' : 'course',
              prefill: {
                ...slot,
                disciplineId: effectiveDisciplineId ?? undefined,
                classId: selectedClassId ? Number(selectedClassId) : undefined,
              },
            })
          }
          legend={legend}
          toolbar={
            effectiveDisciplineId !== null ? (
              <div className="mcal__switch" role="group" aria-label={t('Hiển thị phòng', 'Room visibility')}>
                <button type="button" aria-pressed={!showEmptyRooms} onClick={() => setShowEmptyRooms(false)}>
                  {t('Chỉ phòng có lớp', 'Busy rooms')}
                </button>
                <button type="button" aria-pressed={showEmptyRooms} onClick={() => setShowEmptyRooms(true)}>
                  {t('Mọi phòng', 'All rooms')}
                </button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <ClassListTable
          classes={filteredClasses}
          sessions={enrichedSessions}
          onViewClassSchedule={(cls) => {
            setSelectedDisciplineId(cls.disciplineId);
            setSelectedClassId(String(cls.id));
            setView('by_discipline');
          }}
          onAddSession={(cls) =>
            setCreateModal({
              mode: 'session',
              prefill: { classId: cls.id, startTime: cls.startTime, endTime: cls.endTime },
            })
          }
          onEditClass={(cls) => setEditingClass(cls)}
          onDeleteClass={(cls) => void handleDeleteClass(cls)}
        />
      )}

      {/* Modal chi tiết buổi học khi bấm vào ô lịch nhỏ */}
      {detailSession && (
        <ClassSessionDetailModal
          session={detailSession}
          parentClass={classById.get(detailSession.classId)}
          onClose={() => setDetailSession(null)}
          onReschedule={(s) => {
            setDetailSession(null);
            setReschedulingSession(s);
          }}
          onCancelSession={(s) => {
            setDetailSession(null);
            setCancellingSession(s);
          }}
          onEditClass={(cls) => {
            setDetailSession(null);
            setEditingClass(cls);
          }}
        />
      )}

      {createModal && (
        <CreateClassOrSessionModal
          modeInitial={createModal.mode}
          prefill={createModal.prefill}
          classes={classes}
          disciplines={disciplines}
          rooms={rooms}
          coaches={coaches}
          onClose={() => setCreateModal(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

      {editingClass && (
        <EditClassModal
          gymClass={editingClass}
          disciplines={disciplines}
          rooms={rooms}
          coaches={coaches}
          onClose={() => setEditingClass(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

      {reschedulingSession && (
        <RescheduleSessionModal
          session={reschedulingSession}
          onClose={() => setReschedulingSession(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

      {cancellingSession && (
        <CancelSessionModal
          session={cancellingSession}
          onClose={() => setCancellingSession(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

      {confirmDialog}
    </div>
  );
}
