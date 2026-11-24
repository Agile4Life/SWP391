package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Dữ liệu thu tiền một bước tại quầy: hội viên, kỳ gói hoặc gói (để tạo kỳ mới), khóa học, số tiền, phương
 * thức, người nhận và ghi chú.
 *
 * Data Transfer Object for processing a checkout payment and activating subscriptions/enrollments.
 */
@Schema(description = "Yêu cầu xử lý thanh toán mua gói tập hoặc ghi danh lớp học")
public class PaymentProcessDto {

    @NotNull(message = "{validation.payment.member_id.not_null}")
    @Schema(description = "ID hội viên thực hiện thanh toán", example = "2")
    private Long memberId;

    @Schema(description = "ID gói hội viên đăng ký (nếu thanh toán cho gói tập đã tạo)", example = "1")
    private Long subscriptionId;

    @Schema(description = "ID gói tập mua trực tiếp tại quầy (nếu chưa tạo subscription trước)", example = "1")
    private Long packageId;

    @Schema(description = "ID lượt đăng ký lớp học (nếu thanh toán cho lớp)", example = "5")
    private Long classEnrollmentId;

    @NotNull(message = "{validation.payment.amount.not_null}")
    @DecimalMin(value = "0.0", inclusive = false, message = "{validation.payment.amount.min}")
    @Schema(description = "Số tiền thanh toán (VNĐ)", example = "1500000.00")
    private BigDecimal amount;

    @NotBlank(message = "{validation.payment.method.not_blank}")
    @Pattern(regexp = "(?i)^cash$", message = "{validation.payment.method.pattern}")
    @Schema(description = "Phương thức thanh toán", example = "cash")
    private String method;

    @Schema(description = "ID nhân viên thu ngân/lễ tân tiếp nhận", example = "1")
    private Long receivedById;

    @Schema(description = "Ghi chú giao dịch", example = "Thanh toán kích hoạt gói tập tại quầy")
    private String note;

    /** Constructor rỗng cho Jackson. */
    public PaymentProcessDto() {}

    /** Tạo yêu cầu thu tiền với đầy đủ trường. */
    public PaymentProcessDto(Long memberId, Long subscriptionId, Long classEnrollmentId,
                             BigDecimal amount, String method, Long receivedById, String note) {
        this.memberId = memberId;
        this.subscriptionId = subscriptionId;
        this.classEnrollmentId = classEnrollmentId;
        this.amount = amount;
        this.method = method;
        this.receivedById = receivedById;
        this.note = note;
    }

    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }

    /** Lấy giá trị trường subscriptionId. */
    public Long getSubscriptionId() { return subscriptionId; }
    /** Gán giá trị mới cho trường subscriptionId. */
    public void setSubscriptionId(Long subscriptionId) { this.subscriptionId = subscriptionId; }

    /** Lấy giá trị trường packageId. */
    public Long getPackageId() { return packageId; }
    /** Gán giá trị mới cho trường packageId. */
    public void setPackageId(Long packageId) { this.packageId = packageId; }

    /** Lấy giá trị trường classEnrollmentId. */
    public Long getClassEnrollmentId() { return classEnrollmentId; }
    /** Gán giá trị mới cho trường classEnrollmentId. */
    public void setClassEnrollmentId(Long classEnrollmentId) { this.classEnrollmentId = classEnrollmentId; }

    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() { return amount; }
    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    /** Lấy giá trị trường method. */
    public String getMethod() { return method; }
    /** Gán giá trị mới cho trường method. */
    public void setMethod(String method) { this.method = method; }

    /** Lấy giá trị trường receivedById. */
    public Long getReceivedById() { return receivedById; }
    /** Gán giá trị mới cho trường receivedById. */
    public void setReceivedById(Long receivedById) { this.receivedById = receivedById; }

    /** Lấy giá trị trường note. */
    public String getNote() { return note; }
    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) { this.note = note; }
}
