package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class CancellationDtos {
    private CancellationDtos() {}

    public record Request(
            @NotBlank(message = "{validation.membership.cancellation_reason.not_blank}")
            @Size(max = 500, message = "{validation.membership.cancellation_reason.size}") String reason) {}

    public record Decision(
            @Size(max = 500, message = "{validation.membership.cancellation_note.size}") String note) {}

    public record Response(Long id, Long memberId, String memberName, Long subscriptionId,
            String packageName, String reason, String status, LocalDateTime requestedAt,
            Long resolvedById, LocalDateTime resolvedAt, String resolutionNote) {}
}
