package com.swp391.scms.support.dto;

import jakarta.validation.constraints.Pattern;

/** Dữ liệu cập nhật phiếu: trạng thái mới và/hoặc người phụ trách mới. */
public record UpdateSupportRequestStatusDto(
    @Pattern(regexp = "^(open|in_progress|resolved|closed)$", message = "{validation.support.status.invalid}")
    String status,

    Long assignedTo
) {}

