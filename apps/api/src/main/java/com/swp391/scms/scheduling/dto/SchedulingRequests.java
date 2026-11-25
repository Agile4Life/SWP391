package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Nhóm các DTO yêu cầu cho nghiệp vụ lớp học và buổi học.
 *
 * SCRUM-72 & SCRUM-131: các payload yêu cầu quản lý lớp và buổi học.
 */
public final class SchedulingRequests {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private SchedulingRequests() {
    }

    /**
     * Yêu cầu tạo lớp một buổi (đã ngừng): tên, bộ môn, HLV, phòng, sức chứa, trình độ, mô tả, ngày và giờ học.
     *
     * SCRUM-72 AC: Quản lý tạo lớp (bộ môn, HLV, phòng, sức chứa, cấp độ), có thể xếp luôn buổi đầu trong
     * cùng yêu cầu.
     */
    public record CreateClassRequest(
            @NotBlank(message = "{validation.scheduling.class_name.not_blank}")
            @Size(max = 150, message = "{validation.scheduling.class_name.size}")
            String name,

            @NotNull(message = "{validation.scheduling.discipline.not_null}")
            Long disciplineId,

            @NotNull(message = "{validation.scheduling.coach.not_null}")
            Long coachId,

            @NotNull(message = "{validation.scheduling.room.not_null}")
            Long roomId,

            @NotNull(message = "{validation.scheduling.capacity.not_null}")
            @Min(value = 1, message = "{validation.scheduling.capacity.min}")
            Integer capacity,

            @Pattern(regexp = "beginner|intermediate|advanced|all", message = "{validation.scheduling.level.pattern}")
            String level,

            String description,

            java.time.LocalDate sessionDate,
            java.time.LocalTime startTime,
            java.time.LocalTime endTime
    ) {
        /** Constructor rút gọn không có ngày giờ buổi học. */
        public CreateClassRequest(String name,
                                  Long disciplineId,
                                  Long coachId,
                                  Long roomId,
                                  Integer capacity,
                                  String level,
                                  String description) {
            this(name, disciplineId, coachId, roomId, capacity, level, description, null, null, null);
        }
    }

    /**
     * Yêu cầu tạo khóa học định kỳ: thông tin lớp, giá, ngày bắt đầu/kết thúc, các thứ trong tuần và giờ học.
     *
     * Quản lý tạo khóa học định kỳ với khoảng ngày báo trước, các ngày lặp hằng tuần và giá phí khóa học.
     */
    public record CreateRecurringClassRequest(
            @NotBlank(message = "{validation.scheduling.class_name.not_blank}")
            @Size(max = 150, message = "{validation.scheduling.class_name.size}")
            String name,

            @NotNull(message = "{validation.scheduling.discipline.not_null}")
            Long disciplineId,

            @NotNull(message = "{validation.scheduling.coach.not_null}")
            Long coachId,

            @NotNull(message = "{validation.scheduling.room.not_null}")
            Long roomId,

            @NotNull(message = "{validation.scheduling.capacity.not_null}")
            @Min(value = 1, message = "{validation.scheduling.capacity.min}")
            Integer capacity,

            @Pattern(regexp = "beginner|intermediate|advanced|all", message = "{validation.scheduling.level.pattern}")
            String level,

            String description,

            java.math.BigDecimal price,

            @NotNull(message = "{validation.scheduling.start_date.not_null}")
            java.time.LocalDate startDate,

            @NotNull(message = "{validation.scheduling.end_date.not_null}")
            java.time.LocalDate endDate,

            /** Các thứ (MONDAY...) khóa học diễn ra mỗi tuần giữa ngày bắt đầu và kết thúc. */
            java.util.List<String> recurringDays,

            @NotNull(message = "{validation.scheduling.start_time.not_null}")
            java.time.LocalTime startTime,

            @NotNull(message = "{validation.scheduling.end_time.not_null}")
            java.time.LocalTime endTime
    ) {
    }

    /**
     * Yêu cầu cập nhật lớp: tên, bộ môn, HLV, phòng, sức chứa, trình độ, mô tả và trạng thái.
     *
     * SCRUM-131 AC: Quản lý cập nhật lớp hiện có (tên, bộ môn, HLV, phòng, sức chứa, cấp độ, mô tả, trạng
     * thái).
     */
    public record UpdateClassRequest(
            @NotBlank(message = "{validation.scheduling.class_name.not_blank}")
            @Size(max = 150, message = "{validation.scheduling.class_name.size}")
            String name,

            @NotNull(message = "{validation.scheduling.discipline.not_null}")
            Long disciplineId,

            @NotNull(message = "{validation.scheduling.coach.not_null}")
            Long coachId,

            @NotNull(message = "{validation.scheduling.room.not_null}")
            Long roomId,

            @NotNull(message = "{validation.scheduling.capacity.not_null}")
            @Min(value = 1, message = "{validation.scheduling.capacity.min}")
            Integer capacity,

            @Pattern(regexp = "beginner|intermediate|advanced|all", message = "{validation.scheduling.level.pattern}")
            String level,

            String description,

            @Pattern(regexp = "active|cancelled|archived", message = "{validation.scheduling.class_status.pattern}")
            String status
    ) {
    }

    /**
     * Yêu cầu xếp một buổi học cụ thể: ngày, giờ bắt đầu và kết thúc.
     *
     * SCRUM-72 AC: xếp một buổi cụ thể cho lớp.
     */
    public record CreateSessionRequest(
            @NotNull(message = "{validation.scheduling.session_date.not_null}")
            java.time.LocalDate sessionDate,

            @NotNull(message = "{validation.scheduling.start_time.not_null}")
            java.time.LocalTime startTime,

            @NotNull(message = "{validation.scheduling.end_time.not_null}")
            java.time.LocalTime endTime
    ) {
    }

    /**
     * Yêu cầu dời lịch buổi học: ngày, giờ bắt đầu và kết thúc mới.
     *
     * SCRUM-131 AC: dời lịch một buổi học hiện có.
     */
    public record RescheduleSessionRequest(
            @NotNull(message = "{validation.scheduling.session_date.not_null}")
            java.time.LocalDate sessionDate,

            @NotNull(message = "{validation.scheduling.start_time.not_null}")
            java.time.LocalTime startTime,

            @NotNull(message = "{validation.scheduling.end_time.not_null}")
            java.time.LocalTime endTime
    ) {
    }

    /** Yêu cầu thanh toán khóa học: phương thức thanh toán. */
    public record CourseCheckoutRequest(
            String method
    ) {
    }

    /** Yêu cầu kiểm tra trước lịch trống của khóa định kỳ theo 5 slot cố định, phòng và HLV. */
    public record RecurringAvailabilityRequest(
            @NotNull(message = "{validation.scheduling.discipline.not_null}")
            Long disciplineId,

            @NotNull(message = "{validation.scheduling.start_date.not_null}")
            java.time.LocalDate startDate,

            @NotNull(message = "{validation.scheduling.end_date.not_null}")
            java.time.LocalDate endDate,

            java.util.List<String> recurringDays,

            java.time.LocalTime startTime,

            java.time.LocalTime endTime
    ) {
    }
}
