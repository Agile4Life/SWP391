package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.EnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.ClassWaitlistRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * SCRUM-73: member class booking and cancellation.
 *
 * <p>Invariant triggers are owned by the database and are never bypassed:
 * Trigger P2 ({@code trg_enrollments_check_capacity}) rejects a full class and
 * Trigger P4 ({@code trg_enrollments_check_membership}) rejects an inactive/expired
 * membership. Both are mirrored as a pre-check so the API returns a precise error
 * instead of a raw constraint violation.
 */
@Service
public class EnrollmentService {

    private static final String BOOKED = "booked";
    private static final String CANCELLED = "cancelled";
    private static final String WAITING = "waiting";

    private static final String ROLE_CENTER_MANAGER = "CENTER_MANAGER";
    private static final String ROLE_MANAGER = "MANAGER";
    private static final String ROLE_STAFF = "STAFF";
    private static final String ROLE_RECEPTIONIST = "RECEPTIONIST";

    private final ClassEnrollmentRepository enrollments;
    private final ClassSessionRepository sessions;
    private final ClassWaitlistRepository waitlists;
    private final GymClassRepository gymClasses;
    private final MembershipSubscriptionRepository subscriptions;
    private final MemberRepository members;
    private final NotificationService notifications;
    private final MessageService messageService;
    private final Clock clock;

    @Autowired
    public EnrollmentService(ClassEnrollmentRepository enrollments,
                             ClassSessionRepository sessions,
                             ClassWaitlistRepository waitlists,
                             GymClassRepository gymClasses,
                             MembershipSubscriptionRepository subscriptions,
                             MemberRepository members,
                             NotificationService notifications,
                             MessageService messageService,
                             Clock clock) {
        this.enrollments = enrollments;
        this.sessions = sessions;
        this.waitlists = waitlists;
        this.gymClasses = gymClasses;
        this.subscriptions = subscriptions;
        this.members = members;
        this.notifications = notifications;
        this.messageService = messageService;
        this.clock = clock;
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * SCRUM-73 AC: a member books a seat in a class session.
     */
    @Transactional
    public EnrollmentDto enroll(AuthenticatedPrincipal principal, Long sessionId) {
        Member member = findMember(principal.id());
        ClassSession session = findSession(sessionId);
        Long classId = session.getGymClass().getId();
        GymClass gymClass = gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
        SessionEligibility.ensureBookable(session, clock);
        ensureActiveMembership(member.getUserId());

        if (enrollments.findByGymClassIdAndMemberUserIdAndStatus(gymClass.getId(), member.getUserId(), BOOKED)
                .isPresent()) {
            throw new ConflictException(
                    "SCHEDULING_ALREADY_ENROLLED",
                    "error.scheduling.already_enrolled",
                    null,
                    "Member already has an active booking for this class");
        }

        // Trigger P2 pre-check: capacity is enforced again by the database trigger.
        long booked = enrollments.countByGymClassIdAndStatus(gymClass.getId(), BOOKED);
        if (booked >= gymClass.getCapacity()) {
            throw new ConflictException(
                    "SCHEDULING_CLASS_FULL",
                    "error.scheduling.class_full",
                    null,
                    "Class is full; consider joining the waitlist");
        }

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus(BOOKED);
        enrollment.setEnrolledAt(LocalDateTime.now(clock));

        ClassEnrollment saved = enrollments.saveAndFlush(enrollment);

        waitlists.findByGymClassIdAndMemberUserIdAndStatus(classId, member.getUserId(), WAITING)
                .ifPresent(waiting -> {
                    waiting.setStatus("expired");
                    waitlists.save(waiting);
                });

        notifications.send(member.getUserId(),
                msg("notifications.booking.enrolled.title"),
                msg("notifications.booking.enrolled.body", gymClass.getName(), session.getSessionDate().toString()),
                "system",
                "class_enrollment",
                saved.getId());

        return toDto(saved, session);
    }

    /**
     * SCRUM-73 BR-05: cancel a booking. Soft delete, releases the seat immediately.
     * Only the owner or Staff/Manager may cancel.
     */
    @Transactional
    public EnrollmentDto cancel(AuthenticatedPrincipal principal, Long enrollmentId) {
        ClassEnrollment enrollment = enrollments.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_enrollment", enrollmentId));

        boolean isStaff = isStaffRole(principal.role());
        boolean isOwner = enrollment.getMember() != null
                && enrollment.getMember().getUserId().equals(principal.id());
        if (!isStaff && !isOwner) {
            throw new ForbiddenException(
                    "SCHEDULING_ENROLLMENT_NOT_OWNER",
                    "error.scheduling.enrollment_not_owner",
                    null,
                    "Only the owner or staff may cancel this enrollment");
        }

        if (!BOOKED.equalsIgnoreCase(enrollment.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ENROLLMENT_NOT_BOOKED",
                    "error.scheduling.enrollment_not_booked",
                    null,
                    "Only a booked enrollment can be cancelled");
        }

        enrollment.setStatus(CANCELLED);
        enrollment.setCancelledAt(LocalDateTime.now(clock));
        enrollment.setCancelReason("Cancelled by " + principal.role());

        ClassEnrollment saved = enrollments.saveAndFlush(enrollment);

        notifications.send(enrollment.getMember().getUserId(),
                msg("notifications.booking.cancelled.title"),
                msg("notifications.booking.cancelled.body"),
                "system",
                "class_enrollment",
                saved.getId());

        return toDto(saved, null);
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> myEnrollments(AuthenticatedPrincipal principal) {
        return myEnrollments(principal, null);
    }

    @Transactional(readOnly = true)
    public List<EnrollmentDto> myEnrollments(AuthenticatedPrincipal principal, String status) {
        findMember(principal.id());
        String normalizedStatus = status != null && !status.isBlank() ? status.trim() : null;
        return enrollments.findByMemberUserId(principal.id()).stream()
                .filter(enrollment -> normalizedStatus == null
                        || normalizedStatus.equalsIgnoreCase(enrollment.getStatus()))
                .map(enrollment -> toDto(enrollment, null))
                .toList();
    }

    /**
     * SCRUM-73 BR-01: Trigger P4 pre-check, the database trigger remains the source of truth.
     */
    private void ensureActiveMembership(Long memberId) {
        boolean hasActive = subscriptions.hasActiveMembership(memberId, LocalDate.now(clock));
        if (!hasActive) {
            throw new ForbiddenException(
                    "SCHEDULING_MEMBERSHIP_INVALID",
                    "error.scheduling.membership_expired_or_inactive",
                    null,
                    "Member has no active or unexpired subscription");
        }
    }

    private boolean isStaffRole(String role) {
        return ROLE_CENTER_MANAGER.equals(role)
                || ROLE_MANAGER.equals(role)
                || ROLE_STAFF.equals(role)
                || ROLE_RECEPTIONIST.equals(role);
    }

    private ClassSession findSession(Long sessionId) {
        return sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
    }

    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    private EnrollmentDto toDto(ClassEnrollment enrollment, ClassSession session) {
        GymClass gymClass = enrollment.getGymClass();
        return new EnrollmentDto(
                enrollment.getId(),
                gymClass != null ? gymClass.getId() : null,
                gymClass != null ? gymClass.getName() : null,
                enrollment.getMember() != null ? enrollment.getMember().getUserId() : null,
                session != null ? session.getId() : null,
                session != null ? session.getSessionDate() : null,
                session != null ? session.getStartTime() : null,
                session != null ? session.getEndTime() : null,
                enrollment.getStatus(),
                enrollment.getEnrolledAt(),
                enrollment.getCancelledAt(),
                enrollment.getCancelReason()
        );
    }
}
