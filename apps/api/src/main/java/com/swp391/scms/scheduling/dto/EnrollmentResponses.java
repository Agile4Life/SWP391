package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * SCRUM-73: response payloads for enrollments.
 */
public final class EnrollmentResponses {

    private EnrollmentResponses() {
    }

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
            String cancelReason
    ) {
    }

    public record QuotaDto(
            String tier,
            Integer totalCredits,
            int usedCredits,
            int remainingCredits,
            boolean unlimited,
            java.time.LocalDateTime enrollBlockedUntil
    ) {
        public QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited) {
            this(tier, totalCredits, usedCredits, remainingCredits, unlimited, null);
        }
    }

    public record CourseCheckoutDto(
            Long enrollmentId,
            Long paymentId,
            Long classId,
            String className,
            java.math.BigDecimal amount,
            String paymentMethod,
            String paymentStatus,
            String paymentUrl
    ) {
    }
}
