package com.swp391.scms.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSupportRequestDto(
    @NotBlank(message = "{validation.support.subject.not_blank}")
    @Size(max = 150, message = "{validation.support.subject.size}")
    String subject,

    String description
) {}

