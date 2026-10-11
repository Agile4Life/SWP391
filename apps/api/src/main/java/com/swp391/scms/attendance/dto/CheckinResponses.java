package com.swp391.scms.attendance.dto;

import java.time.LocalDateTime;

public final class CheckinResponses {

    private CheckinResponses() {}

    public record CheckinDto(
            Long id,
            Long memberId,
            String memberName,
            LocalDateTime checkInTime,
            LocalDateTime checkOutTime,
            String method,
            String gate,
            String status
    ) {}
}
