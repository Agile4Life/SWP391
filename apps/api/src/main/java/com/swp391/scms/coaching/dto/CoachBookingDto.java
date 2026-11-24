package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Thông tin một booking PT 1:1 trả về client: hội viên, HLV, bộ môn, ngày giờ, giá theo giờ, thanh toán, trạng
 * thái, ghi chú và thông tin điểm danh.
 */
public record CoachBookingDto(
        Long id,
        Long memberId,
        String memberName,
        Long coachId,
        String coachName,
        String coachSpecialization,
        String coachAvatarUrl,
        Long disciplineId,
        String disciplineName,
        LocalDate bookingDate,
        LocalTime startTime,
        LocalTime endTime,
        BigDecimal hourlyRate,
        String paymentMethod,
        String paymentStatus,
        String status,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime cancelledAt,
        String cancelReason,
        /** Thời điểm HLV hoặc quầy lễ tân ghi nhận hội viên có mặt; null nếu chưa ghi nhận. */
        LocalDateTime attendedAt,
        /** True khi nhân viên chủ động gỡ dấu có mặt. */
        boolean attendanceLocked,
        /** Lượt check-in cổng bao phủ buổi tập (chỉ ở danh sách điểm danh), hiển thị như gợi ý; null nếu không có. */
        LocalDateTime gateCheckinAt,
        String membershipCode,
        String memberPhone,
        String memberEmail
) {
    /** Constructor rút gọn dùng ở các chỗ không cần đủ mọi trường mở rộng; các trường còn lại để mặc định. */
    public CoachBookingDto(
            Long id, Long memberId, String memberName, Long coachId, String coachName,
            String coachSpecialization, String coachAvatarUrl, Long disciplineId, String disciplineName,
            LocalDate bookingDate, LocalTime startTime, LocalTime endTime, BigDecimal hourlyRate,
            String paymentMethod, String paymentStatus, String status, String notes,
            LocalDateTime createdAt, LocalDateTime cancelledAt, String cancelReason,
            LocalDateTime attendedAt, boolean attendanceLocked, LocalDateTime gateCheckinAt
    ) {
        this(id, memberId, memberName, coachId, coachName, coachSpecialization, coachAvatarUrl,
                disciplineId, disciplineName, bookingDate, startTime, endTime, hourlyRate,
                paymentMethod, paymentStatus, status, notes, createdAt, cancelledAt, cancelReason,
                attendedAt, attendanceLocked, gateCheckinAt, null, null, null);
    }
}
