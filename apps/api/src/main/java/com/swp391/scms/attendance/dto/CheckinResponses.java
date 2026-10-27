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
            String status,
            String denialReason,
            String avatarUrl,
            String packageName,
            Long remainingDays
    ) {
        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status, String denialReason) {
            this(id, memberId, memberName, checkInTime, checkOutTime, method, gate, status, denialReason, null, null, null);
        }
        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status) {
            this(id, memberId, memberName, checkInTime, checkOutTime, method, gate, status, null);
        }
    }
}
