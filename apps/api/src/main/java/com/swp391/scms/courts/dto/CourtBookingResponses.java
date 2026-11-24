package com.swp391.scms.courts.dto;

import java.math.BigDecimal;
import java.time.*;

/** Nhóm các DTO trả về cho nghiệp vụ đặt sân. */
public final class CourtBookingResponses {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private CourtBookingResponses() {}
    /** Thông tin một sân: tên, vị trí, bộ môn và giờ mở/đóng cửa. */
    public record CourtDto(Long id, String name, String location, Long disciplineId, String disciplineName,
                           LocalTime openTime, LocalTime closeTime) {}
    /** Một khung giờ của sân: giờ bắt đầu/kết thúc, trạng thái (trống, đã đặt, có lớp, đã qua) và giá. */
    public record SlotDto(LocalTime startTime, LocalTime endTime, String status, BigDecimal price) {
        /** Constructor rút gọn không có giá. */
        public SlotDto(LocalTime startTime, LocalTime endTime, String status) { this(startTime, endTime, status, null); }
    }
    /** Court bookings the member's plan still covers in the month of the requested date. */
    /**
     * Hạn mức đặt sân của hội viên: tên gói, số lượt miễn phí/chu kỳ, đã dùng, còn lại, số ngày được đặt trước,
     * giới hạn lượt sắp tới, giới hạn lượt chưa trả và thời điểm nhả chỗ.
     *
     * Included bookings plus the per-tier court rules and how much of them the member is using.
     */
    public record QuotaDto(String packageName, int monthlyQuota, int used, int remaining,
                           int advanceDays, int maxUpcoming, int upcoming, int maxUnpaid, int unpaid, int releaseLeadMinutes) {}
    /**
     * Thông tin một lượt đặt sân: sân, bộ môn, hội viên, ngày giờ, trạng thái, mốc tạo/hủy, lý do, có được hủy
     * không, giá và thanh toán.
     */
    public record BookingDto(Long id, Long roomId, String roomName, String disciplineName,
                             Long memberId, String memberName, LocalDate date, LocalTime startTime,
                             LocalTime endTime, String status, LocalDateTime createdAt, LocalDateTime cancelledAt,
                             String cancelReason, boolean canCancel, BigDecimal price, String paymentMethod,
                             String paymentStatus) {}
}
