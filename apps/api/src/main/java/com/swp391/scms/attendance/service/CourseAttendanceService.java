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
 * Quy tắc vắng mặt cho khóa học nhóm (tính năng cũ): đánh vắng buổi đã kết thúc mà chưa điểm danh, vắng quá nửa
 * khóa thì bị chặn đăng ký khóa mới 30 ngày; đến muộn tính là có mặt, buổi có phép do bảo lưu không tính vắng.
 *
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

    /** Group classes are out of scope; the sweep stays off with them so legacy rows are not swept. */
    @org.springframework.beans.factory.annotation.Value("${app.legacy.classes-enabled:false}")
    private boolean classesEnabled;

    /** A visit that began up to this long before a session still covers it (the member came early and stayed). */
    private static final int STAY_BEFORE_HOURS = 3;

    /** Nhận repository điểm danh, buổi học, đăng ký và hội viên, cùng Clock. */
    public CourseAttendanceService(SessionAttendanceRepository attendance, ClassSessionRepository sessions,
                                   ClassEnrollmentRepository enrollments, MemberRepository members, Clock clock) {
        this.attendance = attendance;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.members = members;
        this.clock = clock;
    }

    /**
     * Job mỗi 30 phút đánh vắng các buổi đã qua; chỉ chạy khi bật lớp nhóm (app.legacy.classes-enabled). Lỗi
     * chỉ ghi log.
     */
    @Scheduled(cron = "${app.attendance.auto-absent.cron:0 */30 * * * ?}")
    public void sweep() {
        if (!classesEnabled) return;
        try {
            int marked = markMissedSessions();
            if (marked > 0) log.info("[CourseAttendance] marked {} missed session(s) as absent", marked);
        } catch (RuntimeException ex) {
            log.warn("[CourseAttendance] sweep failed", ex);
        }
    }

    /**
     * Với các buổi trong 7 ngày qua đã kết thúc: mọi học viên đăng ký chưa có điểm danh (và không có lượt quét
     * cổng bao phủ buổi) bị ghi vắng tự động; sau đó xét quy tắc vắng quá nửa cho từng học viên. Trả số bản ghi
     * đã tạo.
     *
     * Marks every unrecorded, finished course session as absent and applies the 50% rule. Returns rows created.
     */
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
                // Only the coach records attendance; a member who was in the center then is left for the coach to mark.
                if (gateCheckinFor(member.getUserId(), session) != null) continue;
                SessionAttendance row = new SessionAttendance();
                row.setSession(session);
                row.setMember(member);
                row.setRecordedBy(session.getGymClass().getCoach());
                row.setStatus("absent");
                row.setNotes("auto: not attended");
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
     * Hội viên quay lại sớm sau bảo lưu: xóa các bản ghi "có phép do bảo lưu" từ ngày đó, để các buổi này được
     * tính như bình thường.
     *
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

    /**
     * Giờ vào của lượt quét cổng còn ở trong trung tâm lúc buổi diễn ra (vào sớm tối đa 3 giờ); chỉ để HLV tham
     * khảo, không tự ghi điểm danh.
     *
     * Start of a granted gate check-in that was inside the center while the session ran (it began at most
     * {@value #STAY_BEFORE_HOURS} hours before the start), or null. Shown to the coach; it never records attendance.
     */
    public LocalDateTime gateCheckinFor(Long memberId, ClassSession session) {
        if (checkins == null || session.getSessionDate() == null) return null;
        LocalDateTime start = LocalDateTime.of(session.getSessionDate(), session.getStartTime());
        LocalDateTime end = LocalDateTime.of(session.getSessionDate(), session.getEndTime());
        return checkins.findCoveringVisitStart(memberId, start.minusHours(STAY_BEFORE_HOURS), start, end);
    }

    /**
     * Nếu học viên vắng quá nửa số buổi của khóa thì chặn đăng ký khóa mới 30 ngày và gửi thông báo; trả true
     * nếu đang bị chặn.
     *
     * True when the member missed more than half of the course and was blocked now.
     */
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

    /** Buổi học đã kết thúc chưa. */
    private static boolean hasEnded(ClassSession session, LocalDateTime now) {
        return session.getSessionDate() != null && session.getEndTime() != null
                && !LocalDateTime.of(session.getSessionDate(), session.getEndTime()).isAfter(now);
    }

    /** Học viên có đăng ký sau ngày diễn ra buổi không (khi đó buổi đó không tính). */
    private static boolean joinedAfter(ClassEnrollment enrollment, ClassSession session) {
        return enrollment.getEnrolledAt() != null && session.getSessionDate() != null
                && enrollment.getEnrolledAt().toLocalDate().isAfter(session.getSessionDate());
    }
}
