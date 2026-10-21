package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class SubscriptionRequests {

    private SubscriptionRequests() {}

    public record Create(
            @NotNull(message = "{validation.membership.package_id.not_null}")
            Long packageId
    ) {}

    public record Upgrade(
            @NotNull(message = "{validation.membership.package_id.not_null}")
            Long packageId
    ) {}

    public record HoldRequest(
            @NotBlank(message = "{validation.membership.hold_reason.not_blank}")
            @Size(max = 500, message = "{validation.membership.hold_reason.size}")
            String reason
    ) {}
}
