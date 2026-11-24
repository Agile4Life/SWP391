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

/**
 * Nghiệp vụ chỉ số cơ thể (tính năng đã ngừng): cân nặng, chiều cao, BMI, mỡ, cơ, vòng eo. Kiểm tra quyền theo
 * vai trò, quyền lợi theo hạng gói và tự tính BMI.
 */
@Service
public class HealthMetricService {

    private static final Set<String> ALLOWED_METRICS = Set.of(
            "weight", "height", "bmi", "body_fat", "muscle_mass", "waist"
    );

    private java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    /** Spring tiêm Clock để test có thể cố định thời gian. */
    @org.springframework.beans.factory.annotation.Autowired
    void useClock(java.time.Clock clock) { this.clock = clock; }

    private final MemberProgressLogRepository progressLogRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.coaching.service.CoachMemberAccess coachMemberAccess;

    /** Nhận repository số đo, hội viên và người dùng. */
    public HealthMetricService(MemberProgressLogRepository progressLogRepository,
                               MemberRepository memberRepository,
                               UserRepository userRepository) {
        this.progressLogRepository = progressLogRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    /** Lịch sử số đo: hội viên chỉ xem của mình; HLV chỉ xem học viên mình phụ trách; quản lý xem tất cả. */
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
     * Số đo của chính hội viên, cũ nhất trước (để vẽ biểu đồ).
     *
     * Trả các chỉ số sức khỏe của chính hội viên sắp tăng dần theo recordedAt để vẽ biểu đồ đường
     * (SCRUM-119).
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

    /**
     * Thêm một số đo: kiểm tra quyền, tên chỉ số, đơn vị và quyền lợi theo hạng gói; khi đo cân nặng hoặc chiều
     * cao thì tự tính và lưu thêm BMI.
     */
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

    /**
     * Thêm nhiều số đo của một lần đánh giá trong cùng transaction: không cho gửi BMI (được tự tính), mỗi chỉ
     * số chỉ một lần; sau đó tính BMI một lần từ chiều cao và cân nặng mới nhất.
     *
     * Ghi nhiều số đo của một buổi đánh giá một cách nguyên tử. Không được gửi BMI: nó được suy ra một lần từ
     * chiều cao và cân nặng kết quả, nên batch có cả hai không bao giờ để lại BMI trung gian.
     */
    @Transactional
    public List<HealthMetricDto> addMetrics(Long memberId, com.swp391.scms.health.dto.HealthMetricBatchDto request,
                                            Long currentUserId, String currentUserRole) {
        ensureCanModify(memberId, currentUserId, currentUserRole, true);
        Set<String> seen = new java.util.HashSet<>();
        for (var item : request.metrics()) {
            String name = validateAndNormalizeMetricName(item.metricName());
            if ("bmi".equals(name)) {
                throw new BadRequestException("HEALTH_BMI_AUTOMATIC", "health.metrics.bmi_automatic", null,
                        "BMI is calculated from height and weight.");
            }
            if (!seen.add(name)) {
                throw new BadRequestException("HEALTH_DUPLICATE_METRIC", "health.metrics.duplicate_metric", null,
                        "Each measurement can appear once per assessment.");
            }
            validatedUnit(name, item.metricValue(), item.unit());
            enforceAssessmentTier(memberId, name);
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        User recordedBy = userRepository.findByIdAndDeletedAtIsNull(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.health_recorder", currentUserId));
        java.time.LocalDateTime now = java.time.LocalDateTime.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        List<MemberProgressLog> saved = new java.util.ArrayList<>();
        for (var item : request.metrics()) {
            String name = validateAndNormalizeMetricName(item.metricName());
            MemberProgressLog log = new MemberProgressLog();
            log.setMember(member);
            log.setMetricName(name);
            log.setMetricValue(item.metricValue());
            log.setUnit(validatedUnit(name, item.metricValue(), item.unit()));
            log.setRecordedBy(recordedBy);
            log.setRecordedAt(now);
            saved.add(progressLogRepository.save(log));
        }
        if (seen.contains("weight") || seen.contains("height")) {
            recordAutoCalculatedBmi(member, recordedBy, now, "", null);
        }
        return saved.stream().map(this::toDto).toList();
    }

    /**
     * Tính BMI từ chiều cao/cân nặng (lấy giá trị vừa đo, thiếu thì lấy lần đo gần nhất) và lưu thành một số đo
     * BMI nếu hợp lệ.
     */
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

    /** Sửa một số đo của hội viên (tên, giá trị, đơn vị) sau khi kiểm tra quyền và đơn vị. */
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

    /** Xóa một số đo của hội viên sau khi kiểm tra quyền. */
    @Transactional
    public void deleteMetric(Long memberId, Long metricId, Long currentUserId, String currentUserRole) {
        ensureCanModify(memberId, currentUserId, currentUserRole, false);
        MemberProgressLog log = findOwnedMetric(memberId, metricId);
        progressLogRepository.delete(log);
    }

    /** Ghi một số đo cho hội viên trong body (mặc định là người gọi), dùng lại logic addMetric. */
    @Transactional
    public HealthMetricDto recordMetric(HealthMetricCreateDto request, Long currentUserId, String currentUserRole) {
        Long targetMemberId = request.memberId() != null ? request.memberId() : currentUserId;
        HealthMetricDto dto = new HealthMetricDto(
                null, request.metricName(), request.metricValue(), request.unit(), currentUserId, null
        );
        return addMetric(targetMemberId, dto, currentUserId, currentUserRole);
    }

    /**
     * Quyền ghi số đo: lễ tân chỉ được thêm khi chính mình vừa check-in hội viên hôm nay; HLV và quản lý được
     * ghi; HLV chỉ ghi cho học viên mình phụ trách, trừ lần đánh giá đầu tiên.
     */
    private void ensureCanModify(Long memberId, Long currentUserId, String role, boolean append) {
        if ("RECEPTIONIST".equals(role) && append) { requireIntake(memberId, currentUserId); return; }
        if (!isCoach(role) && !isManager(role)) {
            throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden_update", null,
                    "Only assigned coaches and managers may record measurements.");
        }
        // Mọi hội viên đã đăng ký được buổi đánh giá đầu tiên từ bất kỳ HLV nào; các buổi sau thuộc HLV được
        // phân công.
        if (isCoach(role) && !(append && isFirstAssessmentBy(memberId, currentUserId))) {
            requireAssignedCoach(currentUserId, memberId);
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptions;

    /**
     * Đây có phải lần đánh giá đầu tiên của hội viên do HLV này thực hiện không: hội viên chưa có số đo nào,
     * hoặc chỉ có số đo do chính HLV này ghi trong hôm nay.
     *
     * True khi hội viên chưa có số đo nào, hoặc chỉ có các số đo HLV này đã đo hôm nay (buổi đánh giá đang
     * diễn ra).
     */
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

    /**
     * Các kỳ gói active đang hiệu lực hôm nay của hội viên.
     *
     * Các subscription đang hoạt động của hội viên hôm nay.
     */
    private List<com.swp391.scms.membership.entity.MembershipSubscription> currentSubscriptions(Long memberId) {
        if (subscriptions == null) return List.of();
        java.time.LocalDate today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        return subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null && s.getMembershipPackage() != null
                        && !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                .toList();
    }

    /**
     * Quyền lợi theo hạng gói: mỡ và cơ chỉ cho Platinum; gói không có đánh giá định kỳ chỉ được đánh giá ngày
     * đầu; còn lại mỗi chu kỳ 30 ngày một lần. Hội viên không có gói thì không giới hạn.
     *
     * Mức dịch vụ (spec 2026-11-09): Mỡ cơ thể và Khối lượng cơ chỉ dành cho hội viên Platinum; Silver được
     * đánh giá lần đầu nhưng không có theo dõi. Hội viên không có gói đang hoạt động thì không bị giới hạn.
     */
    private void enforceAssessmentTier(Long memberId, String metricName) {
        List<com.swp391.scms.membership.entity.MembershipSubscription> current = currentSubscriptions(memberId);
        List<com.swp391.scms.facilities.entity.MembershipPackage> packages = current.stream()
                .map(com.swp391.scms.membership.entity.MembershipSubscription::getMembershipPackage).toList();
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
            return;
        }
        enforceOneAssessmentPerCycle(memberId, current);
    }

    /**
     * Mỗi chu kỳ 30 ngày chỉ một lần đánh giá: nếu đã đo vào một ngày khác trong chu kỳ thì báo lỗi kèm ngày đã
     * đo và ngày bắt đầu chu kỳ sau (nhiều số đo trong cùng ngày tính là một lần).
     *
     * Gold và Platinum gồm một buổi đánh giá theo dõi mỗi chu kỳ 30 ngày (spec 2026-11-09): khi đã đo vào một
     * ngày của chu kỳ, các ngày khác phải chờ chu kỳ sau. Nhiều số đo trong cùng một ngày là một buổi đánh
     * giá.
     */
    private void enforceOneAssessmentPerCycle(Long memberId, List<com.swp391.scms.membership.entity.MembershipSubscription> current) {
        java.time.LocalDate today = java.time.LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        List<MemberProgressLog> history = progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(memberId);
        if (history == null || history.isEmpty()) return;
        com.swp391.scms.membership.entity.MembershipSubscription sub = current.stream()
                .filter(s -> com.swp391.scms.facilities.PackageBenefits.allowsPeriodicAssessment(s.getMembershipPackage()))
                .findFirst().orElse(null);
        if (sub == null) return;
        java.time.LocalDate cycleStart = com.swp391.scms.facilities.PackageBenefits.cycleStart(sub, today);
        java.time.LocalDate nextCycle = com.swp391.scms.facilities.PackageBenefits.cycleEnd(sub, today).plusDays(1);
        java.time.LocalDate otherDay = history.stream()
                .map(MemberProgressLog::getRecordedAt)
                .filter(java.util.Objects::nonNull)
                .map(java.time.LocalDateTime::toLocalDate)
                .filter(day -> !day.isBefore(cycleStart) && !day.isAfter(today) && !day.equals(today))
                .findFirst().orElse(null);
        if (otherDay != null) {
            throw new ForbiddenException("HEALTH_ASSESSMENT_CYCLE_USED", "health.metrics.cycle_used",
                    new Object[]{otherDay.toString(), nextCycle.toString()},
                    "This cycle's assessment was already taken on " + otherDay + "; the next one is from " + nextCycle);
        }
    }

    /** HLV phải đang phụ trách hội viên; không kiểm tra được thì từ chối. */
    private void requireAssignedCoach(Long coachId, Long memberId) {
        if (currentCoachMembers == null) throw new ForbiddenException("FORBIDDEN", "health.metrics.forbidden_update", null,
                "Coach member access cannot be verified.");
        currentCoachMembers.requireCoachOf(coachId, memberId);
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.swp391.scms.coaching.service.CurrentCoachMembers currentCoachMembers;
    @org.springframework.beans.factory.annotation.Autowired
    private com.swp391.scms.attendance.repository.CenterCheckinRepository checkins;

    /**
     * Lễ tân chỉ được ghi số đo khi có lượt check-in đang mở hôm nay do chính lễ tân đó ghi nhận, và hội viên
     * còn active.
     */
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

    /**
     * Kiểm tra giá trị (0,01 tới 99.999.999,99, tối đa 2 chữ số thập phân, mỡ không quá 100%) và đơn vị đúng
     * theo chỉ số (kg, cm, %; BMI không có đơn vị). Trả đơn vị chuẩn.
     */
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

    /**
     * Tên chỉ số phải thuộc danh sách cho phép (weight, height, bmi, body_fat, muscle_mass, waist); trả tên chữ
     * thường.
     */
    private String validateAndNormalizeMetricName(String rawName) {
        String metricName = rawName == null ? "" : rawName.toLowerCase(Locale.ROOT);
        if (!ALLOWED_METRICS.contains(metricName)) {
            throw new BadRequestException("INVALID_METRIC", "health.metrics.invalid_metric", null,
                    "Invalid health metric name");
        }
        return metricName;
    }

    /** Lấy số đo theo id và bắt buộc thuộc đúng hội viên. */
    private MemberProgressLog findOwnedMetric(Long memberId, Long metricId) {
        MemberProgressLog log = progressLogRepository.findById(metricId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.health_metric", metricId));
        if (log.getMember() == null || !memberId.equals(log.getMember().getUserId())) {
            throw new BadRequestException("INVALID_MEMBER_METRIC", "health.metrics.invalid_member", null,
                    "Health metric does not belong to this member");
        }
        return log;
    }

    /** Chuyển số đo sang DTO. */
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

    /** Vai trò có phải quản lý không (CENTER_MANAGER hoặc MANAGER). */
    private boolean isManager(String role) {
        return "CENTER_MANAGER".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role);
    }

    /** Vai trò có phải HLV không. */
    private boolean isCoach(String role) {
        return "COACH".equalsIgnoreCase(role);
    }
}
