package com.swp391.scms.scheduling.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Entity mapping table class_enrollments (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_enrollments_status", constraints = "status IN ('booked','cancelled','completed')")
@Table(name = "class_enrollments", indexes = {@Index(name = "ix_enrollments_member_status", columnList = "member_id, status"), @Index(name = "ix_enrollments_class_status", columnList = "class_id, status")})
public class ClassEnrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private GymClass gymClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "booked";

    @Column(name = "enrolled_at", nullable = false)
    private LocalDateTime enrolledAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by")
    private User cancelledBy;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    /**
     * Set when a free course credit was given up for good (a membership hold that came too late to restore it): the
     * cancelled enrollment keeps counting against the package's course allowance. Null/false for every other case.
     */
    @Column(name = "credit_forfeited")
    private Boolean creditForfeited;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường gymClass. */
    public GymClass getGymClass() { return gymClass; }
    /** Gán giá trị mới cho trường gymClass. */
    public void setGymClass(GymClass gymClass) { this.gymClass = gymClass; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường enrolledAt. */
    public LocalDateTime getEnrolledAt() { return enrolledAt; }
    /** Gán giá trị mới cho trường enrolledAt. */
    public void setEnrolledAt(LocalDateTime enrolledAt) { this.enrolledAt = enrolledAt; }
    /** Lấy giá trị trường cancelledAt. */
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    /** Gán giá trị mới cho trường cancelledAt. */
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }
    /** Lấy giá trị trường cancelledBy. */
    public User getCancelledBy() { return cancelledBy; }
    /** Gán giá trị mới cho trường cancelledBy. */
    public void setCancelledBy(User cancelledBy) { this.cancelledBy = cancelledBy; }
    /** Lấy giá trị trường cancelReason. */
    public String getCancelReason() { return cancelReason; }
    /** Gán giá trị mới cho trường cancelReason. */
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    /** Cho biết credit forfeited (trường boolean). */
    public boolean isCreditForfeited() { return Boolean.TRUE.equals(creditForfeited); }
    /** Gán giá trị mới cho trường creditForfeited. */
    public void setCreditForfeited(boolean creditForfeited) { this.creditForfeited = creditForfeited; }
}
