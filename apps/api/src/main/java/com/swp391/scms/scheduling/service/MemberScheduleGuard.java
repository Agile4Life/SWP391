package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.support.DefaultMessageSourceResolvable;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Nơi duy nhất kiểm tra hội viên có rảnh trong một khung giờ trên mọi loại lịch: lớp học nhóm và PT 1:1.
 */
@Component
public class MemberScheduleGuard {
    private static final String CODE = "MEMBER_SCHEDULE_CONFLICT";
    private static final String KEY = "error.member_schedule.conflict";
    private static final String KIND_KEY_PREFIX = "error.member_schedule.kind.";
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ClassSessionRepository sessions;
    private final CoachBookingRepository coachBookings;
    private final Clock clock;

    /** Khởi tạo với các repository buổi học và booking PT (dùng đồng hồ hệ thống giờ Việt Nam). */
    public MemberScheduleGuard(ClassSessionRepository sessions,
                               CoachBookingRepository coachBookings) {
        this(sessions, coachBookings, Clock.system(CENTER_ZONE));
    }

    /** Khởi tạo chính được Spring dùng: nhận repository buổi học, booking PT và Clock. */
    @Autowired
    public MemberScheduleGuard(ClassSessionRepository sessions,
                               CoachBookingRepository coachBookings,
                               Clock clock) {
        this.sessions = sessions;
        this.coachBookings = coachBookings;
        this.clock = clock != null ? clock : Clock.system(CENTER_ZONE);
    }

    /**
     * Ném ConflictException nếu hội viên đã có lớp học hoặc buổi PT trùng khung [start, end) trong ngày (bỏ
     * qua lớp excludeClassId); thiếu tham số thì bỏ qua.
     */
    public void ensureFree(Long memberUserId, LocalDate date, LocalTime start, LocalTime end, Long excludeClassId) {
        if (memberUserId == null || date == null || start == null || end == null) {
            return;
        }
        for (ClassSession s : sessions.findActiveByMemberAndDate(memberUserId, date)) {
            if (s.getStartTime() == null || s.getEndTime() == null) {
                continue;
            }
            Long classId = s.getGymClass() != null ? s.getGymClass().getId() : null;
            if (excludeClassId != null && Objects.equals(classId, excludeClassId)) {
                continue;
            }
            if (overlaps(start, end, s.getStartTime(), s.getEndTime())) {
                throw conflict("class", "lớp học", date, s.getStartTime(), s.getEndTime(),
                        s.getGymClass() != null ? s.getGymClass().getName() : "");
            }
        }
        List<CoachBooking> coach = coachBookings.findActiveByMemberAndDate(memberUserId, date);
        for (CoachBooking b : coach) {
            if (overlaps(start, end, b.getStartTime(), b.getEndTime())) {
                throw conflict("coach", "lịch hẹn HLV 1:1", date, b.getStartTime(), b.getEndTime(), "");
            }
        }
    }

    /**
     * Khóa học định kỳ chiếm lịch hội viên ở mọi buổi đang {@code scheduled} từ hiện tại trở đi: tải lịch lớp
     * nhóm và PT 1:1 của hội viên đúng 2 truy vấn theo khoảng {@code [firstDate, lastDate]} thay vì {@code 2N}.
     */
    public void ensureCourseFree(Long memberUserId, GymClass course) {
        if (memberUserId == null || course == null || course.getId() == null) {
            return;
        }
        List<ClassSession> rawCourseSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(course.getId());
        if (rawCourseSessions == null || rawCourseSessions.isEmpty()) {
            return;
        }
        LocalDateTime now = SessionEligibility.now(clock);
        LocalDate today = now.toLocalDate();
        LocalTime nowTime = now.toLocalTime();

        List<ClassSession> upcoming = new ArrayList<>();
        LocalDate firstDate = null;
        LocalDate lastDate = null;
        for (ClassSession s : rawCourseSessions) {
            if (s == null || !"scheduled".equalsIgnoreCase(s.getStatus())
                    || s.getSessionDate() == null || s.getStartTime() == null || s.getEndTime() == null) {
                continue;
            }
            if (s.getSessionDate().isBefore(today)
                    || (s.getSessionDate().isEqual(today) && !s.getEndTime().isAfter(nowTime))) {
                continue;
            }
            upcoming.add(s);
            if (firstDate == null || s.getSessionDate().isBefore(firstDate)) {
                firstDate = s.getSessionDate();
            }
            if (lastDate == null || s.getSessionDate().isAfter(lastDate)) {
                lastDate = s.getSessionDate();
            }
        }
        if (upcoming.isEmpty()) {
            return;
        }

        Map<LocalDate, List<ClassSession>> memberSessionsByDate = new HashMap<>();
        List<ClassSession> memberSessions = sessions.findActiveByMemberBetween(memberUserId, firstDate, lastDate);
        if (memberSessions != null) {
            for (ClassSession ms : memberSessions) {
                if (ms == null || ms.getSessionDate() == null || ms.getStartTime() == null || ms.getEndTime() == null) {
                    continue;
                }
                Long otherClassId = ms.getGymClass() != null ? ms.getGymClass().getId() : null;
                if (Objects.equals(otherClassId, course.getId())) {
                    continue;
                }
                memberSessionsByDate.computeIfAbsent(ms.getSessionDate(), k -> new ArrayList<>()).add(ms);
            }
        }

        Map<LocalDate, List<CoachBooking>> memberPtByDate = new HashMap<>();
        List<CoachBooking> memberPts = coachBookings.findFutureConfirmedByMember(memberUserId, firstDate);
        if (memberPts != null) {
            for (CoachBooking b : memberPts) {
                if (b == null || b.getBookingDate() == null || b.getBookingDate().isAfter(lastDate)) {
                    continue;
                }
                memberPtByDate.computeIfAbsent(b.getBookingDate(), k -> new ArrayList<>()).add(b);
            }
        }

        for (ClassSession target : upcoming) {
            LocalDate date = target.getSessionDate();
            for (ClassSession other : memberSessionsByDate.getOrDefault(date, List.of())) {
                if (overlaps(target.getStartTime(), target.getEndTime(), other.getStartTime(), other.getEndTime())) {
                    throw conflict("class", "lớp học", date, other.getStartTime(), other.getEndTime(),
                            other.getGymClass() != null ? other.getGymClass().getName() : "");
                }
            }
            for (CoachBooking b : memberPtByDate.getOrDefault(date, List.of())) {
                if (overlaps(target.getStartTime(), target.getEndTime(), b.getStartTime(), b.getEndTime())) {
                    throw conflict("coach", "lịch hẹn HLV 1:1", date, b.getStartTime(), b.getEndTime(), "");
                }
            }
        }
    }

    /** True nếu hai khoảng giờ giao nhau (khoảng kia phải có đủ giờ bắt đầu/kết thúc). */
    private static boolean overlaps(LocalTime start, LocalTime end, LocalTime otherStart, LocalTime otherEnd) {
        return otherStart != null && otherEnd != null && start.isBefore(otherEnd) && end.isAfter(otherStart);
    }

    /**
     * Tạo ConflictException mô tả loại lịch bị trùng, ngày, khung giờ và tên.
     * {@code kind} là hậu tố của message key để loại đặt lịch được dịch theo ngôn ngữ của người gọi.
     */
    private static ConflictException conflict(String kind, String kindVi, LocalDate date, LocalTime start, LocalTime end, String name) {
        String range = start + "–" + end;
        MessageSourceResolvable kindLabel = new DefaultMessageSourceResolvable(new String[]{KIND_KEY_PREFIX + kind}, kindVi);
        return new ConflictException(CODE, KEY, new Object[]{kindLabel, date.toString(), range, name},
                "Bạn đã có " + kindVi + (name.isBlank() ? "" : " \"" + name + "\"") + " ngày " + date + " (" + range + ") trùng khung giờ này.");
    }
}
