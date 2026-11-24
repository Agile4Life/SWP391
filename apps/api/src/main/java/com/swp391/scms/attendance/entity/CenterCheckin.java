package com.swp391.scms.attendance.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bảng center_checkins: một lượt ra vào cổng (hội viên, giờ vào/ra, cách thức, người ghi nhận, cổng, kết quả
 * GRANTED/DENIED, lý do từ chối, ghi chú).
 *
 * Entity ánh xạ bảng center_checkins (schema được Hibernate sinh theo hướng code-first).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_checkins_method", constraints = "method IN ('qr','manual')")
@org.hibernate.annotations.Check(name = "ck_checkins_status", constraints = "status IN ('GRANTED','DENIED')")
@Table(name = "center_checkins", indexes = {@Index(name = "ix_checkins_member_time", columnList = "member_id, check_in_time")})
public class CenterCheckin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = true)
    private Member member;

    @Column(name = "check_in_time", nullable = false)
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "method", nullable = false, length = 10)
    private String method = "qr";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by")
    private User recordedBy;

    @Column(name = "gate", length = 50)
    private String gate;

    @Column(name = "status", nullable = false, length = 20, columnDefinition = "varchar(20) default 'GRANTED'")
    private String status = "GRANTED";

    @Column(name = "denial_reason", length = 255)
    private String denialReason;

    @Column(name = "notes", length = 255)
    private String notes;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường checkInTime. */
    public LocalDateTime getCheckInTime() { return checkInTime; }
    /** Gán giá trị mới cho trường checkInTime. */
    public void setCheckInTime(LocalDateTime checkInTime) { this.checkInTime = checkInTime; }
    /** Lấy giá trị trường checkOutTime. */
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    /** Gán giá trị mới cho trường checkOutTime. */
    public void setCheckOutTime(LocalDateTime checkOutTime) { this.checkOutTime = checkOutTime; }
    /** Lấy giá trị trường method. */
    public String getMethod() { return method; }
    /** Gán giá trị mới cho trường method. */
    public void setMethod(String method) { this.method = method; }
    /** Lấy giá trị trường recordedBy. */
    public User getRecordedBy() { return recordedBy; }
    /** Gán giá trị mới cho trường recordedBy. */
    public void setRecordedBy(User recordedBy) { this.recordedBy = recordedBy; }
    /** Lấy giá trị trường gate. */
    public String getGate() { return gate; }
    /** Gán giá trị mới cho trường gate. */
    public void setGate(String gate) { this.gate = gate; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường result. */
    public String getResult() { return status; }
    /** Gán giá trị mới cho trường result. */
    public void setResult(String result) { this.status = result; }
    /** Lấy giá trị trường denialReason. */
    public String getDenialReason() { return denialReason; }
    /** Gán giá trị mới cho trường denialReason. */
    public void setDenialReason(String denialReason) { this.denialReason = denialReason; }
    /** Lấy giá trị trường notes. */
    public String getNotes() { return notes; }
    /** Gán giá trị mới cho trường notes. */
    public void setNotes(String notes) { this.notes = notes; }
}
