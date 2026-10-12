package com.swp391.scms.ai.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.Length;

/** Entity mapping table ai_chat_messages (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_chat_sender", constraints = "sender IN ('member','ai')")
@Table(name = "ai_chat_messages")
public class AiChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "session_id", nullable = false)
    private AiChatSession session;

    @Column(name = "sender", nullable = false, length = 10)
    private String sender;

    @Column(name = "message", nullable = false, length = Length.LONG32)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public AiChatSession getSession() { return session; }
    public void setSession(AiChatSession session) { this.session = session; }
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
