package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Dữ liệu yêu cầu hủy buổi học: lý do hủy.
 *
 * SCRUM-113: Payload yêu cầu hủy buổi học, bắt buộc có lý do.
 */
public record CancelSessionRequest(
        @NotBlank(message = "{validation.scheduling.cancel_reason.not_blank}")
        @Size(max = 255, message = "{validation.scheduling.cancel_reason.size}")
        String reason
) {
}
