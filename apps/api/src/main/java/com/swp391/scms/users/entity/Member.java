package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/**
 * Bảng members: hồ sơ hội viên gắn 1-1 với tài khoản User (mã hội viên, ngày tham gia, sức khỏe, mục tiêu,
 * trình độ, liên hệ khẩn cấp, giấy tờ tùy thân và trạng thái duyệt KYC...).
 */
@Entity
@org.hibernate.annotations.DynamicUpdate
@org.hibernate.annotations.Check(name = "ck_members_level", constraints = "fitness_level IN ('beginner','intermediate','advanced')")
@Table(name = "members")
public class Member {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "membership_code", nullable = false, unique = true, length = 30)
    private String membershipCode;

    @Column(name = "join_date", nullable = false)
    private LocalDate joinDate;

    @Column(name = "health_notes")
    private String healthNotes;

    @Column(name = "fitness_goal", length = 255)
    private String fitnessGoal;

    @Column(name = "fitness_level", nullable = false, length = 20)
    private String fitnessLevel = "beginner"; // beginner, intermediate, advanced

    @Column(name = "emergency_contact_name", length = 150)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    @Column(name = "document_type", length = 20)
    private String documentType; // CCCD, PASSPORT

    @Column(name = "citizen_id", length = 30)
    private String citizenId;

    @Column(name = "nationality", length = 100)
    private String nationality;

    @Column(name = "front_image_url", columnDefinition = "TEXT")
    private String frontImageUrl;

    @Column(name = "back_image_url", columnDefinition = "TEXT")
    private String backImageUrl;

    @Column(name = "identity_verified")
    private Boolean identityVerified = false;

    @Column(name = "identity_verified_at")
    private java.time.LocalDateTime identityVerifiedAt;

    /** Số định danh đã mã hóa (AES-GCM); {@code citizenId} chỉ giữ dạng che. */
    @Column(name = "citizen_id_encrypted", columnDefinition = "TEXT")
    private String citizenIdEncrypted;

    /** PENDING (chờ quầy), APPROVED hoặc REJECTED; null với hội viên được xác minh trước khi có bước duyệt. */
    @Column(name = "kyc_status", length = 20)
    private String kycStatus;

    @Column(name = "kyc_submitted_at")
    private java.time.LocalDateTime kycSubmittedAt;

    @Column(name = "kyc_reviewed_at")
    private java.time.LocalDateTime kycReviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kyc_reviewed_by")
    private User kycReviewedBy;

    @Column(name = "kyc_reject_reason", length = 255)
    private String kycRejectReason;

    /** Lấy giá trị trường citizenIdEncrypted. */
    public String getCitizenIdEncrypted() { return citizenIdEncrypted; }
    /** Gán giá trị mới cho trường citizenIdEncrypted. */
    public void setCitizenIdEncrypted(String value) { this.citizenIdEncrypted = value; }
    /** Lấy giá trị trường kycStatus. */
    public String getKycStatus() { return kycStatus; }
    /** Gán giá trị mới cho trường kycStatus. */
    public void setKycStatus(String value) { this.kycStatus = value; }
    /** Lấy giá trị trường kycSubmittedAt. */
    public java.time.LocalDateTime getKycSubmittedAt() { return kycSubmittedAt; }
    /** Gán giá trị mới cho trường kycSubmittedAt. */
    public void setKycSubmittedAt(java.time.LocalDateTime value) { this.kycSubmittedAt = value; }
    /** Lấy giá trị trường kycReviewedAt. */
    public java.time.LocalDateTime getKycReviewedAt() { return kycReviewedAt; }
    /** Gán giá trị mới cho trường kycReviewedAt. */
    public void setKycReviewedAt(java.time.LocalDateTime value) { this.kycReviewedAt = value; }
    /** Lấy giá trị trường kycReviewedBy. */
    public User getKycReviewedBy() { return kycReviewedBy; }
    /** Gán giá trị mới cho trường kycReviewedBy. */
    public void setKycReviewedBy(User value) { this.kycReviewedBy = value; }
    /** Lấy giá trị trường kycRejectReason. */
    public String getKycRejectReason() { return kycRejectReason; }
    /** Gán giá trị mới cho trường kycRejectReason. */
    public void setKycRejectReason(String value) { this.kycRejectReason = value; }

    /** Được đặt khi hội viên vắng hơn một nửa khóa học; đến lúc đó mới được vào khóa mới. */
    @Column(name = "course_enroll_blocked_until")
    private java.time.LocalDateTime courseEnrollBlockedUntil;

    /** Lấy giá trị trường courseEnrollBlockedUntil. */
    public java.time.LocalDateTime getCourseEnrollBlockedUntil() { return courseEnrollBlockedUntil; }
    /** Gán giá trị mới cho trường courseEnrollBlockedUntil. */
    public void setCourseEnrollBlockedUntil(java.time.LocalDateTime value) { this.courseEnrollBlockedUntil = value; }

    // Capability cho các thông báo Realtime không chứa dữ liệu; không bao giờ được serialize trong DTO hội
    // viên.
    @Column(name = "payment_realtime_topic")
    private java.util.UUID paymentRealtimeTopic;

    /** Lấy giá trị trường paymentRealtimeTopic. */
    public java.util.UUID getPaymentRealtimeTopic() { return paymentRealtimeTopic; }
    /** Gán mã chủ đề realtime riêng của hội viên (dùng để báo frontend tải lại thanh toán, không chứa dữ liệu). */
    public void setPaymentRealtimeTopic(java.util.UUID topic) { paymentRealtimeTopic = topic; }

    /** Lấy giá trị trường documentType. */
    public String getDocumentType() { return documentType; }
    /** Gán giá trị mới cho trường documentType. */
    public void setDocumentType(String documentType) { this.documentType = documentType; }

    /** Lấy giá trị trường citizenId. */
    public String getCitizenId() { return citizenId; }
    /** Gán giá trị mới cho trường citizenId. */
    public void setCitizenId(String citizenId) { this.citizenId = citizenId; }

    /** Lấy giá trị trường nationality. */
    public String getNationality() { return nationality; }
    /** Gán giá trị mới cho trường nationality. */
    public void setNationality(String nationality) { this.nationality = nationality; }

    /** Lấy giá trị trường frontImageUrl. */
    public String getFrontImageUrl() { return frontImageUrl; }
    /** Gán giá trị mới cho trường frontImageUrl. */
    public void setFrontImageUrl(String frontImageUrl) { this.frontImageUrl = frontImageUrl; }

    /** Lấy giá trị trường backImageUrl. */
    public String getBackImageUrl() { return backImageUrl; }
    /** Gán giá trị mới cho trường backImageUrl. */
    public void setBackImageUrl(String backImageUrl) { this.backImageUrl = backImageUrl; }

    /** Lấy giá trị trường identityVerified. */
    public Boolean getIdentityVerified() { return identityVerified; }
    /** Gán giá trị mới cho trường identityVerified. */
    public void setIdentityVerified(Boolean identityVerified) { this.identityVerified = identityVerified; }

    /** Lấy giá trị trường identityVerifiedAt. */
    public java.time.LocalDateTime getIdentityVerifiedAt() { return identityVerifiedAt; }
    /** Gán giá trị mới cho trường identityVerifiedAt. */
    public void setIdentityVerifiedAt(java.time.LocalDateTime identityVerifiedAt) { this.identityVerifiedAt = identityVerifiedAt; }

    // Getter và Setter.
    /** Lấy giá trị trường userId. */
    public Long getUserId() { return userId; }
    /** Gán giá trị mới cho trường userId. */
    public void setUserId(Long userId) { this.userId = userId; }

    /** Lấy giá trị trường user. */
    public User getUser() { return user; }
    /** Gán giá trị mới cho trường user. */
    public void setUser(User user) { this.user = user; }

    /** Lấy giá trị trường membershipCode. */
    public String getMembershipCode() { return membershipCode; }
    /** Gán giá trị mới cho trường membershipCode. */
    public void setMembershipCode(String membershipCode) { this.membershipCode = membershipCode; }

    /** Lấy giá trị trường joinDate. */
    public LocalDate getJoinDate() { return joinDate; }
    /** Gán giá trị mới cho trường joinDate. */
    public void setJoinDate(LocalDate joinDate) { this.joinDate = joinDate; }

    /** Lấy giá trị trường healthNotes. */
    public String getHealthNotes() { return healthNotes; }
    /** Gán giá trị mới cho trường healthNotes. */
    public void setHealthNotes(String healthNotes) { this.healthNotes = healthNotes; }

    /** Lấy giá trị trường fitnessGoal. */
    public String getFitnessGoal() { return fitnessGoal; }
    /** Gán giá trị mới cho trường fitnessGoal. */
    public void setFitnessGoal(String fitnessGoal) { this.fitnessGoal = fitnessGoal; }

    /** Lấy giá trị trường fitnessLevel. */
    public String getFitnessLevel() { return fitnessLevel; }
    /** Gán giá trị mới cho trường fitnessLevel. */
    public void setFitnessLevel(String fitnessLevel) { this.fitnessLevel = fitnessLevel; }

    /** Lấy giá trị trường emergencyContactName. */
    public String getEmergencyContactName() { return emergencyContactName; }
    /** Gán giá trị mới cho trường emergencyContactName. */
    public void setEmergencyContactName(String emergencyContactName) { this.emergencyContactName = emergencyContactName; }

    /** Lấy giá trị trường emergencyContactPhone. */
    public String getEmergencyContactPhone() { return emergencyContactPhone; }
    /** Gán giá trị mới cho trường emergencyContactPhone. */
    public void setEmergencyContactPhone(String emergencyContactPhone) { this.emergencyContactPhone = emergencyContactPhone; }

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "member_favorite_disciplines",
        joinColumns = @JoinColumn(name = "member_id"),
        inverseJoinColumns = @JoinColumn(name = "discipline_id")
    )
    private java.util.Set<com.swp391.scms.facilities.entity.Discipline> favoriteDisciplines = new java.util.HashSet<>();

    /** Lấy giá trị trường favoriteDisciplines. */
    public java.util.Set<com.swp391.scms.facilities.entity.Discipline> getFavoriteDisciplines() { return favoriteDisciplines; }
    /** Gán giá trị mới cho trường favoriteDisciplines. */
    public void setFavoriteDisciplines(java.util.Set<com.swp391.scms.facilities.entity.Discipline> favoriteDisciplines) { this.favoriteDisciplines = favoriteDisciplines; }

}
