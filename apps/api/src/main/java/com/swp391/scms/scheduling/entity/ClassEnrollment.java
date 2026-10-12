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

    public Long getId() { return id; }
    public GymClass getGymClass() { return gymClass; }
    public void setGymClass(GymClass gymClass) { this.gymClass = gymClass; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getEnrolledAt() { return enrolledAt; }
    public void setEnrolledAt(LocalDateTime enrolledAt) { this.enrolledAt = enrolledAt; }
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }
    public User getCancelledBy() { return cancelledBy; }
    public void setCancelledBy(User cancelledBy) { this.cancelledBy = cancelledBy; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
}
