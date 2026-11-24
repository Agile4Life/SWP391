package com.swp391.scms.notifications.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@org.hibernate.annotations.Check(name = "ck_notifications_type", constraints = "type IN ('schedule_change','package_expiry','class_reminder','system','support_reply','payment')")
@org.hibernate.annotations.Check(name = "ck_notifications_entity_type", constraints = "related_entity_type IS NULL OR related_entity_type IN ('class_session','membership_subscription','payment','support_request','class_enrollment','training_plan')")
@Table(name = "notifications")
public class Notification {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "content", nullable = false, length = org.hibernate.Length.LONG32)
    private String message;

    @Column(nullable = false, length = 30)
    private String type; 

    @Column(name = "related_entity_type", length = 50)
    private String relatedEntityType;

    @Column(name = "related_entity_id")
    private Long relatedEntityId;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "action_path", length = 500)
    private String actionPath;

    /** Lấy giá trị trường actionPath. */
    public String getActionPath() { return actionPath; }
    /** Gán giá trị mới cho trường actionPath. */
    public void setActionPath(String actionPath) { this.actionPath = actionPath; }

    public static final java.util.Set<String> ALLOWED_TYPES = java.util.Set.of(
            "schedule_change", "package_expiry", "class_reminder", "system", "support_reply", "payment"
    );

    public static final java.util.Set<String> ALLOWED_ENTITY_TYPES = java.util.Set.of(
            "class_session", "membership_subscription", "payment", "support_request", "class_enrollment", "training_plan"
    );

    public static String normalizeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "system";
        }
        String trimmed = rawType.trim();
        if (ALLOWED_TYPES.contains(trimmed)) {
            return trimmed;
        }
        if ("order".equalsIgnoreCase(trimmed) || "wallet".equalsIgnoreCase(trimmed)) {
            return "payment";
        }
        if ("booking".equalsIgnoreCase(trimmed)) {
            return "class_reminder";
        }
        return "system";
    }

    public static String normalizeEntityType(String rawEntityType) {
        if (rawEntityType == null || rawEntityType.isBlank()) {
            return null;
        }
        String trimmed = rawEntityType.trim();
        if (ALLOWED_ENTITY_TYPES.contains(trimmed)) {
            return trimmed;
        }
        if ("wallet".equalsIgnoreCase(trimmed) || "product_order".equalsIgnoreCase(trimmed)) {
            return "payment";
        }
        if ("booking".equalsIgnoreCase(trimmed) || "session_booking".equalsIgnoreCase(trimmed)) {
            return "class_session";
        }
        return null;
    }

    public Notification() {}

    public Notification(User user, String title, String message, String type, String relatedEntityType, Long relatedEntityId) {
        this.user = user;
        this.title = title;
        this.message = message;
        this.type = normalizeType(type);
        this.relatedEntityType = normalizeEntityType(relatedEntityType);
        this.relatedEntityId = relatedEntityId;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    
    /** Lấy giá trị trường user. */
    public User getUser() { return user; }
    /** Gán giá trị mới cho trường user. */
    public void setUser(User user) { this.user = user; }
    
    /** Lấy giá trị trường title. */
    public String getTitle() { return title; }
    /** Gán giá trị mới cho trường title. */
    public void setTitle(String title) { this.title = title; }
    
    /** Lấy giá trị trường message. */
    public String getMessage() { return message; }
    /** Gán giá trị mới cho trường message. */
    public void setMessage(String message) { this.message = message; }
    
    /** Lấy giá trị trường type. */
    public String getType() { return type; }
    public void setType(String type) { this.type = normalizeType(type); }
    
    /** Lấy giá trị trường relatedEntityType. */
    public String getRelatedEntityType() { return relatedEntityType; }
    public void setRelatedEntityType(String relatedEntityType) { this.relatedEntityType = normalizeEntityType(relatedEntityType); }

    /** Lấy giá trị trường relatedEntityId. */
    public Long getRelatedEntityId() { return relatedEntityId; }
    /** Gán giá trị mới cho trường relatedEntityId. */
    public void setRelatedEntityId(Long relatedEntityId) { this.relatedEntityId = relatedEntityId; }
    
    /** Cho biết read (trường boolean). */
    public boolean isRead() { return isRead; }
    /** Gán giá trị mới cho trường read. */
    public void setRead(boolean read) { this.isRead = read; }
    
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
