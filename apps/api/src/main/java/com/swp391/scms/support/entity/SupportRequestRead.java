package com.swp391.scms.support.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Mốc đọc riêng cho mỗi lễ tân; không có bản ghi nghĩa là mô tả ban đầu chưa đọc. */
@Entity
@Table(name = "support_request_reads", uniqueConstraints = @UniqueConstraint(
        name = "uq_support_request_read_user", columnNames = {"support_request_id", "user_id"}))
@Check(constraints = "last_message_id >= 0")
public class SupportRequestRead {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "support_request_id", nullable = false)
    private SupportRequest supportRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "last_message_id", nullable = false)
    private long lastMessageId;

    protected SupportRequestRead() {}

    public SupportRequestRead(SupportRequest ticket, User user, long cursor) {
        this.supportRequest = ticket;
        this.user = user;
        this.lastMessageId = cursor;
    }

    public long getLastMessageId() {
        return lastMessageId;
    }

    public void advanceTo(long cursor) {
        lastMessageId = Math.max(lastMessageId, cursor);
    }
}
