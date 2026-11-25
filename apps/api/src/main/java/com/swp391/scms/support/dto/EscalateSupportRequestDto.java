package com.swp391.scms.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Lý do chuyển phiếu lên quản lý. */
public record EscalateSupportRequestDto(
    @NotBlank(message = "{validation.support.escalation.reason.not_blank}")
    @Size(max = 500, message = "{validation.support.escalation.reason.size}")
    String reason
) {}
