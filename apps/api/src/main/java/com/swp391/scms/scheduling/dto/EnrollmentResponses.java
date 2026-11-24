package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Nhóm các DTO trả về cho nghiệp vụ ghi danh khóa học.
 *
 * SCRUM-73: các payload phản hồi cho ghi danh.
 */
public final class EnrollmentResponses {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private EnrollmentResponses() {
    }

    /**
     * Thông tin một lượt ghi danh: lớp, hội viên, buổi, ngày giờ, trạng thái, thời điểm ghi danh/hủy và tiến độ
     * (tổng buổi, đã dự, còn lại).
     */
    public record EnrollmentDto(
            Long id,
            Long classId,
            String className,
            Long memberId,
            Long sessionId,
            LocalDate sessionDate,
            LocalTime startTime,
            LocalTime endTime,
            String status,
            LocalDateTime enrolledAt,
            LocalDateTime cancelledAt,
            String cancelReason,
            /** Các buổi của khóa chưa bị hủy; null khi chưa biết. */
            Integer totalSessions,
            /** Các buổi hội viên đã đến (có mặt hoặc đi trễ). */
            Integer attendedSessions,
            /** Các buổi chưa dùng hết: tổng trừ đã dự, vắng và được miễn; buổi vắng không được học bù. */
            Integer remainingSessions
    ) {
        /** Constructor rút gọn không có thông tin tiến độ (để null). */
        public EnrollmentDto(Long id, Long classId, String className, Long memberId, Long sessionId,
                             LocalDate sessionDate, LocalTime startTime, LocalTime endTime, String status,
                             LocalDateTime enrolledAt, LocalDateTime cancelledAt, String cancelReason) {
            this(id, classId, className, memberId, sessionId, sessionDate, startTime, endTime, status, enrolledAt,
                    cancelledAt, cancelReason, null, null, null);
        }
    }

    /**
     * Hạn mức khóa học của hội viên: hạng, tổng credit, đã dùng, còn lại, không giới hạn, bị chặn ghi danh tới
     * khi nào và % giảm giá theo hạng.
     */
    public record QuotaDto(
            String tier,
            Integer totalCredits,
            int usedCredits,
            int remainingCredits,
            boolean unlimited,
            java.time.LocalDateTime enrollBlockedUntil,
            /** Chiết khấu theo hạng trên phí khóa học vượt quá số lượt miễn phí (0, 10 hoặc 20). */
            int discountPercent
    ) {
        /** Constructor rút gọn: không bị chặn ghi danh, giảm giá 0%. */
        public QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited) {
            this(tier, totalCredits, usedCredits, remainingCredits, unlimited, null, 0);
        }

        /** Constructor rút gọn: có thời điểm chặn ghi danh, giảm giá 0%. */
        public QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited,
                        java.time.LocalDateTime enrollBlockedUntil) {
            this(tier, totalCredits, usedCredits, remainingCredits, unlimited, enrollBlockedUntil, 0);
        }
    }

    /**
     * Kết quả thanh toán khóa học: lượt ghi danh, giao dịch, lớp, số tiền, phương thức, trạng thái, link thanh
     * toán và hạn giữ chỗ.
     */
    public record CourseCheckoutDto(
            Long enrollmentId,
            Long paymentId,
            Long classId,
            String className,
            java.math.BigDecimal amount,
            String paymentMethod,
            String paymentStatus,
            String paymentUrl,
            /** Thời điểm chỗ giữ cho khoản phí chưa trả được nhả; null với ghi danh miễn phí. */
            java.time.LocalDateTime expiresAt
    ) {
    }
}
