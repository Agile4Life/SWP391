package com.swp391.scms.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleHandoffRequest(
        @NotBlank(message = "{auth.google.handoff_invalid}")
        @Size(min = 43, max = 43, message = "{auth.google.handoff_invalid}") String code,
        @NotBlank(message = "{auth.google.handoff_invalid}")
        @Size(min = 43, max = 43, message = "{auth.google.handoff_invalid}") String verifier) { }
