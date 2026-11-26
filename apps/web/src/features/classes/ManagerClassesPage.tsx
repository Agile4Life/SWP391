import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useI18n } from '../../shared/i18n';
import { useLanguage } from '../../shared/i18n/language';
import { centerNowParts } from '../../shared/lib/centerTime';
import { errorMessage } from '../../shared/lib/errorMessage';
import { notify } from '../../shared/lib/portalNotices';
import type { Discipline, Room } from '../manager/catalogApi';
import { WeeklyTimetable, type TimetableLegendItem } from '../schedule/WeeklyTimetable';
import { formatSlotLabel } from '../schedule/slots';
import {
  disciplineAccentColor,
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

type ViewTab = 'by_discipline' | 'week_all' | 'list';

/**
 * Trang Quản lý lớp học & xếp lịch cho Quản lý (`/manager/classes`).
 * Gồm đúng 3 tab độc lập, không lặp điều khiển, không lọc chéo nhau:
 * 1. `Lịch theo bộ môn`: chọn 1 trong 3 bộ môn để xem trọn lịch tuần và toàn bộ các khóa đang hoạt động của môn đó.
 * 2. `Lịch tổng cả tuần`: xem gộp cả 3 bộ môn trong tuần, gom nhóm "+N lớp" khi trùng giờ để không đè chữ.
 * 3. `Danh sách lớp`: quản lý đầy đủ các khóa học toàn trung tâm (hỗ trợ nhiều khóa học trên cùng một bộ môn khi khác lịch).
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
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | null>(null);
  // Lọc lịch Tab 1 theo một khóa của bộ môn đang chọn; '' = tất cả khóa.
  const [selectedClassId, setSelectedClassId] = useState('');

  const [detailSession, setDetailSession] = useState<ClassSessionDto | null>(null);
  const [createModal, setCreateModal] = useState<CreateSlotPrefill | null>(null);
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

  const activeClasses = useMemo(
    () => classes.filter((cls) => String(cls.status).toLowerCase() === 'active'),
    [classes],
  );

  /** Map bộ môn → danh sách các khóa học đang hoạt động của bộ môn đó. */
  const activeClassesByDiscipline = useMemo(() => {
    const map = new Map<number, ClassItem[]>();
    for (const cls of activeClasses) {
      const list = map.get(cls.disciplineId);
      if (list) list.push(cls);
      else map.set(cls.disciplineId, [cls]);
    }
    return map;
  }, [activeClasses]);

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

  /** Chỉ hiển thị buổi thuộc các lớp đang hoạt động (`active`) trên thời khóa biểu tuần. */
  const activeScheduleSessions = useMemo(
    () =>
      enrichedSessions.filter((s) => {
        const parent = classById.get(s.classId);
        return !parent || String(parent.status).toLowerCase() === 'active';
      }),
    [enrichedSessions, classById],
  );

  const activeWeekDays = useMemo(() => new Set(weekDays(weekStart)), [weekStart]);

  /** Số buổi không bị hủy trong tuần hiện tại của lớp đang hoạt động theo từng bộ môn (hiển thị trên chip Tab 1). */
  const weeklyCountsByDiscipline = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of activeScheduleSessions) {
      if (s.status === 'cancelled' || !activeWeekDays.has(s.sessionDate)) continue;
      if (s.disciplineId !== undefined) {
        map.set(s.disciplineId, (map.get(s.disciplineId) ?? 0) + 1);
      }
    }
    return map;
  }, [activeScheduleSessions, activeWeekDays]);

  /** Bộ môn đang chọn trong Tab 1 (luôn là 1 bộ môn cụ thể; mặc định bộ môn đầu tiên có buổi hoặc đầu danh sách). */
  const activeDisciplineId = useMemo(() => {
    if (selectedDisciplineId !== null && disciplines.some((d) => d.id === selectedDisciplineId)) {
      return selectedDisciplineId;
    }
    if (disciplines.length === 0) return null;
    const withSessions = disciplines.find((d) => (weeklyCountsByDiscipline.get(d.id) ?? 0) > 0);
    return (withSessions ?? disciplines[0]).id;
  }, [selectedDisciplineId, disciplines, weeklyCountsByDiscipline]);

  const activeDiscipline = useMemo(
    () => disciplines.find((d) => d.id === activeDisciplineId) ?? null,
    [disciplines, activeDisciplineId],
  );

  const activeDisciplineClasses = useMemo(
    () => (activeDisciplineId !== null ? activeClassesByDiscipline.get(activeDisciplineId) ?? [] : []),
    [activeDisciplineId, activeClassesByDiscipline],
  );

  const toTimetableEvents = useCallback(
    (list: typeof enrichedSessions): TimetableEvent[] => {
      const { date: today, time: nowTime } = centerNowParts();
      return list.map((s) => {
        const capacity = s.capacity ?? 0;
        const booked = s.bookedCount ?? 0;
        const endClock = (s.endTime ?? '').slice(0, 5);
        const isPast = s.sessionDate < today || (s.sessionDate === today && endClock !== '' && endClock <= nowTime);
        const tone: TimetableTone =
          s.status === 'cancelled'
            ? 'cancelled'
            : s.status === 'completed' || isPast
              ? 'past'
              : capacity > 0 && booked >= capacity
                ? 'full'
                : 'open';
        const title = s.className || t(`Lớp #${s.classId}`, `Class #${s.classId}`);
        const seats = capacity > 0 ? `${booked}/${capacity}` : `${booked}`;
        const badge = tone === 'full' ? `${seats} · ${t('Đã đầy', 'Full')}` : seats;
        const range = formatSlotLabel(s.startTime, s.endTime);
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
      });
    },
    [t],
  );

  // Khóa đang lọc chỉ hợp lệ khi còn thuộc bộ môn đang chọn (đổi môn hoặc khóa ngừng hoạt động thì về "Tất cả").
  const activeClassFilter = activeDisciplineClasses.some((c) => String(c.id) === selectedClassId) ? selectedClassId : '';

  /** Sự kiện riêng cho Tab 1 (chỉ 1 bộ môn đang chọn, chỉ tính lớp đang hoạt động, lọc thêm theo khóa nếu có). */
  const disciplineEvents = useMemo(() => {
    if (activeDisciplineId === null) return [];
    return toTimetableEvents(activeScheduleSessions.filter((s) =>
      s.disciplineId === activeDisciplineId && (activeClassFilter === '' || String(s.classId) === activeClassFilter)));
  }, [activeScheduleSessions, activeDisciplineId, activeClassFilter, toTimetableEvents]);

  /** Sự kiện độc lập cho Tab 2 (luôn hiển thị toàn bộ 3 bộ môn đang hoạt động, không bị Tab 1 lọc ảnh hưởng). */
  const allWeekEvents = useMemo(
    () => toTimetableEvents(activeScheduleSessions),
    [activeScheduleSessions, toTimetableEvents],
  );

  const baseLegend = useMemo<TimetableLegendItem[]>(
    () => [
      { tone: 'open', label: t('Còn chỗ', 'Open') },
      { tone: 'full', label: t('Đã đầy', 'Full') },
      { tone: 'past', label: t('Đã qua', 'Past') },
      { tone: 'cancelled', label: t('Đã hủy', 'Cancelled') },
    ],
    [t],
  );


  const canCreateClass = disciplines.length > 0;

  const handleOpenEventDetail = (eventId: string) => {
    const found = enrichedSessions.find((s) => String(s.id) === eventId);
    if (found) setDetailSession(found);
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
      title: t('Xóa lớp học?', 'Delete class?'),
      message: t(
        `Bạn có chắc muốn xóa hoặc ngừng mở lớp "${cls.name}"? Các buổi chưa diễn ra sẽ được hủy và thông báo tới học viên.`,
        `Are you sure you want to delete or deactivate "${cls.name}"? Upcoming sessions will be cancelled and members notified.`,
      ),
      confirmLabel: t('Xóa lớp học', 'Delete class'),
      cancelLabel: t('Hủy', 'Cancel'),
      danger: true,
    });
    if (!accepted) return;
    try {
      await classesApi.deleteClass(cls.id);
      handleMutationSuccess(t(`Đã xóa/ngừng mở lớp "${cls.name}".`, `Class "${cls.name}" deleted/deactivated.`));
    } catch (err) {
      notify(errorMessage(err, t('Không thể xóa lớp học.', 'Could not delete class.')), 'error');
    }
  };

  return (
    <div data-i18n-managed className="portal-container manager-classes-page">
      <PageHeader
        title={t('Lớp học & xếp lịch', 'Classes & schedule')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RefreshButton onClick={() => void loadAll()} disabled={loading} />
            <button
              type="button"
              className="btn-primary"
              data-testid="create-class-btn"
              disabled={!canCreateClass}
              onClick={() =>
                setCreateModal({
                  disciplineId: activeDisciplineId ?? undefined,
                })
              }
            >
              {t('+ Tạo lớp học', '+ Create class')}
            </button>
          </div>
        }
      />

      {/* Đúng 3 tab độc lập, không lặp control, không lọc chéo */}
      <div className="portal-tabs" role="tablist" aria-label={t('Chế độ xem lịch học', 'Schedule view modes')} style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'week_all'}
          className={`portal-tab${view === 'week_all' ? ' active' : ''}`}
          onClick={() => setView('week_all')}
        >
          {t('Lịch tổng cả tuần', 'Full week overview')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'by_discipline'}
          className={`portal-tab${view === 'by_discipline' ? ' active' : ''}`}
          onClick={() => setView('by_discipline')}
        >
          {t('Lịch theo bộ môn', 'By discipline')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={`portal-tab${view === 'list' ? ' active' : ''}`}
          onClick={() => setView('list')}
        >
          {t('Danh sách lớp', 'Classes list')}
          <span className="portal-tab-count">{activeClasses.length}</span>
        </button>
      </div>

      {loading && sessions.length === 0 && disciplines.length === 0 ? (
        <LoadingSkeleton label={t('Đang tải lịch lớp học...', 'Loading class schedule...')} count={6} />
      ) : error && sessions.length === 0 && disciplines.length === 0 ? (
        <div className="portal-state" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void loadAll()}>
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      ) : view === 'by_discipline' ? (
        <>
          {/* Chỉ chọn 1 trong 3 bộ môn — không có chip "Tất cả" trùng với tab Lịch tổng, không có dropdown dư thừa */}
          <div className="portal-card" style={{ marginBottom: 16 }}>
            <div
              className="class-discipline-chips"
              role="group"
              aria-label={t('Chọn bộ môn để xem lịch', 'Select a discipline to view schedule')}
              data-testid="discipline-filter-chips"
            >
              {disciplines.map((disc) => {
                const selected = activeDisciplineId === disc.id;
                const count = weeklyCountsByDiscipline.get(disc.id) ?? 0;
                const color = disciplineAccentColor(disc.id);
                return (
                  <button
                    key={disc.id}
                    type="button"
                    data-testid={`discipline-chip-${disc.id}`}
                    className={`filter-chip${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedDisciplineId(disc.id)}
                  >
                    <span className="class-discipline-dot" style={{ background: color }} aria-hidden="true" />
                    {`${disc.name} (${count})`}
                  </button>
                );
              })}
            </div>

            {activeDiscipline && (
              <div className="discipline-active-bar" data-testid="discipline-active-class-bar">
                {activeDisciplineClasses.length > 0 ? (
                  <>
                    <div className="discipline-active-bar__head">
                      <div className="discipline-active-bar__title">
                        <strong>{activeDiscipline.name}</strong>
                        <Select
                          className="discipline-class-filter"
                          value={activeClassFilter}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          aria-label={t('Lọc lịch theo khóa học', 'Filter schedule by course')}
                        >
                          <option value="">
                            {t(`Tất cả khóa (${activeDisciplineClasses.length})`, `All courses (${activeDisciplineClasses.length})`)}
                          </option>
                          {activeDisciplineClasses.map((cls) => (
                            <option key={cls.id} value={String(cls.id)}>{cls.name}</option>
                          ))}
                        </Select>
                      </div>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        data-testid="discipline-create-class-btn"
                        onClick={() => setCreateModal({ disciplineId: activeDiscipline.id })}
                      >
                        {t('+ Tạo khóa mới', '+ New course')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="discipline-active-bar__head">
                    <span className="discipline-active-bar__count">
                      {t(
                        `Bộ môn ${activeDiscipline.name} chưa có khóa học đang hoạt động.`,
                        `${activeDiscipline.name} has no active course yet.`,
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      data-testid="discipline-create-class-btn"
                      onClick={() => setCreateModal({ disciplineId: activeDiscipline.id })}
                    >
                      {t(`+ Tạo lớp ${activeDiscipline.name}`, `+ Create ${activeDiscipline.name} class`)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <WeeklyTimetable
            label={
              activeDiscipline
                ? t(`Thời khóa biểu bộ môn ${activeDiscipline.name}`, `${activeDiscipline.name} weekly timetable`)
                : t('Thời khóa biểu theo bộ môn', 'Discipline weekly timetable')
            }
            weekStart={weekStart}
            events={disciplineEvents}
            loading={loading}
            error={error}
            onRetry={() => void loadAll()}
            onWeekChange={setWeekStart}
            onEventClick={handleOpenEventDetail}
            selectedId={detailSession ? String(detailSession.id) : undefined}
            maxVisibleLanes={2}
            legend={baseLegend}
            legendNote={t('Bấm vào từng buổi học để xem chi tiết lớp, phòng, HLV và danh sách học viên.', 'Click any session to inspect class, room, coach, and enrolled members.')}
            emptyLabel={
              activeDiscipline
                ? t(`Tuần này bộ môn ${activeDiscipline.name} chưa có buổi học nào`, `No ${activeDiscipline.name} sessions this week`)
                : t('Tuần này chưa có buổi học nào', 'No sessions scheduled this week')
            }
          />
        </>
      ) : view === 'week_all' ? (
        <>
          {disciplines.length > 0 && (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12, fontSize: 13, color: 'var(--portal-muted)' }}
              aria-label={t('Chú thích màu theo bộ môn', 'Discipline color legend')}
            >
              {disciplines.map((disc) => (
                <span key={disc.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span className="class-discipline-dot" style={{ background: disciplineAccentColor(disc.id) }} aria-hidden="true" />
                  {disc.name}
                </span>
              ))}
            </div>
          )}

          <WeeklyTimetable
            label={t('Lịch tổng cả tuần toàn trung tâm', 'Full center weekly overview')}
            weekStart={weekStart}
            events={allWeekEvents}
            loading={loading}
            error={error}
            onRetry={() => void loadAll()}
            onWeekChange={setWeekStart}
            onEventClick={handleOpenEventDetail}
            selectedId={detailSession ? String(detailSession.id) : undefined}
            maxVisibleLanes={2}
            legend={baseLegend}
            legendNote={t(
              'Khi khung giờ có từ 3 bộ môn học cùng lúc, lịch tự gom thành nút "+N lớp" để không đè nhau — bấm vào để xem đủ và chọn buổi.',
              'Slots with 3+ concurrent disciplines group into "+N classes" to prevent overlap — click to inspect every session.',
            )}
            emptyLabel={t('Tuần này chưa có buổi học nào', 'No sessions scheduled this week')}
          />
        </>
      ) : (
        <>
          {error && (
            <div
              className="portal-alert portal-alert--error"
              role="alert"
              style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
            >
              <span>{error}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void loadAll()}>
                {t('Thử lại', 'Retry')}
              </button>
            </div>
          )}
          <ClassListTable
            classes={classes}
            sessions={enrichedSessions}
            onViewClassSchedule={(cls) => {
              setSelectedDisciplineId(cls.disciplineId);
              if (cls.startDate) {
                setWeekStart(mondayOf(cls.startDate));
              } else {
                const firstSessionDate = activeScheduleSessions
                  .filter((s) => s.classId === cls.id && s.status !== 'cancelled')
                  .map((s) => s.sessionDate)
                  .sort()[0];
                if (firstSessionDate) {
                  setWeekStart(mondayOf(firstSessionDate));
                }
              }
              setView('by_discipline');
            }}
            onEditClass={(cls) => setEditingClass(cls)}
            onDeleteClass={(cls) => void handleDeleteClass(cls)}
          />
        </>
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
          prefill={createModal}
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
