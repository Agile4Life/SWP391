package com.swp391.scms.courts.entity;

import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;

/**
 * Entity một lượt đặt sân (bảng court_bookings): sân, hội viên, ngày giờ, trạng thái, mốc tạo/hủy, lý do, mất
 * lượt, giá và thanh toán.
 */
@Entity
@Table(name = "court_bookings", indexes = {
        @Index(name = "ix_court_bookings_room_date", columnList = "room_id, booking_date"),
        @Index(name = "ix_court_bookings_member_date", columnList = "member_id, booking_date")})
@org.hibernate.annotations.Check(name = "ck_court_bookings_status", constraints = "status IN ('booked','cancelled')")
@org.hibernate.annotations.Check(name = "ck_court_bookings_time", constraints = "start_time < end_time")
public class CourtBooking {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "room_id", nullable = false) private Room room;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "member_id", nullable = false) private User member;
    @Column(name = "booking_date", nullable = false) private LocalDate bookingDate;
    @Column(name = "start_time", nullable = false) private LocalTime startTime;
    @Column(name = "end_time", nullable = false) private LocalTime endTime;
    @Column(nullable = false, length = 20) private String status = "booked";
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "cancelled_at") private LocalDateTime cancelledAt;
    @Column(name = "cancel_reason", length = 255) private String cancelReason;
    /** Một khung của gói bị hủy do tạm hoãn quá gần giờ bắt đầu: vẫn tính vào hạn mức tháng. */
    @Column(name = "quota_forfeited") private Boolean quotaForfeited = false;
    /** Phí sân cho khung; null với các lượt đặt tạo trước khi có bảng giá (chúng miễn phí). */
    @Column(precision = 12, scale = 2) private BigDecimal price;
    /** {@code package_quota} khi gói tập chi trả khung giờ này, ngược lại là phương thức đã thanh toán lúc đặt. */
    @Column(name = "payment_method", length = 20) private String paymentMethod;
    @Column(name = "payment_status", length = 20) private String paymentStatus;
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường room. */
    public Room getRoom() { return room; }
    /** Gán giá trị mới cho trường room. */
    public void setRoom(Room room) { this.room = room; }
    /** Lấy giá trị trường member. */
    public User getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(User member) { this.member = member; }
    /** Lấy giá trị trường bookingDate. */
    public LocalDate getBookingDate() { return bookingDate; }
    /** Gán giá trị mới cho trường bookingDate. */
    public void setBookingDate(LocalDate value) { bookingDate = value; }
    /** Lấy giá trị trường startTime. */
    public LocalTime getStartTime() { return startTime; }
    /** Gán giá trị mới cho trường startTime. */
    public void setStartTime(LocalTime value) { startTime = value; }
    /** Lấy giá trị trường endTime. */
    public LocalTime getEndTime() { return endTime; }
    /** Gán giá trị mới cho trường endTime. */
    public void setEndTime(LocalTime value) { endTime = value; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String value) { status = value; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime value) { createdAt = value; }
    /** Lấy giá trị trường cancelledAt. */
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    /** Gán giá trị mới cho trường cancelledAt. */
    public void setCancelledAt(LocalDateTime value) { cancelledAt = value; }
    /** Cho biết quota forfeited (trường boolean). */
    public boolean isQuotaForfeited() { return Boolean.TRUE.equals(quotaForfeited); }
    /** Gán giá trị mới cho trường quotaForfeited. */
    public void setQuotaForfeited(boolean value) { quotaForfeited = value; }
    /** Lấy giá trị trường cancelReason. */
    public String getCancelReason() { return cancelReason; }
    /** Gán giá trị mới cho trường cancelReason. */
    public void setCancelReason(String value) { cancelReason = value; }
    /** Lấy giá trị trường price. */
    public BigDecimal getPrice() { return price; }
    /** Gán giá trị mới cho trường price. */
    public void setPrice(BigDecimal value) { price = value; }
    /** Lấy giá trị trường paymentMethod. */
    public String getPaymentMethod() { return paymentMethod; }
    /** Gán giá trị mới cho trường paymentMethod. */
    public void setPaymentMethod(String value) { paymentMethod = value; }
    /** Lấy giá trị trường paymentStatus. */
    public String getPaymentStatus() { return paymentStatus; }
    /** Gán giá trị mới cho trường paymentStatus. */
    public void setPaymentStatus(String value) { paymentStatus = value; }
}
