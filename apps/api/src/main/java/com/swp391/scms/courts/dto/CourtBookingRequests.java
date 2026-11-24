package com.swp391.scms.courts.dto;

import jakarta.validation.constraints.*;
import java.time.*;

/** Nhóm các DTO yêu cầu cho nghiệp vụ đặt sân. */
public final class CourtBookingRequests {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private CourtBookingRequests() {}
    /**
     * Yêu cầu đặt sân: sân, ngày, giờ bắt đầu (khung 1 giờ) và phương thức thanh toán cash/vnpay (tùy chọn khi
     * còn hạn mức).
     */
    public record BookRequest(
        /** Constructor rút gọn không có phương thức thanh toán. */
            @NotNull(message = "{validation.courts.room.not_null}") Long roomId,
            @NotNull(message = "{validation.courts.date.not_null}") LocalDate date,
            @NotNull(message = "{validation.courts.time.not_null}") LocalTime startTime,
            @Pattern(regexp = "(?i)cash|vnpay", message = "{validation.courts.payment_method.pattern}") String paymentMethod) {
        public BookRequest(Long roomId, LocalDate date, LocalTime startTime) { this(roomId, date, startTime, null); }
    }
    /** Yêu cầu hủy đặt sân: lý do tối đa 255 ký tự. */
    public record CancelRequest(@Size(max = 255, message = "{validation.courts.reason.size}") String reason) {}
}
