package com.swp391.scms.attendance.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * SCRUM-111: Session attendance roster and member attendance status response.
 */
public record SessionAttendanceResponse(
        Long sessionId,
        Long classId,
        String className,
        LocalDate sessionDate,
        LocalTime startTime,
        LocalTime endTime,
        Long coachId,
        String coachName,
        String roomName,
        int totalBooked,
        int totalPresent,
        int totalAbsent,
        int totalLate,
        int totalExcused,
        List<MemberAttendanceItem> members
) {

    public record MemberAttendanceItem(
            Long memberId,
            String membershipCode,
            String fullName,
            String email,
            String phone,
            String avatarUrl,
            String enrollmentStatus,
            String attendanceStatus,
            LocalDateTime checkedInAt,
            Long recordedByCoachId,
            String recordedByCoachName,
            String notes,
            Integer progressScore
    ) {
        public MemberAttendanceItem(
                Long memberId,
                String membershipCode,
                String fullName,
                String email,
                String phone,
                String avatarUrl,
                String enrollmentStatus,
                String attendanceStatus,
                LocalDateTime checkedInAt,
                Long recordedByCoachId,
                String recordedByCoachName,
                String notes
        ) {
            this(memberId, membershipCode, fullName, email, phone, avatarUrl,
                    enrollmentStatus, attendanceStatus, checkedInAt,
                    recordedByCoachId, recordedByCoachName, notes, null);
        }
    }
}
