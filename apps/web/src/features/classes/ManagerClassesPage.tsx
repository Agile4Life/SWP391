import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useI18n } from '../../shared/i18n';
import { useLanguage } from '../../shared/i18n/language';
import { errorMessage } from '../../shared/lib/errorMessage';
import { notify } from '../../shared/lib/portalNotices';
import type { Discipline, Room } from '../manager/catalogApi';
import { WeeklyTimetable, type TimetableLegendItem } from '../schedule/WeeklyTimetable';
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

type ViewTab = 'by_discipline' | 'week_all' | 'list';

/**
 * Trang Quản lý lớp học & xếp lịch cho Quản lý (`/manager/classes`).
 * Gồm đúng 3 tab độc lập, không lặp điều khiển, không lọc chéo nhau:
 * 1. `Lịch theo bộ môn`: chọn 1 trong 6 bộ môn để xem trọn lịch tuần của lớp duy nhất thuộc môn đó.
 * 2. `Lịch tổng cả tuần`: xem gộp cả 6 bộ môn trong tuần, gom nhóm "+N lớp" khi trùng giờ để không đè chữ.
 * 3. `Danh sách lớp`: quản lý đầy đủ các lớp theo quy tắc mỗi bộ môn tối đa 1 lớp đang hoạt động.
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

  const [view, setView] = useState<ViewTab>('by_discipline');
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | null>(null);

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

  const activeClasses = useMemo(
    () => classes.filter((cls) => String(cls.status).toLowerCase() === 'active'),
    [classes],
  );

  /** Map bộ môn → lớp đang hoạt động duy nhất của bộ môn đó. */
  const activeClassByDiscipline = useMemo(() => {
    const map = new Map<number, ClassItem>();
    for (const cls of activeClasses) {
      if (!map.has(cls.disciplineId)) {
        map.set(cls.disciplineId, cls);
      }
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

  const activeWeekDays = useMemo(() => new Set(weekDays(weekStart)), [weekStart]);

  /** Số buổi không bị hủy trong tuần hiện tại theo từng bộ môn (hiển thị trên chip Tab 1). */
  const weeklyCountsByDiscipline = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of enrichedSessions) {
      if (s.status === 'cancelled' || !activeWeekDays.has(s.sessionDate)) continue;
      if (s.disciplineId !== undefined) {
        map.set(s.disciplineId, (map.get(s.disciplineId) ?? 0) + 1);
      }
    }
    return map;
  }, [enrichedSessions, activeWeekDays]);

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

  const activeDisciplineClass = useMemo(
    () => (activeDisciplineId !== null ? activeClassByDiscipline.get(activeDisciplineId) ?? null : null),
    [activeDisciplineId, activeClassByDiscipline],
  );

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

  /** Sự kiện riêng cho Tab 1 (chỉ 1 bộ môn đang chọn). */
  const disciplineEvents = useMemo(() => {
    if (activeDisciplineId === null) return [];
    return toTimetableEvents(enrichedSessions.filter((s) => s.disciplineId === activeDisciplineId));
  }, [enrichedSessions, activeDisciplineId, toTimetableEvents]);

  /** Sự kiện độc lập cho Tab 2 (luôn hiển thị toàn bộ 6 bộ môn, không bị Tab 1 lọc ảnh hưởng). */
  const allWeekEvents = useMemo(
    () => toTimetableEvents(enrichedSessions),
    [enrichedSessions, toTimetableEvents],
  );

  const legend = useMemo<TimetableLegendItem[]>(
    () => [
      { tone: 'open', label: t('Còn chỗ', 'Open') },
      { tone: 'full', label: t('Đã đầy', 'Full') },
      { tone: 'past', label: t('Đã qua', 'Past') },
      { tone: 'cancelled', label: t('Đã hủy', 'Cancelled') },
      { tone: 'free', label: t('Ô trống: bấm để xếp lịch', 'Free slot: click to schedule') },
    ],
    [t],
  );

  const hasAvailableDiscipline = useMemo(
    () => disciplines.some((d) => !activeClassByDiscipline.has(d.id)),
    [disciplines, activeClassByDiscipline],
  );

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
              onClick={() =>
                setCreateModal({
                  mode: hasAvailableDiscipline ? 'course' : 'session',
                  prefill: hasAvailableDiscipline
                    ? {
                        disciplineId:
                          activeDisciplineId !== null && !activeClassByDiscipline.has(activeDisciplineId)
                            ? activeDisciplineId
                            : undefined,
                      }
                    : {
                        classId: activeDisciplineClass?.id ?? activeClasses[0]?.id,
                      },
                })
              }
            >
              {hasAvailableDiscipline ? t('+ Tạo lớp học', '+ Create class') : t('+ Thêm buổi học', '+ Add session')}
            </button>
          </div>
        }
      />

      {/* Đúng 3 tab độc lập, không lặp control, không lọc chéo */}
      <div className="portal-tabs" role="tablist" aria-label={t('Chế độ xem lịch học', 'Schedule view modes')} style={{ marginBottom: 16 }}>
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
          aria-selected={view === 'week_all'}
          className={`portal-tab${view === 'week_all' ? ' active' : ''}`}
          onClick={() => setView('week_all')}
        >
          {t('Lịch tổng cả tuần', 'Full week overview')}
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
          {/* Chỉ chọn 1 trong 6 bộ môn — không có chip "Tất cả" trùng với tab Lịch tổng, không có dropdown dư thừa */}
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
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--portal-border)',
                }}
                data-testid="discipline-active-class-bar"
              >
                {activeDisciplineClass ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <strong>{activeDisciplineClass.name}</strong>
                      <span style={{ color: 'var(--portal-muted)', fontSize: 13 }}>
                        {[
                          activeDisciplineClass.roomName,
                          activeDisciplineClass.coachName,
                          t(`${activeDisciplineClass.capacity} chỗ`, `${activeDisciplineClass.capacity} seats`),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() =>
                          setCreateModal({
                            mode: 'session',
                            prefill: {
                              classId: activeDisciplineClass.id,
                              startTime: activeDisciplineClass.startTime,
                              endTime: activeDisciplineClass.endTime,
                            },
                          })
                        }
                      >
                        {t('+ Thêm buổi', '+ Add session')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setEditingClass(activeDisciplineClass)}
                      >
                        {t('Sửa lớp', 'Edit class')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--portal-muted)', fontSize: 13 }}>
                      {t(
                        `Bộ môn ${activeDiscipline.name} chưa có lớp đang hoạt động.`,
                        `${activeDiscipline.name} has no active class yet.`,
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() =>
                        setCreateModal({
                          mode: 'course',
                          prefill: { disciplineId: activeDiscipline.id },
                        })
                      }
                    >
                      {t(`+ Tạo lớp ${activeDiscipline.name}`, `+ Create ${activeDiscipline.name} class`)}
                    </button>
                  </>
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
            onSlotClick={(slot) =>
              setCreateModal({
                mode: activeDisciplineClass ? 'session' : 'course',
                prefill: {
                  ...slot,
                  disciplineId: activeDisciplineId ?? undefined,
                  classId: activeDisciplineClass?.id,
                },
              })
            }
            maxVisibleLanes={2}
            legend={legend}
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
            onSlotClick={(slot) =>
              setCreateModal({
                mode: hasAvailableDiscipline ? 'course' : 'session',
                prefill: {
                  ...slot,
                  classId: hasAvailableDiscipline ? undefined : activeClasses[0]?.id,
                },
              })
            }
            maxVisibleLanes={2}
            legend={legend}
            legendNote={t(
              'Khi khung giờ có từ 3 bộ môn học cùng lúc, lịch tự gom thành nút "+N lớp" để không đè nhau — bấm vào để xem đủ và chọn buổi.',
              'Slots with 3+ concurrent disciplines group into "+N classes" to prevent overlap — click to inspect every session.',
            )}
            emptyLabel={t('Tuần này chưa có buổi học nào', 'No sessions scheduled this week')}
          />
        </>
      ) : (
        <ClassListTable
          classes={classes}
          sessions={enrichedSessions}
          onViewClassSchedule={(cls) => {
            setSelectedDisciplineId(cls.disciplineId);
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
          classes={classes}
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
