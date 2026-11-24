package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.dto.SessionEvaluationCreateDto;
import com.swp391.scms.coaching.dto.SessionEvaluationDto;
import com.swp391.scms.coaching.entity.SessionEvaluation;
import com.swp391.scms.coaching.repository.SessionEvaluationRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Nghiệp vụ đánh giá buổi tập của HLV và theo dõi tiến độ cho hội viên (SCRUM-119; tính năng đã ngừng, chỉ bật qua
 * app.coaching.*).
 */
@Service
@Transactional
public class SessionEvaluationService {

    private static final BigDecimal MIN_SCORE = new BigDecimal("1.0");
    private static final BigDecimal MAX_SCORE = new BigDecimal("100.0");

    private final SessionEvaluationRepository evaluationRepository;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final ClassSessionRepository classSessionRepository;
    private final Clock clock;

    /** Constructor rút gọn cho test: chỉ có repository đánh giá, hội viên và HLV. */
    public SessionEvaluationService(SessionEvaluationRepository evaluationRepository,
                                    MemberRepository memberRepository,
                                    CoachRepository coachRepository,
                                    ClassSessionRepository classSessionRepository) {
        this(evaluationRepository, memberRepository, coachRepository, classSessionRepository, Clock.systemDefaultZone());
    }

    private final com.swp391.scms.notifications.NotificationService notificationService;

    /** Constructor cho test: thêm repository buổi lớp và Clock (có thể vắng mặt). */
    public SessionEvaluationService(SessionEvaluationRepository evaluationRepository,
                                    MemberRepository memberRepository,
                                    CoachRepository coachRepository,
                                    @Autowired(required = false) ClassSessionRepository classSessionRepository,
                                    @Autowired(required = false) Clock clock) {
        this(evaluationRepository, memberRepository, coachRepository, classSessionRepository, clock, null);
    }

    /** Constructor chính được Spring dùng: thêm NotificationService để báo cho hội viên khi có đánh giá mới. */
    @Autowired
    public SessionEvaluationService(SessionEvaluationRepository evaluationRepository, MemberRepository memberRepository,
            CoachRepository coachRepository, ClassSessionRepository classSessionRepository, Clock clock,
            com.swp391.scms.notifications.NotificationService notificationService) {
        this.notificationService = notificationService;
        this.evaluationRepository = evaluationRepository;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.classSessionRepository = classSessionRepository;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /**
     * Tạo đánh giá buổi tập: kiểm tra điểm trong khoảng 1–100, xác định HLV chấm, kiểm tra buổi lớp, lưu và gửi
     * thông báo cho hội viên (lỗi gửi không làm hỏng việc lưu).
     */
    public SessionEvaluationDto createEvaluation(SessionEvaluationCreateDto request,
                                                 Long currentUserId,
                                                 String currentRole) {
        if (request.progressScore() == null
                || request.progressScore().compareTo(MIN_SCORE) < 0
                || request.progressScore().compareTo(MAX_SCORE) > 0) {
            throw new BadRequestException("INVALID_PROGRESS_SCORE",
                    "validation.coaching.progress_score.range", null,
                    "Progress score must be between 1.0 and 100.0");
        }

        Member member = memberRepository.findById(request.memberId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", request.memberId()));

        Long targetCoachId = resolveCoachId(request.coachId(), currentUserId, currentRole);
        Coach coach = coachRepository.findById(targetCoachId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", targetCoachId));

        ClassSession session = null;
        if (request.sessionId() != null && classSessionRepository != null) {
            session = classSessionRepository.findById(request.sessionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.session", request.sessionId()));
        }

        LocalDateTime now = LocalDateTime.now(clock);
        SessionEvaluation evaluation = new SessionEvaluation();
        evaluation.setSession(session);
        evaluation.setMember(member);
        evaluation.setCoach(coach);
        evaluation.setProgressScore(request.progressScore());
        evaluation.setPerformanceNotes(request.performanceNotes());
        evaluation.setFeedback(request.feedback());
        evaluation.setEvaluatedAt(request.evaluatedAt() != null ? request.evaluatedAt() : now);
        evaluation.setCreatedAt(now);

        SessionEvaluation saved = evaluationRepository.save(evaluation);
        if (notificationService != null) {
            try {
                notificationService.notifyEvaluation(member.getUserId());
            } catch (ResourceNotFoundException ex) {
                // Không làm lỗi việc tạo đánh giá khi tài khoản người dùng của hội viên đã bị xóa mềm
            }
        }
        return toDto(saved);
    }

    /**
     * Lấy danh sách đánh giá của người dùng hiện tại: HLV thấy đánh giá mình đã chấm, hội viên thấy đánh giá
     * mình nhận được.
     */
    @Transactional(readOnly = true)
    public List<SessionEvaluationDto> getMyEvaluations(Long currentUserId, String currentRole) {
        if ("COACH".equalsIgnoreCase(currentRole)) {
            return evaluationRepository.findByCoachUserIdOrderByEvaluatedAtDesc(currentUserId)
                    .stream()
                    .map(this::toDto)
                    .toList();
        }
        return evaluationRepository.findByMemberUserIdOrderByEvaluatedAtDesc(currentUserId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Lấy đánh giá của một hội viên: hội viên chỉ xem của chính mình, HLV phải đang phụ trách hội viên đó, hội
     * viên phải tồn tại.
     */
    @Transactional(readOnly = true)
    public List<SessionEvaluationDto> getMemberEvaluations(Long memberId, Long currentUserId, String currentRole) {
        if ("MEMBER".equalsIgnoreCase(currentRole) && !memberId.equals(currentUserId)) {
            throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null, null);
        }
        if (coachMemberAccess != null) {
            coachMemberAccess.requireAccess(currentUserId, currentRole, memberId);
        }
        if (!memberRepository.existsById(memberId)) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return evaluationRepository.findByMemberUserIdOrderByEvaluatedAtDesc(memberId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** Lấy đánh giá theo buổi lớp: HLV chỉ xem được buổi thuộc lớp mình dạy. */
    @Transactional(readOnly = true)
    public List<SessionEvaluationDto> getSessionEvaluations(Long sessionId, Long currentUserId, String currentRole) {
        if ("COACH".equalsIgnoreCase(currentRole) && classSessionRepository != null) {
            // HLV chỉ được đọc đánh giá các buổi thuộc lớp phân công cho mình.
            ClassSession session = classSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
            Coach sessionCoach = session.getGymClass() != null ? session.getGymClass().getCoach() : null;
            if (sessionCoach == null || !sessionCoach.getUserId().equals(currentUserId)) {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null, null);
            }
        }
        return evaluationRepository.findBySessionIdOrderByEvaluatedAtDesc(sessionId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Xác định HLV chấm điểm: HLV đang đăng nhập không được chấm thay HLV khác; role khác bắt buộc truyền
     * coachId.
     */
    private Long resolveCoachId(Long requestedCoachId, Long currentUserId, String currentRole) {
        if ("COACH".equalsIgnoreCase(currentRole)) {
            if (requestedCoachId != null && currentUserId != null && !requestedCoachId.equals(currentUserId)) {
                throw new ForbiddenException("FORBIDDEN", "coaching.plan.not_owner", null, null);
            }
            return currentUserId != null ? currentUserId : requestedCoachId;
        }
        Long targetCoachId = requestedCoachId != null ? requestedCoachId : currentUserId;
        if (targetCoachId == null) {
            throw new BadRequestException("COACH_REQUIRED", "coaching.plan.coach_required", null, null);
        }
        return targetCoachId;
    }

    /** Chuyển entity SessionEvaluation sang DTO trả về client. */
    private SessionEvaluationDto toDto(SessionEvaluation e) {
        return new SessionEvaluationDto(
                e.getId(),
                e.getSession() != null ? e.getSession().getId() : null,
                e.getMember() != null ? e.getMember().getUserId() : null,
                e.getMember() != null ? e.getMember().getMembershipCode() : null,
                e.getCoach() != null ? e.getCoach().getUserId() : null,
                e.getPerformanceNotes(),
                e.getProgressScore(),
                e.getFeedback(),
                e.getEvaluatedAt(),
                e.getCreatedAt()
        );
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.coaching.service.CoachMemberAccess coachMemberAccess;
}
