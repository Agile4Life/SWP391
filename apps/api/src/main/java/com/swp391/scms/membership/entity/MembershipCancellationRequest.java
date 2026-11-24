package com.swp391.scms.membership.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "membership_cancellation_requests", indexes = {
        @Index(name = "ix_cancellation_member_status", columnList = "member_id, status"),
        @Index(name = "ix_cancellation_subscription", columnList = "subscription_id")
})
/**
 * Bảng membership_cancellation_requests: yêu cầu hủy gói (hội viên, kỳ gói, lý do, số tiền hoàn, người gửi,
 * trạng thái, thời điểm gửi/quyết định, người quyết định và ghi chú).
 */
@org.hibernate.annotations.Check(name = "ck_cancellation_status", constraints = "status IN ('PENDING','APPROVED','REJECTED')")
public class MembershipCancellationRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subscription_id", nullable = false)
    private MembershipSubscription subscription;
    @Column(name = "reason", nullable = false, length = 500)
    private String reason;
    @Column(name = "refund_amount", precision = 15, scale = 2)
    private BigDecimal refundAmount;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by")
    private User requestedBy;
    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";
    @Column(name = "requested_at", nullable = false, updatable = false)
    private LocalDateTime requestedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường subscription. */
    public MembershipSubscription getSubscription() { return subscription; }
    /** Gán giá trị mới cho trường subscription. */
    public void setSubscription(MembershipSubscription subscription) { this.subscription = subscription; }
    /** Lấy giá trị trường reason. */
    public String getReason() { return reason; }
    /** Gán giá trị mới cho trường reason. */
    public void setReason(String reason) { this.reason = reason; }
    /** Lấy giá trị trường refundAmount. */
    public BigDecimal getRefundAmount() { return refundAmount; }
    /** Gán giá trị mới cho trường refundAmount. */
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
    /** Lấy giá trị trường requestedBy. */
    public User getRequestedBy() { return requestedBy; }
    /** Gán giá trị mới cho trường requestedBy. */
    public void setRequestedBy(User requestedBy) { this.requestedBy = requestedBy; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường requestedAt. */
    public LocalDateTime getRequestedAt() { return requestedAt; }
    /** Gán giá trị mới cho trường requestedAt. */
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
    /** Lấy giá trị trường resolvedBy. */
    public User getResolvedBy() { return resolvedBy; }
    /** Gán giá trị mới cho trường resolvedBy. */
    public void setResolvedBy(User resolvedBy) { this.resolvedBy = resolvedBy; }
    /** Lấy giá trị trường resolvedAt. */
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    /** Gán giá trị mới cho trường resolvedAt. */
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    /** Lấy giá trị trường resolutionNote. */
    public String getResolutionNote() { return resolutionNote; }
    /** Gán giá trị mới cho trường resolutionNote. */
    public void setResolutionNote(String resolutionNote) { this.resolutionNote = resolutionNote; }
}
