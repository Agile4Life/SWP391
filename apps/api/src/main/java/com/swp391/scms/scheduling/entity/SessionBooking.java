package com.swp391.scms.scheduling.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * Entity lượt đặt chỗ một buổi học (bảng session_bookings): buổi, hội viên, trạng thái, thời điểm đặt, mã lô
 * đặt nhiều buổi và thông tin hủy.
 *
 * Chỗ của một hội viên trong MỘT buổi học. Khác {@link ClassEnrollment} giữ chỗ cho mọi buổi của lớp, lượt
 * đặt này được tạo, hủy và đếm theo từng buổi, nên hội viên chọn được từng ngày, cả tuần hoặc cả tháng. Sức
 * chứa và quy tắc một-lượt-đặt-mỗi-buổi do trigger/index của database bảo đảm.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_session_bookings_status", constraints = "status IN ('booked','cancelled','completed')")
@Table(name = "session_bookings", indexes = {
        @Index(name = "ix_session_bookings_session_status", columnList = "session_id, status"),
        @Index(name = "ix_session_bookings_member_status", columnList = "member_id, status")})
public class SessionBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "session_id", nullable = false)
    private ClassSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "booked";

    @Column(name = "booked_at", nullable = false)
    private LocalDateTime bookedAt;

    /** Gom các lượt đặt được tạo bởi một yêu cầu hàng loạt (tuần / tháng / các buổi chọn tay). */
    @Column(name = "batch_id", length = 36)
    private String batchId;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by")
    private User cancelledBy;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường session. */
    public ClassSession getSession() { return session; }
    /** Gán giá trị mới cho trường session. */
    public void setSession(ClassSession session) { this.session = session; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường bookedAt. */
    public LocalDateTime getBookedAt() { return bookedAt; }
    /** Gán giá trị mới cho trường bookedAt. */
    public void setBookedAt(LocalDateTime bookedAt) { this.bookedAt = bookedAt; }
    /** Lấy giá trị trường batchId. */
    public String getBatchId() { return batchId; }
    /** Gán giá trị mới cho trường batchId. */
    public void setBatchId(String batchId) { this.batchId = batchId; }
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
}
