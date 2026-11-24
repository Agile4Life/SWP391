package com.swp391.scms.coaching.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

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
        /** When the coach or the desk recorded the member as present; null when not recorded. */
        LocalDateTime attendedAt,
        /** True when staff removed the mark on purpose. */
        boolean attendanceLocked,
        /** Gate check-in that covered the session (attendance list only), shown as a hint; null otherwise. */
        LocalDateTime gateCheckinAt,
        String membershipCode,
        String memberPhone,
        String memberEmail
) {
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
