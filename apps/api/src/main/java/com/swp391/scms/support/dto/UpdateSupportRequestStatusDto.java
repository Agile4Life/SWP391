package com.swp391.scms.support.dto;

import jakarta.validation.constraints.Pattern;

public record UpdateSupportRequestStatusDto(
    @Pattern(regexp = "^(open|in_progress|resolved|closed)$", message = "{validation.support.status.invalid}")
    String status,

    Long assignedTo
) {}

