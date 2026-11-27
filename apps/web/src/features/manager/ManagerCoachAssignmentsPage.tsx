import { useStaffI18n, type StaffMessage } from '../operations/staffI18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
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
    FROZEN: { cls: 'badge-warning', label: staffText('Đang bảo lưu', 'On hold'), hint: staffText('Gói đang bảo lưu: chưa thể đặt buổi tập.', 'Plan on hold: sessions cannot be booked.') },
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
 * Màn phân công HLV (chỉ xem): học viên của từng HLV theo giáo án, PT 1:1, lớp nhóm; lọc/sắp xếp và xem hồ sơ.
 * Không có điều chuyển hay kết thúc: hội viên do HLV nào đảm nhận thì đi theo HLV đó đến hết.
 */
export function ManagerCoachAssignmentsPage() {
  const { t } = useStaffI18n();
  const loadGeneration = useRef(0);
  const [data, setData] = useState<CoachAssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage | null>(null);
  const [search, setSearch] = useState('');
  const [coachFilter, setCoachFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<string>('name_asc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

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

  // Hộp thoại hồ sơ học viên
  const [detail, setDetail] = useState<{ student: CoachAssignmentStudent; assignments: CoachAssignmentStudent[] } | null>(null);
  const selectedStudentDetail = detail?.student ?? null;

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

  // Danh sách HLV đang hoạt động cho ô lọc.
  const allCoachesList = useMemo(() => {
    return data?.availableCoaches || [];
  }, [data]);

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

      {error && (
        <div data-i18n-managed className="portal-alert portal-alert--error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>{t(error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>{t("Thử lại", "Retry")}</button>
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
                <th>{t("Hồ sơ", "Profile")}</th>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hộp thoại: Chi tiết học viên */}
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
