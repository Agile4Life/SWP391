package com.swp391.scms.attendance.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Bảng điểm danh của một buổi: thông tin buổi, HLV, phòng, các tổng số và danh sách học viên.
 *
 * SCRUM-111: Phản hồi danh sách điểm danh buổi học và trạng thái điểm danh của từng hội viên.
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

    /**
     * Một học viên trong bảng điểm danh: thông tin liên hệ, trạng thái đăng ký, trạng thái điểm danh, thời
     * điểm, HLV ghi nhận, ghi chú, điểm tiến bộ và giờ quét cổng (gợi ý).
     */
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
            Integer progressScore,
            /**
             * Lượt check-in ở cổng đã bao phủ buổi này, hiển thị cho HLV dưới dạng thẻ nhãn; null khi không
             * có.
             */
            LocalDateTime gateCheckinAt
    ) {
        /** Constructor không có điểm tiến bộ và giờ quét cổng. */
        public MemberAttendanceItem(Long memberId, String membershipCode, String fullName, String email, String phone,
                                    String avatarUrl, String enrollmentStatus, String attendanceStatus,
                                    LocalDateTime checkedInAt, Long recordedByCoachId, String recordedByCoachName,
                                    String notes, Integer progressScore) {
            this(memberId, membershipCode, fullName, email, phone, avatarUrl, enrollmentStatus, attendanceStatus,
                    checkedInAt, recordedByCoachId, recordedByCoachName, notes, progressScore, null);
        }

        /** Constructor có điểm tiến bộ nhưng không có giờ quét cổng. */
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
                    recordedByCoachId, recordedByCoachName, notes, null, null);
        }
    }
}
