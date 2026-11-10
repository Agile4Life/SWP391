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
            String cancelReason,
            /** Sessions of the course that are not cancelled; null when unknown. */
            Integer totalSessions,
            /** Sessions the member came to (present or late). */
            Integer attendedSessions,
            /** Sessions not yet used up: total minus attended, missed and excused; a missed session is not made up. */
            Integer remainingSessions
    ) {
        public EnrollmentDto(Long id, Long classId, String className, Long memberId, Long sessionId,
                             LocalDate sessionDate, LocalTime startTime, LocalTime endTime, String status,
                             LocalDateTime enrolledAt, LocalDateTime cancelledAt, String cancelReason) {
            this(id, classId, className, memberId, sessionId, sessionDate, startTime, endTime, status, enrolledAt,
                    cancelledAt, cancelReason, null, null, null);
        }
    }

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
        public QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited) {
            this(tier, totalCredits, usedCredits, remainingCredits, unlimited, null, 0);
        }

        public QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited,
                        java.time.LocalDateTime enrollBlockedUntil) {
            this(tier, totalCredits, usedCredits, remainingCredits, unlimited, enrollBlockedUntil, 0);
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
            String paymentUrl,
            /** When the seat held for an unpaid fee is released; null for free enrollments. */
            java.time.LocalDateTime expiresAt
    ) {
    }
}
