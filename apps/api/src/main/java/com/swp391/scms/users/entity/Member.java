package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
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

    /** The identity number encrypted (AES-GCM); {@code citizenId} keeps only the masked form. */
    @Column(name = "citizen_id_encrypted", columnDefinition = "TEXT")
    private String citizenIdEncrypted;

    /** PENDING (waiting for the desk), APPROVED or REJECTED; null for members verified before reviews existed. */
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

    public String getCitizenIdEncrypted() { return citizenIdEncrypted; }
    public void setCitizenIdEncrypted(String value) { this.citizenIdEncrypted = value; }
    public String getKycStatus() { return kycStatus; }
    public void setKycStatus(String value) { this.kycStatus = value; }
    public java.time.LocalDateTime getKycSubmittedAt() { return kycSubmittedAt; }
    public void setKycSubmittedAt(java.time.LocalDateTime value) { this.kycSubmittedAt = value; }
    public java.time.LocalDateTime getKycReviewedAt() { return kycReviewedAt; }
    public void setKycReviewedAt(java.time.LocalDateTime value) { this.kycReviewedAt = value; }
    public User getKycReviewedBy() { return kycReviewedBy; }
    public void setKycReviewedBy(User value) { this.kycReviewedBy = value; }
    public String getKycRejectReason() { return kycRejectReason; }
    public void setKycRejectReason(String value) { this.kycRejectReason = value; }

    /** Set when the member missed more than half of a course; no new course can be joined until then. */
    @Column(name = "course_enroll_blocked_until")
    private java.time.LocalDateTime courseEnrollBlockedUntil;

    public java.time.LocalDateTime getCourseEnrollBlockedUntil() { return courseEnrollBlockedUntil; }
    public void setCourseEnrollBlockedUntil(java.time.LocalDateTime value) { this.courseEnrollBlockedUntil = value; }

    // Capability for data-free Realtime invalidations; never serialized in member DTOs.
    @Column(name = "payment_realtime_topic")
    private java.util.UUID paymentRealtimeTopic;

    public java.util.UUID getPaymentRealtimeTopic() { return paymentRealtimeTopic; }
    public void setPaymentRealtimeTopic(java.util.UUID topic) { paymentRealtimeTopic = topic; }

    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }

    public String getCitizenId() { return citizenId; }
    public void setCitizenId(String citizenId) { this.citizenId = citizenId; }

    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }

    public String getFrontImageUrl() { return frontImageUrl; }
    public void setFrontImageUrl(String frontImageUrl) { this.frontImageUrl = frontImageUrl; }

    public String getBackImageUrl() { return backImageUrl; }
    public void setBackImageUrl(String backImageUrl) { this.backImageUrl = backImageUrl; }

    public Boolean getIdentityVerified() { return identityVerified; }
    public void setIdentityVerified(Boolean identityVerified) { this.identityVerified = identityVerified; }

    public java.time.LocalDateTime getIdentityVerifiedAt() { return identityVerifiedAt; }
    public void setIdentityVerifiedAt(java.time.LocalDateTime identityVerifiedAt) { this.identityVerifiedAt = identityVerifiedAt; }

    // Getters and Setters
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getMembershipCode() { return membershipCode; }
    public void setMembershipCode(String membershipCode) { this.membershipCode = membershipCode; }

    public LocalDate getJoinDate() { return joinDate; }
    public void setJoinDate(LocalDate joinDate) { this.joinDate = joinDate; }

    public String getHealthNotes() { return healthNotes; }
    public void setHealthNotes(String healthNotes) { this.healthNotes = healthNotes; }

    public String getFitnessGoal() { return fitnessGoal; }
    public void setFitnessGoal(String fitnessGoal) { this.fitnessGoal = fitnessGoal; }

    public String getFitnessLevel() { return fitnessLevel; }
    public void setFitnessLevel(String fitnessLevel) { this.fitnessLevel = fitnessLevel; }

    public String getEmergencyContactName() { return emergencyContactName; }
    public void setEmergencyContactName(String emergencyContactName) { this.emergencyContactName = emergencyContactName; }

    public String getEmergencyContactPhone() { return emergencyContactPhone; }
    public void setEmergencyContactPhone(String emergencyContactPhone) { this.emergencyContactPhone = emergencyContactPhone; }

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "member_favorite_disciplines",
        joinColumns = @JoinColumn(name = "member_id"),
        inverseJoinColumns = @JoinColumn(name = "discipline_id")
    )
    private java.util.Set<com.swp391.scms.facilities.entity.Discipline> favoriteDisciplines = new java.util.HashSet<>();

    public java.util.Set<com.swp391.scms.facilities.entity.Discipline> getFavoriteDisciplines() { return favoriteDisciplines; }
    public void setFavoriteDisciplines(java.util.Set<com.swp391.scms.facilities.entity.Discipline> favoriteDisciplines) { this.favoriteDisciplines = favoriteDisciplines; }

}
