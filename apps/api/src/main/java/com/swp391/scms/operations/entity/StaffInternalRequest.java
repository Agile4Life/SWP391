package com.swp391.scms.operations.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "staff_internal_requests", indexes = {
        @Index(name = "idx_staff_req_user", columnList = "user_id"),
        @Index(name = "idx_staff_req_status", columnList = "status"),
        @Index(name = "idx_staff_req_type", columnList = "request_type")
})
/**
 * Bảng staff_internal_requests: đơn từ nội bộ (người gửi, loại, tiêu đề, lý do, khoảng ngày, ca, người thay ca,
 * trạng thái, ghi chú và người/thời điểm duyệt).
 */
public class StaffInternalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "request_type", nullable = false, length = 50)
    private String requestType; // Giá trị hợp lệ: LEAVE, SHIFT_EXCHANGE, SCHEDULE_CHANGE, OTHER

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "reason", columnDefinition = "TEXT", nullable = false)
    private String reason;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "target_shift", length = 100)
    private String targetShift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replacement_user_id")
    private User replacementUser;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // Giá trị hợp lệ: PENDING, APPROVED, REJECTED, CANCELLED

    @Column(name = "manager_notes", columnDefinition = "TEXT")
    private String managerNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_user_id")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Constructor rỗng cho JPA. */
    public StaffInternalRequest() {}

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường user. */
    public User getUser() { return user; }
    /** Gán giá trị mới cho trường user. */
    public void setUser(User user) { this.user = user; }

    /** Lấy giá trị trường requestType. */
    public String getRequestType() { return requestType; }
    /** Gán giá trị mới cho trường requestType. */
    public void setRequestType(String requestType) { this.requestType = requestType; }

    /** Lấy giá trị trường title. */
    public String getTitle() { return title; }
    /** Gán giá trị mới cho trường title. */
    public void setTitle(String title) { this.title = title; }

    /** Lấy giá trị trường reason. */
    public String getReason() { return reason; }
    /** Gán giá trị mới cho trường reason. */
    public void setReason(String reason) { this.reason = reason; }

    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    /** Lấy giá trị trường targetShift. */
    public String getTargetShift() { return targetShift; }
    /** Gán giá trị mới cho trường targetShift. */
    public void setTargetShift(String targetShift) { this.targetShift = targetShift; }

    /** Lấy giá trị trường replacementUser. */
    public User getReplacementUser() { return replacementUser; }
    /** Gán giá trị mới cho trường replacementUser. */
    public void setReplacementUser(User replacementUser) { this.replacementUser = replacementUser; }

    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }

    /** Lấy giá trị trường managerNotes. */
    public String getManagerNotes() { return managerNotes; }
    /** Gán giá trị mới cho trường managerNotes. */
    public void setManagerNotes(String managerNotes) { this.managerNotes = managerNotes; }

    /** Lấy giá trị trường reviewedBy. */
    public User getReviewedBy() { return reviewedBy; }
    /** Gán giá trị mới cho trường reviewedBy. */
    public void setReviewedBy(User reviewedBy) { this.reviewedBy = reviewedBy; }

    /** Lấy giá trị trường reviewedAt. */
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    /** Gán giá trị mới cho trường reviewedAt. */
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

