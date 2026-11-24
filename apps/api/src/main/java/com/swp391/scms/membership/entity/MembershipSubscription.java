package com.swp391.scms.membership.entity;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Bảng membership_subscriptions: một kỳ gói tập của hội viên (gói, kỳ trước trong chuỗi gia hạn/nâng cấp, thời
 * hạn, trạng thái pending_payment/active/frozen/expired/cancelled, mã QR, phí nâng cấp, phần quy đổi, giá chốt,
 * ngày kết thúc gốc của kỳ bị thay thế, và toàn bộ thông tin bảo lưu).
 *
 * Entity mapping table membership_subscriptions (schema is generated code-first by Hibernate).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_subscriptions_status", constraints = "status IN ('pending_payment','active','frozen','expired','cancelled')")
@Table(name = "membership_subscriptions", indexes = {@Index(name = "ix_subscriptions_member_status", columnList = "member_id, status"), @Index(name = "ix_subscriptions_end_date", columnList = "end_date")})
public class MembershipSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_id", nullable = false)
    private MembershipPackage membershipPackage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_subscription_id")
    private MembershipSubscription previousSubscription;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "pending_payment";

    @Column(name = "qr_code", length = 255, unique = true)
    private String qrCode;

    /** Quoted amount for an upgrade: new package price minus {@link #creditApplied}; null for ordinary purchases and renewals. */
    @Column(name = "upgrade_charge", precision = 14, scale = 2)
    private BigDecimal upgradeCharge;

    /**
     * For an upgrade: unused value of the replaced period carried into this one, fixed when the upgrade is quoted.
     * It comes from what the member actually paid, so later catalog price changes never alter it.
     */
    @Column(name = "credit_applied", precision = 14, scale = 2)
    private BigDecimal creditApplied;

    /**
     * For a new registration or renewal: the catalog price when the request was made. Like an upgrade quote it is
     * what the member pays even if the manager reprices the package before payment; null for older requests.
     */
    @Column(name = "quoted_price", precision = 14, scale = 2)
    private BigDecimal quotedPrice;

    /** For an upgrade: the expiry the replaced period had before the upgrade cut it short. */
    @Column(name = "replaced_end_date")
    private java.time.LocalDate replacedEndDate;

    /** Lấy giá trị trường replacedEndDate. */
    public java.time.LocalDate getReplacedEndDate() { return replacedEndDate; }
    /** Gán giá trị mới cho trường replacedEndDate. */
    public void setReplacedEndDate(java.time.LocalDate replacedEndDate) { this.replacedEndDate = replacedEndDate; }

    @Column(name = "hold_status", length = 20)
    private String holdStatus;

    @Column(name = "hold_reason", length = 500)
    private String holdReason;

    /** Why reception rejected the hold request; shown to the member. Cleared when a new request is filed. */
    @Column(name = "hold_rejection_reason", length = 500)
    private String holdRejectionReason;

    @Column(name = "hold_requested_at")
    private LocalDateTime holdRequestedAt;

    @Column(name = "hold_resolved_at")
    private LocalDateTime holdResolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hold_resolved_by")
    private User holdResolvedBy;

    /** First and last day of the requested hold; both inclusive. Null on holds created before dated holds. */
    @Column(name = "hold_start_date")
    private LocalDate holdStartDate;

    @Column(name = "hold_end_date")
    private LocalDate holdEndDate;

    /** A package may be held once; set when a hold is approved and never cleared. */
    @Column(name = "hold_used")
    private Boolean holdUsed = false;

    /** True when the approved hold's days were already added to endDate; null for holds approved before that change. */
    @Column(name = "hold_days_credited")
    private Boolean holdDaysCredited;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Hibernate gọi trước khi cập nhật bản ghi: tự cập nhật updatedAt. */
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường membershipPackage. */
    public MembershipPackage getMembershipPackage() { return membershipPackage; }
    /** Gán giá trị mới cho trường membershipPackage. */
    public void setMembershipPackage(MembershipPackage membershipPackage) { this.membershipPackage = membershipPackage; }
    /** Lấy giá trị trường previousSubscription. */
    public MembershipSubscription getPreviousSubscription() { return previousSubscription; }
    /** Gán giá trị mới cho trường previousSubscription. */
    public void setPreviousSubscription(MembershipSubscription previousSubscription) { this.previousSubscription = previousSubscription; }
    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường qrCode. */
    public String getQrCode() { return qrCode; }
    /** Gán giá trị mới cho trường qrCode. */
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    /** Lấy giá trị trường upgradeCharge. */
    public BigDecimal getUpgradeCharge() { return upgradeCharge; }
    /** Gán giá trị mới cho trường upgradeCharge. */
    public void setUpgradeCharge(BigDecimal upgradeCharge) { this.upgradeCharge = upgradeCharge; }
    /** Lấy giá trị trường creditApplied. */
    public BigDecimal getCreditApplied() { return creditApplied; }
    /** Gán giá trị mới cho trường creditApplied. */
    public void setCreditApplied(BigDecimal creditApplied) { this.creditApplied = creditApplied; }
    /** Lấy giá trị trường quotedPrice. */
    public BigDecimal getQuotedPrice() { return quotedPrice; }
    /** Gán giá trị mới cho trường quotedPrice. */
    public void setQuotedPrice(BigDecimal quotedPrice) { this.quotedPrice = quotedPrice; }
    /**
     * Số tiền hội viên phải trả ở quầy hoặc qua VNPay: giá đã chốt khi tạo yêu cầu (phí nâng cấp hoặc giá niêm
     * yết lúc đó). Chỉ yêu cầu cũ chưa chốt giá mới dùng giá gói hiện tại.
     *
     * What the member owes at the counter or on VNPay: the price fixed when the request was made (upgrade charge or
     * quoted catalog price). Only requests created before prices were fixed fall back to the current package price.
     */
    public BigDecimal payableAmount() {
        if (upgradeCharge != null) return upgradeCharge;
        if (quotedPrice != null) return quotedPrice;
        return membershipPackage != null ? membershipPackage.getPrice() : null;
    }
    /** Lấy giá trị trường holdStatus. */
    public String getHoldStatus() { return holdStatus; }
    /** Gán giá trị mới cho trường holdStatus. */
    public void setHoldStatus(String holdStatus) { this.holdStatus = holdStatus; }
    /** Lấy giá trị trường holdRejectionReason. */
    public String getHoldRejectionReason() { return holdRejectionReason; }
    /** Gán giá trị mới cho trường holdRejectionReason. */
    public void setHoldRejectionReason(String holdRejectionReason) { this.holdRejectionReason = holdRejectionReason; }
    /** Lấy giá trị trường holdReason. */
    public String getHoldReason() { return holdReason; }
    /** Gán giá trị mới cho trường holdReason. */
    public void setHoldReason(String holdReason) { this.holdReason = holdReason; }
    /** Lấy giá trị trường holdRequestedAt. */
    public LocalDateTime getHoldRequestedAt() { return holdRequestedAt; }
    /** Gán giá trị mới cho trường holdRequestedAt. */
    public void setHoldRequestedAt(LocalDateTime holdRequestedAt) { this.holdRequestedAt = holdRequestedAt; }
    /** Lấy giá trị trường holdResolvedAt. */
    public LocalDateTime getHoldResolvedAt() { return holdResolvedAt; }
    /** Gán giá trị mới cho trường holdResolvedAt. */
    public void setHoldResolvedAt(LocalDateTime holdResolvedAt) { this.holdResolvedAt = holdResolvedAt; }
    /** Lấy giá trị trường holdStartDate. */
    public LocalDate getHoldStartDate() { return holdStartDate; }
    /** Gán giá trị mới cho trường holdStartDate. */
    public void setHoldStartDate(LocalDate holdStartDate) { this.holdStartDate = holdStartDate; }
    /** Lấy giá trị trường holdEndDate. */
    public LocalDate getHoldEndDate() { return holdEndDate; }
    /** Gán giá trị mới cho trường holdEndDate. */
    public void setHoldEndDate(LocalDate holdEndDate) { this.holdEndDate = holdEndDate; }
    /** Ngày bảo lưu đã được cộng vào hạn gói lúc duyệt chưa (null coi là chưa). */
    public boolean isHoldDaysCredited() { return Boolean.TRUE.equals(holdDaysCredited); }
    /** Gán giá trị mới cho trường holdDaysCredited. */
    public void setHoldDaysCredited(Boolean holdDaysCredited) { this.holdDaysCredited = holdDaysCredited; }
    /**
     * Có bảo lưu đã duyệt bao phủ ngày cho trước không (ngày bảo lưu không được đặt lịch).
     *
     * True when an approved hold covers {@code date}: nothing may be booked on a held day.
     */
    public boolean isHeldOn(LocalDate date) {
        return "APPROVED".equalsIgnoreCase(holdStatus) && holdStartDate != null && holdEndDate != null
                && !date.isBefore(holdStartDate) && !date.isAfter(holdEndDate);
    }
    /** Gói đã dùng lượt bảo lưu duy nhất chưa (null coi là chưa). */
    public boolean isHoldUsed() { return Boolean.TRUE.equals(holdUsed); }
    /** Gán giá trị mới cho trường holdUsed. */
    public void setHoldUsed(boolean holdUsed) { this.holdUsed = holdUsed; }
    /** Lấy giá trị trường holdResolvedBy. */
    public User getHoldResolvedBy() { return holdResolvedBy; }
    /** Gán giá trị mới cho trường holdResolvedBy. */
    public void setHoldResolvedBy(User holdResolvedBy) { this.holdResolvedBy = holdResolvedBy; }
    /** Lấy giá trị trường createdBy. */
    public User getCreatedBy() { return createdBy; }
    /** Gán giá trị mới cho trường createdBy. */
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
