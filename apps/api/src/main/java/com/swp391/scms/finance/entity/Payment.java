package com.swp391.scms.finance.entity;

import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity mapping table payments on Supabase PostgreSQL (Module F: Thanh toán & Báo cáo).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_payments_method", constraints = "method IN ('cash','pos','bank_transfer','online_wallet')")
@org.hibernate.annotations.Check(name = "ck_payments_status", constraints = "status IN ('success','pending','failed','refunded')")
@Table(name = "payments", indexes = {
        @Index(name = "ix_payments_member_status", columnList = "member_id, status"),
        @Index(name = "ix_payments_paid_at", columnList = "paid_at")
})
/**
 * Bảng payments: một khoản thanh toán của hội viên cho đúng một đối tượng (kỳ gói, khóa học, buổi PT, sân, đơn
 * hàng) hoặc nạp ví; gồm số tiền, đã hoàn, phương thức, trạng thái, thời điểm trả, người nhận, ghi chú, ảnh
 * biên lai và hóa đơn.
 */
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "subscription_id")
    private Long subscriptionId;

    /** Read-only mapping so the schema generator emits fk_payments_subscription; writes go through subscriptionId. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_id", insertable = false, updatable = false)
    private MembershipSubscription subscription;

    @Column(name = "coach_booking_id")
    private Long coachBookingId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_booking_id", insertable = false, updatable = false)
    private com.swp391.scms.coaching.entity.CoachBooking coachBooking;
    @Column(name = "court_booking_id")
    private Long courtBookingId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "court_booking_id", insertable = false, updatable = false)
    private com.swp391.scms.courts.entity.CourtBooking courtBooking;
    @Column(name = "product_order_id")
    private Long productOrderId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_order_id", insertable = false, updatable = false)
    private com.swp391.scms.shop.entity.ProductOrder productOrder;

    /** Lấy giá trị trường coachBookingId. */
    public Long getCoachBookingId() { return coachBookingId; }
    /** Gán buổi PT được thanh toán. */
    public void setCoachBookingId(Long id) { coachBookingId = id; }
    /** Lấy giá trị trường courtBookingId. */
    public Long getCourtBookingId() { return courtBookingId; }
    /** Gán lượt đặt sân được thanh toán. */
    public void setCourtBookingId(Long id) { courtBookingId = id; }
    /** Lấy giá trị trường productOrderId. */
    public Long getProductOrderId() { return productOrderId; }
    /** Gán đơn hàng được thanh toán. */
    public void setProductOrderId(Long id) { productOrderId = id; }
    /** Lấy giá trị trường productOrder. */
    public com.swp391.scms.shop.entity.ProductOrder getProductOrder() { return productOrder; }
    /**
     * Lấy giá trị trường subscription.
     *
     * Read-only views of the linked records (the *_id fields are the writable side).
     */
    public MembershipSubscription getSubscription() { return subscription; }
    /** Lấy giá trị trường coachBooking. */
    public com.swp391.scms.coaching.entity.CoachBooking getCoachBooking() { return coachBooking; }
    /** Lấy giá trị trường courtBooking. */
    public com.swp391.scms.courts.entity.CourtBooking getCourtBooking() { return courtBooking; }
    /** Lấy giá trị trường classEnrollment. */
    public ClassEnrollment getClassEnrollment() { return classEnrollment; }
    /** Gán giá trị mới cho trường productOrder. */
    public void setProductOrder(com.swp391.scms.shop.entity.ProductOrder productOrder) { this.productOrder = productOrder; }

    @Column(name = "class_enrollment_id")
    private Long classEnrollmentId;

    /** Read-only mapping so the schema generator emits fk_payments_enrollment; writes go through classEnrollmentId. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_enrollment_id", insertable = false, updatable = false)
    private ClassEnrollment classEnrollment;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Money already returned to the member; a partial refund keeps the payment successful. */
    @Column(name = "refunded_amount", precision = 12, scale = 2)
    private BigDecimal refundedAmount;

    @Column(nullable = false, length = 20)
    private String method; // cash, pos, bank_transfer, online_wallet

    @Column(nullable = false, length = 20)
    private String status = "pending"; // success, pending, failed, refunded

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by")
    private User receivedBy;

    @Column(length = 255)
    private String note;

    /** Receipt photo (data URL) a member attaches to a cash payment for the receptionist to verify. */
    @Column(name = "receipt_image", columnDefinition = "text")
    private String receiptImage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToOne(mappedBy = "payment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Invoice invoice;

    /** Constructor rỗng cho JPA. */
    public Payment() {}

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường member. */
    public Member getMember() {
        return member;
    }

    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) {
        this.member = member;
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

    /** Lấy giá trị trường receivedBy. */
    public User getReceivedBy() {
        return receivedBy;
    }

    /** Gán giá trị mới cho trường receivedBy. */
    public void setReceivedBy(User receivedBy) {
        this.receivedBy = receivedBy;
    }

    /** Lấy giá trị trường note. */
    public String getNote() {
        return note;
    }

    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) {
        this.note = note;
    }

    /** Lấy giá trị trường receiptImage. */
    public String getReceiptImage() {
        return receiptImage;
    }

    /** Gán giá trị mới cho trường receiptImage. */
    public void setReceiptImage(String receiptImage) {
        this.receiptImage = receiptImage;
    }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /** Lấy giá trị trường invoice. */
    public Invoice getInvoice() {
        return invoice;
    }

    /** Gán giá trị mới cho trường invoice. */
    public void setInvoice(Invoice invoice) {
        this.invoice = invoice;
    }

    /** Lấy giá trị trường refundedAmount. */
    public BigDecimal getRefundedAmount() {
        return refundedAmount;
    }

    /** Gán giá trị mới cho trường refundedAmount. */
    public void setRefundedAmount(BigDecimal refundedAmount) {
        this.refundedAmount = refundedAmount;
    }

    /**
     * Số tiền trung tâm giữ lại: đã trả trừ đã hoàn.
     *
     * Amount the centre keeps: what was paid minus what was refunded.
     */
    public BigDecimal netAmount() {
        if (amount == null) return BigDecimal.ZERO;
        return refundedAmount == null ? amount : amount.subtract(refundedAmount);
    }
}
