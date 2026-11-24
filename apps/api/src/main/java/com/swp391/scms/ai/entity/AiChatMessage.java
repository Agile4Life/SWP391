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

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường session. */
    public AiChatSession getSession() { return session; }
    /** Gán giá trị mới cho trường session. */
    public void setSession(AiChatSession session) { this.session = session; }
    /** Lấy giá trị trường sender. */
    public String getSender() { return sender; }
    /** Gán giá trị mới cho trường sender. */
    public void setSender(String sender) { this.sender = sender; }
    /** Lấy giá trị trường message. */
    public String getMessage() { return message; }
    /** Gán giá trị mới cho trường message. */
    public void setMessage(String message) { this.message = message; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
