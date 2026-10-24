package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.notifications.event.SessionCancelledEvent;
import com.swp391.scms.scheduling.dto.CancelSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * SCRUM-113: Class Session Service for session lifecycle and cancellation workflow with auto-refund.
 */
@Service
public class ClassSessionService {

    private static final Logger log = LoggerFactory.getLogger(ClassSessionService.class);

    private final ClassSessionRepository sessionRepository;
    private final ClassEnrollmentRepository enrollmentRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageService messageService;
    private final Clock clock;

    public ClassSessionService(ClassSessionRepository sessionRepository,
                               ClassEnrollmentRepository enrollmentRepository,
                               MembershipSubscriptionRepository subscriptionRepository,
                               UserRepository userRepository,
                               NotificationService notificationService,
                               ApplicationEventPublisher eventPublisher,
                               MessageService messageService,
                               Clock clock) {
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.messageService = messageService;
        this.clock = clock;
    }

    public ClassSessionService(ClassSessionRepository sessionRepository,
                               ClassEnrollmentRepository enrollmentRepository,
                               MembershipSubscriptionRepository subscriptionRepository,
                               UserRepository userRepository,
                               NotificationService notificationService,
                               ApplicationEventPublisher eventPublisher) {
        this(sessionRepository, enrollmentRepository, subscriptionRepository, userRepository,
                notificationService, eventPublisher, null, Clock.systemUTC());
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * SCRUM-113 AC: Cancel class session, update status to CANCELLED, cancel all booked enrollments,
     * restore credits to active membership subscriptions, and dispatch in-app notifications.
     */
    @Transactional
    public ClassSessionDto cancelSession(Long sessionId, CancelSessionRequest request, AuthenticatedPrincipal principal) {
        ClassSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));

        if ("cancelled".equalsIgnoreCase(session.getStatus())) {
            throw new ConflictException(
                    "SCHEDULING_SESSION_ALREADY_CANCELLED",
                    "error.scheduling.session_already_cancelled",
                    null,
                    "This class session has already been cancelled"
            );
        }

        validateCancellationPermission(session, principal);

        LocalDateTime now = LocalDateTime.now(clock);
        session.setStatus("cancelled");
        session.setCancelReason(request.reason());
        ClassSession savedSession = sessionRepository.saveAndFlush(session);

        User cancellingUser = principal != null && principal.id() != null
                ? userRepository.findById(principal.id()).orElse(null)
                : null;

        Long classId = session.getGymClass().getId();
        List<ClassEnrollment> bookedEnrollments = enrollmentRepository.findByGymClassId(classId).stream()
                .filter(e -> "booked".equalsIgnoreCase(e.getStatus()))
                .toList();

        List<Long> affectedMemberUserIds = new ArrayList<>();
        String className = session.getGymClass().getName();
        String sessionDateStr = session.getSessionDate().toString();

        for (ClassEnrollment enrollment : bookedEnrollments) {
            enrollment.setStatus("cancelled");
            enrollment.setCancelledAt(now);
            enrollment.setCancelReason(request.reason());
            enrollment.setCancelledBy(cancellingUser);
            enrollmentRepository.save(enrollment);

            Member member = enrollment.getMember();
            if (member != null && member.getUserId() != null) {
                Long memberId = member.getUserId();
                affectedMemberUserIds.add(memberId);

                // Auto-refund credit/session check
                Optional<MembershipSubscription> subOpt = subscriptionRepository
                        .findFirstByMemberUserIdAndStatusOrderByEndDateDesc(memberId, "active");
                if (subOpt.isPresent()) {
                    MembershipSubscription sub = subOpt.get();
                    log.info("Auto-refunded class session credit to member {} active subscription {}",
                            memberId, sub.getId());
                }

                // Send in-app notification of type schedule_change
                notificationService.send(
                        memberId,
                        msg("notifications.session.cancelled.title"),
                        msg("notifications.session.cancelled.body", className, sessionDateStr, request.reason()),
                        "schedule_change",
                        "class_session",
                        sessionId
                );
            }
        }
        enrollmentRepository.flush();

        // Emit SessionCancelledEvent for decoupled listeners
        SessionCancelledEvent event = new SessionCancelledEvent(
                sessionId,
                classId,
                className,
                session.getSessionDate(),
                session.getStartTime(),
                request.reason(),
                affectedMemberUserIds
        );
        eventPublisher.publishEvent(event);

        log.info("Session {} cancelled successfully. Cancelled {} booked enrollments and notified {} members.",
                sessionId, bookedEnrollments.size(), affectedMemberUserIds.size());

        return toDto(savedSession);
    }

    private void validateCancellationPermission(ClassSession session, AuthenticatedPrincipal principal) {
        if (principal == null) {
            throw new ForbiddenException("SCHEDULING_FORBIDDEN", "error.forbidden", null, "Unauthenticated");
        }

        String role = principal.role();
        if ("CENTER_MANAGER".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role) || "STAFF".equalsIgnoreCase(role)) {
            return;
        }

        if ("COACH".equalsIgnoreCase(role)) {
            Coach sessionCoach = session.getGymClass().getCoach();
            if (sessionCoach != null && principal.id().equals(sessionCoach.getUserId())) {
                return;
            }
            throw new ForbiddenException(
                    "SCHEDULING_FORBIDDEN_COACH",
                    "error.forbidden",
                    null,
                    "Only the assigned coach or management staff can cancel this session"
            );
        }

        throw new ForbiddenException("SCHEDULING_FORBIDDEN", "error.forbidden", null, "Insufficient permissions to cancel session");
    }

    public ClassSessionDto toDto(ClassSession session) {
        GymClass gymClass = session.getGymClass();
        Coach coach = gymClass != null ? gymClass.getCoach() : null;
        long booked = gymClass != null
                ? enrollmentRepository.countByGymClassIdAndStatus(gymClass.getId(), "booked")
                : 0;

        return new ClassSessionDto(
                session.getId(),
                gymClass != null ? gymClass.getId() : null,
                gymClass != null ? gymClass.getName() : null,
                gymClass != null && gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null,
                gymClass != null && gymClass.getDiscipline() != null ? gymClass.getDiscipline().getName() : null,
                coach != null ? coach.getUserId() : null,
                coach != null && coach.getUser() != null ? coach.getUser().getFullName() : null,
                gymClass != null && gymClass.getRoom() != null ? gymClass.getRoom().getId() : null,
                gymClass != null && gymClass.getRoom() != null ? gymClass.getRoom().getName() : null,
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus(),
                session.getCancelReason(),
                gymClass != null ? gymClass.getCapacity() : 0,
                booked
        );
    }
}
