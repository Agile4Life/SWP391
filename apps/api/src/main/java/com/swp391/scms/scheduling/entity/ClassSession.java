package com.swp391.scms.scheduling.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Entity mapping table class_sessions (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_sessions_status", constraints = "status IN ('scheduled','completed','cancelled')")
@Table(name = "class_sessions", indexes = {@Index(name = "ix_sessions_class_date", columnList = "class_id, session_date")})
public class ClassSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "class_id", nullable = false)
    private GymClass gymClass;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "scheduled";

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường gymClass. */
    public GymClass getGymClass() { return gymClass; }
    /** Gán giá trị mới cho trường gymClass. */
    public void setGymClass(GymClass gymClass) { this.gymClass = gymClass; }
    /** Lấy giá trị trường sessionDate. */
    public LocalDate getSessionDate() { return sessionDate; }
    /** Gán giá trị mới cho trường sessionDate. */
    public void setSessionDate(LocalDate sessionDate) { this.sessionDate = sessionDate; }
    /** Lấy giá trị trường startTime. */
    public LocalTime getStartTime() { return startTime; }
    /** Gán giá trị mới cho trường startTime. */
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    /** Lấy giá trị trường endTime. */
    public LocalTime getEndTime() { return endTime; }
    /** Gán giá trị mới cho trường endTime. */
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường cancelReason. */
    public String getCancelReason() { return cancelReason; }
    /** Gán giá trị mới cho trường cancelReason. */
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
