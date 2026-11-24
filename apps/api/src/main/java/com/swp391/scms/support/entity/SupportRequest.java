package com.swp391.scms.support.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.Length;

/**
 * Bảng support_requests: phiếu khiếu nại của hội viên (người phụ trách, tiêu đề, mô tả, trạng thái, thời điểm
 * tạo/giải quyết, thông tin chuyển lên quản lý).
 *
 * Entity mapping table support_requests (schema is generated code-first by Hibernate).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_support_status", constraints = "status IN ('open','in_progress','resolved','closed')")
@Table(name = "support_requests")
public class SupportRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;

    @Column(name = "subject", nullable = false, length = 150)
    private String subject;

    @Column(name = "description", length = Length.LONG32)
    private String description;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "open";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /** Set when the receptionist hands the complaint up; managers only ever see escalated requests. */
    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "escalated_by")
    private User escalatedBy;

    @Column(name = "escalation_reason", length = 500)
    private String escalationReason;

    /** Constructor rỗng cho JPA. */
    public SupportRequest() {}

    /** Tạo phiếu mới ở trạng thái open. */
    public SupportRequest(Member member, String subject, String description) {
        this.member = member;
        this.subject = subject;
        this.description = description;
        this.status = "open";
        this.createdAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường assignedTo. */
    public User getAssignedTo() { return assignedTo; }
    /** Gán giá trị mới cho trường assignedTo. */
    public void setAssignedTo(User assignedTo) { this.assignedTo = assignedTo; }
    /** Lấy giá trị trường subject. */
    public String getSubject() { return subject; }
    /** Gán giá trị mới cho trường subject. */
    public void setSubject(String subject) { this.subject = subject; }
    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường escalatedAt. */
    public LocalDateTime getEscalatedAt() { return escalatedAt; }
    /** Gán giá trị mới cho trường escalatedAt. */
    public void setEscalatedAt(LocalDateTime escalatedAt) { this.escalatedAt = escalatedAt; }
    /** Lấy giá trị trường escalatedBy. */
    public User getEscalatedBy() { return escalatedBy; }
    /** Gán giá trị mới cho trường escalatedBy. */
    public void setEscalatedBy(User escalatedBy) { this.escalatedBy = escalatedBy; }
    /** Lấy giá trị trường escalationReason. */
    public String getEscalationReason() { return escalationReason; }
    /** Gán giá trị mới cho trường escalationReason. */
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    /** Phiếu đã được chuyển lên quản lý chưa. */
    public boolean isEscalated() { return escalatedAt != null; }
    /** Lấy giá trị trường resolvedAt. */
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    /** Gán giá trị mới cho trường resolvedAt. */
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
