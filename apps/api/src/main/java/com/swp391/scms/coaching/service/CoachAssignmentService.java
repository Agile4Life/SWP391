package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.dto.*;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Màn phân công HLV của quản lý trung tâm (chỉ xem): HLV và học viên hiện tại theo giáo án, PT 1:1, lớp nhóm.
 * Không có điều chuyển hay kết thúc phân công: hội viên do HLV nào đảm nhận thì đi theo HLV đó đến hết.
 */
@Service
@Transactional(readOnly = true)
public class CoachAssignmentService {
    private final CoachRepository coachRepository;
    private final TrainingPlanRepository trainingPlanRepository;
    private final CoachBookingRepository coachBookingRepository;
    private final ClassEnrollmentRepository classEnrollmentRepository;
    private final SessionBookingRepository sessionBookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final MessageService messageService;
    private final Clock clock;

    /** Constructor Spring dùng. */
    public CoachAssignmentService(CoachRepository coachRepository,
            TrainingPlanRepository trainingPlanRepository, CoachBookingRepository coachBookingRepository,
            ClassEnrollmentRepository classEnrollmentRepository, SessionBookingRepository sessionBookingRepository,
            ClassSessionRepository classSessionRepository, MembershipSubscriptionRepository subscriptionRepository,
            MessageService messageService, Clock clock) {
        this.coachRepository = coachRepository;
        this.trainingPlanRepository = trainingPlanRepository;
        this.coachBookingRepository = coachBookingRepository;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.sessionBookingRepository = sessionBookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.messageService = messageService;
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
}
