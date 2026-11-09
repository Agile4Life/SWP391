package com.swp391.scms.health;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.health.dto.HealthMetricCreateDto;
import com.swp391.scms.health.dto.HealthMetricDto;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class HealthMetricService {

    private static final Set<String> ALLOWED_METRICS = Set.of(
            "weight", "height", "bmi", "body_fat", "muscle_mass", "waist"
    );

    private java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    @org.springframework.beans.factory.annotation.Autowired
    void useClock(java.time.Clock clock) { this.clock = clock; }

    private final MemberProgressLogRepository progressLogRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.coaching.service.CoachMemberAccess coachMemberAccess;

    public HealthMetricService(MemberProgressLogRepository progressLogRepository,
                               MemberRepository memberRepository,
                               UserRepository userRepository) {
        this.progressLogRepository = progressLogRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<HealthMetricDto> getMetrics(Long memberId, Long currentUserId, String currentUserRole) {
        if (!("MEMBER".equals(currentUserRole) || isCoach(currentUserRole) || isManager(currentUserRole)))
            throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden", null, "Health history access denied.");
        if (!memberId.equals(currentUserId) && !isManager(currentUserRole) && !isCoach(currentUserRole)) {
            throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden", null,
                    "You do not have permission to view these health metrics");
        }
        if (isCoach(currentUserRole)) requireAssignedCoach(currentUserId, memberId);
        if (!memberRepository.existsById(memberId)) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(memberId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Returns member's own health metrics ordered ascending by recordedAt for Line Chart rendering (SCRUM-119).
     */
    @Transactional(readOnly = true)
    public List<HealthMetricDto> getMyMetricsChronological(Long currentUserId) {
        if (!memberRepository.existsById(currentUserId)) {
            throw new ResourceNotFoundException("resource.member", currentUserId);
        }
        return progressLogRepository.findByMemberUserIdOrderByRecordedAtAsc(currentUserId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public HealthMetricDto addMetric(Long memberId, HealthMetricDto request, Long currentUserId, String currentUserRole) {
        ensureCanModify(memberId, currentUserId, currentUserRole, true);
        String metricName = validateAndNormalizeMetricName(request.metricName());
        validatedUnit(metricName, request.metricValue(), request.unit());
        enforceAssessmentTier(memberId, metricName);

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        User recordedBy = userRepository.findByIdAndDeletedAtIsNull(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.health_recorder", currentUserId));

        MemberProgressLog log = new MemberProgressLog();
        log.setMember(member);
        log.setMetricName(metricName);
        log.setMetricValue(request.metricValue());
        log.setUnit(validatedUnit(metricName, request.metricValue(), request.unit()));
        log.setRecordedBy(recordedBy);
        java.time.LocalDateTime now = java.time.LocalDateTime.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        log.setRecordedAt(now);
        MemberProgressLog saved = progressLogRepository.save(log);
        if ("weight".equals(metricName) || "height".equals(metricName)) {
            recordAutoCalculatedBmi(member, recordedBy, now, metricName, request.metricValue());
        }
        return toDto(saved);
    }

    private void recordAutoCalculatedBmi(Member member, User recordedBy, java.time.LocalDateTime recordedAt,
                                         String updatedMetricName, java.math.BigDecimal updatedValue) {
        if (member == null || member.getUserId() == null) return;
        java.math.BigDecimal height = "height".equals(updatedMetricName) ? updatedValue : null;
        java.math.BigDecimal weight = "weight".equals(updatedMetricName) ? updatedValue : null;
        List<MemberProgressLog> history = progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(member.getUserId());
        if (history != null) {
            for (MemberProgressLog row : history) {
                if (row == null || row.getMetricName() == null || row.getMetricValue() == null) continue;
                if (height == null && "height".equalsIgnoreCase(row.getMetricName())) {
                    height = row.getMetricValue();
                } else if (weight == null && "weight".equalsIgnoreCase(row.getMetricName())) {
                    weight = row.getMetricValue();
                }
                if (height != null && weight != null) break;
            }
        }
        java.math.BigDecimal bmi = com.swp391.scms.coaching.service.CurrentCoachMembers.calculateBmi(height, weight);
        if (bmi != null && bmi.compareTo(new java.math.BigDecimal("0.01")) >= 0
                && bmi.compareTo(new java.math.BigDecimal("99999999.99")) <= 0) {
            MemberProgressLog bmiLog = new MemberProgressLog();
            bmiLog.setMember(member);
            bmiLog.setMetricName("bmi");
            bmiLog.setMetricValue(bmi);
            bmiLog.setUnit(null);
            bmiLog.setRecordedBy(recordedBy);
            bmiLog.setRecordedAt(recordedAt);
            progressLogRepository.save(bmiLog);
        }
    }

    @Transactional
    public HealthMetricDto updateMetric(Long memberId, Long metricId, HealthMetricDto request, Long currentUserId, String currentUserRole) {
        ensureCanModify(memberId, currentUserId, currentUserRole, false);
        MemberProgressLog log = findOwnedMetric(memberId, metricId);

        if (request.metricName() != null && !request.metricName().isBlank()) {
            log.setMetricName(validateAndNormalizeMetricName(request.metricName()));
        }
        if (request.metricValue() != null) {
            log.setMetricValue(request.metricValue());
        }
        if (request.unit() != null || "bmi".equals(log.getMetricName())) {
            log.setUnit(request.unit());
        }
        log.setUnit(validatedUnit(log.getMetricName(), log.getMetricValue(), log.getUnit()));
        return toDto(progressLogRepository.save(log));
    }

    @Transactional
    public void deleteMetric(Long memberId, Long metricId, Long currentUserId, String currentUserRole) {
        ensureCanModify(memberId, currentUserId, currentUserRole, false);
        MemberProgressLog log = findOwnedMetric(memberId, metricId);
        progressLogRepository.delete(log);
    }

    /** Registered members with no measurements matching {@code query} (at least two characters), at most 20. */
    @Transactional(readOnly = true)
    public List<com.swp391.scms.health.dto.FirstAssessmentCandidateDto> firstAssessmentCandidates(String query) {
        String trimmed = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        if (trimmed.length() < 2) return List.of();
        String pattern = "%" + trimmed.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return memberRepository.searchWithoutMeasurements(pattern, org.springframework.data.domain.PageRequest.of(0, 20))
                .stream()
                .map(m -> new com.swp391.scms.health.dto.FirstAssessmentCandidateDto(m.getUserId(), m.getMembershipCode(),
                        m.getUser() != null ? m.getUser().getFullName() : null,
                        m.getUser() != null ? m.getUser().getPhone() : null))
                .toList();
    }

    @Transactional
    public HealthMetricDto recordMetric(HealthMetricCreateDto request, Long currentUserId, String currentUserRole) {
        Long targetMemberId = request.memberId() != null ? request.memberId() : currentUserId;
        HealthMetricDto dto = new HealthMetricDto(
                null, request.metricName(), request.metricValue(), request.unit(), currentUserId, null
        );
        return addMetric(targetMemberId, dto, currentUserId, currentUserRole);
    }

    private void ensureCanModify(Long memberId, Long currentUserId, String role, boolean append) {
        if ("RECEPTIONIST".equals(role) && append) { requireIntake(memberId, currentUserId); return; }
        if (!isCoach(role) && !isManager(role)) {
            throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden_update", null,
                    "Only assigned coaches and managers may record measurements.");
        }
        // Every registered member gets a first assessment from any coach; later ones belong to the assigned coach.
        if (isCoach(role) && !(append && isFirstAssessmentBy(memberId, currentUserId))) {
            requireAssignedCoach(currentUserId, memberId);
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptions;

    /** True while the member has no measurements, or only ones this coach took today (an assessment in progress). */
    private boolean isFirstAssessmentBy(Long memberId, Long coachId) {
        if (memberId == null || coachId == null) return false;
        var member = memberRepository.findById(memberId).orElse(null);
        if (member == null || member.getUser() == null || member.getUser().getDeletedAt() != null) return false;
        List<MemberProgressLog> history = progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(memberId);
        if (history == null || history.isEmpty()) return true;
        java.time.LocalDate today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        return history.stream().allMatch(row -> row.getRecordedBy() != null && coachId.equals(row.getRecordedBy().getId())
                && row.getRecordedAt() != null && row.getRecordedAt().toLocalDate().equals(today));
    }

    /** The active packages of the member today. */
    private List<com.swp391.scms.facilities.entity.MembershipPackage> currentPackages(Long memberId) {
        if (subscriptions == null) return List.of();
        java.time.LocalDate today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        return subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null
                        && !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                .map(com.swp391.scms.membership.entity.MembershipSubscription::getMembershipPackage)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * Service levels (spec 2026-11-09): Body Fat and Muscle Mass only for Platinum members; Silver members get the
     * first assessment but no follow-up. Members without an active package are not restricted.
     */
    private void enforceAssessmentTier(Long memberId, String metricName) {
        List<com.swp391.scms.facilities.entity.MembershipPackage> packages = currentPackages(memberId);
        if (packages.isEmpty()) return;
        if (("body_fat".equals(metricName) || "muscle_mass".equals(metricName))
                && packages.stream().noneMatch(com.swp391.scms.facilities.PackageBenefits::allowsDeepAssessment)) {
            throw new ForbiddenException("HEALTH_DEEP_ASSESSMENT_PLATINUM", "health.metrics.platinum_required", null,
                    "Body Fat and Muscle Mass assessments are part of the Platinum package");
        }
        if (packages.stream().noneMatch(com.swp391.scms.facilities.PackageBenefits::allowsPeriodicAssessment)) {
            java.time.LocalDate today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
            List<MemberProgressLog> history = progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(memberId);
            boolean earlier = history != null && history.stream()
                    .anyMatch(row -> row.getRecordedAt() != null && row.getRecordedAt().toLocalDate().isBefore(today));
            if (earlier) {
                throw new ForbiddenException("HEALTH_PERIODIC_ASSESSMENT_GOLD", "health.metrics.gold_required", null,
                        "Periodic assessments are part of the Gold package and above");
            }
        }
    }

    private void requireAssignedCoach(Long coachId, Long memberId) {
        if (currentCoachMembers == null) throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden_update", null,
                "Coach member access cannot be verified.");
        currentCoachMembers.requireCoachOf(coachId, memberId);
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.swp391.scms.coaching.service.CurrentCoachMembers currentCoachMembers;
    @org.springframework.beans.factory.annotation.Autowired
    private com.swp391.scms.attendance.repository.CenterCheckinRepository checkins;

    private void requireIntake(Long memberId, Long staffId) {
        var today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        var now = java.time.LocalDateTime.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        var candidate = checkins == null ? java.util.Optional.<com.swp391.scms.attendance.entity.CenterCheckin>empty()
            : checkins.findFirstByMemberUserIdAndStatusAndCheckOutTimeIsNullOrderByCheckInTimeDesc(memberId, "GRANTED");
        var checkin = candidate.flatMap(row -> checkins.findByIdForUpdate(row.getId())).orElse(null);
        if (checkin == null || checkin.getMember() == null || !java.util.Objects.equals(checkin.getMember().getUserId(), memberId)
                || !"GRANTED".equals(checkin.getStatus()) || checkin.getCheckOutTime() != null
                || checkin.getCheckInTime() == null || !checkin.getCheckInTime().toLocalDate().equals(today)
                || checkin.getCheckInTime().isAfter(now) || checkin.getRecordedBy() == null
                || !java.util.Objects.equals(checkin.getRecordedBy().getId(), staffId)
                || checkin.getMember().getUser() == null || checkin.getMember().getUser().getDeletedAt() != null
                || !"active".equals(checkin.getMember().getUser().getStatus())) {
            throw new ForbiddenException("HEALTH_INTAKE_REQUIRED", "health.metrics.intake_required", null,
                    "An open check-in recorded by this receptionist today is required.");
        }
    }

    private String validatedUnit(String name, java.math.BigDecimal value, String unit) {
        String expected = switch (name) {
            case "weight", "muscle_mass" -> "kg";
            case "height", "waist" -> "cm";
            case "body_fat" -> "%";
            default -> "";
        };
        String actual = unit == null ? "" : unit.trim();
        if (value == null || value.compareTo(new java.math.BigDecimal("0.01")) < 0
                || value.compareTo(new java.math.BigDecimal("99999999.99")) > 0 || value.stripTrailingZeros().scale() > 2
                || ("body_fat".equals(name) && value.compareTo(new java.math.BigDecimal("100")) > 0)
                || !expected.equalsIgnoreCase(actual)) {
            throw new BadRequestException("INVALID_HEALTH_MEASUREMENT", "health.metrics.invalid_measurement", null,
                    "Invalid measurement value or unit.");
        }
        return expected.isEmpty() ? null : expected;
    }

    private String validateAndNormalizeMetricName(String rawName) {
        String metricName = rawName == null ? "" : rawName.toLowerCase(Locale.ROOT);
        if (!ALLOWED_METRICS.contains(metricName)) {
            throw new BadRequestException("INVALID_METRIC", "health.metrics.invalid_metric", null,
                    "Invalid health metric name");
        }
        return metricName;
    }

    private MemberProgressLog findOwnedMetric(Long memberId, Long metricId) {
        MemberProgressLog log = progressLogRepository.findById(metricId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.health_metric", metricId));
        if (log.getMember() == null || !memberId.equals(log.getMember().getUserId())) {
            throw new BadRequestException("INVALID_MEMBER_METRIC", "health.metrics.invalid_member", null,
                    "Health metric does not belong to this member");
        }
        return log;
    }

    private HealthMetricDto toDto(MemberProgressLog log) {
        return new HealthMetricDto(
                log.getId(),
                log.getMetricName(),
                log.getMetricValue(),
                log.getUnit(),
                log.getRecordedBy() != null ? log.getRecordedBy().getId() : null,
                log.getRecordedAt()
        );
    }

    private boolean isManager(String role) {
        return "CENTER_MANAGER".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role);
    }

    private boolean isCoach(String role) {
        return "COACH".equalsIgnoreCase(role);
    }
}
