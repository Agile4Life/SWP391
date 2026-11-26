package com.swp391.scms.support.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record MarkSupportReadDto(
        @NotNull(message = "{validation.support.read.cursor.required}")
        @Min(value = 0, message = "{validation.support.read.cursor.invalid}") Long lastMessageId) {}
