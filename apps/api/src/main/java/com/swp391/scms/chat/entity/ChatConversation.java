package com.swp391.scms.chat.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_conversations", uniqueConstraints = @UniqueConstraint(name = "uk_chat_pair", columnNames = {"member_user_id", "staff_user_id"}),
        indexes = {@Index(name = "ix_chat_member_activity", columnList = "member_user_id,last_activity_at,id"),
/**
 * Bảng chat_conversations: hội thoại giữa một hội viên và một nhân viên (lễ tân/HLV), thời điểm tạo, hoạt động
 * cuối và mốc tin đã đọc của từng bên.
 */
                @Index(name = "ix_chat_staff_activity", columnList = "staff_user_id,last_activity_at,id")})
public class ChatConversation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "member_user_id", nullable = false) private User member;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "staff_user_id", nullable = false) private User staff;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "last_activity_at", nullable = false) private Instant lastActivityAt;
    /** Tin cuối cùng mỗi bên đã đọc; null nghĩa là chưa đọc tin nào. */
    @Column(name = "member_last_read_message_id") private Long memberLastReadMessageId;
    @Column(name = "staff_last_read_message_id") private Long staffLastReadMessageId;

    /** Constructor rỗng cho JPA. */
    protected ChatConversation() { }
    /** Tạo hội thoại mới giữa hội viên và nhân viên. */
    public ChatConversation(User member, User staff, Instant now) {
        this.member = member; this.staff = staff; this.createdAt = now; this.lastActivityAt = now;
    }
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường member. */
    public User getMember() { return member; }
    /** Lấy giá trị trường staff. */
    public User getStaff() { return staff; }
    /** Lấy giá trị trường createdAt. */
    public Instant getCreatedAt() { return createdAt; }
    /** Lấy giá trị trường lastActivityAt. */
    public Instant getLastActivityAt() { return lastActivityAt; }
    /** Cập nhật thời điểm hoạt động cuối. */
    public void touch(Instant now) { lastActivityAt = now; }
    /** Mốc tin đã đọc của người dùng (theo vai trò trong hội thoại). */
    public Long lastReadBy(Long userId) { return member.getId().equals(userId) ? memberLastReadMessageId : staffLastReadMessageId; }
    /** Chỉ tiến về phía trước: đọc lại tin cũ không làm tin mới thành chưa đọc. */
    public void markRead(Long userId, long messageId) {
        Long current = lastReadBy(userId);
        if (current != null && current >= messageId) return;
        if (member.getId().equals(userId)) memberLastReadMessageId = messageId; else staffLastReadMessageId = messageId;
    }
}
