package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SCRUM-113: Request payload to cancel a class session with a mandatory reason.
 */
public record CancelSessionRequest(
        @NotBlank(message = "{validation.scheduling.cancel_reason.not_blank}")
        @Size(max = 255, message = "{validation.scheduling.cancel_reason.size}")
        String reason
) {
}
