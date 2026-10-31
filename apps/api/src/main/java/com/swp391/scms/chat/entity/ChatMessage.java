package com.swp391.scms.chat.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages", uniqueConstraints = @UniqueConstraint(name = "uk_chat_message_retry", columnNames = {"conversation_id", "sender_user_id", "client_message_id"}),
        indexes = @Index(name = "ix_chat_message_history", columnList = "conversation_id,id"))
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "conversation_id", nullable = false, updatable = false) private ChatConversation conversation;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sender_user_id", nullable = false, updatable = false) private User sender;
    @Column(name = "client_message_id", nullable = false, updatable = false) private UUID clientMessageId;
    @Column(nullable = false, length = 2000, updatable = false) private String message;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ChatMessage() { }
    public ChatMessage(ChatConversation conversation, User sender, UUID clientMessageId, String message, Instant now) {
        this.conversation = conversation; this.sender = sender; this.clientMessageId = clientMessageId; this.message = message; this.createdAt = now;
    }
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ChatConversation getConversation() { return conversation; }
    public User getSender() { return sender; }
    public UUID getClientMessageId() { return clientMessageId; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
}
