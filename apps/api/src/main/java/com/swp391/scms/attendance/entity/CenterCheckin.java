package com.swp391.scms.attendance.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Entity mapping table center_checkins (schema is generated code-first by Hibernate). */
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

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public LocalDateTime getCheckInTime() { return checkInTime; }
    public void setCheckInTime(LocalDateTime checkInTime) { this.checkInTime = checkInTime; }
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    public void setCheckOutTime(LocalDateTime checkOutTime) { this.checkOutTime = checkOutTime; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public User getRecordedBy() { return recordedBy; }
    public void setRecordedBy(User recordedBy) { this.recordedBy = recordedBy; }
    public String getGate() { return gate; }
    public void setGate(String gate) { this.gate = gate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResult() { return status; }
    public void setResult(String result) { this.status = result; }
    public String getDenialReason() { return denialReason; }
    public void setDenialReason(String denialReason) { this.denialReason = denialReason; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
