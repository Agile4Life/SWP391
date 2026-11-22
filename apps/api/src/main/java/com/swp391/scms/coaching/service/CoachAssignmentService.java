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
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.operations.repository.StaffInternalRequestRepository;
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
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

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
    private final StaffInternalRequestRepository staffRequestRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final AuditLogRepository auditRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public CoachAssignmentService(CoachRepository coachRepository, MemberRepository memberRepository,
            TrainingPlanRepository trainingPlanRepository, CoachBookingRepository coachBookingRepository,
            ClassEnrollmentRepository classEnrollmentRepository, SessionBookingRepository sessionBookingRepository,
            ClassSessionRepository classSessionRepository, StaffInternalRequestRepository staffRequestRepository,
            MembershipSubscriptionRepository subscriptionRepository, NotificationService notificationService,
            MessageService messageService, AuditLogRepository auditRepository, ObjectMapper objectMapper, Clock clock) {
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.trainingPlanRepository = trainingPlanRepository;
        this.coachBookingRepository = coachBookingRepository;
        this.classEnrollmentRepository = classEnrollmentRepository;
        this.sessionBookingRepository = sessionBookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.staffRequestRepository = staffRequestRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.auditRepository = auditRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    private LocalDate today() { return LocalDate.now(clock); }
    private String msg(String key, Object... args) { return messageService == null ? "manager.coach_assignments." + key : messageService.getMessage("manager.coach_assignments." + key, args); }
    private BadRequestException invalid(String code, String key) { return new BadRequestException(code, "manager.coach_assignments." + key, null, msg(key)); }

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long filterCoachId, String search, String assignmentType) {
        return getOverview(filterCoachId, search, assignmentType, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long filterCoachId, String search, String assignmentType,
                                           String sortBy, String sortDir) {
        List<Coach> availableCoaches = coachRepository.findActiveWithUser();
        LocalDate date = today();
        LocalTime time = LocalTime.now(clock);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String type = assignmentType == null ? "ALL" : assignmentType.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "TRAINING_PLAN", "PT_1_1", "CLASS").contains(type)) throw invalid("INVALID_ASSIGNMENT_TYPE", "invalid_type");
        List<CoachAssignmentOverviewDto> coaches = new ArrayList<>();
        Set<Long> allStudents = new HashSet<>(), allPt = new HashSet<>(), allPlans = new HashSet<>(), allClasses = new HashSet<>();
        for (Coach coach : availableCoaches) {
            if (filterCoachId != null && !filterCoachId.equals(coach.getUserId())) continue;
            Long coachId = coach.getUserId();
            List<CoachAssignmentStudentDto> rows = new ArrayList<>();
            for (TrainingPlan plan : trainingPlanRepository.findCurrentAssignments(coachId, date)) {
                rows.add(student(plan.getMember(), "TRAINING_PLAN", plan.getGoal(), plan.getStartDate(),
                        plan.getEndDate(), plan.getEndDate().toString(), plan.getStatus(), plan.getId()));
            }
            for (CoachBooking booking : coachBookingRepository.findCurrentAssignments(coachId, date, time)) {
                rows.add(student(booking.getMember(), "PT_1_1", booking.getDiscipline() == null ? null : booking.getDiscipline().getName(),
                        booking.getBookingDate(), booking.getBookingDate(), booking.getBookingDate() + " " + booking.getStartTime(),
                        booking.getStatus(), booking.getId()));
            }
            // Collapse series enrollment and session bookings into one class/member relationship.
            Set<String> classMembers = new HashSet<>();
            for (var enrollment : classEnrollmentRepository.findCurrentCoachAssignments(coachId, date, time)) {
                if (classMembers.add(enrollment.getGymClass().getId() + ":" + enrollment.getMember().getUserId())) rows.add(student(enrollment.getMember(), "CLASS", enrollment.getGymClass().getName(), null, null, null,
                        enrollment.getStatus(), enrollment.getGymClass().getId()));
            }
            for (var booking : sessionBookingRepository.findCurrentCoachAssignments(coachId, date, time)) {
                var session = booking.getSession();
                if (classMembers.add(session.getGymClass().getId() + ":" + booking.getMember().getUserId())) {
                    rows.add(student(booking.getMember(), "CLASS", session.getGymClass().getName(), session.getSessionDate(),
                            session.getSessionDate(), session.getSessionDate() + " " + session.getStartTime(), booking.getStatus(), session.getGymClass().getId()));
                }
            }
            List<CoachAssignmentStudentDto> filtered = rows.stream()
                    .filter(s -> "ALL".equals(type) || type.equals(s.assignmentType()))
                    .filter(s -> query.isEmpty() || searchable(s, coach).contains(query)).toList();
            Set<Long> pt = studentsOfType(filtered, "PT_1_1"), plans = studentsOfType(filtered, "TRAINING_PLAN"), classes = studentsOfType(filtered, "CLASS");
            Set<Long> distinct = new HashSet<>();
            filtered.forEach(s -> distinct.add(s.memberId()));
            allStudents.addAll(distinct); allPt.addAll(pt); allPlans.addAll(plans); allClasses.addAll(classes);
            coaches.add(new CoachAssignmentOverviewDto(coachId, coach.getUser().getFullName(), coach.getUser().getEmail(),
                    coach.getUser().getPhone(), coach.getSpecialization(), coach.getBio(), coach.getEmploymentStatus(),
                    distinct.size(), pt.size(), plans.size(), classes.size(), filtered));
        }
        sortCoaches(coaches, sortBy, sortDir);
        return Map.of("coaches", coaches, "availableCoaches", availableCoaches.stream()
                        .map(c -> new CoachAssignmentCoachOptionDto(c.getUserId(), c.getUser().getFullName(), c.getSpecialization())).toList(),
                "stats", new CoachAssignmentSummaryStatsDto(availableCoaches.size(), availableCoaches.size(), allStudents.size(), allPt.size(), allPlans.size(), allClasses.size()));
    }

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

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private Set<Long> studentsOfType(List<CoachAssignmentStudentDto> rows, String type) {
        Set<Long> ids = new HashSet<>();
        rows.stream().filter(s -> type.equals(s.assignmentType())).forEach(s -> ids.add(s.memberId()));
        return ids;
    }

    private String searchable(CoachAssignmentStudentDto row, Coach coach) {
        return String.join(" ", Objects.toString(row.fullName(), ""), Objects.toString(row.membershipCode(), ""),
                Objects.toString(row.phone(), ""), Objects.toString(row.email(), ""), Objects.toString(row.detail(), ""),
                Objects.toString(coach.getUser().getFullName(), "")).toLowerCase(Locale.ROOT);
    }

    private CoachAssignmentStudentDto student(Member member, String type, String detail, LocalDate start, LocalDate end,
            String nextSession, String status, Long referenceId) {
        var user = member.getUser();
        return new CoachAssignmentStudentDto(member.getUserId(), member.getMembershipCode(), user.getFullName(), user.getPhone(),
                user.getEmail(), user.getAvatarUrl(), member.getFitnessGoal(), member.getFitnessLevel(), member.getHealthNotes(),
                type, msg("type." + type), detail, start, end, nextSession, status, referenceId,
                membershipIssue(member.getUserId(), type, start));
    }

    /** Why the member's plan blocks coaching right now, or null when nothing is wrong (the page shows a tag only then). */
    private String membershipIssue(Long memberId, String type, LocalDate sessionDate) {
        if (!subscriptionRepository.findByMemberUserIdAndStatus(memberId, "frozen").isEmpty()) return "FROZEN";
        if (!subscriptionRepository.hasActiveMembership(memberId, today())) return "NO_ACTIVE";
        if ("PT_1_1".equals(type) && sessionDate != null
                && !subscriptionRepository.hasActiveMembershipCoveringSession(memberId, today(), sessionDate)) return "NOT_COVERED";
        return null;
    }

    public void reassignStudent(CoachAssignmentReassignDto dto) {
        if (dto.referenceId() == null || dto.assignmentType() == null || !Set.of("TRAINING_PLAN", "PT_1_1").contains(dto.assignmentType())) {
            throw invalid("INVALID_ASSIGNMENT_TYPE", "invalid_type");
        }
        String reason = dto.reason() == null ? "" : dto.reason().strip();
        if (reason.isEmpty()) throw invalid("REASON_REQUIRED", "reason_required");
        if (Objects.equals(dto.fromCoachId(), dto.toCoachId())) throw invalid("SAME_COACH", "same_coach");
        Coach from = coachRepository.findById(dto.fromCoachId()).orElseThrow(() -> new ResourceNotFoundException("resource.coach", dto.fromCoachId()));
        Coach to = activeCoach(dto.toCoachId());
        Member member = activeMember(dto.memberId());
        requireMembership(member.getUserId());
        String entityType;
        String coachPath;
        if ("TRAINING_PLAN".equals(dto.assignmentType())) {
            TrainingPlan plan = trainingPlanRepository.findByIdForUpdate(dto.referenceId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", dto.referenceId()));
            requireRelationship(plan.getMember(), plan.getCoach(), dto);
            requireActivePlan(plan);
            plan.setCoach(to);
            trainingPlanRepository.save(plan);
            entityType = "training_plan"; coachPath = "/coach/training-plans";
        } else {
            CoachBooking booking = coachBookingRepository.findByIdForUpdate(dto.referenceId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.coach_booking", dto.referenceId()));
            requireRelationship(booking.getMember(), booking.getCoach(), dto);
            if (!"confirmed".equals(booking.getStatus()) || booking.getBookingDate() == null || booking.getStartTime() == null
                    || !booking.getBookingDate().atTime(booking.getStartTime()).isAfter(LocalDateTime.now(clock))) {
                throw invalid("ASSIGNMENT_NOT_CURRENT", "not_current");
            }
            if (!subscriptionRepository.hasActiveMembershipCoveringSession(member.getUserId(), today(), booking.getBookingDate())) {
                throw membershipMissing(member.getUserId());
            }
            requireCoachAvailable(to.getUserId(), booking);
            booking.setCoach(to);
            coachBookingRepository.save(booking);
            inheritPlans(member.getUserId(), from, to);
            entityType = null; coachPath = "/coach/classes";
        }
        recordTransfer(dto, reason);
        notificationService.send(to.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.coach", member.getUser().getFullName(), dto.referenceId()),
                "system", entityType, dto.referenceId(), coachPath);
        notificationService.send(from.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.from", member.getUser().getFullName(), to.getUser().getFullName(), dto.referenceId()),
                "system", entityType, dto.referenceId(), coachPath);
        notificationService.send(member.getUserId(), msg("notice.transferred.title"), msg("notice.transferred.member", to.getUser().getFullName(), dto.referenceId(), reason),
                "system", entityType, dto.referenceId(), "TRAINING_PLAN".equals(dto.assignmentType()) ? "/member/progress" : "/member/classes?tab=coach_booking");
    }

    /**
     * The member's plans follow the PT session to the new coach, who edits them from there; the previous coach no longer
     * owns them. If the new coach already has an active plan for the member, theirs stays and the inherited one goes to history.
     */
    private void inheritPlans(Long memberId, Coach from, Coach to) {
        boolean toHasActive = !trainingPlanRepository.findOtherActiveForMemberAndCoach(memberId, to.getUserId(), -1L).isEmpty();
        for (TrainingPlan plan : trainingPlanRepository.findByMemberUserIdAndCoachUserIdAndStatusIn(memberId, from.getUserId(),
                List.of("active", "draft", "superseded"))) {
            plan.setCoach(to);
            if ("active".equals(plan.getStatus())) {
                if (toHasActive) plan.setStatus("superseded"); else toHasActive = true;
            }
            trainingPlanRepository.save(plan);
        }
    }

    private void requireRelationship(Member member, Coach coach, CoachAssignmentReassignDto dto) {
        if (member == null || coach == null || !Objects.equals(member.getUserId(), dto.memberId()) || !Objects.equals(coach.getUserId(), dto.fromCoachId())) {
            throw invalid("ASSIGNMENT_MISMATCH", "relationship_mismatch");
        }
    }

    private void requireCoachAvailable(Long coachId, CoachBooking booking) {
        if (staffRequestRepository.existsApprovedLeaveOn(coachId, booking.getBookingDate())) throw invalid("COACH_ON_LEAVE", "coach_unavailable");
        boolean classConflict = classSessionRepository.findActiveByCoachAndDate(coachId, booking.getBookingDate()).stream()
                .anyMatch(s -> overlaps(booking, s.getStartTime(), s.getEndTime()));
        boolean ptConflict = coachBookingRepository.findActiveByCoachAndDate(coachId, booking.getBookingDate()).stream()
                .anyMatch(b -> overlaps(booking, b.getStartTime(), b.getEndTime()));
        if (classConflict || ptConflict) throw invalid("COACH_SCHEDULE_CONFLICT", "coach_unavailable");
    }

    private boolean overlaps(CoachBooking booking, LocalTime start, LocalTime end) {
        return booking.getStartTime().isBefore(end) && booking.getEndTime().isAfter(start);
    }

    private void recordTransfer(CoachAssignmentReassignDto dto, String reason) {
        // The existing coach audit stream stores both sides of the exact plan / PT relationship.
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

    public void removeAssignment(Long planId) {
        TrainingPlan plan = trainingPlanRepository.findByIdForUpdate(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));
        requireActivePlan(plan);
        plan.setStatus("cancelled");
        trainingPlanRepository.save(plan);
        notificationService.send(plan.getCoach().getUserId(), msg("notice.ended.title"), msg("notice.ended.body", plan.getMember().getUser().getFullName()),
                "system", "training_plan", plan.getId(), "/coach/training-plans");
    }

    private void requireActivePlan(TrainingPlan plan) {
        if (!"active".equals(plan.getStatus()) || plan.getEndDate() == null || plan.getEndDate().isBefore(today())) {
            throw invalid("ASSIGNMENT_NOT_CURRENT", "not_current");
        }
    }

    private Coach activeCoach(Long id) {
        Coach coach = coachRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.coach", id));
        if (!"active".equals(coach.getEmploymentStatus()) || !activeAccount(coach.getUser())) throw invalid("COACH_INACTIVE", "coach_inactive");
        return coach;
    }

    private Member activeMember(Long id) {
        Member member = memberRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.member", id));
        if (!activeAccount(member.getUser())) throw invalid("MEMBER_INACTIVE", "member_inactive");
        return member;
    }

    private boolean activeAccount(User user) { return user != null && user.getDeletedAt() == null && "active".equals(user.getStatus()); }
    private void requireMembership(Long memberId) {
        if (!subscriptionRepository.hasActiveMembership(memberId, today())) throw membershipMissing(memberId);
    }

    /** A frozen (on hold) membership gets its own message; anything else is the generic "needs an active plan". */
    private BadRequestException membershipMissing(Long memberId) {
        return subscriptionRepository.findByMemberUserIdAndStatus(memberId, "frozen").isEmpty()
                ? invalid("NO_ACTIVE_SUBSCRIPTION", "no_membership")
                : invalid("MEMBERSHIP_FROZEN", "membership_frozen");
    }
}
