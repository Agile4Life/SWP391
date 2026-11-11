package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.courts.repository.CourtBookingRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.support.DefaultMessageSourceResolvable;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Objects;

/**
 * One place that decides whether a member is free in a time window across every kind of booking: class enrollments
 * and per-session bookings, court bookings and 1:1 coach bookings. Each booking flow used to check only its own kind,
 * so a member could hold a Yoga class, a Tennis court and a Gym coach in the same hour.
 */
@Component
public class MemberScheduleGuard {
    private static final String CODE = "MEMBER_SCHEDULE_CONFLICT";
    private static final String KEY = "error.member_schedule.conflict";
    private static final String KIND_KEY_PREFIX = "error.member_schedule.kind.";

    private final ClassSessionRepository sessions;
    private final CourtBookingRepository courts;
    private final CoachBookingRepository coachBookings;

    @Autowired
    public MemberScheduleGuard(ClassSessionRepository sessions,
                               CourtBookingRepository courts,
                               CoachBookingRepository coachBookings) {
        this.sessions = sessions;
        this.courts = courts;
        this.coachBookings = coachBookings;
    }

    /** Throws when the member already has something else in [start, end) on {@code date}. */
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
        if (courts.existsMemberOverlap(memberUserId, date, start, end)) {
            throw conflict("court", "đặt sân", date, start, end, "");
        }
        List<CoachBooking> coach = coachBookings.findActiveByMemberAndDate(memberUserId, date);
        for (CoachBooking b : coach) {
            if (overlaps(start, end, b.getStartTime(), b.getEndTime())) {
                throw conflict("coach", "lịch hẹn HLV 1:1", date, b.getStartTime(), b.getEndTime(), "");
            }
        }
    }

    /** A recurring course holds the member on every one of its sessions. */
    public void ensureCourseFree(Long memberUserId, GymClass course) {
        if (memberUserId == null || course == null || course.getId() == null) {
            return;
        }
        for (ClassSession s : sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(course.getId())) {
            if (s == null || "cancelled".equalsIgnoreCase(s.getStatus())) {
                continue;
            }
            ensureFree(memberUserId, s.getSessionDate(), s.getStartTime(), s.getEndTime(), course.getId());
        }
    }

    private static boolean overlaps(LocalTime start, LocalTime end, LocalTime otherStart, LocalTime otherEnd) {
        return otherStart != null && otherEnd != null && start.isBefore(otherEnd) && end.isAfter(otherStart);
    }

    /** {@code kind} is a message-key suffix so the booking type is translated with the caller's language. */
    private static ConflictException conflict(String kind, String kindVi, LocalDate date, LocalTime start, LocalTime end, String name) {
        String range = start + "–" + end;
        MessageSourceResolvable kindLabel = new DefaultMessageSourceResolvable(new String[]{KIND_KEY_PREFIX + kind}, kindVi);
        return new ConflictException(CODE, KEY, new Object[]{kindLabel, date.toString(), range, name},
                "Bạn đã có " + kindVi + (name.isBlank() ? "" : " \"" + name + "\"") + " ngày " + date + " (" + range + ") trùng khung giờ này.");
    }
}
