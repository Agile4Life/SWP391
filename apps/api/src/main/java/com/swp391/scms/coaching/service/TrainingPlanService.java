package com.swp391.scms.coaching.service;

import com.swp391.scms.ai.entity.AiRecommendationLog;
import com.swp391.scms.ai.repository.AiRecommendationLogRepository;
import com.swp391.scms.coaching.dto.TrainingPlanCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemDto;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.entity.TrainingPlanItem;
import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Nghiệp vụ giáo án: HLV/quản lý tạo, sửa, kích hoạt, áp dụng lại, xóa giáo án; hội viên xem giáo án đang áp
 * dụng (trừ hạng Silver). Mỗi cặp hội viên - HLV chỉ có một giáo án đang áp dụng, giáo án bị thay thế vào lịch
 * sử.
 */
@Service
@Transactional
public class TrainingPlanService {

    private final TrainingPlanRepository trainingPlanRepository;
    private final TrainingPlanItemRepository trainingPlanItemRepository;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final GymClassRepository gymClassRepository;
    private final AiRecommendationLogRepository aiRecommendationLogRepository;

    /** Constructor cho test với các repository bắt buộc. */
    public TrainingPlanService(TrainingPlanRepository trainingPlanRepository,
                               TrainingPlanItemRepository trainingPlanItemRepository,
                               MemberRepository memberRepository,
                               CoachRepository coachRepository) {
        this(trainingPlanRepository, trainingPlanItemRepository, memberRepository, coachRepository, null, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public TrainingPlanService(TrainingPlanRepository trainingPlanRepository,
                               TrainingPlanItemRepository trainingPlanItemRepository,
                               MemberRepository memberRepository,
                               CoachRepository coachRepository,
                               @Autowired(required = false) GymClassRepository gymClassRepository,
                               @Autowired(required = false) AiRecommendationLogRepository aiRecommendationLogRepository) {
        this.trainingPlanRepository = trainingPlanRepository;
        this.trainingPlanItemRepository = trainingPlanItemRepository;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.gymClassRepository = gymClassRepository;
        this.aiRecommendationLogRepository = aiRecommendationLogRepository;
    }

    /**
     * Tạo giáo án: ngày hợp lệ; HLV chỉ tạo cho chính mình và cho hội viên có buổi PT với mình cùng gói
     * Gold/Platinum; gắn lớp/gợi ý AI nếu có; có thể kích hoạt ngay (giáo án cũ của cùng HLV vào lịch sử); lưu
     * các bài tập sau khi kiểm tra.
     */
    public TrainingPlanDto createPlan(TrainingPlanCreateDto dto, Long currentUserId, String currentUserRole) {
        if (dto.getStartDate() == null || dto.getEndDate() == null || dto.getStartDate().isAfter(dto.getEndDate())) {
            throw new BadRequestException("INVALID_DATE_RANGE", "coaching.plan.invalid_date_range", null,
                    "Start date cannot be after end date");
        }

        boolean activateImmediately = Boolean.TRUE.equals(dto.getActivate())
                || "active".equalsIgnoreCase(dto.getStatus());
        java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        if (activateImmediately && dto.getEndDate().isBefore(today)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "coaching.plan.invalid_date_range", null,
                    "Cannot activate an expired training plan");
        }

        Member member = (activateImmediately
                ? memberRepository.findByUserIdForUpdate(dto.getMemberId()).or(() -> memberRepository.findById(dto.getMemberId()))
                : memberRepository.findById(dto.getMemberId()))
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", dto.getMemberId()));

        Long targetCoachId = dto.getCoachId() != null ? dto.getCoachId() : currentUserId;
        if (targetCoachId == null) {
            throw new BadRequestException("COACH_REQUIRED", "coaching.plan.coach_required", null,
                    "Coach ID is required");
        }
        if (isCoach(currentUserRole) && currentUserId != null && !currentUserId.equals(targetCoachId)) {
            throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                    "Coaches can only create training plans for themselves");
        }
        if (isCoach(currentUserRole)) requirePersonalPlanEligibility(currentUserId, member.getUserId());

        Coach coach = coachRepository.findById(targetCoachId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", targetCoachId));

        TrainingPlan plan = new TrainingPlan();
        plan.setMember(member);
        plan.setCoach(coach);
        String resolvedGoal = (dto.getGoal() != null && !dto.getGoal().isBlank())
                ? dto.getGoal().trim()
                : (dto.getTitle() != null && !dto.getTitle().isBlank() ? dto.getTitle().trim() : null);
        plan.setGoal(resolvedGoal);
        plan.setStartDate(dto.getStartDate());
        plan.setEndDate(dto.getEndDate());
        plan.setStatus(activateImmediately ? "active" : "draft");
        plan.setAiGenerated(Boolean.TRUE.equals(dto.getAiGenerated()));

        if (dto.getClassId() != null && gymClassRepository != null) {
            GymClass gymClass = gymClassRepository.findById(dto.getClassId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", dto.getClassId()));
            plan.setGymClass(gymClass);
        }

        if (dto.getAiRecommendationId() != null && aiRecommendationLogRepository != null) {
            AiRecommendationLog recoLog = aiRecommendationLogRepository.findById(dto.getAiRecommendationId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.ai_recommendation", dto.getAiRecommendationId()));
            if (recoLog.getMember() == null || !member.getUserId().equals(recoLog.getMember().getUserId())) {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                        "AI recommendation does not belong to this member");
            }
            plan.setAiGenerated(true);
            plan.setAiRecommendation(recoLog);
            recoLog.setApplied(true);
            aiRecommendationLogRepository.save(recoLog);
        }

        if (activateImmediately) supersedeOtherActivePlans(plan);
        TrainingPlan savedPlan = trainingPlanRepository.save(plan);

        List<TrainingPlanItem> savedItems = new ArrayList<>();
        if (dto.getItems() != null && !dto.getItems().isEmpty()) {
            int idx = 1;
            for (TrainingPlanItemCreateDto itemDto : dto.getItems()) {
                validateItem(itemDto);
                TrainingPlanItem item = buildItem(savedPlan, itemDto,
                        itemDto.getOrderIndex() != null ? itemDto.getOrderIndex() : idx);
                savedItems.add(trainingPlanItemRepository.save(item));
                idx++;
            }
        }

        return toDto(savedPlan, savedItems);
    }

    /** Thêm một bài tập vào giáo án chưa hủy/hoàn thành (chỉ HLV sở hữu hoặc quản lý). */
    public TrainingPlanDto addItem(Long planId, TrainingPlanItemCreateDto itemDto, Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));

        verifyCoachOwnership(plan, currentUserId, currentUserRole);
        if (!"draft".equalsIgnoreCase(plan.getStatus()) && !"active".equalsIgnoreCase(plan.getStatus())) {
            throw new ConflictException("INVALID_PLAN_STATUS", "coaching.plan.cannot_modify_status",
                    new Object[]{plan.getStatus()}, "Cannot modify training plan in status " + plan.getStatus());
        }

        validateItem(itemDto);
        List<TrainingPlanItem> existing = trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId);
        int nextOrder = itemDto.getOrderIndex() != null ? itemDto.getOrderIndex() : existing.size() + 1;

        TrainingPlanItem item = buildItem(plan, itemDto, nextOrder);
        trainingPlanItemRepository.save(item);

        List<TrainingPlanItem> updatedItems = trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId);
        return toDto(plan, updatedItems);
    }

    /**
     * Kích hoạt giáo án nháp (hoặc đang áp dụng); giáo án đang áp dụng khác của cùng HLV cho hội viên vào lịch
     * sử.
     */
    public TrainingPlanDto activatePlan(Long planId, Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));

        verifyCoachOwnership(plan, currentUserId, currentUserRole);

        if (!"draft".equalsIgnoreCase(plan.getStatus()) && !"active".equalsIgnoreCase(plan.getStatus())) {
            throw new ConflictException("INVALID_PLAN_STATUS", "coaching.plan.invalid_activate_status",
                    new Object[]{plan.getStatus()}, "Only draft training plans can be activated");
        }
        java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        if (plan.getEndDate() != null && plan.getEndDate().isBefore(today)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "coaching.plan.invalid_date_range", null,
                    "Cannot activate an expired training plan");
        }

        lockMember(plan.getMember() != null ? plan.getMember().getUserId() : null);
        supersedeOtherActivePlans(plan);
        plan.setStatus("active");
        TrainingPlan saved = trainingPlanRepository.save(plan);
        List<TrainingPlanItem> items = trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId);
        return toDto(saved, items);
    }

    /**
     * Đưa một giáo án từ lịch sử của hội viên trở lại làm giáo án đang áp dụng. Giáo án mà cùng HLV đang áp dụng cho
     * hội viên sẽ chuyển vào lịch sử, đảm bảo mỗi cặp hội viên–HLV có đúng một giáo án hiện hành. Giáo án có khoảng
     * thời gian đã kết thúc sẽ được cấp khung thời gian mới cùng độ dài bắt đầu từ hôm nay để tránh ở trạng thái
     * "active" nhưng nằm ngoài ngày hiệu lực.
     */
    public TrainingPlanDto reapplyPlan(Long planId, Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));
        verifyCoachOwnership(plan, currentUserId, currentUserRole);
        if (!"superseded".equalsIgnoreCase(plan.getStatus())) {
            throw new ConflictException("INVALID_PLAN_STATUS", "coaching.plan.invalid_reapply_status",
                    new Object[]{plan.getStatus()}, "Only plans in history can be re-applied");
        }
        lockMember(plan.getMember() != null ? plan.getMember().getUserId() : null);
        java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        if (plan.getEndDate().isBefore(today)) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(plan.getStartDate(), plan.getEndDate());
            plan.setStartDate(today);
            plan.setEndDate(today.plusDays(days));
        }
        supersedeOtherActivePlans(plan);
        plan.setStatus("active");
        TrainingPlan saved = trainingPlanRepository.save(plan);
        return toDto(saved, trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId));
    }

    /** Khóa dòng hội viên để tuần tự hóa thao tác kích hoạt/thay thế giáo án active, ngăn race tạo 2 bản active. */
    private void lockMember(Long memberId) {
        if (memberRepository != null && memberId != null) {
            memberRepository.findByUserIdForUpdate(memberId);
        }
    }

    /**
     * Mỗi cặp hội viên–HLV chỉ có một giáo án đang áp dụng; các giáo án bị thay thế được chuyển sang lịch sử
     * (superseded) thay vì xóa. Giáo án của các HLV khác của hội viên được giữ nguyên.
     */
    private void supersedeOtherActivePlans(TrainingPlan current) {
        if (current.getMember() == null || current.getMember().getUserId() == null
                || current.getCoach() == null || current.getCoach().getUserId() == null) return;
        Long exceptId = current.getId() != null ? current.getId() : -1L;
        var others = trainingPlanRepository.findOtherActiveForMemberAndCoach(
                current.getMember().getUserId(), current.getCoach().getUserId(), exceptId);
        if (others == null) return;
        for (TrainingPlan other : others) {
            other.setStatus("superseded");
            trainingPlanRepository.save(other);
        }
    }

    /**
     * Sửa giáo án nháp/đang áp dụng: ngày hợp lệ, cập nhật mục tiêu và bài tập (mỗi bài một lần, phải thuộc
     * giáo án).
     */
    public TrainingPlanDto updatePlan(Long planId, com.swp391.scms.coaching.dto.TrainingPlanUpdateDto dto,
                                      Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));
        verifyCoachOwnership(plan, currentUserId, currentUserRole);
        if (!"draft".equalsIgnoreCase(plan.getStatus()) && !"active".equalsIgnoreCase(plan.getStatus())) {
            throw new ConflictException("INVALID_PLAN_STATUS", "coaching.plan.cannot_modify_status",
                    new Object[]{plan.getStatus()}, "Cannot modify training plan in status " + plan.getStatus());
        }
        java.time.LocalDate start = dto.getStartDate() != null ? dto.getStartDate() : plan.getStartDate();
        java.time.LocalDate end = dto.getEndDate() != null ? dto.getEndDate() : plan.getEndDate();
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "coaching.plan.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        List<TrainingPlanItem> items = trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId);
        if (dto.getItems() != null) {
            var seen = new java.util.HashSet<Long>();
            for (var update : dto.getItems()) {
                if (update == null || update.getId() == null || !seen.add(update.getId())
                        || items.stream().noneMatch(item -> update.getId().equals(item.getId()))) {
                    throw new BadRequestException("INVALID_PLAN_ITEM", "coaching.plan.item_not_owned", null, null);
                }
                validateItem(update);
            }
            for (var update : dto.getItems()) {
                var item = items.stream().filter(existing -> update.getId().equals(existing.getId())).findFirst().orElseThrow();
                item.setDayOfWeek(update.getDayOfWeek());item.setExerciseName(update.getExerciseName().trim());
                item.setDescription(update.getDescription());item.setSets(update.getSets());item.setReps(update.getReps());
                item.setDurationMinutes(update.getDurationMinutes());item.setRestSeconds(update.getRestSeconds());
            }
        }
        plan.setStartDate(start);
        plan.setEndDate(end);
        if (dto.getGoal() != null) {
            plan.setGoal(dto.getGoal().isBlank() ? null : dto.getGoal().trim());
        }
        TrainingPlan saved = trainingPlanRepository.save(plan);
        return toDto(saved, items);
    }

    /**
     * Xóa giáo án: bản nháp thì xóa hẳn; giáo án đã kích hoạt hoặc trong lịch sử được thu hồi (chuyển cancelled)
     * mà không xóa bài tập hay lịch sử hoàn thành của hội viên.
     */
    public void deletePlan(Long planId, Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));
        verifyCoachOwnership(plan, currentUserId, currentUserRole);
        if ("cancelled".equalsIgnoreCase(plan.getStatus())) return;
        if ("active".equalsIgnoreCase(plan.getStatus()) || "superseded".equalsIgnoreCase(plan.getStatus())) {
            plan.setStatus("cancelled");trainingPlanRepository.save(plan);return;
        }
        if (!"draft".equalsIgnoreCase(plan.getStatus())) {
            throw new ConflictException("INVALID_PLAN_STATUS", "coaching.plan.cannot_delete_status",
                    new Object[]{plan.getStatus()}, null);
        }
        trainingPlanRepository.delete(plan);
    }

    @Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository;

    /**
     * Hội viên có được xem giáo án HLV soạn hay không (spec 2026-11-09): hội viên hạng Silver không thấy giáo án
     * (HLV vẫn có thể tạo và giáo án sẽ hiện ngay khi hội viên lên Gold hoặc Platinum). Hội viên không có gói hiệu lực
     * giữ nguyên hành vi cũ, còn gói trải nghiệm áp dụng theo hạng Gold.
     */
    boolean memberMaySeePlans(Long memberId) {
        if (subscriptionRepository == null || memberId == null) return true;
        java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        var current = subscriptionRepository.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null
                        && !s.getStartDate().isAfter(today) && !s.getEndDate().isBefore(today))
                .toList();
        return current.isEmpty() || current.stream()
                .anyMatch(s -> com.swp391.scms.facilities.PackageBenefits.canViewWorkoutPlan(s.getMembershipPackage()));
    }

    /** Các giáo án đang áp dụng của hội viên (rỗng nếu hội viên không được xem). */
    @Transactional(readOnly = true)
    public List<TrainingPlanDto> getMyActivePlans(Long memberId) {
        if (!memberMaySeePlans(memberId)) {
            return List.of();
        }
        return trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(memberId, "active")
                .stream()
                .map(plan -> toDto(plan, trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(plan.getId())))
                .toList();
    }

    /**
     * Chi tiết giáo án: HLV chỉ xem giáo án của chính mình hoặc giáo án không phải nháp/hủy của học viên mình
     * đang phụ trách (qua CurrentCoachMembers); hội viên chỉ xem giáo án active/completed của mình và phải đủ
     * hạng gói.
     */
    @Transactional(readOnly = true)
    public TrainingPlanDto getPlanById(Long planId, Long currentUserId, String currentUserRole) {
        TrainingPlan plan = trainingPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", planId));

        if (isCoach(currentUserRole)) {
            boolean isOwnPlan = plan.getCoach() != null && currentUserId != null
                    && currentUserId.equals(plan.getCoach().getUserId());
            if (!isOwnPlan) {
                requireCurrentAssignment(currentUserId, plan.getMember() != null ? plan.getMember().getUserId() : null);
                if ("draft".equalsIgnoreCase(plan.getStatus()) || "cancelled".equalsIgnoreCase(plan.getStatus())) {
                    throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                            "You do not have permission to view another coach's draft or cancelled training plan");
                }
            }
        } else if (!isManager(currentUserRole)) {
            Long ownerId = plan.getMember() != null ? plan.getMember().getUserId() : null;
            if (currentUserId == null || !currentUserId.equals(ownerId)) {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                        "You do not have permission to view this training plan");
            }
            if (!"active".equalsIgnoreCase(plan.getStatus()) && !"completed".equalsIgnoreCase(plan.getStatus())) {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                        "Members can only view active or completed training plans");
            }
            if (!memberMaySeePlans(ownerId)) {
                throw new ForbiddenException("COACHING_PLAN_TIER_REQUIRED", "coaching.plan.tier_required", null,
                        "Training plans are available from the Gold package");
            }
        }

        List<TrainingPlanItem> items = trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(planId);
        return toDto(plan, items);
    }

    /** Danh sách giáo án: theo hội viên (kiểm tra phân công hiện tại của HLV) hoặc của chính HLV/tất cả cho quản lý. */
    @Transactional(readOnly = true)
    public List<TrainingPlanDto> getPlans(Long memberId, Long currentUserId, String currentUserRole) {
        List<TrainingPlan> plans;
        if (memberId != null) {
            if (isCoach(currentUserRole)) {
                requireCurrentAssignment(currentUserId, memberId);
                plans = trainingPlanRepository.findByMemberUserIdOrderByCreatedAtDesc(memberId).stream()
                        .filter(p -> (p.getCoach() != null && currentUserId != null && currentUserId.equals(p.getCoach().getUserId()))
                                || (!"draft".equalsIgnoreCase(p.getStatus()) && !"cancelled".equalsIgnoreCase(p.getStatus())))
                        .toList();
            } else if (isManager(currentUserRole)) {
                plans = trainingPlanRepository.findByMemberUserIdOrderByCreatedAtDesc(memberId);
            } else {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                        "You do not have permission to list training plans");
            }
        } else if (isCoach(currentUserRole) && currentUserId != null) {
            plans = trainingPlanRepository.findByCoachUserIdOrderByCreatedAtDesc(currentUserId);
        } else {
            plans = trainingPlanRepository.findAllByOrderByCreatedAtDesc();
        }
        return plans.stream()
                .map(plan -> toDto(plan, trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(plan.getId())))
                .toList();
    }

    /** Quản lý được sửa mọi giáo án; HLV chỉ sửa giáo án của mình (giáo án chưa giao thuộc quản lý). */
    private void verifyCoachOwnership(TrainingPlan plan, Long currentUserId, String currentUserRole) {
        if (isManager(currentUserRole)) {
            return;
        }
        Long planCoachId = plan.getCoach() != null ? plan.getCoach().getUserId() : null;
        if (currentUserId != null && currentUserId.equals(planCoachId)) {
            return;
        }
        if (isCoach(currentUserRole)) {
            requireCurrentAssignment(currentUserId, plan.getMember() != null ? plan.getMember().getUserId() : null);
        }
        // Giáo án chưa gán HLV thuộc quyền quản lý; giáo án đã gán thì chỉ HLV phụ trách giáo án đó được chỉnh sửa.
        if (currentUserId == null || planCoachId == null || !currentUserId.equals(planCoachId)) {
            throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null,
                    "You can only modify your own training plans");
        }
    }

    /**
     * Kiểm tra bài tập: tên bắt buộc (tối đa 150 ký tự), hiệp/lần/phút từ 1 trở lên, nghỉ không âm, thứ trong
     * tuần 1-7.
     */
    private void validateItem(TrainingPlanItemCreateDto itemDto) {
        if (itemDto.getExerciseName() == null || itemDto.getExerciseName().isBlank()) {
            throw new BadRequestException("EXERCISE_NAME_REQUIRED", "validation.coaching.exercise_name.not_blank",
                    null, "Exercise name is required");
        }
        if (itemDto.getExerciseName().trim().length() > 150) {
            throw new BadRequestException("INVALID_EXERCISE_NAME", "validation.coaching.exercise_name.size", null, null);
        }
        if (itemDto.getSets() != null && itemDto.getSets() < 1)
            throw new BadRequestException("INVALID_SETS", "validation.coaching.sets.min", null, null);
        if (itemDto.getReps() != null && itemDto.getReps() < 1)
            throw new BadRequestException("INVALID_REPS", "validation.coaching.reps.min", null, null);
        if (itemDto.getDurationMinutes() != null && itemDto.getDurationMinutes() < 1)
            throw new BadRequestException("INVALID_DURATION", "validation.coaching.duration.min", null, null);
        if (itemDto.getRestSeconds() != null && itemDto.getRestSeconds() < 0)
            throw new BadRequestException("INVALID_REST", "validation.coaching.rest.min", null, null);
        if (itemDto.getDayOfWeek() != null && (itemDto.getDayOfWeek() < 1 || itemDto.getDayOfWeek() > 7)) {
            throw new BadRequestException("INVALID_DAY_OF_WEEK", "validation.coaching.day_of_week.range",
                    null, "Day of week must be between 1 and 7");
        }
    }

    /** Tạo entity bài tập thuộc giáo án với thứ tự cho trước. */
    private TrainingPlanItem buildItem(TrainingPlan plan, TrainingPlanItemCreateDto dto, int orderIndex) {
        TrainingPlanItem item = new TrainingPlanItem();
        item.setTrainingPlan(plan);
        item.setDayOfWeek(dto.getDayOfWeek());
        item.setExerciseName(dto.getExerciseName().trim());
        item.setDescription(dto.getDescription());
        item.setRestSeconds(dto.getRestSeconds());
        item.setSets(dto.getSets());
        item.setReps(dto.getReps());
        item.setDurationMinutes(dto.getDurationMinutes());
        item.setOrderIndex(orderIndex);
        return item;
    }

    /** Chuyển giáo án sang DTO kèm hội viên, HLV, lớp, gợi ý AI và các bài tập. */
    private TrainingPlanDto toDto(TrainingPlan plan, List<TrainingPlanItem> items) {
        TrainingPlanDto dto = new TrainingPlanDto();
        dto.setId(plan.getId());
        if (plan.getMember() != null) {
            dto.setMemberId(plan.getMember().getUserId());
            if (plan.getMember().getUser() != null) {
                dto.setMemberName(plan.getMember().getUser().getFullName());
            }
        }
        if (plan.getCoach() != null) {
            dto.setCoachId(plan.getCoach().getUserId());
            if (plan.getCoach().getUser() != null) {
                dto.setCoachName(plan.getCoach().getUser().getFullName());
            }
        }
        if (plan.getGymClass() != null) {
            dto.setClassId(plan.getGymClass().getId());
        }
        dto.setGoal(plan.getGoal());
        dto.setStartDate(plan.getStartDate());
        dto.setEndDate(plan.getEndDate());
        dto.setStatus(plan.getStatus());
        dto.setAiGenerated(plan.isAiGenerated());
        if (plan.getAiRecommendation() != null) {
            dto.setAiRecommendationId(plan.getAiRecommendation().getId());
        }
        dto.setCreatedAt(plan.getCreatedAt());
        dto.setUpdatedAt(plan.getUpdatedAt());

        List<TrainingPlanItemDto> itemDtos = items == null ? List.of() : items.stream()
                .map(i -> { var itemDto = new TrainingPlanItemDto(
                        i.getId(),
                        plan.getId(),
                        i.getDayOfWeek(),
                        i.getExerciseName(),
                        i.getDescription(),
                        i.getSets(),
                        i.getReps(),
                        i.getDurationMinutes(),
                        i.getOrderIndex()
                ); itemDto.setRestSeconds(i.getRestSeconds()); return itemDto; })
                .toList();
        dto.setItems(itemDtos);
        return dto;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private CurrentCoachMembers currentCoachMembers;

    @Autowired(required = false)
    private com.swp391.scms.coaching.repository.CoachBookingRepository coachBookingRepository;

    /**
     * HLV chỉ được soạn giáo án cá nhân cho hội viên đã đăng ký buổi PT 1:1 với mình và đang có gói Gold/Platinum.
     */
    private void requirePersonalPlanEligibility(Long coachId, Long memberId) {
        if (coachBookingRepository != null && !coachBookingRepository.existsForCoachAndMember(coachId, memberId)) {
            throw new ForbiddenException("PT_SESSION_REQUIRED", "coaching.plan.pt_required", null,
                    "A personal plan needs a registered 1:1 PT session");
        }
        if (subscriptionRepository != null) {
            java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
            boolean eligible = subscriptionRepository.findByMemberUserIdAndStatus(memberId, "active").stream()
                    .anyMatch(sub -> sub.getStartDate() != null && sub.getEndDate() != null
                            && !sub.getStartDate().isAfter(today) && !sub.getEndDate().isBefore(today)
                            && com.swp391.scms.facilities.PackageBenefits.canViewWorkoutPlan(sub.getMembershipPackage()));
            if (!eligible) throw new ForbiddenException("PLAN_TIER_REQUIRED", "coaching.plan.tier_required_author", null,
                    "Personal plans need a Gold or Platinum package");
        }
    }

    /** HLV phải đang phụ trách hội viên. */
    private void requireCurrentAssignment(Long coachId, Long memberId) {
        if(currentCoachMembers == null) throw new ForbiddenException("COACH_MEMBER_NOT_ASSIGNED", "coaching.member.not_assigned", null, "Current assignment cannot be verified.");
        currentCoachMembers.requireCoachOf(coachId, memberId);
    }

    /** Vai trò quản lý trung tâm. */
    private boolean isManager(String role) {
        return "CENTER_MANAGER".equalsIgnoreCase(role) || "Manager".equalsIgnoreCase(role);
    }

    /** Vai trò HLV. */
    private boolean isCoach(String role) {
        return "COACH".equalsIgnoreCase(role) || "Coach".equalsIgnoreCase(role);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.coaching.service.CoachMemberAccess coachMemberAccess;
}

