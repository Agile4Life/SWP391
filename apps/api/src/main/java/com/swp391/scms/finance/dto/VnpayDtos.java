package com.swp391.scms.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Nhóm DTO cho thanh toán VNPay. */
public final class VnpayDtos {
    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private VnpayDtos() {}
    /** Yêu cầu thanh toán: đúng một đối tượng (kỳ gói, buổi PT, sân, khoản thu hoặc đơn hàng). */
    public record CheckoutRequest(Long subscriptionId, Long coachBookingId, Long courtBookingId, Long paymentId, Long productOrderId) {
        /** Constructor không có đơn hàng. */
        public CheckoutRequest(Long subscriptionId, Long coachBookingId, Long courtBookingId, Long paymentId) {
            this(subscriptionId, coachBookingId, courtBookingId, paymentId, null);
        }
    }
    /** Cấu hình VNPay cho frontend: có bật không. */
    public record Configuration(boolean enabled) {}
    /** Kết quả tạo thanh toán: mã tham chiếu, link sang cổng VNPay, số tiền và thời điểm hết hạn. */
    public record Checkout(String reference, String paymentUrl, BigDecimal amount, LocalDateTime expiresAt) {}
    /**
     * Trạng thái một lượt VNPay: mã tham chiếu, khoản thu, kỳ gói, số tiền, trạng thái, thời điểm hết hạn và
     * trang cần quay về.
     */
    public record Status(String reference, Long paymentId, Long subscriptionId, BigDecimal amount, String status, LocalDateTime expiresAt, String destination) {}
}
