package com.swp391.scms.notifications.entity;

import com.swp391.scms.common.CenterTime;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Bảng notifications: thông báo trong ứng dụng của một người dùng (tiêu đề, nội dung, loại, bản ghi liên quan,
 * đã đọc, thời điểm tạo, đường dẫn mở trang). Loại và loại bản ghi bị giới hạn theo danh sách cho phép.
 */
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
    private LocalDateTime createdAt = LocalDateTime.now(CenterTime.ZONE);

    @Column(name = "action_path", length = 500)
    private String actionPath;

    /** Lấy giá trị trường actionPath. */
    public String getActionPath() { return actionPath; }
    /** Gán giá trị mới cho trường actionPath. */
    public void setActionPath(String actionPath) { this.actionPath = actionPath; }

    public static final int MAX_TITLE_LENGTH = 150;

    public static final java.util.Set<String> ALLOWED_TYPES = java.util.Set.of(
            "schedule_change", "package_expiry", "class_reminder", "system", "support_reply", "payment"
    );

    public static final java.util.Set<String> ALLOWED_ENTITY_TYPES = java.util.Set.of(
            "class_session", "membership_subscription", "payment", "support_request", "class_enrollment", "training_plan"
    );

    /** Giới hạn tiêu đề tối đa 150 ký tự khớp độ dài cột DB (P3-BE-20). */
    public static String clampTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.length() <= MAX_TITLE_LENGTH) {
            return rawTitle;
        }
        return rawTitle.substring(0, MAX_TITLE_LENGTH);
    }

    /**
     * Chuẩn hóa loại thông báo về danh sách cho phép (không phân biệt hoa thường): order/wallet thành payment,
     * booking thành class_reminder, còn lại không hợp lệ thành system.
     */
    public static String normalizeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "system";
        }
        String normalized = rawType.trim().toLowerCase(Locale.ROOT);
        if (ALLOWED_TYPES.contains(normalized)) {
            return normalized;
        }
        if ("order".equals(normalized) || "wallet".equals(normalized)) {
            return "payment";
        }
        if ("booking".equals(normalized)) {
            return "class_reminder";
        }
        return "system";
    }

    /**
     * Chuẩn hóa loại bản ghi liên quan (không phân biệt hoa thường): wallet/product_order thành payment,
     * booking/session_booking thành class_session, không hợp lệ thành null.
     */
    public static String normalizeEntityType(String rawEntityType) {
        if (rawEntityType == null || rawEntityType.isBlank()) {
            return null;
        }
        String normalized = rawEntityType.trim().toLowerCase(Locale.ROOT);
        if (ALLOWED_ENTITY_TYPES.contains(normalized)) {
            return normalized;
        }
        if ("wallet".equals(normalized) || "product_order".equals(normalized)) {
            return "payment";
        }
        if ("booking".equals(normalized) || "session_booking".equals(normalized)) {
            return "class_session";
        }
        return null;
    }

    /** Constructor rỗng cho JPA. */
    public Notification() {}

    /** Tạo thông báo chưa đọc với tiêu đề đã giới hạn 150 ký tự, loại và loại bản ghi đã chuẩn hóa. */
    public Notification(User user, String title, String message, String type, String relatedEntityType, Long relatedEntityId) {
        this.user = user;
        this.title = clampTitle(title);
        this.message = message;
        this.type = normalizeType(type);
        this.relatedEntityType = normalizeEntityType(relatedEntityType);
        this.relatedEntityId = relatedEntityId;
        this.isRead = false;
        this.createdAt = LocalDateTime.now(CenterTime.ZONE);
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
    /** Gán giá trị mới cho trường title (giới hạn 150 ký tự). */
    public void setTitle(String title) { this.title = clampTitle(title); }
    
    /** Lấy giá trị trường message. */
    public String getMessage() { return message; }
    /** Gán giá trị mới cho trường message. */
    public void setMessage(String message) { this.message = message; }
    
    /** Lấy giá trị trường type. */
    public String getType() { return type; }
    /** Gán loại thông báo (được chuẩn hóa). */
    public void setType(String type) { this.type = normalizeType(type); }
    
    /** Lấy giá trị trường relatedEntityType. */
    public String getRelatedEntityType() { return relatedEntityType; }
    /** Gán loại bản ghi liên quan (được chuẩn hóa). */
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
