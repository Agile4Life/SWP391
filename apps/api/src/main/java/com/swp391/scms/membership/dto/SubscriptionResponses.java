package com.swp391.scms.membership.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class SubscriptionResponses {
<<<<<<< Updated upstream
    private SubscriptionResponses() {}
    public record SubscriptionDto(Long id, Long memberId, Long packageId, String packageName,
                                  Long previousSubscriptionId, LocalDate startDate, LocalDate endDate,
                                  String status, String qrCode, LocalDateTime createdAt) {}
=======

    private SubscriptionResponses() {}

    public record SubscriptionDto(
            Long id,
            Long memberId,
            Long packageId,
            String packageName,
            Long previousSubscriptionId,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            String qrCode,
            LocalDateTime createdAt
    ) {}
>>>>>>> Stashed changes
}
