package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.dto.BatchAttendanceRequest;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse;
import com.swp391.scms.attendance.dto.SessionAttendanceResponse.MemberAttendanceItem;
import com.swp391.scms.attendance.entity.SessionAttendance;
import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * SCRUM-111: Session attendance service for retrieving rosters and batch recording attendance.
 */
@Service
public class SessionAttendanceService {

    private static final Logger log = LoggerFactory.getLogger(SessionAttendanceService.class);

    private final SessionAttendanceRepository attendanceRepository;
    private final ClassSessionRepository sessionRepository;
    private final ClassEnrollmentRepository enrollmentRepository;
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final MessageService messageService;
    private final Clock clock;

    public SessionAttendanceService(SessionAttendanceRepository attendanceRepository,
                                  ClassSessionRepository sessionRepository,
                                  ClassEnrollmentRepository enrollmentRepository,
                                  CoachRepository coachRepository,
                                  MemberRepository memberRepository,
                                  MessageService messageService,
                                  Clock clock) {
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.messageService = messageService;
        this.clock = clock;
    }

    public SessionAttendanceService(SessionAttendanceRepository attendanceRepository,
                                  ClassSessionRepository sessionRepository,
                                  ClassEnrollmentRepository enrollmentRepository,
                                  CoachRepository coachRepository,
                                  MemberRepository memberRepository) {
        this(attendanceRepository, sessionRepository, enrollmentRepository, coachRepository, memberRepository, null, Clock.systemUTC());
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * SCRUM-111 AC: GET /api/v1/attendance/sessions/{id}
     * Returns list of enrolled students for the session with their attendance records if recorded.
     */
    @Transactional(readOnly = true)
    public SessionAttendanceResponse getSessionAttendanceRoster(Long sessionId) {
        ClassSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));

        Long classId = session.getGymClass().getId();
        List<ClassEnrollment> enrollments = enrollmentRepository.findByGymClassId(classId).stream()
                .filter(e -> "booked".equalsIgnoreCase(e.getStatus()))
                .toList();

        List<SessionAttendance> attendances = attendanceRepository.findBySessionIdWithDetails(sessionId);
        Map<Long, SessionAttendance> attendanceMap = attendances.stream()
                .filter(a -> a.getMember() != null)
                .collect(Collectors.toMap(a -> a.getMember().getUserId(), a -> a, (first, second) -> first));

        List<MemberAttendanceItem> memberItems = new ArrayList<>();
        int presentCount = 0;
        int absentCount = 0;
        int lateCount = 0;
        int excusedCount = 0;

        for (ClassEnrollment enrollment : enrollments) {
            Member member = enrollment.getMember();
            if (member == null) {
                continue;
            }
            User user = member.getUser();
            SessionAttendance att = attendanceMap.get(member.getUserId());

            String attStatus = att != null ? att.getStatus() : null;
            LocalDateTime checkInTime = att != null ? att.getCheckedInAt() : null;
            Long coachId = (att != null && att.getRecordedBy() != null) ? att.getRecordedBy().getUserId() : null;
            String coachName = (att != null && att.getRecordedBy() != null && att.getRecordedBy().getUser() != null)
                    ? att.getRecordedBy().getUser().getFullName()
                    : null;
            String notes = att != null ? att.getNotes() : null;

            if (attStatus != null) {
                switch (attStatus.toLowerCase()) {
                    case "present" -> presentCount++;
                    case "absent" -> absentCount++;
                    case "late" -> lateCount++;
                    case "excused" -> excusedCount++;
                }
            }

            memberItems.add(new MemberAttendanceItem(
                    member.getUserId(),
                    member.getMembershipCode(),
                    user != null ? user.getFullName() : null,
                    user != null ? user.getEmail() : null,
                    user != null ? user.getPhone() : null,
                    user != null ? user.getAvatarUrl() : null,
                    enrollment.getStatus(),
                    attStatus,
                    checkInTime,
                    coachId,
                    coachName,
                    notes
            ));
        }

        Coach sessionCoach = session.getGymClass().getCoach();
        return new SessionAttendanceResponse(
                session.getId(),
                classId,
                session.getGymClass().getName(),
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                sessionCoach != null ? sessionCoach.getUserId() : null,
                sessionCoach != null && sessionCoach.getUser() != null ? sessionCoach.getUser().getFullName() : null,
                session.getGymClass().getRoom() != null ? session.getGymClass().getRoom().getName() : null,
                enrollments.size(),
                presentCount,
                absentCount,
                lateCount,
                excusedCount,
                memberItems
        );
    }

    /**
     * SCRUM-111 AC: POST /api/v1/attendance/sessions/{id}/batch
     * Transactional batch attendance recording by authenticated coach / staff.
     */
    @Transactional
    public List<MemberAttendanceItem> recordBatchAttendance(Long sessionId,
                                                           BatchAttendanceRequest request,
                                                           AuthenticatedPrincipal principal) {
        ClassSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));

        Coach recordingCoach = resolveRecordingCoach(principal, session);
        LocalDateTime now = LocalDateTime.now(clock);
        List<MemberAttendanceItem> result = new ArrayList<>();

        try {
            for (BatchAttendanceRequest.AttendanceItem item : request.records()) {
                Member member = memberRepository.findById(item.memberId())
                        .orElseThrow(() -> new ResourceNotFoundException("resource.member", item.memberId()));

                String normalizedStatus = item.status().trim().toLowerCase();
                Optional<SessionAttendance> existingOpt = attendanceRepository
                        .findBySessionIdAndMemberUserId(sessionId, item.memberId());

                SessionAttendance attendance;
                if (existingOpt.isPresent()) {
                    attendance = existingOpt.get();
                    attendance.setStatus(normalizedStatus);
                    if ("present".equals(normalizedStatus) || "late".equals(normalizedStatus)) {
                        if (attendance.getCheckedInAt() == null) {
                            attendance.setCheckedInAt(now);
                        }
                    } else {
                        attendance.setCheckedInAt(null);
                    }
                    attendance.setRecordedBy(recordingCoach);
                    attendance.setNotes(item.notes());
                } else {
                    attendance = new SessionAttendance();
                    attendance.setSession(session);
                    attendance.setMember(member);
                    attendance.setStatus(normalizedStatus);
                    if ("present".equals(normalizedStatus) || "late".equals(normalizedStatus)) {
                        attendance.setCheckedInAt(now);
                    }
                    attendance.setRecordedBy(recordingCoach);
                    attendance.setNotes(item.notes());
                }

                SessionAttendance saved = attendanceRepository.saveAndFlush(attendance);

                User user = member.getUser();
                result.add(new MemberAttendanceItem(
                        member.getUserId(),
                        member.getMembershipCode(),
                        user != null ? user.getFullName() : null,
                        user != null ? user.getEmail() : null,
                        user != null ? user.getPhone() : null,
                        user != null ? user.getAvatarUrl() : null,
                        "booked",
                        saved.getStatus(),
                        saved.getCheckedInAt(),
                        recordingCoach.getUserId(),
                        recordingCoach.getUser() != null ? recordingCoach.getUser().getFullName() : null,
                        saved.getNotes()
                ));
            }
        } catch (DataIntegrityViolationException ex) {
            log.error("Duplicate key violation during batch attendance for session {}: {}", sessionId, ex.getMessage());
            throw new ConflictException(
                    "ATTENDANCE_DUPLICATE_KEY",
                    "attendance.error.duplicate_key",
                    new Object[]{sessionId},
                    "Attendance duplicate entry constraint violated for this session"
            );
        }

        log.info("Batch attendance recorded successfully for session {} with {} records by coach/user {}",
                sessionId, request.records().size(), principal != null ? principal.id() : null);
        return result;
    }

    private Coach resolveRecordingCoach(AuthenticatedPrincipal principal, ClassSession session) {
        if (principal == null) {
            Coach sessionCoach = session.getGymClass().getCoach();
            if (sessionCoach != null) return sessionCoach;
            throw new ForbiddenException("ATTENDANCE_UNAUTHENTICATED", "error.unauthorized", null, "Unauthenticated");
        }

        Optional<Coach> coachOpt = coachRepository.findById(principal.id());
        if (coachOpt.isPresent()) {
            return coachOpt.get();
        }

        // If the caller is staff/manager, use the session's designated coach
        Coach sessionCoach = session.getGymClass().getCoach();
        if (sessionCoach != null) {
            return sessionCoach;
        }

        throw new ForbiddenException(
                "ATTENDANCE_NOT_COACH",
                "attendance.forbidden.not_coach",
                null,
                "Only an assigned coach or authorized staff may record session attendance"
        );
    }
}
