package com.swp391.scms.attendance.dto;

import java.time.LocalDateTime;

public final class CheckinResponses {

    private CheckinResponses() {}

    public record CheckinDto(
            Long id,
            Long memberId,
            String memberCode,
            String memberName,
            String avatarUrl,
            String packageName,
            Long remainingDays,
            LocalDateTime checkInTime,
            LocalDateTime checkOutTime,
            String method,
            String gate,
            String status,
            String denialReason
    ) {
        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status) {
            this(id, memberId, null, memberName, null, null, null, checkInTime, checkOutTime, method, gate, status, null);
        }

        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status, String denialReason) {
            this(id, memberId, null, memberName, null, null, null, checkInTime, checkOutTime, method, gate, status, denialReason);
        }
    }
}
