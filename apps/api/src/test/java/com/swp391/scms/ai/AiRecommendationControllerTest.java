package com.swp391.scms.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.ai.client.AiClient;
import com.swp391.scms.ai.client.MockAiClient;
import com.swp391.scms.ai.dto.AiApplyRecommendationRequest;
import com.swp391.scms.ai.dto.AiWorkoutPlanRequest;
import com.swp391.scms.ai.dto.AiWorkoutPlanResponse;
import com.swp391.scms.ai.entity.AiRecommendationLog;
import com.swp391.scms.ai.repository.AiRecommendationLogRepository;
import com.swp391.scms.ai.service.AiRecommendationService;
import com.swp391.scms.coaching.dto.TrainingPlanCreateDto;
import com.swp391.scms.coaching.dto.TrainingPlanDto;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import com.swp391.scms.coaching.service.TrainingPlanService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AiRecommendationControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private AiRecommendationLogRepository recommendationLogRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private CoachRepository coachRepository;

    @Mock
    private MemberProgressLogRepository progressLogRepository;

    @Mock
    private TrainingPlanService trainingPlanService;

    private AiRecommendationService recommendationService;
    private AiRecommendationController controller;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        AiClient aiClient = new MockAiClient("gpt-4o");
        recommendationService = new AiRecommendationService(
                aiClient,
                recommendationLogRepository,
                memberRepository,
                coachRepository,
                progressLogRepository,
                trainingPlanService,
                objectMapper
        );
        controller = new AiRecommendationController(recommendationService);

        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return new AuthenticatedPrincipal(20L, "coach1", "COACH");
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("POST /api/v1/ai/generate-workout-plan should read height, weight, BMI, fitness_goal, health_notes and save log")
    void shouldGenerateStructuredWorkoutPlanAndLog() throws Exception {
        Member member = new Member();
        member.setUserId(10L);
        member.setMembershipCode("MB-2026-089");
        member.setFitnessGoal("Tăng cơ giảm mỡ");
        member.setFitnessLevel("intermediate");
        member.setHealthNotes("Đau nhẹ khớp gối trái");

        Coach coach = new Coach();
        coach.setUserId(20L);

        MemberProgressLog heightLog = new MemberProgressLog();
        heightLog.setMetricName("height");
        heightLog.setMetricValue(new BigDecimal("175.0"));

        MemberProgressLog weightLog = new MemberProgressLog();
        weightLog.setMetricName("weight");
        weightLog.setMetricValue(new BigDecimal("73.5"));

        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(10L))
                .thenReturn(List.of(heightLog, weightLog));
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> {
            AiRecommendationLog log = inv.getArgument(0);
            ReflectionTestUtils.setField(log, "id", 77L);
            return log;
        });

        AiWorkoutPlanRequest req = new AiWorkoutPlanRequest(10L, "Ưu tiên bài tập ít áp lực khớp gối", 4);

        mockMvc.perform(post("/api/v1/ai/generate-workout-plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(77))
                .andExpect(jsonPath("$.data.memberId").value(10))
                .andExpect(jsonPath("$.data.modelName").value("gpt-4o"))
                .andExpect(jsonPath("$.data.inputContext.heightCm").value(175.0))
                .andExpect(jsonPath("$.data.inputContext.weightKg").value(73.5))
                .andExpect(jsonPath("$.data.inputContext.bmi").value(24.0))
                .andExpect(jsonPath("$.data.inputContext.healthNotes").value("Đau nhẹ khớp gối trái"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].exerciseName").isNotEmpty());

        verify(recommendationLogRepository).save(any(AiRecommendationLog.class));
    }

    @Test
    @DisplayName("POST /api/v1/ai/recommendations/{id}/apply should create training plan with is_ai_generated=true and mark log is_applied=true")
    void shouldApplyAiRecommendationToTrainingPlan() throws Exception {
        Member member = new Member();
        member.setUserId(10L);
        member.setFitnessGoal("Tăng sức bền");

        AiRecommendationLog log = new AiRecommendationLog();
        ReflectionTestUtils.setField(log, "id", 77L);
        log.setMember(member);
        log.setRecommendedContent("{\"goal\":\"Tăng sức bền 4 tuần\",\"items\":[{\"dayOfWeek\":1,\"exerciseName\":\"Kettlebell Swing\",\"sets\":4,\"reps\":15,\"durationMinutes\":15,\"orderIndex\":1}]}");
        log.setApplied(false);

        when(recommendationLogRepository.findById(77L)).thenReturn(Optional.of(log));
        when(trainingPlanService.createPlan(any(TrainingPlanCreateDto.class), eq(20L), eq("COACH")))
                .thenAnswer(inv -> {
                    TrainingPlanCreateDto dto = inv.getArgument(0);
                    TrainingPlanDto created = new TrainingPlanDto();
                    created.setId(200L);
                    created.setMemberId(dto.getMemberId());
                    created.setGoal(dto.getGoal());
                    created.setStatus("draft");
                    created.setAiGenerated(Boolean.TRUE.equals(dto.getAiGenerated()));
                    created.setAiRecommendationId(dto.getAiRecommendationId());
                    return created;
                });

        AiApplyRecommendationRequest applyReq = new AiApplyRecommendationRequest();

        mockMvc.perform(post("/api/v1/ai/recommendations/77/apply")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(applyReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(200))
                .andExpect(jsonPath("$.data.aiGenerated").value(true))
                .andExpect(jsonPath("$.data.aiRecommendationId").value(77));

        assertTrue(log.isApplied());
        verify(recommendationLogRepository).save(log);
    }

    @Test
    @DisplayName("AI generation must execute outside DB transaction between short read-only and write transactions")
    void shouldNotHoldTransactionDuringAiCalls() throws Exception {
        assertFalse(AiRecommendationService.class.isAnnotationPresent(
                org.springframework.transaction.annotation.Transactional.class));
        assertFalse(AiRecommendationService.class
                .getMethod("generateRecommendation", Long.class, String.class)
                .isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class));
        assertFalse(AiRecommendationService.class
                .getMethod("generateWorkoutPlan", AiWorkoutPlanRequest.class, Long.class)
                .isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class));

        var txManager = new org.springframework.transaction.support.AbstractPlatformTransactionManager() {
            @Override
            protected Object doGetTransaction() { return new Object(); }
            @Override
            protected void doBegin(Object transaction, org.springframework.transaction.TransactionDefinition definition) {
                org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(true);
            }
            @Override
            protected void doCommit(org.springframework.transaction.support.DefaultTransactionStatus status) {}
            @Override
            protected void doRollback(org.springframework.transaction.support.DefaultTransactionStatus status) {}
            @Override
            protected void doCleanupAfterCompletion(Object transaction) {
                org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(false);
            }
        };

        var txActiveDuringAi = new java.util.concurrent.atomic.AtomicBoolean(true);
        AiClient slowAiClient = new AiClient() {
            @Override
            public String generate(String systemPrompt, String userMessage) {
                txActiveDuringAi.set(
                        org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
                return "{\"goal\":\"Test\",\"analysis\":\"OK\",\"items\":[]}";
            }
            @Override
            public String getModelName() { return "test-model"; }
            @Override
            public String getProviderName() { return "test-provider"; }
        };

        Member member = new Member();
        member.setUserId(10L);
        member.setMembershipCode("MEM-10");
        when(memberRepository.findById(10L)).thenAnswer(inv -> {
            assertTrue(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
            assertTrue(org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            return Optional.of(member);
        });
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> {
            assertTrue(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
            assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            return inv.getArgument(0);
        });

        AiRecommendationService txService = new AiRecommendationService(
                slowAiClient, recommendationLogRepository, memberRepository,
                coachRepository, progressLogRepository, trainingPlanService, objectMapper, txManager);

        txService.generateRecommendation(10L, "healthy");
        assertFalse(txActiveDuringAi.get(), "Transaction must NOT be active while calling AiClient.generate");

        txActiveDuringAi.set(true);
        txService.generateWorkoutPlan(new AiWorkoutPlanRequest(10L, "extra", 4), null);
        assertFalse(txActiveDuringAi.get(), "Transaction must NOT be active while calling AiClient.generate in generateWorkoutPlan");
    }

    @Test
    @DisplayName("Plan generation sends the member's current plan and the centre's equipment, and keeps a plan whose items need tidying")
    void shouldGroundThePromptAndKeepItemsThatNeedTidying() {
        Member member = new Member();
        member.setUserId(10L);
        member.setMembershipCode("MEM-10");
        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        var plans = org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.TrainingPlanRepository.class);
        var planItems = org.mockito.Mockito.mock(com.swp391.scms.coaching.repository.TrainingPlanItemRepository.class);
        var equipment = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.EquipmentRepository.class);
        var currentPlan = new com.swp391.scms.coaching.entity.TrainingPlan();
        ReflectionTestUtils.setField(currentPlan, "id", 5L);
        currentPlan.setGoal("Giảm mỡ 4 tuần");
        when(plans.findByMemberUserIdAndStatusOrderByCreatedAtDesc(10L, "active")).thenReturn(List.of(currentPlan));
        var currentItem = new com.swp391.scms.coaching.entity.TrainingPlanItem();
        currentItem.setDayOfWeek(1);
        currentItem.setExerciseName("Goblet Squat");
        currentItem.setSets(3);
        currentItem.setReps(12);
        when(planItems.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(5L)).thenReturn(List.of(currentItem));
        var treadmill = new com.swp391.scms.facilities.entity.Equipment();
        treadmill.setName("Máy chạy bộ");
        treadmill.setCategory("Cardio");
        var broken = new com.swp391.scms.facilities.entity.Equipment();
        broken.setName("Máy kéo cáp");
        broken.setCategory("Strength");
        broken.setStatus("broken");
        when(equipment.findAllWithRoom()).thenReturn(List.of(treadmill, broken));

        var prompts = new java.util.ArrayList<String>();
        AiClient client = new AiClient() {
            @Override
            public String generate(String systemPrompt, String userMessage) {
                prompts.add(systemPrompt);
                prompts.add(userMessage);
                return """
                        {"goal":"Tăng sức bền","analysis":"Ổn","items":[
                          {"dayOfWeek":9,"exerciseName":"Chạy bộ nhẹ","sets":"3 hiệp","reps":"10-12","restSeconds":-5,"tempo":"2-0-2"},
                          {"dayOfWeek":3,"exerciseName":"  "},
                          {"day_of_week":3,"exercise_name":"Plank","durationMinutes":0}]}""";
            }
            @Override
            public String getModelName() { return "test-model"; }
            @Override
            public String getProviderName() { return "test-provider"; }
        };
        AiRecommendationService service = new AiRecommendationService(client, recommendationLogRepository,
                memberRepository, coachRepository, progressLogRepository, trainingPlanService, objectMapper);
        ReflectionTestUtils.setField(service, "trainingPlanRepository", plans);
        ReflectionTestUtils.setField(service, "trainingPlanItemRepository", planItems);
        ReflectionTestUtils.setField(service, "equipmentRepository", equipment);

        var response = service.generateWorkoutPlan(new AiWorkoutPlanRequest(10L, null, 6), null);

        assertTrue(prompts.get(0).contains("7 = Chủ nhật"));
        String userPrompt = prompts.get(1);
        assertTrue(userPrompt.contains("Thời lượng giáo án: 6 tuần"));
        assertTrue(userPrompt.contains("Giáo án đang áp dụng: Giảm mỡ 4 tuần"));
        assertTrue(userPrompt.contains("Goblet Squat 3x12"));
        assertTrue(userPrompt.contains("Cardio: Máy chạy bộ"));
        assertFalse(userPrompt.contains("Máy kéo cáp"));

        assertEquals(2, response.getItems().size());
        var run = response.getItems().get(0);
        assertEquals(2, run.getDayOfWeek());
        assertEquals(3, run.getSets());
        assertEquals(10, run.getReps());
        assertNull(run.getRestSeconds());
        var plank = response.getItems().get(1);
        assertEquals("Plank", plank.getExerciseName());
        assertEquals(3, plank.getDayOfWeek());
        assertNull(plank.getDurationMinutes());
    }

    @Test
    @DisplayName("Includes member fullName in response and history, and rejects soft-deleted members")
    void shouldPopulateMemberNameAndRejectSoftDeletedMember() {
        var activeUser = new com.swp391.scms.users.entity.User();
        activeUser.setId(10L);
        activeUser.setFullName("Lê Hoàng Long");
        activeUser.setStatus("active");

        Member member = new Member();
        member.setUserId(10L);
        member.setUser(activeUser);
        member.setMembershipCode("MB-2026-089");

        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(memberRepository.existsById(10L)).thenReturn(true);
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> {
            AiRecommendationLog log = inv.getArgument(0);
            ReflectionTestUtils.setField(log, "id", 88L);
            return log;
        });

        AiWorkoutPlanResponse generated = recommendationService.generateWorkoutPlan(
                new AiWorkoutPlanRequest(10L, null, 4), 20L);
        assertEquals("Lê Hoàng Long", generated.getMemberName());

        AiRecommendationLog stored = new AiRecommendationLog();
        ReflectionTestUtils.setField(stored, "id", 88L);
        stored.setMember(member);
        stored.setRecommendedContent("{\"goal\":\"Sức bền\",\"items\":[]}");
        when(recommendationLogRepository.findByMemberUserId(10L)).thenReturn(List.of(stored));

        List<AiWorkoutPlanResponse> history = recommendationService.getMemberRecommendations(10L);
        assertEquals("Lê Hoàng Long", history.get(0).getMemberName());

        activeUser.setDeletedAt(java.time.LocalDateTime.now());
        assertThrows(com.swp391.scms.common.exception.ResourceNotFoundException.class,
                () -> recommendationService.generateWorkoutPlan(new AiWorkoutPlanRequest(10L, null, 4), 20L));
    }

    @Test
    @DisplayName("Enforces current coach assignment during AI workout generation when CurrentCoachMembers is wired")
    void shouldEnforceCurrentCoachAssignmentDuringAiGeneration() {
        Member member = new Member();
        member.setUserId(10L);
        Coach coach = new Coach();
        coach.setUserId(20L);
        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));

        var currentCoachMembers = mock(com.swp391.scms.coaching.service.CurrentCoachMembers.class);
        doThrow(new com.swp391.scms.common.exception.ForbiddenException(
                "COACH_MEMBER_NOT_ASSIGNED", "coaching.member.not_assigned", null, "No current coaching assignment."))
                .when(currentCoachMembers).requireCoachOf(20L, 10L);
        ReflectionTestUtils.setField(recommendationService, "currentCoachMembers", currentCoachMembers);

        assertThrows(com.swp391.scms.common.exception.ForbiddenException.class,
                () -> recommendationService.generateWorkoutPlan(new AiWorkoutPlanRequest(10L, null, 4), 20L));
    }

    @Test
    @DisplayName("Includes coach specialization and prefers the target coach's own active plan over another coach's plan")
    void shouldIncludeCoachSpecializationAndPreferTargetCoachActivePlan() throws Exception {
        Member member = new Member();
        member.setUserId(10L);
        member.setMembershipCode("MEM-10");
        Coach gymCoach = new Coach();
        gymCoach.setUserId(20L);
        gymCoach.setSpecialization("Strength & Conditioning");
        Coach yogaCoach = new Coach();
        yogaCoach.setUserId(99L);

        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(gymCoach));
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        var plans = mock(com.swp391.scms.coaching.repository.TrainingPlanRepository.class);
        var planItems = mock(com.swp391.scms.coaching.repository.TrainingPlanItemRepository.class);
        var yogaPlan = new com.swp391.scms.coaching.entity.TrainingPlan();
        ReflectionTestUtils.setField(yogaPlan, "id", 1L);
        yogaPlan.setCoach(yogaCoach);
        yogaPlan.setGoal("Yoga phục hồi buổi sáng");

        var gymPlan = new com.swp391.scms.coaching.entity.TrainingPlan();
        ReflectionTestUtils.setField(gymPlan, "id", 2L);
        gymPlan.setCoach(gymCoach);
        gymPlan.setGoal("Tăng cơ thân trên");

        when(plans.findByMemberUserIdAndStatusOrderByCreatedAtDesc(10L, "active"))
                .thenReturn(List.of(yogaPlan, gymPlan));
        when(planItems.findByTrainingPlanIdOrderByOrderIndexAscIdAsc(2L)).thenReturn(List.of());

        var prompts = new java.util.ArrayList<String>();
        AiClient capturingClient = new AiClient() {
            @Override
            public String generate(String systemPrompt, String userMessage) {
                prompts.add(userMessage);
                return "{\"goal\":\"Tăng cơ giai đoạn 2\",\"analysis\":\"Tốt\",\"items\":[]}";
            }
            @Override
            public String getModelName() { return "test-model"; }
            @Override
            public String getProviderName() { return "test-provider"; }
        };

        AiRecommendationService service = new AiRecommendationService(capturingClient, recommendationLogRepository,
                memberRepository, coachRepository, progressLogRepository, trainingPlanService, objectMapper);
        ReflectionTestUtils.setField(service, "trainingPlanRepository", plans);
        ReflectionTestUtils.setField(service, "trainingPlanItemRepository", planItems);

        AiWorkoutPlanRequest managerReq = objectMapper.readValue(
                "{\"member_id\":10,\"coach_id\":20,\"duration_weeks\":6}", AiWorkoutPlanRequest.class);
        service.generateWorkoutPlan(managerReq, 1L, "CENTER_MANAGER");

        String userPrompt = prompts.get(0);
        assertTrue(userPrompt.contains("Strength & Conditioning"), "Prompt should include target coach specialization");
        assertTrue(userPrompt.contains("Tăng cơ thân trên"), "Prompt should inherit target coach's active plan");
        assertFalse(userPrompt.contains("Yoga phục hồi buổi sáng"), "Prompt must not inherit another coach's plan");
    }

    @Test
    @DisplayName("Manager apply uses log coach or explicit coach_id instead of manager userId, and blocks cross-coach apply")
    void shouldAllowManagerApplyAndBlockOtherCoachApply() throws Exception {
        Member member = new Member();
        member.setUserId(10L);
        Coach logCoach = new Coach();
        logCoach.setUserId(20L);

        AiRecommendationLog log = new AiRecommendationLog();
        ReflectionTestUtils.setField(log, "id", 77L);
        log.setMember(member);
        log.setCoach(logCoach);
        log.setRecommendedContent("{\"goal\":\"Sức mạnh\",\"items\":[]}");
        when(recommendationLogRepository.findById(77L)).thenReturn(Optional.of(log));

        var capturedCoachIds = new java.util.ArrayList<Long>();
        when(trainingPlanService.createPlan(any(TrainingPlanCreateDto.class), eq(1L), eq("CENTER_MANAGER")))
                .thenAnswer(inv -> {
                    TrainingPlanCreateDto dto = inv.getArgument(0);
                    capturedCoachIds.add(dto.getCoachId());
                    TrainingPlanDto created = new TrainingPlanDto();
                    created.setId(301L);
                    return created;
                });

        recommendationService.applyRecommendation(77L, new AiApplyRecommendationRequest(), 1L, "CENTER_MANAGER");
        AiApplyRecommendationRequest explicitCoachReq = objectMapper.readValue(
                "{\"coach_id\":25}", AiApplyRecommendationRequest.class);
        recommendationService.applyRecommendation(77L, explicitCoachReq, 1L, "CENTER_MANAGER");

        assertEquals(List.of(20L, 25L), capturedCoachIds);

        assertThrows(com.swp391.scms.common.exception.ForbiddenException.class,
                () -> recommendationService.applyRecommendation(77L, new AiApplyRecommendationRequest(), 21L, "COACH"));
    }

    @Test
    @DisplayName("Validates durationWeeks range (1..52) and enforces per-user rate limit on workout generation")
    void shouldValidateDurationWeeksAndRateLimitGeneration() throws Exception {
        mockMvc.perform(post("/api/v1/ai/generate-workout-plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"member_id\":10,\"duration_weeks\":0}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/ai/generate-workout-plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"member_id\":10,\"duration_weeks\":53}"))
                .andExpect(status().isBadRequest());

        Member member = new Member();
        member.setUserId(10L);
        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(com.swp391.scms.common.exception.TooManyRequestsException.class, () -> {
            for (int i = 0; i < 12; i++) {
                recommendationService.generateWorkoutPlan(new AiWorkoutPlanRequest(10L, null, 4), 20L);
            }
        });
    }
}
