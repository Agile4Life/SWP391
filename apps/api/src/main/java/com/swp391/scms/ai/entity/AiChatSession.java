package com.swp391.scms.ai.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bảng ai_chat_sessions: phiên chat AI của một hội viên hoặc của một nhân viên quầy (chủ đề, thời điểm bắt
 * đầu/kết thúc).
 *
 * Entity ánh xạ bảng ai_chat_sessions (schema được Hibernate sinh theo hướng code-first). Một phiên thuộc về
 * một hội viên (với hồ sơ của họ làm ngữ cảnh) hoặc một tài khoản nhân viên quầy (chỉ dùng dữ liệu chung của
 * trung tâm); đúng một trong hai trường {@code member} hoặc {@code staffUser} được gán giá trị.
 */
@Entity
@Table(name = "ai_chat_sessions")
public class AiChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_user_id")
    private User staffUser;

    @Column(name = "topic", length = 150)
    private String topic;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường staffUser. */
    public User getStaffUser() { return staffUser; }
    /** Gán giá trị mới cho trường staffUser. */
    public void setStaffUser(User staffUser) { this.staffUser = staffUser; }
    /** Lấy giá trị trường topic. */
    public String getTopic() { return topic; }
    /** Gán giá trị mới cho trường topic. */
    public void setTopic(String topic) { this.topic = topic; }
    /** Lấy giá trị trường startedAt. */
    public LocalDateTime getStartedAt() { return startedAt; }
    /** Gán giá trị mới cho trường startedAt. */
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    /** Lấy giá trị trường endedAt. */
    public LocalDateTime getEndedAt() { return endedAt; }
    /** Gán giá trị mới cho trường endedAt. */
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }
}
