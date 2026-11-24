package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

/**
 * Yêu cầu hoàn tiền: lý do và số tiền (trống là hoàn toàn bộ phần còn lại).
 *
 * DTO hoàn tiền một giao dịch thanh toán.
 */
@Schema(description = "Yêu cầu hoàn tiền và hủy giao dịch")
public class PaymentRefundRequest {

    @NotBlank(message = "{validation.payment.refund_reason.not_blank}")
    @Schema(description = "Lý do hoàn tiền", example = "Hội viên yêu cầu hủy gói do chuyển nơi ở")
    private String reason;

    @DecimalMin(value = "0.0", inclusive = false, message = "{validation.payment.amount.min}")
    @Schema(description = "Số tiền hoàn lại (mặc định hoàn toàn bộ)", example = "1500000.00")
    private BigDecimal refundAmount;

    /** Constructor rỗng cho Jackson. */
    public PaymentRefundRequest() {}

    /** Hoàn toàn bộ với lý do. */
    public PaymentRefundRequest(String reason) {
        this(reason, null);
    }

    /** Hoàn một số tiền cụ thể với lý do. */
    public PaymentRefundRequest(String reason, BigDecimal refundAmount) {
        this.reason = reason;
        this.refundAmount = refundAmount;
    }

    /** Lấy giá trị trường reason. */
    public String getReason() { return reason; }
    /** Gán giá trị mới cho trường reason. */
    public void setReason(String reason) { this.reason = reason; }

    /** Lấy giá trị trường refundAmount. */
    public BigDecimal getRefundAmount() { return refundAmount; }
    /** Gán giá trị mới cho trường refundAmount. */
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
}
