package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.SessionEvaluationCreateDto;
import com.swp391.scms.coaching.dto.SessionEvaluationDto;
import com.swp391.scms.coaching.entity.SessionEvaluation;
import com.swp391.scms.coaching.repository.SessionEvaluationRepository;
import com.swp391.scms.coaching.service.SessionEvaluationService;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service SessionEvaluationService (session evaluation service). */
@ExtendWith(MockitoExtension.class)
class SessionEvaluationServiceTest {

    @Mock
    private SessionEvaluationRepository evaluationRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private CoachRepository coachRepository;

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock private com.swp391.scms.notifications.NotificationService notifications;
    private SessionEvaluationService evaluationService;
    private Member member;
    private Coach coach;

    /** Chuẩn bị trước mỗi test: tạo SessionEvaluationService với repository giả lập. */
    @BeforeEach
    void setUp() {
        evaluationService = new SessionEvaluationService(
                evaluationRepository, memberRepository, coachRepository, classSessionRepository);

        ReflectionTestUtils.setField(evaluationService, "notificationService", notifications);
        member = new Member();
        member.setUserId(101L);
        member.setMembershipCode("MEM-101");

        coach = new Coach();
        coach.setUserId(202L);
    }

    /** Kiểm thử: tạo đánh giá với điểm hợp lệ thì lưu và trả DTO. */
    @Test
    void createEvaluation_WithValidScore_SavesAndReturnsDto() {
        when(memberRepository.findById(101L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(202L)).thenReturn(Optional.of(coach));
        when(evaluationRepository.save(any(SessionEvaluation.class))).thenAnswer(inv -> {
            SessionEvaluation e = inv.getArgument(0);
            ReflectionTestUtils.setField(e, "id", 10L);
            return e;
        });

        SessionEvaluationCreateDto request = new SessionEvaluationCreateDto(
                null, 101L, 202L, new BigDecimal("88.5"), "Tập trung tốt, giữ chuẩn form Squat", "Tiếp tục tăng tạ tuần tới", null
        );

        SessionEvaluationDto result = evaluationService.createEvaluation(request, 202L, "COACH");

        assertNotNull(result);
        assertEquals(10L, result.id());
        assertEquals(101L, result.memberId());
        assertEquals(202L, result.coachId());
        assertEquals(new BigDecimal("88.5"), result.progressScore());
        verify(evaluationRepository).save(any(SessionEvaluation.class));
        verify(notifications).notifyEvaluation(101L);
    }

    /** Kiểm thử: điểm ngoài khoảng ném BadRequest. */
    @Test
    void createEvaluation_WithOutOfRangeScore_ThrowsBadRequest() {
        SessionEvaluationCreateDto request = new SessionEvaluationCreateDto(
                null, 101L, 202L, new BigDecimal("105.0"), "Notes", "Feedback", null
        );

        assertThrows(BadRequestException.class,
                () -> evaluationService.createEvaluation(request, 202L, "COACH"));
    }

    /** Kiểm thử: hội viên khác xem đánh giá thì ném Forbidden. */
    @Test
    void getMemberEvaluations_WhenOtherMember_ThrowsForbidden() {
        assertThrows(ForbiddenException.class,
                () -> evaluationService.getMemberEvaluations(101L, 999L, "MEMBER"));
    }

    /** Kiểm thử: hội viên xem đánh giá của mình. */
    @Test
    void getMyEvaluations_ForMember_ReturnsEvaluations() {
        SessionEvaluation eval = new SessionEvaluation();
        ReflectionTestUtils.setField(eval, "id", 15L);
        eval.setMember(member);
        eval.setCoach(coach);
        eval.setProgressScore(new BigDecimal("92.0"));
        when(evaluationRepository.findByMemberUserIdOrderByEvaluatedAtDesc(101L)).thenReturn(List.of(eval));

        List<SessionEvaluationDto> list = evaluationService.getMyEvaluations(101L, "MEMBER");

        assertEquals(1, list.size());
        assertEquals(new BigDecimal("92.0"), list.get(0).progressScore());
    }

    /** Kiểm thử: HLV của lớp khác không được xem đánh giá của buổi. */
    @Test
    void getSessionEvaluations_coachOfAnotherClass_isForbidden() {
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setCoach(coach);
        com.swp391.scms.scheduling.entity.ClassSession session = new com.swp391.scms.scheduling.entity.ClassSession();
        session.setGymClass(gymClass);
        when(classSessionRepository.findById(7L)).thenReturn(Optional.of(session));

        org.junit.jupiter.api.Assertions.assertThrows(com.swp391.scms.common.exception.ForbiddenException.class,
                () -> evaluationService.getSessionEvaluations(7L, 999L, "COACH"));
        org.mockito.Mockito.verifyNoInteractions(evaluationRepository);
    }

    /** Kiểm thử: HLV được phân công xem được đánh giá của buổi. */
    @Test
    void getSessionEvaluations_assignedCoach_readsEvaluations() {
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setCoach(coach);
        com.swp391.scms.scheduling.entity.ClassSession session = new com.swp391.scms.scheduling.entity.ClassSession();
        session.setGymClass(gymClass);
        when(classSessionRepository.findById(7L)).thenReturn(Optional.of(session));
        when(evaluationRepository.findBySessionIdOrderByEvaluatedAtDesc(7L)).thenReturn(java.util.List.of());

        assertEquals(0, evaluationService.getSessionEvaluations(7L, 202L, "COACH").size());
    }

    /** Kiểm thử P3-BE-08: HLV lớp khác không được tạo đánh giá cho buổi học không phải lớp mình dạy. */
    @Test
    void createEvaluation_forAnotherCoachSession_throwsForbidden() {
        when(memberRepository.findById(101L)).thenReturn(Optional.of(member));
        Coach otherCoach = new Coach();
        otherCoach.setUserId(999L);
        when(coachRepository.findById(999L)).thenReturn(Optional.of(otherCoach));
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setCoach(coach);
        com.swp391.scms.scheduling.entity.ClassSession session = new com.swp391.scms.scheduling.entity.ClassSession();
        session.setGymClass(gymClass);
        when(classSessionRepository.findById(7L)).thenReturn(Optional.of(session));

        SessionEvaluationCreateDto request = new SessionEvaluationCreateDto(
                7L, 101L, 999L, new BigDecimal("85.0"), "Notes", "Feedback", null);
        assertThrows(ForbiddenException.class, () -> evaluationService.createEvaluation(request, 999L, "COACH"));
    }
}
