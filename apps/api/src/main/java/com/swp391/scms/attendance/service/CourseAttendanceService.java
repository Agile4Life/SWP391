package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.entity.SessionAttendance;
import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.common.CenterTime;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Absence rules for recurring courses (spec 2026-11-09, section 1.4).
 * <ul>
 *   <li>A booked member with no attendance row for a finished session is marked {@code absent}.</li>
 *   <li>Missing more than half of a course's sessions blocks joining a new course for {@link #BLOCK_DAYS} days.</li>
 *   <li>Late arrivals count as present; excused sessions (an approved hold) are not absences.</li>
 * </ul>
 */
@Service
public class CourseAttendanceService {
    public static final int BLOCK_DAYS = 30;
    /** How far back a sweep looks for finished sessions nobody recorded. */
    private static final int LOOKBACK_DAYS = 7;
    private static final Logger log = LoggerFactory.getLogger(CourseAttendanceService.class);

    private final SessionAttendanceRepository attendance;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final MemberRepository members;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.notifications.NotificationService notifications;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.common.i18n.MessageService messages;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.attendance.repository.CenterCheckinRepository checkins;

    /** A visit that began up to this long before a session still covers it (the member came early and stayed). */
    private static final int STAY_BEFORE_HOURS = 3;

    public CourseAttendanceService(SessionAttendanceRepository attendance, ClassSessionRepository sessions,
                                   ClassEnrollmentRepository enrollments, MemberRepository members, Clock clock) {
        this.attendance = attendance;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.members = members;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.attendance.auto-absent.cron:0 */30 * * * ?}")
    public void sweep() {
        try {
            int marked = markMissedSessions();
            if (marked > 0) log.info("[CourseAttendance] marked {} missed session(s) as absent", marked);
        } catch (RuntimeException ex) {
            log.warn("[CourseAttendance] sweep failed", ex);
        }
    }

    /** Marks every unrecorded, finished course session as absent and applies the 50% rule. Returns rows created. */
    @Transactional
    public int markMissedSessions() {
        LocalDateTime now = LocalDateTime.now(clock.withZone(CenterTime.ZONE));
        LocalDate today = now.toLocalDate();
        int created = 0;
        Set<String> touched = new HashSet<>();
        for (ClassSession session : sessions.findNotCancelledBetween(today.minusDays(LOOKBACK_DAYS), today)) {
            if (!hasEnded(session, now) || session.getGymClass() == null || session.getGymClass().getCoach() == null) continue;
            Long classId = session.getGymClass().getId();
            for (ClassEnrollment enrollment : enrollments.findByGymClassIdAndStatus(classId, "booked")) {
                Member member = enrollment.getMember();
                if (member == null || joinedAfter(enrollment, session)
                        || attendance.existsBySessionIdAndMemberUserId(session.getId(), member.getUserId())) continue;
                SessionAttendance row = new SessionAttendance();
                row.setSession(session);
                row.setMember(member);
                row.setRecordedBy(session.getGymClass().getCoach());
                LocalDateTime visit = coveringVisit(member.getUserId(), session);
                if (visit != null) {
                    // Came in early and stayed through the session: present, not absent.
                    row.setStatus("present");
                    row.setCheckedInAt(visit);
                    row.setNotes("auto: visit covered the session");
                } else {
                    row.setStatus("absent");
                    row.setNotes("auto: not attended");
                }
                attendance.save(row);
                created++;
                touched.add(member.getUserId() + ":" + classId);
            }
        }
        for (String key : touched) {
            String[] parts = key.split(":");
            evaluate(Long.valueOf(parts[0]), Long.valueOf(parts[1]));
        }
        return created;
    }

    /**
     * The member resumed before the hold ended: sessions that were excused for the hold from {@code from} on are
     * ordinary sessions again, so they count as attended or missed like any other.
     */
    @Transactional
    public int releaseHoldExcuses(Long memberId, LocalDate from) {
        if (memberId == null || from == null) return 0;
        List<SessionAttendance> rows = attendance.findHoldExcuses(memberId, from);
        attendance.deleteAll(rows);
        return rows.size();
    }

    /** Start of a granted visit that was inside the center while the session ran, or null. */
    private LocalDateTime coveringVisit(Long memberId, ClassSession session) {
        if (checkins == null || session.getSessionDate() == null) return null;
        LocalDateTime start = LocalDateTime.of(session.getSessionDate(), session.getStartTime());
        LocalDateTime end = LocalDateTime.of(session.getSessionDate(), session.getEndTime());
        return checkins.findCoveringVisitStart(memberId, start.minusHours(STAY_BEFORE_HOURS), start, end);
    }

    /**
     * Marks the member's course sessions inside {@code from..to} as excused (an approved hold) so the hold never counts
     * as an absence. Sessions already recorded are left alone. Returns how many rows were created.
     */
    @Transactional
    public int excuseSessionsBetween(Long memberId, LocalDate from, LocalDate to) {
        if (memberId == null || from == null || to == null) return 0;
        int created = 0;
        for (ClassSession session : sessions.findNotCancelledBetween(from, to)) {
            if (session.getGymClass() == null || session.getGymClass().getCoach() == null) continue;
            for (ClassEnrollment enrollment : enrollments.findByGymClassIdAndStatus(session.getGymClass().getId(), "booked")) {
                Member member = enrollment.getMember();
                if (member == null || !memberId.equals(member.getUserId())
                        || attendance.existsBySessionIdAndMemberUserId(session.getId(), memberId)) continue;
                SessionAttendance row = new SessionAttendance();
                row.setSession(session);
                row.setMember(member);
                row.setStatus("excused");
                row.setRecordedBy(session.getGymClass().getCoach());
                row.setNotes("auto: membership hold");
                attendance.save(row);
                created++;
            }
        }
        return created;
    }

    /** How early before a session starts a gate scan already counts as arriving for it. */
    private static final int EARLY_MINUTES = 30;
    /** A scan later than this after the start is recorded as late. */
    private static final int LATE_AFTER_MINUTES = 15;

    /**
     * A member entering the center is marked present for today's sessions of the courses they are booked in
     * (from 30 minutes before the start until the end); the session then counts as attended and leaves the
     * remaining count. Sessions already recorded by the coach are left alone. Returns how many were marked.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public int markPresentOnEntry(Long memberId, LocalDateTime now) {
        if (memberId == null || now == null) return 0;
        Member member = members.findById(memberId).orElse(null);
        if (member == null) return 0;
        int marked = 0;
        for (ClassSession session : sessions.findNotCancelledBetween(now.toLocalDate(), now.toLocalDate())) {
            if (session.getGymClass() == null || session.getGymClass().getCoach() == null
                    || session.getStartTime() == null || session.getEndTime() == null) continue;
            LocalDateTime start = LocalDateTime.of(session.getSessionDate(), session.getStartTime());
            LocalDateTime end = LocalDateTime.of(session.getSessionDate(), session.getEndTime());
            if (now.isBefore(start.minusMinutes(EARLY_MINUTES)) || now.isAfter(end)) continue;
            boolean booked = enrollments.findByGymClassIdAndStatus(session.getGymClass().getId(), "booked").stream()
                    .anyMatch(e -> e.getMember() != null && memberId.equals(e.getMember().getUserId()));
            if (!booked || attendance.existsBySessionIdAndMemberUserId(session.getId(), memberId)) continue;
            SessionAttendance row = new SessionAttendance();
            row.setSession(session);
            row.setMember(member);
            row.setStatus(now.isAfter(start.plusMinutes(LATE_AFTER_MINUTES)) ? "late" : "present");
            row.setCheckedInAt(now);
            row.setRecordedBy(session.getGymClass().getCoach());
            row.setNotes("auto: gate scan");
            attendance.save(row);
            marked++;
        }
        return marked;
    }

    /** True when the member missed more than half of the course and was blocked now. */
    @Transactional
    public boolean evaluate(Long memberId, Long classId) {
        long total = sessions.countByGymClassIdAndStatusNot(classId, "cancelled");
        if (total <= 0) return false;
        long absent = attendance.countAbsences(memberId, classId);
        if (absent * 2 <= total) return false;
        Member member = members.findById(memberId).orElse(null);
        if (member == null) return false;
        LocalDateTime now = LocalDateTime.now(clock.withZone(CenterTime.ZONE));
        if (member.getCourseEnrollBlockedUntil() != null && member.getCourseEnrollBlockedUntil().isAfter(now)) return true;
        member.setCourseEnrollBlockedUntil(now.plusDays(BLOCK_DAYS));
        members.save(member);
        if (notifications != null && messages != null) {
            try {
                notifications.send(memberId, messages.getMessage("notifications.course.enroll_blocked.title"),
                        messages.getMessage("notifications.course.enroll_blocked.body", BLOCK_DAYS),
                        "system", "member", memberId);
            } catch (RuntimeException ex) {
                log.debug("Could not notify member {} about the enrollment block", memberId, ex);
            }
        }
        return true;
    }

    private static boolean hasEnded(ClassSession session, LocalDateTime now) {
        return session.getSessionDate() != null && session.getEndTime() != null
                && !LocalDateTime.of(session.getSessionDate(), session.getEndTime()).isAfter(now);
    }

    private static boolean joinedAfter(ClassEnrollment enrollment, ClassSession session) {
        return enrollment.getEnrolledAt() != null && session.getSessionDate() != null
                && enrollment.getEnrolledAt().toLocalDate().isAfter(session.getSessionDate());
    }
}
