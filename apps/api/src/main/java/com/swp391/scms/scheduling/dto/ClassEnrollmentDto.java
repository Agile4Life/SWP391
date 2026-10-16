package com.swp391.scms.scheduling.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * SCRUM-73: DTO mapping for member class enrollment.
 */
@Schema(description = "Thông tin đăng ký buổi học của hội viên")
public record ClassEnrollmentDto(
        @Schema(description = "Mã lượt đăng ký", example = "10")
        Long id,

        @Schema(description = "Mã lớp học", example = "5")
        Long classId,

        @Schema(description = "Tên lớp học", example = "Yoga Vinyasa Nâng Cao")
        String className,

        @Schema(description = "Mã hội viên", example = "12")
        Long memberId,

        @Schema(description = "Mã buổi học", example = "9")
        Long sessionId,

        @Schema(description = "Ngày diễn ra buổi học", example = "2026-10-15")
        LocalDate sessionDate,

        @Schema(description = "Giờ bắt đầu buổi học", example = "08:00:00")
        LocalTime startTime,

        @Schema(description = "Giờ kết thúc buổi học", example = "09:30:00")
        LocalTime endTime,

        @Schema(description = "Trạng thái đặt chỗ (booked, cancelled, completed)", example = "booked")
        String status,

        @Schema(description = "Thời điểm đăng ký")
        LocalDateTime enrolledAt,

        @Schema(description = "Thời điểm hủy đặt chỗ (nếu có)")
        LocalDateTime cancelledAt,

        @Schema(description = "Lý do hủy đặt chỗ (nếu có)")
        String cancelReason
) {
}
