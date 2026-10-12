package com.swp391.scms.attendance.entity;

import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Entity mapping table session_attendance (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_attendance_status", constraints = "status IN ('present','absent','late','excused')")
@Table(name = "session_attendance", indexes = {@Index(name = "ix_attendance_member", columnList = "member_id")}, uniqueConstraints = {@UniqueConstraint(name = "uq_session_member", columnNames = {"session_id", "member_id"})})
public class SessionAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ClassSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by", nullable = false)
    private Coach recordedBy;

    @Column(name = "notes", length = 255)
    private String notes;

    public Long getId() { return id; }
    public ClassSession getSession() { return session; }
    public void setSession(ClassSession session) { this.session = session; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
    public void setCheckedInAt(LocalDateTime checkedInAt) { this.checkedInAt = checkedInAt; }
    public Coach getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Coach recordedBy) { this.recordedBy = recordedBy; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
