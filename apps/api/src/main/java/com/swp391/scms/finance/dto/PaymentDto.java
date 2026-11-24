package com.swp391.scms.finance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Khoản thanh toán trả cho client: hội viên, đối tượng thanh toán (gói, khóa học, PT, sân, đơn hàng), số tiền,
 * đã hoàn, phương thức, trạng thái, người nhận, ghi chú, số hóa đơn, biên lai, loại và tên dịch vụ, và cờ đang
 * chờ VNPay.
 *
 * DTO phản hồi thanh toán.
 */
@Schema(description = "Thông tin giao dịch thanh toán")
public class PaymentDto {

    private Long id;
    private Long memberId;
    private String memberName;
    private Long subscriptionId;
    private Long classEnrollmentId;
    private BigDecimal amount;
    private String method; // Giá trị: cash, pos, bank_transfer, online_wallet
    private String status; // Giá trị: success, pending, failed, refunded
    private LocalDateTime paidAt;
    private Long receivedById;
    private String receivedByName;
    private String note;
    private LocalDateTime createdAt;
    private String invoiceNumber;
    private boolean hasReceipt;
    private String receiptImage; // chỉ trả ở API chi tiết dành cho nhân viên

    /** Constructor rỗng cho Jackson. */
    public PaymentDto() {}

    /** Cho biết has receipt (trường boolean). */
    public boolean isHasReceipt() {
        return hasReceipt;
    }

    /** Gán giá trị mới cho trường hasReceipt. */
    public void setHasReceipt(boolean hasReceipt) {
        this.hasReceipt = hasReceipt;
    }

    /** Lấy giá trị trường receiptImage. */
    public String getReceiptImage() {
        return receiptImage;
    }

    /** Gán giá trị mới cho trường receiptImage. */
    public void setReceiptImage(String receiptImage) {
        this.receiptImage = receiptImage;
    }

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường memberId. */
    public Long getMemberId() {
        return memberId;
    }

    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) {
        this.memberId = memberId;
    }

    /** Lấy giá trị trường memberName. */
    public String getMemberName() {
        return memberName;
    }

    /** Gán giá trị mới cho trường memberName. */
    public void setMemberName(String memberName) {
        this.memberName = memberName;
    }

    /** Lấy giá trị trường subscriptionId. */
    public Long getSubscriptionId() {
        return subscriptionId;
    }

    /** Gán giá trị mới cho trường subscriptionId. */
    public void setSubscriptionId(Long subscriptionId) {
        this.subscriptionId = subscriptionId;
    }

    /** Lấy giá trị trường classEnrollmentId. */
    public Long getClassEnrollmentId() {
        return classEnrollmentId;
    }

    /** Gán giá trị mới cho trường classEnrollmentId. */
    public void setClassEnrollmentId(Long classEnrollmentId) {
        this.classEnrollmentId = classEnrollmentId;
    }

    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() {
        return amount;
    }

    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /** Lấy giá trị trường method. */
    public String getMethod() {
        return method;
    }

    /** Gán giá trị mới cho trường method. */
    public void setMethod(String method) {
        this.method = method;
    }

    /** Lấy giá trị trường status. */
    public String getStatus() {
        return status;
    }

    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) {
        this.status = status;
    }

    /** Lấy giá trị trường paidAt. */
    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    /** Gán giá trị mới cho trường paidAt. */
    public void setPaidAt(LocalDateTime paidAt) {
        this.paidAt = paidAt;
    }

    /** Lấy giá trị trường receivedById. */
    public Long getReceivedById() {
        return receivedById;
    }

    /** Gán giá trị mới cho trường receivedById. */
    public void setReceivedById(Long receivedById) {
        this.receivedById = receivedById;
    }

    /** Lấy giá trị trường receivedByName. */
    public String getReceivedByName() {
        return receivedByName;
    }

    /** Gán giá trị mới cho trường receivedByName. */
    public void setReceivedByName(String receivedByName) {
        this.receivedByName = receivedByName;
    }

    /** Lấy giá trị trường note. */
    public String getNote() {
        return note;
    }

    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) {
        this.note = note;
    }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /** Lấy giá trị trường invoiceNumber. */
    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    /** Gán giá trị mới cho trường invoiceNumber. */
    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    private BigDecimal refundedAmount;

    /** Lấy giá trị trường refundedAmount. */
    public BigDecimal getRefundedAmount() {
        return refundedAmount;
    }

    /** Gán giá trị mới cho trường refundedAmount. */
    public void setRefundedAmount(BigDecimal refundedAmount) {
        this.refundedAmount = refundedAmount;
    }

    /** Thanh toán dành cho việc gì: MEMBERSHIP, CLASS, PT, COURT, SHOP hoặc OTHER. */
    @Schema(description = "Loại dịch vụ: MEMBERSHIP, CLASS, PT, COURT, SHOP, OTHER")
    private String serviceType;
    /** Mục đã trả dưới dạng dữ liệu lưu (gói, lớp, HLV và khung, sân và khung, mã đơn); không dịch. */
    @Schema(description = "Tên dịch vụ cụ thể (gói tập, khóa học, HLV + giờ, sân + giờ, mã đơn)")
    private String serviceName;
    private Long coachBookingId;
    private Long courtBookingId;
    private Long productOrderId;
    private boolean vnpayPending;

    /** Lấy giá trị trường serviceType. */
    public String getServiceType() { return serviceType; }
    /** Gán giá trị mới cho trường serviceType. */
    public void setServiceType(String serviceType) { this.serviceType = serviceType; }
    /** Lấy giá trị trường serviceName. */
    public String getServiceName() { return serviceName; }
    /** Gán giá trị mới cho trường serviceName. */
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    /** Lấy giá trị trường coachBookingId. */
    public Long getCoachBookingId() { return coachBookingId; }
    /** Gán giá trị mới cho trường coachBookingId. */
    public void setCoachBookingId(Long coachBookingId) { this.coachBookingId = coachBookingId; }
    /** Lấy giá trị trường courtBookingId. */
    public Long getCourtBookingId() { return courtBookingId; }
    /** Gán giá trị mới cho trường courtBookingId. */
    public void setCourtBookingId(Long courtBookingId) { this.courtBookingId = courtBookingId; }
    /** Lấy giá trị trường productOrderId. */
    public Long getProductOrderId() { return productOrderId; }
    /** Gán giá trị mới cho trường productOrderId. */
    public void setProductOrderId(Long productOrderId) { this.productOrderId = productOrderId; }
    /** Cho biết vnpay pending (trường boolean). */
    public boolean isVnpayPending() { return vnpayPending; }
    /** Gán giá trị mới cho trường vnpayPending. */
    public void setVnpayPending(boolean vnpayPending) { this.vnpayPending = vnpayPending; }
}
