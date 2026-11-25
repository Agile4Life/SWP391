import { useMemo, useState } from 'react';
import { useI18n } from '../../../shared/i18n';
import { formatCenterDate } from '../../../shared/lib/centerTime';
import { formatPrice } from '../../../shared/lib/membershipPresentation';
import { formatSlotLabel } from '../../schedule/slots';
import { disciplineAccentColor } from '../../schedule/timetable';
import type { ClassItem, ClassSessionDto } from '../classesApi';

interface ClassListTableProps {
  classes: ClassItem[];
  sessions: ClassSessionDto[];
  onViewClassSchedule: (cls: ClassItem) => void;
  onEditClass: (cls: ClassItem) => void;
  onDeleteClass: (cls: ClassItem) => void;
}

const DAY_LABELS: Record<string, [string, string]> = {
  MONDAY: ['T2', 'Mon'],
  TUESDAY: ['T3', 'Tue'],
  WEDNESDAY: ['T4', 'Wed'],
  THURSDAY: ['T5', 'Thu'],
  FRIDAY: ['T6', 'Fri'],
  SATURDAY: ['T7', 'Sat'],
  SUNDAY: ['CN', 'Sun'],
};

/** Bảng danh sách khóa học nhóm kèm tìm kiếm và nút xem lịch / sửa / xóa. */
export function ClassListTable({
  classes,
  sessions,
  onViewClassSchedule,
  onEditClass,
  onDeleteClass,
}: ClassListTableProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  const sessionCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of sessions) {
      if (s.status !== 'cancelled') {
        map.set(s.classId, (map.get(s.classId) ?? 0) + 1);
      }
    }
    return map;
  }, [sessions]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return classes.filter((cls) => {
      if (statusFilter === 'active' && String(cls.status).toLowerCase() !== 'active') return false;
      if (!needle) return true;
      return [cls.name, cls.disciplineName, cls.roomName, cls.coachName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [classes, search, statusFilter]);

  const formatDays = (raw?: string) => {
    if (!raw) return '—';
    return raw
      .split(',')
      .map((code) => {
        const pair = DAY_LABELS[code.trim().toUpperCase()];
        return pair ? t(pair[0], pair[1]) : code.trim();
      })
      .join(', ');
  };

  return (
    <div className="portal-card">
      <div className="class-filter-bar">
        <div className="class-filter-field" style={{ flex: '1 1 280px' }}>
          <label className="portal-label" htmlFor="cls-list-search">{t('Tìm kiếm lớp học', 'Search classes')}</label>
          <input
            id="cls-list-search"
            className="portal-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Tên lớp, bộ môn, phòng tập hoặc HLV…', 'Class, discipline, room, or coach…')}
          />
        </div>
        <div className="filter-chips" role="group" aria-label={t('Lọc trạng thái lớp', 'Filter class status')}>
          <button
            type="button"
            className={`filter-chip${statusFilter === 'active' ? ' is-active' : ''}`}
            aria-pressed={statusFilter === 'active'}
            onClick={() => setStatusFilter('active')}
          >
            {t('Đang hoạt động', 'Active')}
          </button>
          <button
            type="button"
            className={`filter-chip${statusFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          >
            {t('Tất cả (gồm ngừng mở/lưu trữ)', 'All (incl. inactive/archived)')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="portal-empty" role="status">
          <p>{t('Chưa có khóa học nào phù hợp bộ lọc.', 'No courses match the current filter.')}</p>
        </div>
      ) : (
        <div className="portal-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('Khóa học', 'Course')}</th>
                <th>{t('Bộ môn', 'Discipline')}</th>
                <th>{t('Phòng & HLV', 'Room & coach')}</th>
                <th>{t('Lịch định kỳ', 'Schedule')}</th>
                <th>{t('Sĩ số / Học phí', 'Capacity / fee')}</th>
                <th>{t('Trạng thái', 'Status')}</th>
                <th>{t('Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cls) => {
                const normalizedStatus = String(cls.status).toLowerCase();
                const isActive = normalizedStatus === 'active';
                const isArchived = normalizedStatus === 'archived';
                const accent = disciplineAccentColor(cls.disciplineId ?? cls.disciplineName);
                const count = sessionCounts.get(cls.id) ?? cls.activeSessions ?? 0;
                return (
                  <tr key={cls.id}>
                    <td>
                      <strong>{cls.name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--portal-muted)' }}>
                        {t(`${count} buổi học`, `${count} ${count === 1 ? 'session' : 'sessions'}`)}
                      </div>
                    </td>
                    <td>
                      <span className="class-discipline-dot" style={{ background: accent }} aria-hidden="true" />
                      {cls.disciplineName ?? '—'}
                    </td>
                    <td>
                      <div>{cls.roomName ?? '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--portal-muted)' }}>{cls.coachName ?? '—'}</div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <div>{formatDays(cls.recurringDays)}</div>
                      {cls.startTime && cls.endTime && (
                        <div style={{ fontSize: 12, color: 'var(--portal-muted)' }}>
                          {formatSlotLabel(cls.startTime, cls.endTime)}
                        </div>
                      )}
                      {cls.startDate && cls.endDate && (
                        <div style={{ fontSize: 12, color: 'var(--portal-muted)' }}>
                          {`${formatCenterDate(cls.startDate)} – ${formatCenterDate(cls.endDate)}`}
                        </div>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <div>{t(`${cls.capacity} chỗ`, `${cls.capacity} seats`)}</div>
                      <div style={{ fontSize: 12, color: 'var(--portal-muted)' }}>
                        {typeof cls.price === 'number' && cls.price > 0 ? formatPrice(cls.price) : t('Theo gói', 'Included')}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {isActive
                          ? t('Đang mở', 'Active')
                          : isArchived
                            ? t('Lưu trữ', 'Archived')
                            : t('Ngừng mở', 'Inactive')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {isActive && (
                          <button type="button" className="btn-secondary btn-sm" onClick={() => onViewClassSchedule(cls)}>
                            {t('Xem lịch', 'Schedule')}
                          </button>
                        )}
                        <button type="button" className="btn-secondary btn-sm" onClick={() => onEditClass(cls)}>
                          {t('Sửa', 'Edit')}
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => onDeleteClass(cls)}>
                          {t('Xóa', 'Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
