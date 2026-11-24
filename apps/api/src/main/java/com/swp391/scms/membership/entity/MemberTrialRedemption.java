package com.swp391.scms.membership.entity;

import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entity tracking 3-day free trial redemptions verified by Citizen Identity Card (CCCD) or Passport.
 * Each document hash and each Member can only redeem once.
 * Submissions initially stay in PENDING_APPROVAL until verified at the reception desk.
 */
@Entity
@Table(name = "member_trial_redemptions", uniqueConstraints = {
        @UniqueConstraint(name = "uq_trial_cccd_hash", columnNames = {"cccd_hash"}),
        @UniqueConstraint(name = "uq_trial_member", columnNames = {"member_id"})
})
/**
 * Bảng member_trial_redemptions: yêu cầu nhận gói trải nghiệm của hội viên, gồm mã băm và 4 số cuối giấy tờ
 * (không lưu số đầy đủ; bản mã hóa chỉ giữ khi đang chờ duyệt), họ tên, quốc tịch, ảnh, trạng thái, người/thời
 * điểm duyệt, lý do từ chối và kỳ gói đã tạo. Mỗi hội viên và mỗi giấy tờ chỉ có một bản ghi.
 */
public class MemberTrialRedemption {

    public static final String STATUS_PENDING = "PENDING_APPROVAL";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    public static final String DOC_CCCD = "CCCD";
    public static final String DOC_PASSPORT = "PASSPORT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    /** HMAC-SHA256 của số CCCD/Hộ chiếu; không lưu số gốc. */
    @Column(name = "cccd_hash", nullable = false, length = 64)
    private String cccdHash;

    @Column(name = "cccd_last4", nullable = false, length = 4)
    private String cccdLast4;

    /** Số giấy tờ mã hóa AES-GCM, chỉ giữ trong lúc đơn chờ duyệt; xóa khi duyệt hoặc từ chối. */
    @Column(name = "document_number_enc", length = 255)
    private String documentNumberEnc;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "document_type", length = 20)
    private String documentType = DOC_CCCD; // CCCD, PASSPORT

    @Column(name = "nationality", length = 100)
    private String nationality;

    @Column(name = "front_image_url", columnDefinition = "TEXT")
    private String frontImageUrl;

    @Column(name = "back_image_url", columnDefinition = "TEXT")
    private String backImageUrl;

    @Column(name = "status", length = 30)
    private String status = STATUS_PENDING; // PENDING_APPROVAL, APPROVED, REJECTED

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_id", nullable = true)
    private MembershipSubscription subscription;

    @Column(name = "redeemed_at", nullable = false)
    private LocalDateTime redeemedAt = LocalDateTime.now();

    /** Constructor rỗng cho JPA. */
    public MemberTrialRedemption() {}

    /** Tạo bản ghi nhận gói kiểu cũ (kích hoạt ngay) với hội viên, mã băm, 4 số cuối, họ tên và kỳ gói. */
    public MemberTrialRedemption(Member member, String cccdHash, String cccdLast4, String fullName, MembershipSubscription subscription) {
        this.member = member;
        this.cccdHash = cccdHash;
        this.cccdLast4 = cccdLast4;
        this.fullName = fullName;
        this.subscription = subscription;
        this.status = subscription != null ? STATUS_APPROVED : STATUS_PENDING;
        this.redeemedAt = LocalDateTime.now();
    }

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

    /** Lấy giá trị trường cccdHash. */
    public String getCccdHash() {
        return cccdHash;
    }

    /** Gán giá trị mới cho trường cccdHash. */
    public void setCccdHash(String cccdHash) {
        this.cccdHash = cccdHash;
    }

    /** Lấy giá trị trường documentNumberEnc. */
    public String getDocumentNumberEnc() {
        return documentNumberEnc;
    }

    /** Gán giá trị mới cho trường documentNumberEnc. */
    public void setDocumentNumberEnc(String documentNumberEnc) {
        this.documentNumberEnc = documentNumberEnc;
    }

    /** Lấy giá trị trường cccdLast4. */
    public String getCccdLast4() {
        return cccdLast4;
    }

    /** Gán giá trị mới cho trường cccdLast4. */
    public void setCccdLast4(String cccdLast4) {
        this.cccdLast4 = cccdLast4;
    }

    /** Lấy giá trị trường fullName. */
    public String getFullName() {
        return fullName;
    }

    /** Gán giá trị mới cho trường fullName. */
    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    /** Lấy giá trị trường documentType. */
    public String getDocumentType() {
        return documentType;
    }

    /** Gán giá trị mới cho trường documentType. */
    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    /** Lấy giá trị trường nationality. */
    public String getNationality() {
        return nationality;
    }

    /** Gán giá trị mới cho trường nationality. */
    public void setNationality(String nationality) {
        this.nationality = nationality;
    }

    /** Lấy giá trị trường frontImageUrl. */
    public String getFrontImageUrl() {
        return frontImageUrl;
    }

    /** Gán giá trị mới cho trường frontImageUrl. */
    public void setFrontImageUrl(String frontImageUrl) {
        this.frontImageUrl = frontImageUrl;
    }

    /** Lấy giá trị trường backImageUrl. */
    public String getBackImageUrl() {
        return backImageUrl;
    }

    /** Gán giá trị mới cho trường backImageUrl. */
    public void setBackImageUrl(String backImageUrl) {
        this.backImageUrl = backImageUrl;
    }

    /** Lấy giá trị trường status. */
    public String getStatus() {
        return status;
    }

    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) {
        this.status = status;
    }

    /** Lấy giá trị trường reviewedBy. */
    public Long getReviewedBy() {
        return reviewedBy;
    }

    /** Gán giá trị mới cho trường reviewedBy. */
    public void setReviewedBy(Long reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    /** Lấy giá trị trường reviewedAt. */
    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    /** Gán giá trị mới cho trường reviewedAt. */
    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    /** Lấy giá trị trường rejectionReason. */
    public String getRejectionReason() {
        return rejectionReason;
    }

    /** Gán giá trị mới cho trường rejectionReason. */
    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    /** Lấy giá trị trường subscription. */
    public MembershipSubscription getSubscription() {
        return subscription;
    }

    /** Gán giá trị mới cho trường subscription. */
    public void setSubscription(MembershipSubscription subscription) {
        this.subscription = subscription;
    }

    /** Lấy giá trị trường redeemedAt. */
    public LocalDateTime getRedeemedAt() {
        return redeemedAt;
    }

    /** Gán giá trị mới cho trường redeemedAt. */
    public void setRedeemedAt(LocalDateTime redeemedAt) {
        this.redeemedAt = redeemedAt;
    }
}
