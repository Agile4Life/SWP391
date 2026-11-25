package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Yêu cầu đổi trạng thái khoản thanh toán. */
@Schema(description = "Yêu cầu cập nhật trạng thái thanh toán")
public record PaymentStatusUpdateRequest(
        @NotBlank(message = "{validation.payment.status.not_blank}")
        @Pattern(regexp = "(?i)^(success|pending|failed|refunded)$",
                message = "{validation.payment.status.update_pattern}")
        @Schema(description = "Trạng thái mới của giao dịch (success, pending, failed, refunded)", example = "success")
        String status
) {}
