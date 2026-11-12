package com.swp391.scms.courts.dto;

import jakarta.validation.constraints.*;
import java.time.*;

public final class CourtBookingRequests {
    private CourtBookingRequests() {}
    public record BookRequest(
            @NotNull(message = "{validation.courts.room.not_null}") Long roomId,
            @NotNull(message = "{validation.courts.date.not_null}") LocalDate date,
            @NotNull(message = "{validation.courts.time.not_null}") LocalTime startTime,
            @Pattern(regexp = "(?i)cash|vnpay", message = "{validation.courts.payment_method.pattern}") String paymentMethod) {
        public BookRequest(Long roomId, LocalDate date, LocalTime startTime) { this(roomId, date, startTime, null); }
    }
    public record CancelRequest(@Size(max = 255, message = "{validation.courts.reason.size}") String reason) {}
}
