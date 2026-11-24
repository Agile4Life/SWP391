package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Nhóm các DTO trả về cho nghiệp vụ ghi danh khóa học.
 *
 * SCRUM-73: response payloads for enrollments.
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
            /** Sessions of the course that are not cancelled; null when unknown. */
            Integer totalSessions,
            /** Sessions the member came to (present or late). */
            Integer attendedSessions,
            /** Sessions not yet used up: total minus attended, missed and excused; a missed session is not made up. */
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
            /** Tier discount on the fee of a course beyond the free credits (0, 10 or 20). */
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
            /** When the seat held for an unpaid fee is released; null for free enrollments. */
            java.time.LocalDateTime expiresAt
    ) {
    }
}
