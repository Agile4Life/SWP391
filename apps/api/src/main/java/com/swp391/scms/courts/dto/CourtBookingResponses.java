package com.swp391.scms.courts.dto;

import java.math.BigDecimal;
import java.time.*;

public final class CourtBookingResponses {
    private CourtBookingResponses() {}
    public record CourtDto(Long id, String name, String location, Long disciplineId, String disciplineName,
                           LocalTime openTime, LocalTime closeTime) {}
    public record SlotDto(LocalTime startTime, LocalTime endTime, String status, BigDecimal price) {
        public SlotDto(LocalTime startTime, LocalTime endTime, String status) { this(startTime, endTime, status, null); }
    }
    /** Court bookings the member's plan still covers in the month of the requested date. */
    /** Included bookings plus the per-tier court rules and how much of them the member is using. */
    public record QuotaDto(String packageName, int monthlyQuota, int used, int remaining,
                           int advanceDays, int maxUpcoming, int upcoming, int maxUnpaid, int unpaid, int releaseLeadMinutes) {}
    public record BookingDto(Long id, Long roomId, String roomName, String disciplineName,
                             Long memberId, String memberName, LocalDate date, LocalTime startTime,
                             LocalTime endTime, String status, LocalDateTime createdAt, LocalDateTime cancelledAt,
                             String cancelReason, boolean canCancel, BigDecimal price, String paymentMethod,
                             String paymentStatus) {}
}
