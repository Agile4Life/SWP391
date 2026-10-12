package com.swp391.scms.support.dto;

import java.time.LocalDateTime;

public record SupportRequestDto(
    Long id,
    Long memberId,
    String memberName,
    Long assignedTo,
    String assignedToName,
    String subject,
    String description,
    String status,
    LocalDateTime createdAt,
    LocalDateTime resolvedAt
) {}

