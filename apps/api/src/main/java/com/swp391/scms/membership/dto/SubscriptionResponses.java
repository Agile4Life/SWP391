package com.swp391.scms.membership.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class SubscriptionResponses {

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

    public record PendingSubscriptionDto(
            Long id,
            Long memberId,
            String membershipCode,
            String memberName,
            String memberEmail,
            String memberPhone,
            Long packageId,
            String packageName,
            Integer durationDays,
            java.math.BigDecimal packagePrice,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDateTime createdAt
    ) {}
}
