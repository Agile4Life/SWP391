import { useEffect, useState } from 'react';
import { Modal } from '../../../shared/ui/Modal';
import { useI18n } from '../../../shared/i18n';
import { formatCenterDate, parseCenterTime } from '../../../shared/lib/centerTime';
import { formatPrice } from '../../../shared/lib/membershipPresentation';
import { formatSlotLabel } from '../../schedule/slots';
import { disciplineAccentColor } from '../../schedule/timetable';
import { classesApi, type ClassEnrolledStudent, type ClassItem, type ClassSessionDto } from '../classesApi';

interface ClassSessionDetailModalProps {
  session: ClassSessionDto;
  parentClass?: ClassItem;
  onClose: () => void;
  onReschedule: (session: ClassSessionDto) => void;
  onCancelSession: (session: ClassSessionDto) => void;
  onEditClass?: (cls: ClassItem) => void;
}

/**
 * Hộp thoại chi tiết một buổi học khi Manager bấm vào ô lịch nhỏ trên bất kỳ chế độ xem nào:
 * hiển thị đầy đủ thông tin lớp, bộ môn, phòng, HLV, sĩ số, danh sách học viên đã ghi danh và nút thao tác nhanh.
 */
export function ClassSessionDetailModal({
  session,
  parentClass,
  onClose,
  onReschedule,
  onCancelSession,
  onEditClass,
}: ClassSessionDetailModalProps) {
  const { t } = useI18n();
  const [students, setStudents] = useState<ClassEnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    setLoadingStudents(true);
    setStudentsError(null);
    void classesApi.getSessionStudents(session.id)
      .then((list) => {
        if (alive) setStudents(list);
      })
      .catch(() => {
        if (alive) setStudentsError(t('Không thể tải danh sách học viên.', 'Could not load enrolled members.'));
      })
      .finally(() => {
        if (alive) setLoadingStudents(false);
      });
    return () => { alive = false; };
  }, [session.id, t]);

  const title = session.className || parentClass?.name || t(`Lớp #${session.classId}`, `Class #${session.classId}`);
  const disciplineName = session.disciplineName || parentClass?.disciplineName || '—';
  const roomName = session.roomName || parentClass?.roomName || '—';
  const coachName = session.coachName || parentClass?.coachName || '—';
  const capacity = session.capacity ?? parentClass?.capacity ?? 0;
  const bookedCount = !loadingStudents && !studentsError
    ? Math.max(session.bookedCount ?? 0, students.length)
    : (session.bookedCount ?? students.length);
  const accent = disciplineAccentColor(session.disciplineId ?? parentClass?.disciplineId ?? disciplineName);
  const isScheduled = session.status === 'scheduled';
  const sessionStart = parseCenterTime(`${session.sessionDate}T${session.startTime}`);
  const rescheduleTooLate = isScheduled
    && sessionStart !== null
    && openedAt >= sessionStart.getTime() - 8 * 60 * 60 * 1000;

  const statusLabel = session.status === 'cancelled'
    ? t('Đã hủy', 'Cancelled')
    : session.status === 'completed'
      ? t('Đã hoàn thành', 'Completed')
      : t('Đã lên lịch', 'Scheduled');

  const statusBadgeClass = session.status === 'cancelled'
    ? 'badge-danger'
    : session.status === 'completed'
      ? 'badge-neutral'
      : 'badge-success';

  const hasActions = Boolean((parentClass && onEditClass) || isScheduled);

  const fitnessLevelLabel = (raw?: string | null): string | null => {
    if (!raw) return null;
    switch (raw.trim().toLowerCase()) {
      case 'beginner':
        return t('Cơ bản', 'Beginner');
      case 'intermediate':
        return t('Trung cấp', 'Intermediate');
      case 'advanced':
        return t('Nâng cao', 'Advanced');
      case 'all':
        return t('Mọi trình độ', 'All levels');
      default:
        return t('Cơ bản', 'Beginner');
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="kv-list" data-testid="session-detail-content">
        <div className="kv-row">
          <span>{t('Bộ môn', 'Discipline')}</span>
          <strong>
            <span className="class-discipline-dot" style={{ background: accent }} aria-hidden="true" />
            {disciplineName}
          </strong>
        </div>
        <div className="kv-row">
          <span>{t('Trạng thái', 'Status')}</span>
          <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
        </div>
        <div className="kv-row">
          <span>{t('Ngày học', 'Date')}</span>
          <strong>{formatCenterDate(session.sessionDate)}</strong>
        </div>
        <div className="kv-row">
          <span>{t('Khung giờ', 'Time')}</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatSlotLabel(session.startTime, session.endTime)}
          </strong>
        </div>
        <div className="kv-row">
          <span>{t('Phòng tập', 'Room')}</span>
          <strong>{roomName}</strong>
        </div>
        <div className="kv-row">
          <span>{t('Huấn luyện viên', 'Coach')}</span>
          <strong>{coachName}</strong>
        </div>
        <div className="kv-row">
          <span>{t('Sĩ số', 'Attendance capacity')}</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {capacity > 0 ? `${bookedCount}/${capacity}` : String(bookedCount)}
            {capacity > 0 && bookedCount >= capacity ? ` (${t('Đã đầy', 'Full')})` : ''}
          </strong>
        </div>
        {parentClass && typeof parentClass.price === 'number' && parentClass.price > 0 && (
          <div className="kv-row">
            <span>{t('Học phí ngoài gói', 'Extra course fee')}</span>
            <strong>{formatPrice(parentClass.price)}</strong>
          </div>
        )}
        {session.cancelReason && (
          <div className="kv-row">
            <span>{t('Lý do hủy', 'Cancellation reason')}</span>
            <strong>{session.cancelReason}</strong>
          </div>
        )}
        <div className="kv-row">
          <span>{t('Học viên đã ghi danh', 'Enrolled members')}</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            data-testid="session-detail-students-trigger"
            disabled={loadingStudents}
            onClick={() => setShowStudentsModal(true)}
          >
            {loadingStudents
              ? t('Đang tải…', 'Loading…')
              : studentsError
                ? t('Lỗi tải · Thử lại', 'Load failed')
                : t(`Xem danh sách (${students.length})`, `View list (${students.length})`)}
          </button>
        </div>
      </div>

      {showStudentsModal && (
        <Modal
          title={t(`Học viên đã ghi danh (${students.length})`, `Enrolled members (${students.length})`)}
          onClose={() => setShowStudentsModal(false)}
        >
          {studentsError ? (
            <p className="mcal__note" role="alert">{studentsError}</p>
          ) : students.length === 0 ? (
            <p className="mcal__note">{t('Chưa có học viên nào đăng ký buổi học này.', 'No members enrolled in this session yet.')}</p>
          ) : (
            <div className="mcal__overflow-list mcal__students-scroll" data-testid="session-detail-students">
              {students.map((st) => {
                const levelText = fitnessLevelLabel(st.fitnessLevel);
                return (
                  <div key={st.id} className="mcal__overflow-row mcal__student-row" style={{ cursor: 'default' }}>
                    <span className="mcal__overflow-main">
                      <strong>{st.fullName}</strong>
                      <small>{[st.membershipCode, st.phone, st.email].filter(Boolean).join(' · ')}</small>
                    </span>
                    {levelText && <span className="mcal__overflow-badge">{levelText}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {rescheduleTooLate && (
        <p role="note" className="portal-alert portal-alert--info" style={{ marginTop: 14, marginBottom: 0 }}>
          {t('Chỉ có thể dời lịch trước giờ bắt đầu buổi học tối thiểu 8 giờ.', 'Sessions can only be rescheduled at least 8 hours before start time.')}
        </p>
      )}

      {hasActions && (
        <div className="mcal__dialog-actions" style={{ marginTop: 18 }}>
          {parentClass && onEditClass && (
            <button type="button" className="btn-secondary" onClick={() => onEditClass(parentClass)}>
              {t('Sửa khóa học', 'Edit course')}
            </button>
          )}
          {isScheduled && (
            <button
              type="button"
              className="btn-secondary"
              disabled={rescheduleTooLate}
              title={rescheduleTooLate ? t('Chỉ có thể dời lịch trước giờ bắt đầu buổi học tối thiểu 8 giờ.', 'Sessions can only be rescheduled at least 8 hours before start time.') : undefined}
              onClick={() => onReschedule(session)}
            >
              {t('Dời lịch', 'Reschedule')}
            </button>
          )}
          {isScheduled && (
            <button type="button" className="btn-danger" onClick={() => onCancelSession(session)}>
              {t('Hủy buổi', 'Cancel session')}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
