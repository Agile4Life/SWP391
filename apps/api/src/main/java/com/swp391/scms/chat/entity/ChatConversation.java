package com.swp391.scms.chat.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_conversations", uniqueConstraints = @UniqueConstraint(name = "uk_chat_pair", columnNames = {"member_user_id", "staff_user_id"}),
        indexes = {@Index(name = "ix_chat_member_activity", columnList = "member_user_id,last_activity_at,id"),
                @Index(name = "ix_chat_staff_activity", columnList = "staff_user_id,last_activity_at,id")})
public class ChatConversation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "member_user_id", nullable = false) private User member;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "staff_user_id", nullable = false) private User staff;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "last_activity_at", nullable = false) private Instant lastActivityAt;

    protected ChatConversation() { }
    public ChatConversation(User member, User staff, Instant now) {
        this.member = member; this.staff = staff; this.createdAt = now; this.lastActivityAt = now;
    }
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getMember() { return member; }
    public User getStaff() { return staff; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastActivityAt() { return lastActivityAt; }
    public void touch(Instant now) { lastActivityAt = now; }
}
