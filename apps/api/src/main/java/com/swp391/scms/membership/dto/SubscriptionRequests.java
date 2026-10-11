package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotNull;

public final class SubscriptionRequests {

    private SubscriptionRequests() {}

    public record Create(
            @NotNull(message = "{validation.membership.package_id.not_null}")
            Long packageId
    ) {}
}
