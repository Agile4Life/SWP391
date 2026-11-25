package com.swp391.scms.coaching;

import com.swp391.scms.ai.entity.AiRecommendationLog;
import com.swp391.scms.ai.repository.AiRecommendationLogRepository;
import com.swp391.scms.coaching.dto.TrainingPlanCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.entity.TrainingPlanItem;
import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.coaching.service.TrainingPlanService;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service TrainingPlanService (training plan service). */
@ExtendWith(MockitoExtension.class)
class TrainingPlanServiceTest {

    @Mock
    private TrainingPlanRepository trainingPlanRepository;

    @Mock
    private TrainingPlanItemRepository trainingPlanItemRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private CoachRepository coachRepository;

    @Mock
    private GymClassRepository gymClassRepository;

    @Mock
    private AiRecommendationLogRepository aiRecommendationLogRepository;

    private TrainingPlanService service;

    @Mock private com.swp391.scms.coaching.service.CurrentCoachMembers currentCoachMembers;

    /** Chuẩn bị trước mỗi test: tạo TrainingPlanService với repository giả lập. */
    @BeforeEach
    void setUp() {
        service = new TrainingPlanService(
                trainingPlanRepository,
                trainingPlanItemRepository,
                memberRepository,
                coachRepository,
                gymClassRepository,
                aiRecommendationLogRepository
        );
        org.springframework.test.util.ReflectionTestUtils.setField(service,"currentCoachMembers",currentCoachMembers);
    }

    /** Kiểm thử: tạo kế hoạch ở trạng thái nháp kèm các mục tập. */
    @Test
    @DisplayName("Should create training plan in draft status with ordered items")
    void shouldCreatePlanInDraftWithItems() {
        User memberUser = new User();
        memberUser.setId(10L);
        memberUser.setFullName("Nguyễn Văn An");
        Member member = new Member();
        member.setUserId(10L);
        member.setUser(memberUser);

        User coachUser = new User();
        coachUser.setId(20L);
        coachUser.setFullName("HLV Khoa");
        Coach coach = new Coach();
        coach.setUserId(20L);
        coach.setUser(coachUser);

        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> {
            TrainingPlan p = inv.getArgument(0);
            ReflectionTestUtils.setField(p, "id", 100L);
            return p;
        });
        when(trainingPlanItemRepository.save(any(TrainingPlanItem.class))).thenAnswer(inv -> {
            TrainingPlanItem item = inv.getArgument(0);
            ReflectionTestUtils.setField(item, "id", 500L + item.getOrderIndex());
            return item;
        });

        TrainingPlanCreateDto dto = new TrainingPlanCreateDto();
        dto.setMemberId(10L);
        dto.setGoal("Tăng cơ giảm mỡ 8 tuần");
        dto.setStartDate(LocalDate.of(2026, 10, 20));
        dto.setEndDate(LocalDate.of(2026, 12, 15));
        dto.setItems(List.of(
                new TrainingPlanItemCreateDto(1, "Barbell Squat", "Giữ lưng thẳng", 4, 10, 15, null),
                new TrainingPlanItemCreateDto(3, "Romanian Deadlift", "Kiểm soát nhịp hạ", 3, 12, 15, null)
        ));

        TrainingPlanDto created = service.createPlan(dto, 20L, "COACH");

        assertNotNull(created);
        assertEquals(100L, created.getId());
        assertEquals("draft", created.getStatus());
        assertEquals(10L, created.getMemberId());
        assertEquals(20L, created.getCoachId());
        assertEquals(2, created.getItems().size());
        assertEquals(1, created.getItems().get(0).getOrderIndex());
        assertEquals("Barbell Squat", created.getItems().get(0).getExerciseName());
        assertEquals(2, created.getItems().get(1).getOrderIndex());
    }

    /** Kiểm thử: từ chối khoảng ngày không hợp lệ. */
    @Test
    @DisplayName("Should reject plan creation when startDate is after endDate")
    void shouldRejectInvalidDateRange() {
        TrainingPlanCreateDto dto = new TrainingPlanCreateDto();
        dto.setMemberId(10L);
        dto.setStartDate(LocalDate.of(2026, 11, 10));
        dto.setEndDate(LocalDate.of(2026, 10, 10));

        assertThrows(BadRequestException.class, () -> service.createPlan(dto, 20L, "COACH"));
    }

    /** Kiểm thử: kích hoạt kế hoạch nháp. */
    @Test
    @DisplayName("Should activate draft plan when owned by coach")
    void shouldActivateDraftPlan() {
        Coach coach = new Coach();
        coach.setUserId(20L);
        Member member = new Member();
        member.setUserId(10L);

        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        plan.setCoach(coach);
        plan.setMember(member);
        plan.setStatus("draft");

        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());

        TrainingPlanDto activated = service.activatePlan(100L, 20L, "COACH");

        assertEquals("active", activated.getStatus());
        verify(trainingPlanRepository).save(plan);
    }

    /** Kiểm thử: cấm kích hoạt kế hoạch của HLV khác. */
    @Test
    @DisplayName("Should forbid activating another coach's training plan")
    void shouldForbidActivatingOtherCoachPlan() {
        Coach coach = new Coach();
        coach.setUserId(20L);
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        plan.setCoach(coach);
        plan.setStatus("draft");

        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));

        assertThrows(ForbiddenException.class, () -> service.activatePlan(100L, 99L, "COACH"));
    }

    /** Kiểm thử: từ chối kích hoạt kế hoạch đã hủy. */
    @Test
    @DisplayName("Should reject activating cancelled training plan")
    void shouldRejectActivatingCancelledPlan() {
        Coach coach = new Coach();
        coach.setUserId(20L);
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        plan.setCoach(coach);
        plan.setStatus("cancelled");

        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));

        assertThrows(ConflictException.class, () -> service.activatePlan(100L, 20L, "COACH"));
    }

    /** Kiểm thử: trả các kế hoạch đang hoạt động của tôi. */
    @Test
    @DisplayName("Should return active training plans for member")
    void shouldReturnMyActivePlans() {
        Member member = new Member();
        member.setUserId(10L);
        Coach coach = new Coach();
        coach.setUserId(20L);

        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        plan.setMember(member);
        plan.setCoach(coach);
        plan.setStatus("active");
        plan.setGoal("Core Strength");

        TrainingPlanItem item = new TrainingPlanItem();
        ReflectionTestUtils.setField(item, "id", 1L);
        item.setTrainingPlan(plan);
        item.setDayOfWeek(2);
        item.setExerciseName("Plank Hold");
        item.setSets(3);
        item.setDurationMinutes(5);
        item.setOrderIndex(1);

        when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(10L, "active"))
                .thenReturn(List.of(plan));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L))
                .thenReturn(List.of(item));

        List<TrainingPlanDto> plans = service.getMyActivePlans(10L);

        assertEquals(1, plans.size());
        assertEquals("active", plans.get(0).getStatus());
        assertEquals(1, plans.get(0).getItems().size());
        assertEquals("Plank Hold", plans.get(0).getItems().get(0).getExerciseName());
    }

    /** Hàm trợ giúp của test: tạo subscription đang hoạt động. */
    private com.swp391.scms.membership.entity.MembershipSubscription activeSubscription(String tier) {
        com.swp391.scms.facilities.entity.MembershipPackage pkg = new com.swp391.scms.facilities.entity.MembershipPackage();
        pkg.setName(tier);
        pkg.setTier(tier);
        pkg.setDurationDays(30);
        com.swp391.scms.membership.entity.MembershipSubscription sub = new com.swp391.scms.membership.entity.MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        java.time.LocalDate today = java.time.LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        sub.setStartDate(today.minusDays(2));
        sub.setEndDate(today.plusDays(20));
        return sub;
    }

    /** Kiểm thử: hội viên Silver không thấy kế hoạch tập. */
    @Test
    @DisplayName("Silver members do not see plans; Gold and Platinum do; the coach can still create them")
    void silverMembersDoNotSeeTrainingPlans() {
        com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptions =
                org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
        ReflectionTestUtils.setField(service, "subscriptionRepository", subscriptions);
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        Member owner = new Member();
        owner.setUserId(10L);
        plan.setMember(owner);
        plan.setStatus("active");
        lenient().when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(10L, "active")).thenReturn(List.of(plan));
        lenient().when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        lenient().when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(activeSubscription("SILVER")));
        assertTrue(service.getMyActivePlans(10L).isEmpty());
        assertThrows(ForbiddenException.class, () -> service.getPlanById(100L, 10L, "MEMBER"));
        // Huấn luyện viên vẫn giữ quyền truy cập để giáo án sẵn sàng khi hội viên nâng cấp gói.
        assertDoesNotThrow(() -> service.getPlanById(100L, 20L, "CENTER_MANAGER"));

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(activeSubscription("GOLD")));
        assertEquals(1, service.getMyActivePlans(10L).size());
        assertDoesNotThrow(() -> service.getPlanById(100L, 10L, "MEMBER"));

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(activeSubscription("PLATINUM")));
        assertEquals(1, service.getMyActivePlans(10L).size());
    }

    /** Kiểm thử: tạo kế hoạch đánh dấu gợi ý AI đã được áp dụng. */
    @Test
    @DisplayName("Should mark AI recommendation as applied when creating plan with aiRecommendationId")
    void shouldMarkAiRecommendationAppliedOnCreate() {
        Member member = new Member();
        member.setUserId(10L);
        Coach coach = new Coach();
        coach.setUserId(20L);
        AiRecommendationLog recoLog = new AiRecommendationLog();
        ReflectionTestUtils.setField(recoLog, "id", 55L);
        recoLog.setMember(member);
        recoLog.setApplied(false);

        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(aiRecommendationLogRepository.findById(55L)).thenReturn(Optional.of(recoLog));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> {
            TrainingPlan p = inv.getArgument(0);
            ReflectionTestUtils.setField(p, "id", 101L);
            return p;
        });

        TrainingPlanCreateDto dto = new TrainingPlanCreateDto();
        dto.setMemberId(10L);
        dto.setGoal("AI Hypertrophy Plan");
        dto.setStartDate(LocalDate.of(2026, 10, 20));
        dto.setEndDate(LocalDate.of(2026, 11, 20));
        dto.setAiRecommendationId(55L);

        TrainingPlanDto created = service.createPlan(dto, 20L, "COACH");

        assertTrue(created.isAiGenerated());
        assertEquals(55L, created.getAiRecommendationId());
        assertTrue(recoLog.isApplied());
        verify(aiRecommendationLogRepository).save(recoLog);
    }

    /** Kiểm thử: cấm HLV sửa kế hoạch của hội viên không được phân công. */
    @Test
    @DisplayName("Should forbid a coach from changing a plan no coach is assigned to")
    void shouldForbidCoachEditingUnassignedPlan() {
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 101L);
        plan.setStatus("draft");
        when(trainingPlanRepository.findById(101L)).thenReturn(Optional.of(plan));

        assertThrows(ForbiddenException.class, () -> service.activatePlan(101L, 20L, "COACH"));
    }

    /** Hàm trợ giúp của test: tạo kế hoạch thuộc về HLV. */
    private TrainingPlan ownedPlan(String status) {
        Coach coach = new Coach();
        coach.setUserId(20L);
        Member member = new Member();
        member.setUserId(10L);
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 100L);
        plan.setCoach(coach);
        plan.setMember(member);
        plan.setStatus(status);
        plan.setStartDate(LocalDate.of(2026, 11, 1));
        plan.setEndDate(LocalDate.of(2026, 11, 30));
        return plan;
    }

    /** Kiểm thử: cập nhật kế hoạch của chính mình. */
    @Test
    @DisplayName("Should update goal and dates of an owned plan")
    void shouldUpdateOwnedPlan() {
        TrainingPlan plan = ownedPlan("active");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());
        var dto = new com.swp391.scms.coaching.dto.TrainingPlanUpdateDto();
        dto.setGoal("  Giảm mỡ  ");
        dto.setEndDate(LocalDate.of(2026, 12, 15));
        TrainingPlanDto updated = service.updatePlan(100L, dto, 20L, "COACH");
        assertEquals("Giảm mỡ", updated.getGoal());
        assertEquals(LocalDate.of(2026, 12, 15), updated.getEndDate());
        assertEquals(LocalDate.of(2026, 11, 1), updated.getStartDate());
    }

    /** Kiểm thử: từ chối các cập nhật không hợp lệ. */
    @Test
    @DisplayName("Should reject update with start after end and update of completed plan")
    void shouldRejectInvalidUpdates() {
        TrainingPlan plan = ownedPlan("draft");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        var dto = new com.swp391.scms.coaching.dto.TrainingPlanUpdateDto();
        dto.setStartDate(LocalDate.of(2026, 12, 31));
        assertThrows(BadRequestException.class, () -> service.updatePlan(100L, dto, 20L, "COACH"));
        plan.setStatus("completed");
        assertThrows(ConflictException.class, () -> service.updatePlan(100L, new com.swp391.scms.coaching.dto.TrainingPlanUpdateDto(), 20L, "COACH"));
        verify(trainingPlanRepository, never()).save(any());
    }

    /** Kiểm thử: chỉ xóa được kế hoạch nháp. */
    @Test
    @DisplayName("Should delete only draft plans owned by the caller")
    void shouldDeleteDraftPlanOnly() {
        TrainingPlan plan = ownedPlan("draft");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        assertThrows(ForbiddenException.class, () -> service.deletePlan(100L, 99L, "COACH"));
        verify(trainingPlanRepository, never()).delete(any());
        service.deletePlan(100L, 20L, "COACH");
        verify(trainingPlanRepository).delete(plan);
        plan.setStatus("completed");
        assertThrows(ConflictException.class, () -> service.deletePlan(100L, 20L, "COACH"));
        verify(trainingPlanRepository, times(1)).delete(any());
    }
    @Test void updatesExerciseDetailsWithoutReplacingItsId() {
        var plan = ownedPlan("active");
        var item = new com.swp391.scms.coaching.entity.TrainingPlanItem();
        ReflectionTestUtils.setField(item, "id", 501L); item.setTrainingPlan(plan); item.setExerciseName("Squat");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        when(trainingPlanRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of(item));
        var edit = new com.swp391.scms.coaching.dto.TrainingPlanItemUpdateDto();
        edit.setId(501L); edit.setExerciseName("Squat chỉnh sửa");edit.setDayOfWeek(3);edit.setSets(5);edit.setReps(8);edit.setDurationMinutes(20);edit.setRestSeconds(90);
        var dto = new com.swp391.scms.coaching.dto.TrainingPlanUpdateDto();dto.setItems(List.of(edit));
        var result = service.updatePlan(100L,dto,20L,"COACH");
        assertEquals(501L,result.getItems().getFirst().getId());assertEquals(5,item.getSets());assertEquals(8,item.getReps());
        assertEquals(90,result.getItems().getFirst().getRestSeconds());assertEquals(3,item.getDayOfWeek());
        verify(trainingPlanItemRepository,never()).delete(any());
    }
    @Test void cannotAttachAnotherPlansExerciseToAnUpdate() {
        var plan=ownedPlan("draft");when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());
        var edit=new com.swp391.scms.coaching.dto.TrainingPlanItemUpdateDto();edit.setId(999L);edit.setExerciseName("Squat");
        var dto=new com.swp391.scms.coaching.dto.TrainingPlanUpdateDto();dto.setItems(List.of(edit));
        assertThrows(BadRequestException.class,()->service.updatePlan(100L,dto,20L,"COACH"));verify(trainingPlanRepository,never()).save(any());
    }
    @Test void deletingAnActivePlanHidesItWithoutRemovingItsExerciseHistory() {
        var plan=ownedPlan("active");when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
        service.deletePlan(100L,20L,"COACH");assertEquals("cancelled",plan.getStatus());
        verify(trainingPlanRepository,never()).delete(any());
    }

    @Test void exerciseValidationAllowsZeroRestButRejectsZeroSetsAndNegativeRest() {
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var item = new com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto();
            item.setExerciseName("Squat");item.setSets(3);item.setReps(10);item.setRestSeconds(0);
            assertTrue(validator.validate(item).isEmpty());
            item.setSets(0);assertFalse(validator.validate(item).isEmpty());
            item.setSets(3);item.setRestSeconds(-1);assertFalse(validator.validate(item).isEmpty());
        }
    }


 @Test void rejectsCreatingPlanWithoutRegisteredPtSession() {
  var dto = new com.swp391.scms.coaching.dto.TrainingPlanCreateDto();
  dto.setMemberId(10L);dto.setStartDate(LocalDate.of(2026,11,4));dto.setEndDate(LocalDate.of(2026,11,10));
  Member member=new Member();member.setUserId(10L);when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
  var bookings=org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
  when(bookings.existsForCoachAndMember(20L,10L)).thenReturn(false);
  org.springframework.test.util.ReflectionTestUtils.setField(service,"coachBookingRepository",bookings);
  var ex=assertThrows(com.swp391.scms.common.exception.ForbiddenException.class,()->service.createPlan(dto,20L,"COACH"));
  assertEquals("PT_SESSION_REQUIRED",ex.getErrorCode());
  verify(trainingPlanRepository,never()).save(any());
 }

 @Test void rejectsCreatingPlanForMemberWithoutGoldOrPlatinum() {
  var dto = new com.swp391.scms.coaching.dto.TrainingPlanCreateDto();
  dto.setMemberId(10L);dto.setStartDate(LocalDate.of(2026,11,4));dto.setEndDate(LocalDate.of(2026,11,10));
  Member member=new Member();member.setUserId(10L);when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
  var bookings=org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
  when(bookings.existsForCoachAndMember(20L,10L)).thenReturn(true);
  var subs=org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
  when(subs.findByMemberUserIdAndStatus(10L,"active")).thenReturn(java.util.List.of());
  org.springframework.test.util.ReflectionTestUtils.setField(service,"coachBookingRepository",bookings);
  org.springframework.test.util.ReflectionTestUtils.setField(service,"subscriptionRepository",subs);
  var ex=assertThrows(com.swp391.scms.common.exception.ForbiddenException.class,()->service.createPlan(dto,20L,"COACH"));
  assertEquals("PLAN_TIER_REQUIRED",ex.getErrorCode());
  verify(trainingPlanRepository,never()).save(any());
 }

    /** Kiểm thử: kích hoạt một kế hoạch thay thế kế hoạch active khác của hội viên. */
    @Test
    @DisplayName("Activating a plan moves the same coach's other active plan for the member into history")
    void activatingAPlanSupersedesTheMembersOtherActivePlan() {
        var draft = ownedPlan("draft");
        draft.setEndDate(LocalDate.now(com.swp391.scms.common.CenterTime.ZONE).plusDays(30));
        var previous = ownedPlan("active");
        ReflectionTestUtils.setField(previous, "id", 99L);
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(draft));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanRepository.findOtherActiveForMemberAndCoach(10L, 20L, 100L)).thenReturn(List.of(previous));

        assertEquals("active", service.activatePlan(100L, 20L, "COACH").getStatus());

        assertEquals("superseded", previous.getStatus());
        verify(trainingPlanRepository).save(previous);
    }

    /** Kiểm thử: áp dụng lại kế hoạch lịch sử hoán đổi với kế hoạch đang hoạt động. */
    @Test
    @DisplayName("Re-applying a history plan makes it active and moves the current plan to history")
    void reapplyingAHistoryPlanSwapsItWithTheActiveOne() {
        var history = ownedPlan("superseded");
        var current = ownedPlan("active");
        ReflectionTestUtils.setField(current, "id", 101L);
        LocalDate baseDate = LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        LocalDate expectedEnd = baseDate.plusDays(18);
        history.setStartDate(baseDate.minusDays(10));
        history.setEndDate(expectedEnd);
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(history));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanRepository.findOtherActiveForMemberAndCoach(10L, 20L, 100L)).thenReturn(List.of(current));

        var result = service.reapplyPlan(100L, 20L, "COACH");

        assertEquals("active", result.getStatus());
        assertEquals("superseded", current.getStatus());
        assertEquals(expectedEnd, result.getEndDate(), "A plan still in its period keeps its dates");
    }

    /** Kiểm thử: áp dụng lại kế hoạch đã hết hạn dời ngày về hôm nay. */
    @Test
    @DisplayName("Re-applying a plan whose period ended gives it a new window of the same length")
    void reapplyingAnExpiredPlanShiftsItsDatesToToday() {
        var history = ownedPlan("superseded");
        history.setStartDate(LocalDate.of(2026, 1, 1));
        history.setEndDate(LocalDate.of(2026, 1, 29));
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(history));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate before = LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);
        var result = service.reapplyPlan(100L, 20L, "COACH");
        LocalDate after = LocalDate.now(com.swp391.scms.common.CenterTime.ZONE);

        assertFalse(result.getStartDate().isBefore(before));
        assertFalse(result.getStartDate().isAfter(after));
        assertEquals(result.getStartDate().plusDays(28), result.getEndDate());
    }

    /** Kiểm thử: từ chối áp dụng lại kế hoạch ngoài lịch sử. */
    @Test
    @DisplayName("Only plans in history can be re-applied")
    void reapplyRejectsPlansOutsideHistory() {
        var active = ownedPlan("active");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(active));
        assertThrows(ConflictException.class, () -> service.reapplyPlan(100L, 20L, "COACH"));
        verify(trainingPlanRepository, never()).save(any());
    }

    /** Kiểm thử: kích hoạt kế hoạch chỉ xét các kế hoạch của cùng HLV. */
    @Test
    @DisplayName("Activating a plan leaves the active plans of the member's other coaches alone")
    void activatingAPlanOnlyLooksAtTheSameCoachsPlans() {
        var draft = ownedPlan("draft");
        draft.setEndDate(LocalDate.now(com.swp391.scms.common.CenterTime.ZONE).plusDays(30));
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(draft));
        when(trainingPlanRepository.save(any(TrainingPlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainingPlanRepository.findOtherActiveForMemberAndCoach(10L, 20L, 100L)).thenReturn(List.of());

        assertEquals("active", service.activatePlan(100L, 20L, "COACH").getStatus());

        verify(trainingPlanRepository).findOtherActiveForMemberAndCoach(10L, 20L, 100L);
        verify(trainingPlanRepository, times(1)).save(any(TrainingPlan.class));
    }

    /** Kiểm thử P1-BE-26: hội viên không đọc được giáo án draft/cancelled/superseded theo ID, nhưng đọc được completed. */
    @Test
    @DisplayName("P1-BE-26: Member cannot view draft, cancelled, or superseded plans via getPlanById")
    void memberCannotViewDraftCancelledOrSupersededPlanById() {
        for (String blockedStatus : List.of("draft", "cancelled", "superseded")) {
            var plan = ownedPlan(blockedStatus);
            when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(plan));
            assertThrows(ForbiddenException.class, () -> service.getPlanById(100L, 10L, "MEMBER"));
        }
        var completed = ownedPlan("completed");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(completed));
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());
        assertEquals("completed", service.getPlanById(100L, 10L, "MEMBER").getStatus());
    }

    /** Kiểm thử P1-BE-26: HLV khác phải có phân công hiện tại qua CurrentCoachMembers và không bao giờ xem được bản nháp của HLV khác. */
    @Test
    @DisplayName("P1-BE-26: Cross-coach read requires active CurrentCoachMembers assignment and hides private drafts")
    void otherCoachRequiresCurrentAssignmentAndCannotReadOtherCoachDraft() {
        var activePlan = ownedPlan("active");
        var draftPlan = ownedPlan("draft");
        ReflectionTestUtils.setField(draftPlan, "id", 101L);
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(activePlan));
        when(trainingPlanRepository.findById(101L)).thenReturn(Optional.of(draftPlan));

        // Cựu HLV (không có phân công hiện tại) bị từ chối cả getPlanById lẫn getPlans(memberId).
        doThrow(new ForbiddenException("COACH_MEMBER_NOT_ASSIGNED", "coaching.member.not_assigned", null, "Denied"))
                .when(currentCoachMembers).requireCoachOf(99L, 10L);
        assertThrows(ForbiddenException.class, () -> service.getPlanById(100L, 99L, "COACH"));
        assertThrows(ForbiddenException.class, () -> service.getPlans(10L, 99L, "COACH"));

        // HLV đang phụ trách hiện tại (id=30L) đọc được giáo án active nhưng bị chặn xem draft riêng của HLV 20L.
        doNothing().when(currentCoachMembers).requireCoachOf(30L, 10L);
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(100L)).thenReturn(List.of());
        assertEquals(100L, service.getPlanById(100L, 30L, "COACH").getId());
        assertThrows(ForbiddenException.class, () -> service.getPlanById(101L, 30L, "COACH"));

        when(trainingPlanRepository.findByMemberUserIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(activePlan, draftPlan));
        var visibleToCoCoach = service.getPlans(10L, 30L, "COACH");
        assertEquals(1, visibleToCoCoach.size());
        assertEquals(100L, visibleToCoCoach.get(0).getId());
    }

    /** Kiểm thử P2-BE-30: chặn addItem trên giáo án superseded, chặn kích hoạt nháp hết hạn (kèm khóa Member), và chặn IDOR aiRecommendationId. */
    @Test
    @DisplayName("P2-BE-30: Blocks addItem on superseded, expired activatePlan, member lock, and cross-member AI reco IDOR")
    void enforcesLifecycleAndOwnershipGuardsOnTrainingPlans() {
        // 1. addItem bị chặn trên giáo án superseded
        var superseded = ownedPlan("superseded");
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(superseded));
        var itemDto = new TrainingPlanItemCreateDto(1, "Push Up", null, 3, 12, null, 1);
        assertThrows(ConflictException.class, () -> service.addItem(100L, itemDto, 20L, "COACH"));

        // 2. activatePlan từ chối giáo án nháp đã quá hạn
        var expiredDraft = ownedPlan("draft");
        expiredDraft.setStartDate(LocalDate.of(2025, 1, 1));
        expiredDraft.setEndDate(LocalDate.of(2025, 1, 31));
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(expiredDraft));
        assertThrows(BadRequestException.class, () -> service.activatePlan(100L, 20L, "COACH"));

        // 3. activatePlan hợp lệ khóa Member bằng findByUserIdForUpdate
        var validDraft = ownedPlan("draft");
        validDraft.setEndDate(LocalDate.now(com.swp391.scms.common.CenterTime.ZONE).plusDays(14));
        when(trainingPlanRepository.findById(100L)).thenReturn(Optional.of(validDraft));
        when(trainingPlanRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service.activatePlan(100L, 20L, "COACH");
        verify(memberRepository).findByUserIdForUpdate(10L);

        // 4. createPlan chặn gắn aiRecommendationId của hội viên khác
        Member member10 = new Member();
        member10.setUserId(10L);
        Member member99 = new Member();
        member99.setUserId(99L);
        Coach coach20 = new Coach();
        coach20.setUserId(20L);
        AiRecommendationLog foreignReco = new AiRecommendationLog();
        ReflectionTestUtils.setField(foreignReco, "id", 88L);
        foreignReco.setMember(member99);
        when(memberRepository.findById(10L)).thenReturn(Optional.of(member10));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach20));
        when(aiRecommendationLogRepository.findById(88L)).thenReturn(Optional.of(foreignReco));

        TrainingPlanCreateDto dto = new TrainingPlanCreateDto();
        dto.setMemberId(10L);
        dto.setStartDate(LocalDate.of(2026, 11, 1));
        dto.setEndDate(LocalDate.of(2026, 12, 1));
        dto.setAiRecommendationId(88L);
        assertThrows(ForbiddenException.class, () -> service.createPlan(dto, 20L, "COACH"));
        assertFalse(foreignReco.isApplied());
        verify(aiRecommendationLogRepository, never()).save(foreignReco);
    }
}
