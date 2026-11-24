package com.swp391.scms.coaching.entity;

import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import org.hibernate.Length;

import java.time.LocalDateTime;

/**
 * Entity ánh xạ phản hồi và đánh giá của hội viên cho HLV (SCRUM-134, bảng coach_reviews): HLV, hội viên, nguồn
 * (booking/buổi lớp), số sao, nhận xét, ẩn danh, trạng thái duyệt và ghi chú quản lý.
 */
@Entity
@Table(name = "coach_reviews", uniqueConstraints = {
        @UniqueConstraint(name = "uq_review_member_booking", columnNames = {"member_id", "booking_id"}),
        @UniqueConstraint(name = "uq_review_member_session", columnNames = {"member_id", "class_session_id"})
}, indexes = {
        @Index(name = "ix_coach_reviews_coach", columnList = "coach_id"),
        @Index(name = "ix_coach_reviews_member", columnList = "member_id")
})
public class CoachReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "class_session_id")
    private Long classSessionId;

    @Column(name = "rating", nullable = false)
    private Integer rating; // Số sao từ 1 đến 5

    @Column(name = "comment", length = Length.LONG32)
    private String comment;

    @Column(name = "is_anonymous")
    private Boolean isAnonymous = false;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "approved"; // Trạng thái duyệt: approved, pending, hidden

    @Column(name = "manager_notes", length = Length.LONG32)
    private String managerNotes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường bookingId. */
    public Long getBookingId() { return bookingId; }
    /** Gán giá trị mới cho trường bookingId. */
    public void setBookingId(Long bookingId) { this.bookingId = bookingId; }

    /** Lấy giá trị trường classSessionId. */
    public Long getClassSessionId() { return classSessionId; }
    /** Gán giá trị mới cho trường classSessionId. */
    public void setClassSessionId(Long classSessionId) { this.classSessionId = classSessionId; }

    /** Lấy giá trị trường rating. */
    public Integer getRating() { return rating; }
    /** Gán giá trị mới cho trường rating. */
    public void setRating(Integer rating) { this.rating = rating; }

    /** Lấy giá trị trường comment. */
    public String getComment() { return comment; }
    /** Gán giá trị mới cho trường comment. */
    public void setComment(String comment) { this.comment = comment; }

    /** Lấy giá trị trường isAnonymous. */
    public Boolean getIsAnonymous() { return isAnonymous; }
    /** Gán cờ ẩn danh cho đánh giá. */
    public void setIsAnonymous(Boolean anonymous) { isAnonymous = anonymous; }

    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }

    /** Lấy giá trị trường managerNotes. */
    public String getManagerNotes() { return managerNotes; }
    /** Gán giá trị mới cho trường managerNotes. */
    public void setManagerNotes(String managerNotes) { this.managerNotes = managerNotes; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

