package com.swp391.scms.coaching.entity;

import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * SCRUM-133: Entity mapping 1-on-1 coach booking (PT private session).
 * Enforces hourly slot booking, minimum 2-hour advance booking, anti-conflict, and paid/quota verification.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_coach_bookings_status", constraints = "status IN ('confirmed','cancelled','completed')")
@org.hibernate.annotations.Check(name = "ck_coach_bookings_payment_status", constraints = "payment_status IN ('paid','used_quota','pending')")
@Table(name = "coach_bookings", indexes = {
        @Index(name = "ix_coach_bookings_coach_date", columnList = "coach_id, booking_date"),
        @Index(name = "ix_coach_bookings_member_date", columnList = "member_id, booking_date"),
        @Index(name = "ix_coach_bookings_status", columnList = "status")
})
public class CoachBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "discipline_id")
    private Discipline discipline;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_id")
    private MembershipSubscription subscription;

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "hourly_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal hourlyRate = new BigDecimal("200000.00");

    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod = "package_quota"; // package_quota, cash, bank_transfer, online_wallet

    @Column(name = "payment_status", nullable = false, length = 20)
    private String paymentStatus = "used_quota"; // used_quota, paid, pending

    @Column(name = "status", nullable = false, length = 20)
    private String status = "confirmed"; // confirmed, cancelled, completed

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** When the member was recorded as arriving for this session (gate scan or a visit covering it); null if not yet. */
    @Column(name = "attended_at")
    private LocalDateTime attendedAt;

    /** Set when staff removed the arrival, so the list can say the mark was taken off on purpose. */
    @Column(name = "attendance_locked")
    private Boolean attendanceLocked = false;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    /** A package slot cancelled by a hold too close to the session: it still counts against the monthly quota. */
    @Column(name = "quota_forfeited")
    private Boolean quotaForfeited = false;

    public CoachBooking() {}

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }

    /** Lấy giá trị trường discipline. */
    public Discipline getDiscipline() { return discipline; }
    /** Gán giá trị mới cho trường discipline. */
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }

    /** Lấy giá trị trường subscription. */
    public MembershipSubscription getSubscription() { return subscription; }
    /** Gán giá trị mới cho trường subscription. */
    public void setSubscription(MembershipSubscription subscription) { this.subscription = subscription; }

    /** Lấy giá trị trường bookingDate. */
    public LocalDate getBookingDate() { return bookingDate; }
    /** Gán giá trị mới cho trường bookingDate. */
    public void setBookingDate(LocalDate bookingDate) { this.bookingDate = bookingDate; }

    /** Lấy giá trị trường startTime. */
    public LocalTime getStartTime() { return startTime; }
    /** Gán giá trị mới cho trường startTime. */
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    /** Lấy giá trị trường endTime. */
    public LocalTime getEndTime() { return endTime; }
    /** Gán giá trị mới cho trường endTime. */
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    /** Lấy giá trị trường hourlyRate. */
    public BigDecimal getHourlyRate() { return hourlyRate; }
    /** Gán giá trị mới cho trường hourlyRate. */
    public void setHourlyRate(BigDecimal hourlyRate) { this.hourlyRate = hourlyRate; }

    /** Lấy giá trị trường paymentMethod. */
    public String getPaymentMethod() { return paymentMethod; }
    /** Gán giá trị mới cho trường paymentMethod. */
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    /** Lấy giá trị trường paymentStatus. */
    public String getPaymentStatus() { return paymentStatus; }
    /** Gán giá trị mới cho trường paymentStatus. */
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public boolean isQuotaForfeited() { return Boolean.TRUE.equals(quotaForfeited); }
    /** Gán giá trị mới cho trường quotaForfeited. */
    public void setQuotaForfeited(boolean quotaForfeited) { this.quotaForfeited = quotaForfeited; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }

    /** Lấy giá trị trường notes. */
    public String getNotes() { return notes; }
    /** Gán giá trị mới cho trường notes. */
    public void setNotes(String notes) { this.notes = notes; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isAttendanceLocked() { return Boolean.TRUE.equals(attendanceLocked); }
    /** Gán giá trị mới cho trường attendanceLocked. */
    public void setAttendanceLocked(boolean attendanceLocked) { this.attendanceLocked = attendanceLocked; }
    /** Lấy giá trị trường attendedAt. */
    public LocalDateTime getAttendedAt() { return attendedAt; }
    /** Gán giá trị mới cho trường attendedAt. */
    public void setAttendedAt(LocalDateTime attendedAt) { this.attendedAt = attendedAt; }
    /** Lấy giá trị trường cancelledAt. */
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    /** Gán giá trị mới cho trường cancelledAt. */
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }

    /** Lấy giá trị trường cancelReason. */
    public String getCancelReason() { return cancelReason; }
    /** Gán giá trị mới cho trường cancelReason. */
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
}
