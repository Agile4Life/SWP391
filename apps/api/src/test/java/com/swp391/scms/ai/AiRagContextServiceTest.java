package com.swp391.scms.ai;

import com.swp391.scms.ai.service.AiRagContextService;
import com.swp391.scms.catalog.PublicCatalogService;
import com.swp391.scms.catalog.PublicCatalogService.CatalogDto;
import com.swp391.scms.catalog.PublicCatalogService.CoachDto;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.entity.TrainingPlanItem;
import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service AiRagContextService (ai rag context service). */
@ExtendWith(MockitoExtension.class)
class AiRagContextServiceTest {

    @Mock
    private PublicCatalogService catalogService;

    @Mock
    private MembershipSubscriptionRepository subscriptionRepository;

    @Mock
    private TrainingPlanRepository trainingPlanRepository;

    @Mock
    private TrainingPlanItemRepository trainingPlanItemRepository;

    private AiRagContextService ragContextService;

    /** Chuẩn bị trước mỗi test: tạo AiRagContextService với repository giả lập. */
    @BeforeEach
    void setUp() {
        ragContextService = new AiRagContextService(
                catalogService,
                subscriptionRepository,
                trainingPlanRepository,
                trainingPlanItemRepository
        );
    }

    /** Kiểm thử: ngữ cảnh RAG gồm danh mục và dữ liệu hội viên đã xác thực. */
    @Test
    void buildRagContext_IncludesCatalogAndAuthenticatedMemberData() {
        ReflectionTestUtils.setField(ragContextService, "clock", Clock.fixed(
                Instant.parse("2026-11-13T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
        LocalDate today = LocalDate.of(2026, 11, 13);

        PackageDto pkg = new PackageDto(1L, "SÖL Signature", "Full gym & yoga", BigDecimal.valueOf(499000), 30, 12, "active");
        CoachDto coach = new CoachDto(10L, "Trần Minh", "Strength & Conditioning", "10 năm kinh nghiệm", "NASM-CPT", null);
        when(catalogService.getCatalog()).thenReturn(new CatalogDto(List.of(pkg), List.of(coach), List.of()));

        Member member = new Member();
        member.setUserId(100L);
        member.setMembershipCode("MEM-100");
        member.setFitnessGoal("Giảm mỡ bụng và tăng sức bền");
        member.setFitnessLevel("intermediate");
        member.setHealthNotes("Đau nhẹ khớp gối trái");

        MembershipPackage activePkg = new MembershipPackage();
        activePkg.setName("SÖL Signature");
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(activePkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 15));
        sub.setEndDate(LocalDate.of(2026, 11, 14));
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                100L, "active", today, today))
                .thenReturn(Optional.of(sub));

        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 77L);
        plan.setGoal("Tăng cơ giảm mỡ 4 tuần");
        when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(100L, "active"))
                .thenReturn(List.of(plan));

        TrainingPlanItem item = new TrainingPlanItem();
        item.setDayOfWeek(1);
        item.setExerciseName("Goblet Squat");
        item.setSets(4);
        item.setReps(12);
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(77L))
                .thenReturn(List.of(item));

        String context = ragContextService.buildRagContext(member, "Cho mình hỏi giá gói tập và lịch học Yoga ngày mai?");

        assertTrue(context.contains("SÖL Signature"));
        assertTrue(context.contains("499000"));
        assertFalse(context.contains("buổi lớp"));
        assertTrue(context.contains("Trần Minh"));
        assertTrue(context.contains("MEM-100"));
        assertTrue(context.contains("Đau nhẹ khớp gối trái"));
        assertTrue(context.contains("2026-11-14"));
        assertTrue(context.contains("Goblet Squat"));

        // Lần gọi nhanh thứ hai phải tái sử dụng bản chụp danh mục và hội viên trong cache mà không truy vấn lại CSDL
        String secondContext = ragContextService.buildRagContext(member, "Câu hỏi tiếp theo");
        assertTrue(secondContext.contains("SÖL Signature"));
        org.mockito.Mockito.verify(catalogService, org.mockito.Mockito.times(1)).getCatalog();
    }

    /** Kiểm thử: ngữ cảnh RAG bao gồm lịch lớp học nhóm 7 ngày tới kèm phòng, HLV và số chỗ trống. */
    @Test
    void buildRagContext_IncludesUpcomingGroupSessions() {
        ClassSessionDto session = new ClassSessionDto(
                501L, 11L, "Yoga Flow Sáng", 3L, "Yoga", 10L, "Nguyễn Lan",
                4L, "Zen Garden Studio", LocalDate.of(2026, 11, 14),
                LocalTime.of(7, 0), LocalTime.of(9, 30), "scheduled", null, 20, 14L);
        when(catalogService.getCatalog()).thenReturn(new CatalogDto(List.of(), List.of(), List.of(session)));

        String context = ragContextService.buildRagContext(null, "Ngày mai có lớp Yoga nào còn chỗ không?");

        assertTrue(context.contains("LỊCH LỚP HỌC NHÓM SẮP TỚI"));
        assertTrue(context.contains("Yoga Flow Sáng"));
        assertTrue(context.contains("Yoga"));
        assertTrue(context.contains("2026-11-14"));
        assertTrue(context.contains("07:00–09:30"));
        assertTrue(context.contains("Zen Garden Studio"));
        assertTrue(context.contains("Nguyễn Lan"));
        assertTrue(context.contains("14/20"));
        assertTrue(context.contains("còn 6 chỗ trống"));
    }

    /** Kiểm thử: nhận diện gói đang bảo lưu (frozen) và không coi gói active đã quá hạn là đang hoạt động. */
    @Test
    void buildRagContext_ReportsFrozenSubscriptionAndIgnoresExpiredActive() {
        ReflectionTestUtils.setField(ragContextService, "clock", Clock.fixed(
                Instant.parse("2026-11-20T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
        LocalDate today = LocalDate.of(2026, 11, 20);
        when(catalogService.getCatalog()).thenReturn(new CatalogDto(List.of(), List.of(), List.of()));

        Member frozenMember = new Member();
        frozenMember.setUserId(200L);
        frozenMember.setMembershipCode("MEM-200");

        MembershipPackage goldPkg = new MembershipPackage();
        goldPkg.setName("SÖL Gold 3 tháng");
        MembershipSubscription frozen = new MembershipSubscription();
        frozen.setMembershipPackage(goldPkg);
        frozen.setStatus("frozen");
        frozen.setHoldStartDate(LocalDate.of(2026, 11, 18));
        frozen.setHoldEndDate(LocalDate.of(2026, 11, 25));

        when(subscriptionRepository.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                200L, "active", today, today)).thenReturn(Optional.empty());
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusOrderByEndDateDesc(200L, "frozen"))
                .thenReturn(Optional.of(frozen));
        when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(200L, "active"))
                .thenReturn(List.of());

        String frozenContext = ragContextService.buildRagContext(frozenMember, "Gói tập của mình đang thế nào?");
        assertTrue(frozenContext.contains("Đang bảo lưu (frozen)"));
        assertTrue(frozenContext.contains("SÖL Gold 3 tháng"));
        assertTrue(frozenContext.contains("2026-11-18"));
        assertTrue(frozenContext.contains("2026-11-25"));
        assertFalse(frozenContext.contains("Chưa có gói active"));

        Member expiredMember = new Member();
        expiredMember.setUserId(201L);
        expiredMember.setMembershipCode("MEM-201");
        MembershipSubscription staleActive = new MembershipSubscription();
        staleActive.setMembershipPackage(goldPkg);
        staleActive.setStatus("active");
        staleActive.setStartDate(LocalDate.of(2026, 10, 1));
        staleActive.setEndDate(LocalDate.of(2026, 11, 1)); // đã hết hạn trước today
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                201L, "active", today, today)).thenReturn(Optional.of(staleActive));
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusOrderByEndDateDesc(201L, "frozen"))
                .thenReturn(Optional.empty());
        when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(201L, "active"))
                .thenReturn(List.of());

        String expiredContext = ragContextService.buildRagContext(expiredMember, "Gói tập của mình?");
        assertTrue(expiredContext.contains("Chưa có gói active"));
    }

    /** Kiểm thử: ngữ cảnh RAG nêu rõ ngày hôm nay. */
    @Test
    void buildRagContext_StatesToday() {
        ReflectionTestUtils.setField(ragContextService, "clock", java.time.Clock.fixed(
                java.time.Instant.parse("2026-11-13T03:00:00Z"), java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        when(catalogService.getCatalog()).thenReturn(new CatalogDto(List.of(), List.of(), List.of()));

        String context = ragContextService.buildRagContext(null, "Thứ 5 có gì không?");

        assertTrue(context.contains("Thứ Sáu 2026-11-13 10:00"));
    }

    /** Kiểm thử: ngữ cảnh RAG gọi đúng tên Chủ nhật trong kế hoạch của hội viên. */
    @Test
    void buildRagContext_NamesSundayInTheMembersPlan() {
        when(catalogService.getCatalog()).thenReturn(new CatalogDto(List.of(), List.of(), List.of()));
        Member member = new Member();
        member.setUserId(100L);
        member.setMembershipCode("MEM-100");
        TrainingPlan plan = new TrainingPlan();
        ReflectionTestUtils.setField(plan, "id", 77L);
        when(trainingPlanRepository.findByMemberUserIdAndStatusOrderByCreatedAtDesc(100L, "active")).thenReturn(List.of(plan));
        TrainingPlanItem item = new TrainingPlanItem();
        item.setDayOfWeek(7);
        item.setExerciseName("Đi bộ phục hồi");
        when(trainingPlanItemRepository.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(77L)).thenReturn(List.of(item));
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                eq(100L), eq("active"), any(LocalDate.class), any(LocalDate.class))).thenReturn(Optional.empty());
        when(subscriptionRepository.findFirstByMemberUserIdAndStatusOrderByEndDateDesc(100L, "frozen")).thenReturn(Optional.empty());

        String context = ragContextService.buildRagContext(member, "giáo án của mình");

        assertTrue(context.contains("+ Chủ nhật: Đi bộ phục hồi\n"));
        assertFalse(context.contains("null"));
    }
}
