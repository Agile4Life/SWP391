import { staffTranslation, staffMessage, useStaffI18n, type StaffMessage, staffNotify as notify } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import {
  coachAssignmentsApi,
  type CoachAssignmentData,
  type CoachAssignmentOverview,
  type CoachAssignmentStudent,
} from './coachAssignmentsApi';
import { staffError as safeMessage, staffText } from '../operations/staffI18n';
import './manager-coach-assignments.css';

import { Select } from '../../shared/ui/Select';
/**
 * Huy hiệu cảnh báo vấn đề gói tập của hội viên (đang bảo lưu, hết hiệu lực...) kèm gợi ý.
 * Chỉ hiển thị thẻ ngắn khi gói tập của hội viên đang chặn việc huấn luyện; không hiển thị gì khi gói tập bình thường.
 */
function MembershipIssueTag({ issue }: { issue?: CoachAssignmentStudent['membershipIssue'] }) {
  if (!issue) return null;
  // Bảng ánh xạ vấn đề sang class màu, nhãn và gợi ý.
  const tag = {
    FROZEN: { cls: 'badge-warning', label: staffText('Đang bảo lưu', 'On hold'), hint: staffText('Gói đang bảo lưu: chưa thể đặt hoặc điều chuyển buổi tập.', 'Plan on hold: sessions cannot be booked or transferred.') },
    NO_ACTIVE: { cls: 'badge-danger', label: staffText('Hết hiệu lực gói', 'No valid plan'), hint: staffText('Hội viên không còn gói tập đang hoạt động còn hạn hôm nay.', 'The member has no active plan valid today.') },
    NOT_COVERED: { cls: 'badge-warning', label: staffText('Gói hết trước buổi PT', 'Plan ends before PT'), hint: staffText('Gói hết hạn trước buổi PT sắp tới cuối cùng.', 'The plan expires before the last upcoming PT session.') },
  }[issue];
  return <span className={`badge ${tag.cls} coach-membership-issue`} title={tag.hint}>{tag.label}</span>;
}

/** Mô tả lịch của một phân công: hạn giáo án hoặc buổi kế tiếp. */
function assignmentSchedule(student: CoachAssignmentStudent, compact = false): string | null {
  if (student.assignmentType === 'TRAINING_PLAN') {
    const date = formatCenterDate(student.endDate, '');
    return date ? (compact ? date : staffText(`Ngày kết thúc giáo án: ${date}`, `Training plan end date: ${date}`)) : null;
  }
  const next = student.nextSession ? formatCenterDateTime(student.nextSession.replace(' ', 'T'), '') || null : null;
  const count = student.sessionCount ?? 0;
  if (!next || count <= 1) return next;
  return compact ? staffText(`${next} (+${count - 1})`, `${next} (+${count - 1})`) : staffText(`${next} · ${count} buổi sắp tới`, `${next} · ${count} upcoming sessions`);
}

/** Lý do không thể điều chuyển do gói tập (backend cũng chặn); null nếu được chuyển. */
function transferBlockedHint(student: CoachAssignmentStudent): string | null {
  if (student.membershipIssue === 'FROZEN') return staffText('Gói đang bảo lưu nên chưa thể điều chuyển.', 'The plan is on hold, so it cannot be transferred yet.');
  if (student.membershipIssue === 'NO_ACTIVE') return staffText('Hội viên không còn gói tập hiệu lực nên chưa thể điều chuyển.', 'The member has no valid plan, so it cannot be transferred.');
  return null;
}

/** Nhãn trạng thái làm việc của HLV không còn hoạt động; null khi đang làm. */
function coachStatusLabel(status: string | null | undefined): string | null {
  switch ((status ?? '').toLowerCase()) {
    case 'active': case '': return null;
    case 'on_leave': return staffText('Đang nghỉ phép', 'On leave');
    case 'terminated': return staffText('Đã nghỉ việc', 'No longer employed');
    default: return staffText('Ngừng hoạt động', 'Inactive');
  }
}

/** Phân công của một hội viên (gom mọi phân công của hội viên đó). */
interface MemberAssignmentGroup {
  memberId: number;
  fullName: string;
  membershipCode: string;
  phone?: string | null;
  assignments: CoachAssignmentStudent[];
}

/**
 * Gom các phân công theo hội viên: một hội viên có thể có nhiều phân công với cùng một HLV nên hiển thị chung dưới một hồ sơ.
 */
function groupStudentsByMember(students: CoachAssignmentStudent[]): MemberAssignmentGroup[] {
  const groups = new Map<number, MemberAssignmentGroup>();
  for (const student of students) {
    const group = groups.get(student.memberId);
    if (group) group.assignments.push(student);
    else groups.set(student.memberId, {
      memberId: student.memberId,
      fullName: student.fullName,
      membershipCode: student.membershipCode,
      phone: student.phone,
      assignments: [student],
    });
  }
  return [...groups.values()];
}

/**
 * Màn quản lý phân công HLV: xem học viên của từng HLV, lọc/sắp xếp, điều chuyển giáo án hoặc buổi PT sang HLV
 * khác (kèm lý do) và kết thúc phân công.
 */
export function ManagerCoachAssignmentsPage() {
  const { t } = useStaffI18n();
  const [confirm, confirmDialog] = useConfirm();
  const loadGeneration = useRef(0);
  const [data, setData] = useState<CoachAssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage | null>(null);
  // Lỗi của thao tác (kết thúc phân công) hiện riêng, không ẩn danh sách như lỗi tải trang.
  const [actionError, setActionError] = useState<StaffMessage | null>(null);
  const [search, setSearch] = useState('');
  const [coachFilter, setCoachFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<string>('name_asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<StaffMessage | null>(null);

  const [sortBy, sortDir] = useMemo(() => {
    switch (sortOption) {
      case 'name_desc': return ['name', 'desc'];
      case 'students_desc': return ['totalStudentsCount', 'desc'];
      case 'students_asc': return ['totalStudentsCount', 'asc'];
      case 'name_asc':
      default:
        return ['name', 'asc'];
    }
  }, [sortOption]);

  // Trạng thái các hộp thoại
  const [reassignStudent, setReassignStudent] = useState<{
    student: CoachAssignmentStudent;
    currentCoachId: number;
    currentCoachName: string;
  } | null>(null);
  const [detail, setDetail] = useState<{ student: CoachAssignmentStudent; assignments: CoachAssignmentStudent[] } | null>(null);
  const selectedStudentDetail = detail?.student ?? null;

  // Trạng thái biểu mẫu điều chuyển HLV
  const [targetCoachId, setTargetCoachId] = useState<number | ''>('');
  const [reassignReason, setReassignReason] = useState('');

  // Tải tổng quan phân công; chỉ kết quả của lần gọi mới nhất được dùng.
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const res = await coachAssignmentsApi.getOverview({
        coachId: coachFilter ? Number(coachFilter) : undefined,
        search: search.trim() || undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        sortBy,
        sortDir,
      });
      if (generation === loadGeneration.current) {
        // Backend đã lọc và đếm; chỉ sắp lại tên theo đối chiếu tiếng Việt (backend so sánh không dấu-aware).
        const coaches = [...res.coaches];
        coaches.sort((a, b) => {
          const nameOrder = a.coachName.localeCompare(b.coachName, 'vi');
          const countOrder = sortOption === 'students_desc' ? b.totalStudentsCount - a.totalStudentsCount
            : sortOption === 'students_asc' ? a.totalStudentsCount - b.totalStudentsCount : 0;
          return countOrder || (sortOption === 'name_desc' ? -nameOrder : nameOrder) || a.coachId - b.coachId;
        });
        setData({ ...res, coaches });
      }
    } catch (err) {
      if (generation === loadGeneration.current) setError(safeMessage(err, 'Không thể tải danh sách HLV & học viên phụ trách'));
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [coachFilter, search, typeFilter, sortBy, sortDir, sortOption]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 200);
    // loadGeneration là bộ đếm yêu cầu, không phải DOM ref: tăng khi dọn dẹp để bỏ qua các phản hồi cũ.
    const generation = loadGeneration;
    return () => { clearTimeout(timer); generation.current += 1; };
  }, [load]);

  // Danh sách HLV có thể chọn khi điều chuyển.
  const allCoachesList = useMemo(() => {
    return data?.availableCoaches || [];
  }, [data]);

  // Điều chuyển: bắt buộc chọn HLV mới và nhập lý do, lớp học chỉ xem, không điều chuyển.
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !reassignStudent || !targetCoachId || reassignStudent.student.assignmentType !== 'TRAINING_PLAN') return;
    const reason = reassignReason.trim();
    if (!reason) {
      setFormError(staffMessage('Vui lòng nhập lý do điều chuyển để thông báo cho học viên.', staffTranslation('Vui lòng nhập lý do điều chuyển để thông báo cho học viên.')));
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await coachAssignmentsApi.reassignStudent({
        memberId: reassignStudent.student.memberId,
        fromCoachId: reassignStudent.currentCoachId,
        toCoachId: Number(targetCoachId),
        referenceId: reassignStudent.student.referenceId,
        assignmentType: 'TRAINING_PLAN',
        reason,
      });
      setReassignStudent(null);
      setTargetCoachId('');
      setReassignReason('');
      notify('Điều chuyển phân công đã chọn sang HLV mới thành công!', 'success');
      await load();
    } catch (err) {
      setFormError(safeMessage(err, 'Lỗi khi điều chuyển học viên'));
    } finally {
      setBusy(false);
    }
  };

  // Kết thúc phân công giáo án (theo id tham chiếu) sau khi xác nhận.
  const handleRemoveAssignment = async (student: CoachAssignmentStudent) => {
    if (busy || !(await confirm({ title: staffMessage('Kết thúc phân công', staffTranslation('Kết thúc phân công')), message: staffMessage(`Kết thúc phân công giáo án của ${student.fullName}? Lịch sử giáo án được giữ lại.`, `End the training plan assignment for ${student.fullName}? Training plan history will be retained.`), confirmLabel: staffMessage('Kết thúc phân công', staffTranslation('Kết thúc phân công')), danger: true }))) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await coachAssignmentsApi.removeAssignment(student.referenceId);
      notify('Đã kết thúc phân công học viên!', 'success');
      await load();
    } catch (err) {
      setActionError(safeMessage(err, 'Lỗi khi kết thúc phân công'));
    } finally {
      setBusy(false);
    }
  };

  const assignmentTypeLabel = useCallback(
    (type: CoachAssignmentStudent['assignmentType'], fallback?: string): string => {
      switch (type) {
        case 'PT_1_1':
          return t('Kèm riêng 1:1', '1:1 PT');
        case 'TRAINING_PLAN':
          return t('Giáo án riêng', 'Training plan');
        case 'CLASS':
          return t('Lớp học nhóm', 'Group class');
        default:
          return fallback || type;
      }
    },
    [t],
  );

  const openTransfer = (student: CoachAssignmentStudent, coachId: number, coachName: string) => {
    setFormError(null); setTargetCoachId(''); setReassignReason('');
    setReassignStudent({ student, currentCoachId: coachId, currentCoachName: coachName });
  };

  // Chỉ giáo án được điều chuyển: PT 1:1 luôn ở với HLV hội viên đã đặt, lớp nhóm chỉ xem. Gói chặn thì khóa nút kèm lý do.
  const transferButton = (student: CoachAssignmentStudent, coachId: number, coachName: string) => {
    if (student.assignmentType !== 'TRAINING_PLAN') return null;
    const blocked = transferBlockedHint(student);
    return (
      <button
        type="button"
        className="btn-secondary btn-sm coach-action-btn"
        disabled={busy || Boolean(blocked)}
        title={blocked ?? undefined}
        onClick={() => openTransfer(student, coachId, coachName)}
      >
        {t('Chuyển giáo án', 'Transfer plan')}</button>
    );
  };

  // Danh sách phẳng cho chế độ xem bảng: làm phẳng học viên của mọi HLV thành một danh sách kèm thông tin HLV.
  const flattenedStudents = useMemo(() => {
    if (!data?.coaches) return [];
    return data.coaches.flatMap((coach) =>
      coach.students.map((student) => ({
        ...student,
        coachId: coach.coachId,
        coachName: coach.coachName,
      }))
    );
  }, [data]);

  return (
    <div data-i18n-managed className="portal-container coach-assignments-page">
      <PageHeader
        title={t("HLV & học viên phụ trách")}
      />

      {confirmDialog}

      {error && (
        <div data-i18n-managed className="portal-alert portal-alert--error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>{t(error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>{t("Thử lại", "Retry")}</button>
        </div>
      )}

      {actionError && (
        <div data-i18n-managed className="portal-alert portal-alert--error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>{t(actionError)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setActionError(null)}>{t('Đóng', 'Dismiss')}</button>
        </div>
      )}

      {/* Các thẻ KPI tổng quan */}
      {!error && data && <section className="metrics-grid coach-assignments-stats" aria-label={t("Thống kê tổng quan")}>
        <div className="metric-card coach-stat-card">
          <span className="metric-label">{t('Học viên đang phụ trách', 'Members in charge')}</span>
          <span className="metric-value">{data?.stats.totalAssignedStudents ?? 0}</span>
        </div>
        <div className="metric-card coach-stat-card">
          <span className="metric-label">{t("Học viên tập 1:1 (PT)")}</span>
          <span className="metric-value">{data?.stats.totalPtStudents ?? 0}</span>
        </div>
        <div className="metric-card coach-stat-card">
          <span className="metric-label">{t("Theo giáo án riêng")}</span>
          <span className="metric-value">{data?.stats.totalPlanStudents ?? 0}</span>
        </div>
        <div className="metric-card coach-stat-card">
          <span className="metric-label">{t('Học viên lớp nhóm', 'Group class members')}</span>
          <span className="metric-value">{data?.stats.totalClassStudents ?? 0}</span>
        </div>
      </section>}

      {/* Thanh công cụ: Bộ lọc, Tìm kiếm, Chuyển đổi chế độ xem */}
      <section className="portal-card coach-assignments-toolbar" aria-label={t("Bộ lọc và tìm kiếm")}>
        <div className="coach-assignments-filters">
          <input
            type="search"
            className="portal-input coach-search-input"
            placeholder={t("Tìm theo tên HLV, học viên, mã thẻ, SĐT...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("Tìm kiếm")}
          />

          <Select
            className="coach-filter-select"
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            aria-label={t("Lọc theo Huấn luyện viên")}
          >
            <option value="">{data ? t(`Tất cả HLV (${data.stats.activeCoaches} đang hoạt động)`, `All coaches (${data.stats.activeCoaches} active)`) : t("Tất cả Huấn luyện viên")}</option>
            {allCoachesList.map((c) => (
              <option data-i18n-managed key={c.coachId} value={c.coachId}>
                {c.coachName}
              </option>
            ))}
          </Select>

          <Select
            className="coach-filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label={t("Lọc theo hình thức")}
          >
            <option value="ALL">{t("Tất cả hình thức")}</option>
            <option value="TRAINING_PLAN">{t("Theo giáo án riêng")}</option>
            <option value="PT_1_1">{t("Tập 1:1 với HLV (PT)")}</option>
            <option value="CLASS">{t("Lớp học nhóm")}</option>
          </Select>

          <Select
            className="coach-filter-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            aria-label={t("Sắp xếp danh sách HLV", "Sort coaches list")}
            data-testid="coach-sort-select"
          >
            <option value="name_asc">{t("Tên HLV (A–Z)", "Coach name (A–Z)")}</option>
            <option value="name_desc">{t("Tên HLV (Z–A)", "Coach name (Z–A)")}</option>
            <option value="students_desc">{t("Số học viên khác nhau (Nhiều nhất)", "Distinct members (Highest)")}</option>
            <option value="students_asc">{t("Số học viên khác nhau (Ít nhất)", "Distinct members (Lowest)")}</option>
          </Select>
        </div>

        <div className="portal-switch coach-view-toggle" role="group" aria-label={t("Cách hiển thị")}>
          <button
            type="button"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
          >
            {t("Theo HLV")}</button>
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
          >
            {t("Bảng danh sách")}</button>
        </div>
      </section>

      {/* Khu vực hiển thị chính */}
      {loading && !data ? (
        <LoadingSkeleton label={t("Đang tải dữ liệu HLV và học viên...")} count={4} />
      ) : error ? null : !data || data.coaches.length === 0 ? (
        <div data-i18n-managed className="portal-empty">
          <h3>{t("Không tìm thấy dữ liệu")}</h3>
          <p>{t("Không có kết quả phù hợp.")}</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Chế độ xem thẻ theo từng HLV */
        <div data-i18n-managed className="coach-cards-grid">
          {data.coaches.map((coach: CoachAssignmentOverview) => (
            <article data-i18n-managed key={coach.coachId} className="portal-card portal-card--flush coach-card-panel">
              <header className="coach-card-header">
                <div className="coach-info-main">
                  <div className="coach-avatar-badge" aria-hidden="true">
                    {coach.coachName.charAt(0).toUpperCase()}
                  </div>
                  <div className="coach-text-details">
                    <h3>{coach.coachName}{coachStatusLabel(coach.employmentStatus) && <> <span className="badge badge-warning">{coachStatusLabel(coach.employmentStatus)}</span></>}</h3>
                    <div className="coach-meta-row">
                      {coach.specialization && <span>{coach.specialization}</span>}
                      {coach.coachPhone && <span>{coach.coachPhone}</span>}
                      {coach.coachEmail && <span>{coach.coachEmail}</span>}
                    </div>
                  </div>
                </div>

                <div className="coach-student-pills">
                  <span className="student-count-pill">
                    <strong>{coach.totalStudentsCount}</strong> {t('tổng học viên', 'total members')}
                  </span>
                  <span className="student-count-pill">
                    <strong>{coach.ptStudentsCount}</strong> PT 1:1
                  </span>
                  <span className="student-count-pill">
                    <strong>{coach.planStudentsCount}</strong> {t('Giáo án', 'Training plans')}
                  </span>
                  <span className="student-count-pill">
                    <strong>{coach.classStudentsCount}</strong> {t('Lớp nhóm', 'Group classes')}
                  </span>
                </div>
              </header>

              {coach.students.length === 0 ? (
                <div data-i18n-managed style={{ padding: '1.25rem', color: 'var(--portal-muted)', fontSize: '0.9rem' }}>
                  {t("HLV hiện chưa có học viên nào trong danh mục lọc này.")}</div>
              ) : (
                <div data-i18n-managed className="coach-students-list">
                  {groupStudentsByMember(coach.students).map((group) => (
                    <div data-i18n-managed key={group.memberId} className="coach-student-row">
                      <div className="coach-student-profile">
                        <div className="student-avatar-circle">
                          {group.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="student-name-block">
                          <strong>{group.fullName}</strong>
                          <small>{group.membershipCode} {group.phone ? `• ${group.phone}` : ''}</small>
                          <button
                            type="button"
                            className="btn-secondary btn-sm coach-action-btn coach-profile-detail"
                            onClick={() => setDetail({ student: group.assignments[0], assignments: group.assignments })}
                          >
                            {t("Chi tiết")}</button>
                        </div>
                      </div>

                      <div className="coach-student-assignments">
                        {group.assignments.map((student) => (
                          <div data-i18n-managed key={`${student.assignmentType}-${student.referenceId}`} className="coach-assignment-line">
                            <span
                              className={`coach-student-type-pill coach-student-type-pill--${
                                student.assignmentType === 'PT_1_1'
                                  ? 'pt'
                                  : student.assignmentType === 'TRAINING_PLAN'
                                  ? 'plan'
                                  : 'class'
                              }`}
                            >
                              {assignmentTypeLabel(student.assignmentType, student.assignmentTypeLabel)}
                            </span>

                            <div className="coach-student-detail">
                              <div>{student.detail || null} <MembershipIssueTag issue={student.membershipIssue} /></div>
                              {assignmentSchedule(student) && (
                                <small data-i18n-managed style={{ color: 'var(--portal-salmon)', display: 'block', marginTop: '0.2rem' }}>
                                  {assignmentSchedule(student)}
                                </small>
                              )}
                            </div>

                            <div className="coach-student-actions">
                              {transferButton(student, coach.coachId, coach.coachName)}
                              {student.assignmentType === 'TRAINING_PLAN' && (
                                <button data-i18n-managed
                                  type="button"
                                  className="btn-danger btn-sm coach-action-btn"
                                  disabled={busy}
                                  onClick={() => void handleRemoveAssignment(student)}
                                >
                                  {t("Kết thúc")}</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        /* Chế độ xem bảng */
        <div data-i18n-managed className="portal-card portal-card--flush portal-table-wrapper coach-table-container">
          <table className="portal-table coach-table">
            <thead>
              <tr>
                <th>{t("Học viên")}</th>
                <th>{t("HLV phụ trách")}</th>
                <th>{t("Hình thức")}</th>
                <th>{t("Chi tiết & Mục tiêu")}</th>
                <th>{t('Hết hạn giáo án / Buổi kế tiếp', 'Plan end / Next session')}</th>
                <th>{t("Thao tác")}</th>
              </tr>
            </thead>
            <tbody>
              {flattenedStudents.map((item) => (
                <tr data-i18n-managed key={`table-${item.assignmentType}-${item.referenceId}-${item.memberId}-${item.coachId}`}>
                  <td>
                    <strong>{item.fullName}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--portal-muted)' }}>
                      {item.membershipCode} {item.phone ? `• ${item.phone}` : ''}
                    </div>
                  </td>
                  <td>
                    <strong>{item.coachName}</strong>
                  </td>
                  <td>
                    <span
                      className={`coach-student-type-pill coach-student-type-pill--${
                        item.assignmentType === 'PT_1_1'
                          ? 'pt'
                          : item.assignmentType === 'TRAINING_PLAN'
                          ? 'plan'
                          : 'class'
                      }`}
                    >
                      {assignmentTypeLabel(item.assignmentType, item.assignmentTypeLabel)}
                    </span>
                  </td>
                  <td>{item.detail || '—'} <MembershipIssueTag issue={item.membershipIssue} /></td>
                  <td>{assignmentSchedule(item, true) || t('Chưa có thông tin', 'Not available')}</td>
                  <td>
                    <div className="coach-student-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm coach-action-btn"
                        onClick={() => setDetail({ student: item, assignments: flattenedStudents.filter((s) => s.memberId === item.memberId && s.coachId === item.coachId) })}
                      >
                        {t("Chi tiết")}</button>
                      {transferButton(item, item.coachId, item.coachName)}
                      {item.assignmentType === 'TRAINING_PLAN' && <button type="button" className="btn-danger btn-sm coach-action-btn" disabled={busy} onClick={() => void handleRemoveAssignment(item)}>{t("Kết thúc")}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hộp thoại 2: Điều chuyển HLV cho học viên */}
      {reassignStudent && (
        <Modal
          title={t(`Chuyển giáo án của học viên: ${reassignStudent.student.fullName}`, `Transfer training plan for member: ${reassignStudent.student.fullName}`)}
          busy={busy}
          onClose={() => setReassignStudent(null)}
        >
          <form className="coach-modal-form" onSubmit={(e) => void handleReassignSubmit(e)}>
            <fieldset disabled={busy}>
            {formError && <p className="portal-alert portal-alert--error" role="alert">{t(formError)}</p>}
            <p>{t('Chỉ chuyển giáo án được chọn. Buổi PT 1:1 luôn do HLV hội viên đã đặt phụ trách và không thay đổi.', 'Only the selected training plan transfers. 1:1 PT sessions always stay with the coach the member booked.')}</p>
            <div className="coach-form-group">
              <label>{t("Học viên")}</label>
              <input
                type="text"
                className="coach-form-control"
                value={`${reassignStudent.student.fullName} (${reassignStudent.student.membershipCode})`}
                disabled
              />
            </div>

            <div className="coach-form-group">
              <label>{t("HLV hiện tại")}</label>
              <input
                type="text"
                className="coach-form-control"
                value={reassignStudent.currentCoachName}
                disabled
              />
            </div>

            <div className="coach-form-group">
              <label htmlFor="reassign-target-coach">{t("Chọn Huấn luyện viên tiếp nhận mới *")}</label>
              <Select
                id="reassign-target-coach"
                className="coach-form-control"
                value={String(targetCoachId)}
                onChange={(e) => setTargetCoachId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">{t("-- Chọn HLV mới --")}</option>
                {allCoachesList
                  .filter((c) => c.coachId !== reassignStudent.currentCoachId)
                  .map((c) => (
                    <option data-i18n-managed key={c.coachId} value={c.coachId}>
                      {c.specialization ? `${c.coachName} — ${c.specialization}` : c.coachName}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="coach-form-group">
              <label htmlFor="reassign-reason">{t("Lý do điều chuyển *")}</label>
              <textarea
                id="reassign-reason"
                className="coach-form-control"
                rows={3}
                required
                maxLength={500}
                placeholder={t("Nhập lý do điều chuyển (vd: HLV cũ nghỉ phép, điều chỉnh lịch tập...)")}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
              />
              <small className="coach-form-hint">{t('Lý do này sẽ được gửi tới học viên qua thông báo trong ứng dụng.', 'The reason will be sent to the member in an in-app notification.')}</small>
            </div>

            <div className="coach-modal-actions">
              <button
                type="button"
                className="btn-secondary coach-action-btn"
                onClick={() => setReassignStudent(null)}
                disabled={busy}
              >
                {t("Hủy")}</button>
              <button
                type="submit"
                className="btn-primary coach-action-btn"
                disabled={busy || !targetCoachId || !reassignReason.trim()}
              >
                {busy ? t('Đang điều chuyển…') : t('Xác nhận điều chuyển')}
              </button>
            </div>
            </fieldset>
          </form>
        </Modal>
      )}

      {/* Hộp thoại 3: Chi tiết học viên */}
      {selectedStudentDetail && (
        <Modal
          title={t(`Hồ sơ học viên: ${selectedStudentDetail.fullName}`, `Member profile: ${selectedStudentDetail.fullName}`)}
          onClose={() => setDetail(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Mã hội viên")}</small>
                <strong>{selectedStudentDetail.membershipCode}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Số điện thoại")}</small>
                <span>{selectedStudentDetail.phone || t('Chưa cập nhật')}</span>
              </div>
              <div>
                <small style={{ color: 'var(--portal-muted)', display: 'block' }}>Email</small>
                <span>{selectedStudentDetail.email || t('Chưa cập nhật')}</span>
              </div>
              <div>
                <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Trình độ thể lực")}</small>
                <span>{({ beginner: t('Mới bắt đầu', 'Beginner'), intermediate: t('Trung cấp', 'Intermediate'), advanced: t('Nâng cao', 'Advanced') } as Record<string, string>)[selectedStudentDetail.fitnessLevel?.toLowerCase() ?? ''] || t('Chưa cập nhật', 'Not provided')}</span>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Mục tiêu luyện tập")}</small>
              <p style={{ margin: '0.2rem 0', fontWeight: 500, color: 'var(--portal-paper)' }}>
                {selectedStudentDetail.fitnessGoal || (selectedStudentDetail.assignmentType === 'TRAINING_PLAN' ? selectedStudentDetail.detail : null) || t('Chưa cập nhật', 'Not provided')}
              </p>
            </div>

            <div>
              <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Ghi chú sức khỏe & Tiền sử")}</small>
              <p style={{ margin: '0.2rem 0', color: selectedStudentDetail.healthNotes ? 'var(--portal-warning)' : 'var(--portal-muted)' }}>
                {selectedStudentDetail.healthNotes || t('Không có ghi chú bệnh lý đặc biệt.')}
              </p>
            </div>

            <div>
              <small style={{ color: 'var(--portal-muted)', display: 'block' }}>{t("Hình thức & Lịch tập")}</small>
              {(detail?.assignments ?? []).map((assignment) => (
                <div data-i18n-managed key={`${assignment.assignmentType}-${assignment.referenceId}`} style={{ marginTop: '0.25rem' }}>
                  <span
                    className={`coach-student-type-pill coach-student-type-pill--${
                      assignment.assignmentType === 'PT_1_1'
                        ? 'pt'
                        : assignment.assignmentType === 'TRAINING_PLAN'
                        ? 'plan'
                        : 'class'
                    }`}
                  >
                    {assignmentTypeLabel(assignment.assignmentType, assignment.assignmentTypeLabel)}
                  </span>{' '}
                  <span style={{ marginLeft: '0.5rem' }}>
                    {[assignment.detail, assignmentSchedule(assignment)].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="coach-modal-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary coach-action-btn"
                onClick={() => setDetail(null)}
              >
                {t("Đóng")}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
