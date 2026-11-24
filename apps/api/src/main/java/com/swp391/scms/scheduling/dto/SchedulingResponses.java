package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Nhóm các DTO trả về cho nghiệp vụ lớp học và buổi học.
 *
 * SCRUM-72: các payload phản hồi cho mô hình đọc của lớp và buổi học.
 */
public final class SchedulingResponses {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private SchedulingResponses() {
    }

    /** Thông tin lớp/khóa học: bộ môn, HLV, phòng, sức chứa, trình độ, mô tả, trạng thái, giá và lịch định kỳ. */
    public record GymClassDto(
            Long id,
            String name,
            Long disciplineId,
            String disciplineName,
            Long coachId,
            String coachName,
            Long roomId,
            String roomName,
            int capacity,
            String level,
            String description,
            String status,
            java.math.BigDecimal price,
            LocalDate startDate,
            LocalDate endDate,
            String recurringDays,
            LocalTime startTime,
            LocalTime endTime
    ) {
        /** Constructor rút gọn không có giá và lịch (giá mặc định 0). */
        public GymClassDto(
                Long id,
                String name,
                Long disciplineId,
                String disciplineName,
                Long coachId,
                String coachName,
                Long roomId,
                String roomName,
                int capacity,
                String level,
                String description,
                String status
        ) {
            this(id, name, disciplineId, disciplineName, coachId, coachName, roomId, roomName, capacity, level, description, status, java.math.BigDecimal.ZERO, null, null, null, null, null);
        }
    }

    /**
     * Thông tin một buổi học: lớp, bộ môn, HLV, phòng, ngày giờ, trạng thái, lý do hủy, sức chứa và số chỗ đã
     * đặt.
     */
    public record ClassSessionDto(
            Long id,
            Long classId,
            String className,
            Long disciplineId,
            String disciplineName,
            Long coachId,
            String coachName,
            Long roomId,
            String roomName,
            LocalDate sessionDate,
            LocalTime startTime,
            LocalTime endTime,
            String status,
            String cancelReason,
            int capacity,
            long bookedCount
    ) {
    }

    /**
     * Thông tin một học viên trong lớp/buổi: liên hệ, mục tiêu, ghi chú sức khỏe, trình độ, người liên hệ khẩn
     * cấp, thời điểm ghi danh và trạng thái.
     */
    public record EnrolledStudentDto(
            Long id,
            Long memberId,
            String membershipCode,
            String fullName,
            String email,
            String phone,
            String avatarUrl,
            String fitnessGoal,
            String healthNotes,
            String fitnessLevel,
            String emergencyContactName,
            String emergencyContactPhone,
            LocalDateTime enrolledAt,
            String status
    ) {
    }

    /** Một lựa chọn HLV khi xếp lớp: id, họ tên, liên hệ, trạng thái và giới tính. */
    public record CoachOptionDto(
            Long id,
            String fullName,
            String email,
            String phone,
            String status,
            String gender
    ) {
        /** Constructor rút gọn không có giới tính. */
        public CoachOptionDto(Long id, String fullName, String email, String phone, String status) {
            this(id, fullName, email, phone, status, null);
        }
    }
}
