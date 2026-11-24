package com.swp391.scms.audit;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Bảng audit_logs: một dòng nhật ký kiểm toán (người thực hiện, hành động, loại và id bản ghi, giá trị cũ/mới
 * dạng JSON, IP và thời điểm). Ràng buộc CHECK giới hạn các loại bản ghi được phép.
 *
 * Entity ánh xạ bảng audit_logs.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_audit_entity_type", constraints = "entity_type IN ( 'users','members','coaches','receptionists','center_managers', 'membership_packages','membership_subscriptions', 'classes','class_sessions','class_enrollments','class_waitlists', 'center_checkins','session_attendance', 'payments','invoices','invoice_items', 'training_plans','training_plan_items','session_evaluations', 'notifications','support_requests','role_permissions', 'products','product_categories','product_variants','product_orders','coach_bookings' )")
@Table(name = "audit_logs", indexes = @Index(name = "ix_audit_entity", columnList = "entity_type, entity_id"))
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    /** Ánh xạ chỉ đọc để bộ sinh schema tạo fk_audit_user; việc ghi đi qua userId. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private com.swp391.scms.users.entity.User user;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_value")
    private String oldValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_value")
    private String newValue;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường user. */
    public com.swp391.scms.users.entity.User getUser() { return user; }
    /** Gán giá trị mới cho trường user. */
    public void setUser(com.swp391.scms.users.entity.User user) { this.user = user; }
    /** Lấy giá trị trường userId. */
    public Long getUserId() { return userId; }
    /** Gán giá trị mới cho trường userId. */
    public void setUserId(Long userId) { this.userId = userId; }
    /** Lấy giá trị trường action. */
    public String getAction() { return action; }
    /** Gán giá trị mới cho trường action. */
    public void setAction(String action) { this.action = action; }
    /** Lấy giá trị trường entityType. */
    public String getEntityType() { return entityType; }
    /** Gán giá trị mới cho trường entityType. */
    public void setEntityType(String entityType) { this.entityType = entityType; }
    /** Lấy giá trị trường entityId. */
    public Long getEntityId() { return entityId; }
    /** Gán giá trị mới cho trường entityId. */
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    /** Lấy giá trị trường oldValue. */
    public String getOldValue() { return oldValue; }
    /** Gán giá trị mới cho trường oldValue. */
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    /** Lấy giá trị trường newValue. */
    public String getNewValue() { return newValue; }
    /** Gán giá trị mới cho trường newValue. */
    public void setNewValue(String newValue) { this.newValue = newValue; }
    /** Lấy giá trị trường ipAddress. */
    public String getIpAddress() { return ipAddress; }
    /** Gán giá trị mới cho trường ipAddress. */
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
