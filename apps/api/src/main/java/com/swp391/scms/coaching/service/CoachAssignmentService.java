package com.swp391.scms.coaching.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.AuditLog;
import com.swp391.scms.audit.AuditLogRepository;
import com.swp391.scms.coaching.dto.*;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Quản lý phân công HLV cho quản lý trung tâm: xem HLV và học viên hiện tại (giáo án, PT 1:1, lớp nhóm cũ),
 * chuyển giáo án sang HLV khác (PT 1:1 gắn cố định với HLV đã đặt), kết thúc phân công giáo án; ghi audit.
 */
@Service
@Transactional
public class CoachAssignmentService {
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final TrainingPlanRepository trainingPlanRepository;
    private final CoachBookingRepository coachBookingRepository;
    private final ClassEnrollmentRepository classEnrollmentRepository;
    private final SessionBookingRepository sessionBookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final AuditLogRepository auditRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    /** Constructor Spring dùng. */
    public CoachAssignmentService(CoachRepository coachRepository, MemberRepository memberRepository,
            TrainingPlanRepository trainingPlanRepository, CoachBookingRepository coachBookingRepository,
            ClassEnrollmentRepository classEnrollmentRepository, SessionBookingRepository sessionBookingRepository,
            ClassSessionRepository classSessionRepository,
            MembershipSubscriptionRepository subscriptionRepository, NotificationService notificationService,
            MessageService messageService, AuditLogRepository auditRepository, ObjectMapper objectMapper, Clock clock) {
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.trainingPlanRepository = trainingPlanRepository;
        this.coachBookingRepository = coachBookingRepository;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.sessionBookingRepository = sessionBookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.auditRepository = auditRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** Ngày hôm nay. */
    private LocalDate today() { return LocalDate.now(clock); }
    /** Dịch mã thông báo trong nhóm manager.coach_assignments. */
    private String msg(String key, Object... args) { return messageService == null ? "manager.coach_assignments." + key : messageService.getMessage("manager.coach_assignments." + key, args); }
    /** Lỗi 400 với mã lỗi và message key trong nhóm manager.coach_assignments. */
    private BadRequestException invalid(String code, String key) { return new BadRequestException(code, "manager.coach_assignments." + key, null, msg(key)); }

    /** Tổng quan phân công (không sắp xếp). */
    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long filterCoachId, String search, String assignmentType) {
        return getOverview(filterCoachId, search, assignmentType, null, null);
    }

    /**
     * Tổng quan phân công: mỗi HLV đang làm việc kèm học viên hiện tại theo loại (giáo án, PT 1:1, lớp; gộp
     * đăng ký cả khóa và đặt từng buổi của cùng lớp thành một), lọc theo HLV, loại, từ khóa và sắp xếp; kèm
     * danh sách HLV để chọn khi chuyển.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long filterCoachId, String search, String assignmentType,
                                           String sortBy, String sortDir) {
        List<Coach> availableCoaches = coachRepository.findActiveWithUser();
        // HLV nghỉ phép/nghỉ việc vẫn được liệt kê (chỉ làm nguồn) khi còn học viên, để quản lý chuyển học viên đi.
        Set<Long> activeIds = new HashSet<>();
        availableCoaches.forEach(c -> activeIds.add(c.getUserId()));
        List<Coach> listedCoaches = new ArrayList<>(availableCoaches);
        coachRepository.findAll().stream().filter(c -> !activeIds.contains(c.getUserId()) && c.getUser() != null).forEach(listedCoaches::add);
        Map<String, String> issueCache = new HashMap<>();
        Map<Long, List<com.swp391.scms.scheduling.entity.ClassSession>> classSchedule = new HashMap<>();
        LocalDate date = today();
        LocalTime time = LocalTime.now(clock);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        boolean matchesCoachName = !query.isEmpty() && listedCoaches.stream()
                .filter(c -> filterCoachId == null || filterCoachId.equals(c.getUserId()))
                .anyMatch(c -> safeText(c.getUser().getFullName()).toLowerCase(Locale.ROOT).contains(query));
        String type = assignmentType == null ? "ALL" : assignmentType.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "TRAINING_PLAN", "PT_1_1", "CLASS").contains(type)) throw invalid("INVALID_ASSIGNMENT_TYPE", "invalid_type");
        List<CoachAssignmentOverviewDto> coaches = new ArrayList<>();
        Set<Long> allStudents = new HashSet<>(), allPt = new HashSet<>(), allPlans = new HashSet<>(), allClasses = new HashSet<>();
        for (Coach coach : listedCoaches) {
            boolean coachActive = activeIds.contains(coach.getUserId());
            if (filterCoachId != null && !filterCoachId.equals(coach.getUserId())) continue;
            boolean coachMatches = !query.isEmpty() && safeText(coach.getUser().getFullName()).toLowerCase(Locale.ROOT).contains(query);
            if (matchesCoachName && !coachMatches) continue;
            Long coachId = coach.getUserId();
            List<CoachAssignmentStudentDto> rows = new ArrayList<>();
            for (TrainingPlan plan : trainingPlanRepository.findCurrentAssignments(coachId, date)) {
                rows.add(student(plan.getMember(), "TRAINING_PLAN", plan.getGoal(), plan.getStartDate(),
                        plan.getEndDate(), plan.getEndDate().toString(), plan.getStatus(), plan.getId(), null, issueCache));
            }
            // Gộp mọi buổi PT sắp tới của một hội viên thành một dòng: buổi kế tiếp, buổi cuối và số buổi.
            Map<Long, List<CoachBooking>> ptByMember = new LinkedHashMap<>();
            for (CoachBooking booking : coachBookingRepository.findCurrentAssignments(coachId, date, time)) {
                ptByMember.computeIfAbsent(booking.getMember().getUserId(), id -> new ArrayList<>()).add(booking);
            }
            for (List<CoachBooking> sessions : ptByMember.values()) {
                CoachBooking next = sessions.getFirst();
                String disciplines = String.join(", ", sessions.stream().map(CoachBooking::getDiscipline)
                        .filter(Objects::nonNull).map(d -> d.getName()).distinct().toList());
                rows.add(student(next.getMember(), "PT_1_1", disciplines.isEmpty() ? null : disciplines,
                        next.getBookingDate(), sessions.getLast().getBookingDate(), next.getBookingDate() + " " + next.getStartTime(),
                        next.getStatus(), next.getId(), sessions.size(), issueCache));
            }
            // Gộp đăng ký cả khóa và đặt từng buổi thành một quan hệ lớp/hội viên duy nhất.
            Set<String> classMembers = new HashSet<>();
            for (var enrollment : classEnrollmentRepository.findCurrentCoachAssignments(coachId, date, time)) {
                Long classId = enrollment.getGymClass().getId();
                if (classMembers.add(classId + ":" + enrollment.getMember().getUserId())) {
                    // Ghi danh cả khóa: lấy lịch từ các buổi còn sắp tới của lớp (buổi kế tiếp → buổi cuối).
                    var upcoming = classSchedule.computeIfAbsent(classId, id -> classSessionRepository.findByGymClassIdOrderBySessionDateAscStartTimeAsc(id).stream()
                            .filter(cs -> "scheduled".equals(cs.getStatus()) && cs.getSessionDate() != null && cs.getStartTime() != null
                                    && cs.getSessionDate().atTime(cs.getStartTime()).isAfter(date.atTime(time))).toList());
                    var first = upcoming.isEmpty() ? null : upcoming.getFirst();
                    rows.add(student(enrollment.getMember(), "CLASS", enrollment.getGymClass().getName(),
                            first == null ? null : first.getSessionDate(), first == null ? null : upcoming.getLast().getSessionDate(),
                            first == null ? null : first.getSessionDate() + " " + first.getStartTime(),
                            enrollment.getStatus(), classId, upcoming.isEmpty() ? null : upcoming.size(), issueCache));
                }
            }
            for (var booking : sessionBookingRepository.findCurrentCoachAssignments(coachId, date, time)) {
                var session = booking.getSession();
                if (classMembers.add(session.getGymClass().getId() + ":" + booking.getMember().getUserId())) {
                    rows.add(student(booking.getMember(), "CLASS", session.getGymClass().getName(), session.getSessionDate(),
                            session.getSessionDate(), session.getSessionDate() + " " + session.getStartTime(), booking.getStatus(), session.getGymClass().getId(), null, issueCache));
                }
            }
            List<CoachAssignmentStudentDto> filtered = rows.stream()
                    .filter(s -> "ALL".equals(type) || type.equals(s.assignmentType()))
                    .filter(s -> query.isEmpty() || searchable(s, coach).contains(query)).toList();
            if (!query.isEmpty() && !coachMatches && filtered.isEmpty()) continue;
            // HLV không còn hoạt động chỉ hiện khi còn học viên; khi lọc theo loại thì ẩn HLV không có dòng nào.
            if (filtered.isEmpty() && (!coachActive || (!"ALL".equals(type) && filterCoachId == null))) continue;
            Set<Long> pt = studentsOfType(filtered, "PT_1_1"), plans = studentsOfType(filtered, "TRAINING_PLAN"), classes = studentsOfType(filtered, "CLASS");
            Set<Long> distinct = new HashSet<>();
            filtered.forEach(s -> distinct.add(s.memberId()));
            allStudents.addAll(distinct); allPt.addAll(pt); allPlans.addAll(plans); allClasses.addAll(classes);
            coaches.add(new CoachAssignmentOverviewDto(coachId, coach.getUser().getFullName(), coach.getUser().getEmail(),
                    coach.getUser().getPhone(), coach.getSpecialization(), coach.getBio(), coach.getEmploymentStatus(),
                    distinct.size(), pt.size(), plans.size(), classes.size(), filtered));
        }
        sortCoaches(coaches, sortBy, sortDir);
        int totalCoaches = (int) Math.max(coachRepository.count(), availableCoaches.size());
        return Map.of("coaches", coaches, "availableCoaches", availableCoaches.stream()
                        .map(c -> new CoachAssignmentCoachOptionDto(c.getUserId(), c.getUser().getFullName(), c.getSpecialization())).toList(),
                "stats", new CoachAssignmentSummaryStatsDto(totalCoaches, availableCoaches.size(), allStudents.size(), allPt.size(), allPlans.size(), allClasses.size()));
    }

    /** Sắp xếp danh sách HLV theo trường và chiều (asc/desc) được chọn; không chọn thì giữ nguyên. */
    private void sortCoaches(List<CoachAssignmentOverviewDto> coaches, String sortBy, String sortDir) {
        boolean hasSortBy = sortBy != null && !sortBy.isBlank();
        boolean hasSortDir = sortDir != null && !sortDir.isBlank();
        if (!hasSortBy && !hasSortDir) {
            return;
        }

        String normalizedDir = hasSortDir ? sortDir.trim().toLowerCase(Locale.ROOT) : "asc";
        if (!"asc".equals(normalizedDir) && !"desc".equals(normalizedDir)) {
            throw invalid("INVALID_SORT_DIRECTION", "invalid_sort_dir");
        }

        String normalizedKey = hasSortBy ? sortBy.trim().toLowerCase(Locale.ROOT) : "name";
        Comparator<CoachAssignmentOverviewDto> primary = switch (normalizedKey) {
            case "name", "coachname", "fullname" ->
                    Comparator.comparing(c -> safeText(c.coachName()), String.CASE_INSENSITIVE_ORDER);
            case "students", "totalstudents", "totalstudentscount", "studentcount" ->
                    Comparator.comparingInt(CoachAssignmentOverviewDto::totalStudentsCount);
            case "pt", "ptstudents", "ptstudentscount" ->
                    Comparator.comparingInt(CoachAssignmentOverviewDto::ptStudentsCount);
            case "plans", "planstudents", "planstudentscount" ->
                    Comparator.comparingInt(CoachAssignmentOverviewDto::planStudentsCount);
            case "classes", "classstudents", "classstudentscount" ->
                    Comparator.comparingInt(CoachAssignmentOverviewDto::classStudentsCount);
            case "specialization" ->
                    Comparator.comparing(c -> safeText(c.specialization()), String.CASE_INSENSITIVE_ORDER);
            case "status", "employmentstatus" ->
                    Comparator.comparing(c -> safeText(c.employmentStatus()), String.CASE_INSENSITIVE_ORDER);
            default -> throw invalid("INVALID_SORT_FIELD", "invalid_sort");
        };

        if ("desc".equals(normalizedDir)) {
            primary = primary.reversed();
        }

        coaches.sort(primary
                .thenComparing(c -> safeText(c.coachName()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(CoachAssignmentOverviewDto::coachId, Comparator.nullsLast(Long::compareTo)));
    }

    /** Chuỗi null thành rỗng, bỏ khoảng trắng hai đầu. */
    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    /** Id các học viên có phân công thuộc một loại. */
    private Set<Long> studentsOfType(List<CoachAssignmentStudentDto> rows, String type) {
        Set<Long> ids = new HashSet<>();
        rows.stream().filter(s -> type.equals(s.assignmentType())).forEach(s -> ids.add(s.memberId()));
        return ids;
    }

    /** Chuỗi dùng để tìm kiếm: họ tên, mã hội viên, SĐT, email của học viên và tên HLV. */
    private String searchable(CoachAssignmentStudentDto row, Coach coach) {
        return String.join(" ", Objects.toString(row.fullName(), ""), Objects.toString(row.membershipCode(), ""),
                Objects.toString(row.phone(), ""), Objects.toString(row.email(), ""), Objects.toString(row.detail(), ""),
                Objects.toString(coach.getUser().getFullName(), "")).toLowerCase(Locale.ROOT);
    }

    /**
     * Tạo dòng học viên trong tổng quan: thông tin liên hệ, mục tiêu, loại phân công, chi tiết, thời gian, buổi
     * tới, trạng thái, id tham chiếu (buổi PT kế tiếp với PT_1_1), vấn đề về gói và số buổi PT sắp tới.
     */
    private CoachAssignmentStudentDto student(Member member, String type, String detail, LocalDate start, LocalDate end,
            String nextSession, String status, Long referenceId, Integer sessionCount,
            Map<String, String> issueCache) {
        var user = member.getUser();
        return new CoachAssignmentStudentDto(member.getUserId(), member.getMembershipCode(), user.getFullName(), user.getPhone(),
                user.getEmail(), user.getAvatarUrl(), member.getFitnessGoal(), member.getFitnessLevel(), member.getHealthNotes(),
                type, msg("type." + type), detail, start, end, nextSession, status, referenceId,
                // Với PT, gói phải bao phủ tới buổi cuối cùng.
                membershipIssue(member.getUserId(), type, end, issueCache), sessionCount);
    }

    /**
     * Lý do gói của hội viên đang chặn việc huấn luyện ở thời điểm hiện tại: FROZEN (đang bảo lưu), NO_ACTIVE (không
     * có gói hiệu lực), hoặc NOT_COVERED (buổi PT nằm ngoài thời hạn gói); null nếu không có vấn đề (trang chỉ hiện
     * nhãn khi khác null).
     */
    private String membershipIssue(Long memberId, String type, LocalDate sessionDate, Map<String, String> cache) {
        // Một hội viên thường xuất hiện ở nhiều dòng/HLV: nhớ kết quả trong lần tải để tránh lặp truy vấn gói.
        String key = memberId + ":" + ("PT_1_1".equals(type) ? sessionDate : "");
        if (cache.containsKey(key)) return cache.get(key);
        String issue = computeMembershipIssue(memberId, type, sessionDate);
        cache.put(key, issue);
        return issue;
    }

    /** Tính lý do gói chặn huấn luyện (xem membershipIssue). */
    private String computeMembershipIssue(Long memberId, String type, LocalDate sessionDate) {
        if (!subscriptionRepository.findByMemberUserIdAndStatus(memberId, "frozen").isEmpty()) return "FROZEN";
        if (!subscriptionRepository.hasActiveMembership(memberId, today())) return "NO_ACTIVE";
        if ("PT_1_1".equals(type) && sessionDate != null
                && !subscriptionRepository.hasActiveMembershipCoveringSession(memberId, today(), sessionDate)) return "NOT_COVERED";
        return null;
    }

    /**
     * Chuyển giáo án sang HLV khác: bắt buộc lý do, hai HLV phải khác nhau, HLV mới đang làm, hội viên còn gói;
     * giáo án phải active còn hạn và HLV mới chưa có giáo án active khác cho hội viên. PT 1:1 không điều chuyển:
     * hội viên đặt PT với HLV nào thì chỉ tập với HLV đó. Gửi thông báo và ghi audit.
     */
    public void reassignStudent(CoachAssignmentReassignDto dto) {
        if (dto.referenceId() == null || !"TRAINING_PLAN".equals(dto.assignmentType())) {
            throw invalid("ONLY_TRAINING_PLAN_TRANSFER", "transfer_only_plan");
        }
        String reason = dto.reason() == null ? "" : dto.reason().strip();
        if (reason.isEmpty()) throw invalid("REASON_REQUIRED", "reason_required");
        if (Objects.equals(dto.fromCoachId(), dto.toCoachId())) throw invalid("SAME_COACH", "same_coach");
        Coach from = coachRepository.findById(dto.fromCoachId()).orElseThrow(() -> new ResourceNotFoundException("resource.coach", dto.fromCoachId()));
        Coach to = activeCoach(dto.toCoachId());
        Member member = activeMember(dto.memberId());
        requireMembership(member.getUserId());
        TrainingPlan plan = trainingPlanRepository.findByIdForUpdate(dto.referenceId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", dto.referenceId()));
        requireRelationship(plan.getMember(), plan.getCoach(), dto);
        requireActivePlan(plan);
        if (!trainingPlanRepository.findOtherActiveForMemberAndCoach(member.getUserId(), to.getUserId(), plan.getId()).isEmpty()) {
            throw new ConflictException("COACH_ALREADY_HAS_ACTIVE_PLAN", "manager.coach_assignments.active_plan_exists", null, null);
        }
        plan.setCoach(to);
        trainingPlanRepository.save(plan);
        recordTransfer(dto, reason);
        String memberName = member.getUser().getFullName();
        notificationService.send(to.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.coach", memberName),
                "system", "training_plan", plan.getId(), "/coach/training-plans");
        notificationService.send(from.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.from", memberName, to.getUser().getFullName()),
                "system", "training_plan", plan.getId(), "/coach/training-plans");
        notificationService.send(member.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.member", to.getUser().getFullName(), reason),
                "system", "training_plan", plan.getId(), "/member/progress");
    }

    /** Học viên và HLV cũ phải khớp với dữ liệu yêu cầu. */
    private void requireRelationship(Member member, Coach coach, CoachAssignmentReassignDto dto) {
        if (member == null || coach == null || !Objects.equals(member.getUserId(), dto.memberId()) || !Objects.equals(coach.getUserId(), dto.fromCoachId())) {
            throw invalid("ASSIGNMENT_MISMATCH", "relationship_mismatch");
        }
    }

    /** Ghi audit lần chuyển giáo án (HLV cũ và mới, id giáo án, lý do) kèm người thực hiện. */
    private void recordTransfer(CoachAssignmentReassignDto dto, String reason) {
        var oldValue = objectMapper.createObjectNode().put("assignmentType", dto.assignmentType()).put("referenceId", dto.referenceId())
                .put("memberId", dto.memberId()).put("coachId", dto.fromCoachId());
        var newValue = oldValue.deepCopy().put("coachId", dto.toCoachId()).put("reason", reason);
        AuditLog entry = new AuditLog();
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedPrincipal principal) entry.setUserId(principal.id());
        entry.setAction("COACH_ASSIGNMENT_TRANSFER"); entry.setEntityType("coaches"); entry.setEntityId(dto.fromCoachId());
        entry.setOldValue(oldValue.toString()); entry.setNewValue(newValue.toString());
        auditRepository.save(entry);
    }

    /** Kết thúc phân công giáo án: giáo án phải đang áp dụng và còn hạn, chuyển sang cancelled, ghi audit và báo cho HLV/hội viên. */
    public void removeAssignment(Long planId) {
        TrainingPlan plan = trainingPlanRepository.findByIdForUpdate(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));
        requireActivePlan(plan);
        plan.setStatus("cancelled");
        trainingPlanRepository.save(plan);
        recordRemoval(plan);
        String memberName = plan.getMember() != null && plan.getMember().getUser() != null
                ? plan.getMember().getUser().getFullName() : "";
        notificationService.send(plan.getCoach().getUserId(), msg("notice.ended.title"), msg("notice.ended.body", memberName),
                "system", "training_plan", plan.getId(), "/coach/training-plans");
        if (plan.getMember() != null && plan.getMember().getUserId() != null) {
            String coachName = plan.getCoach() != null && plan.getCoach().getUser() != null ? plan.getCoach().getUser().getFullName() : "";
            notificationService.send(plan.getMember().getUserId(), msg("notice.ended.title"), msg("notice.ended.member", coachName),
                    "system", "training_plan", plan.getId(), "/member/progress");
        }
    }

    /** Ghi audit khi quản lý kết thúc phân công giáo án. */
    private void recordRemoval(TrainingPlan plan) {
        if (auditRepository == null || objectMapper == null) return;
        var oldValue = objectMapper.createObjectNode()
                .put("assignmentType", "TRAINING_PLAN")
                .put("referenceId", plan.getId())
                .put("memberId", plan.getMember() != null ? plan.getMember().getUserId() : null)
                .put("coachId", plan.getCoach() != null ? plan.getCoach().getUserId() : null)
                .put("status", "active");
        var newValue = oldValue.deepCopy().put("status", "cancelled");
        AuditLog entry = new AuditLog();
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedPrincipal principal) entry.setUserId(principal.id());
        entry.setAction("COACH_ASSIGNMENT_REMOVE");
        entry.setEntityType("training_plans");
        entry.setEntityId(plan.getId());
        entry.setOldValue(oldValue.toString());
        entry.setNewValue(newValue.toString());
        auditRepository.save(entry);
    }

    /** Giáo án phải đang active và chưa hết hạn. */
    private void requireActivePlan(TrainingPlan plan) {
        if (!"active".equals(plan.getStatus()) || plan.getEndDate() == null || plan.getEndDate().isBefore(today())) {
            throw invalid("ASSIGNMENT_NOT_CURRENT", "not_current");
        }
    }

    /** HLV phải tồn tại, đang làm việc và tài khoản active. */
    private Coach activeCoach(Long id) {
        Coach coach = coachRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.coach", id));
        if (!"active".equals(coach.getEmploymentStatus()) || !activeAccount(coach.getUser())) throw invalid("COACH_INACTIVE", "coach_inactive");
        return coach;
    }

    /** Hội viên phải tồn tại và tài khoản active. */
    private Member activeMember(Long id) {
        Member member = memberRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.member", id));
        if (!activeAccount(member.getUser())) throw invalid("MEMBER_INACTIVE", "member_inactive");
        return member;
    }

    /** Tài khoản active và chưa bị xóa. */
    private boolean activeAccount(User user) { return user != null && user.getDeletedAt() == null && "active".equals(user.getStatus()); }
    /** Hội viên phải có gói hiệu lực hôm nay. */
    private void requireMembership(Long memberId) {
        if (!subscriptionRepository.hasActiveMembership(memberId, today())) throw membershipMissing(memberId);
    }

    /**
     * Lỗi thiếu gói tập hợp lệ: gói đang bảo lưu có thông báo riêng, các trường hợp khác dùng thông báo chung
     * "cần gói đang hoạt động".
     */
    private BadRequestException membershipMissing(Long memberId) {
        return subscriptionRepository.findByMemberUserIdAndStatus(memberId, "frozen").isEmpty()
                ? invalid("NO_ACTIVE_SUBSCRIPTION", "no_membership")
                : invalid("MEMBERSHIP_FROZEN", "membership_frozen");
    }
}
