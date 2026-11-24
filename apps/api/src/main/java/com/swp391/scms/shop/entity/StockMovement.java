package com.swp391.scms.shop.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "product_stock_movements",
    indexes = @Index(name = "ix_stock_movements_variant", columnList = "variant_id, created_at")
)
public class StockMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @Column(nullable = false)
    private int delta;

    @Column(nullable = false, length = 20)
    private String reason;

    @Column(name = "order_id")
    private Long orderId;

    @Column(length = 200)
    private String note;

    @Column(name = "actor_id")
    private Long actorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", insertable = false, updatable = false)
    private User actor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường variant. */
    public ProductVariant getVariant() { return variant; }
    /** Gán giá trị mới cho trường variant. */
    public void setVariant(ProductVariant variant) { this.variant = variant; }

    /** Lấy giá trị trường delta. */
    public int getDelta() { return delta; }
    /** Gán giá trị mới cho trường delta. */
    public void setDelta(int delta) { this.delta = delta; }

    /** Lấy giá trị trường reason. */
    public String getReason() { return reason; }
    /** Gán giá trị mới cho trường reason. */
    public void setReason(String reason) { this.reason = reason; }

    /** Lấy giá trị trường orderId. */
    public Long getOrderId() { return orderId; }
    /** Gán giá trị mới cho trường orderId. */
    public void setOrderId(Long orderId) { this.orderId = orderId; }

    /** Lấy giá trị trường note. */
    public String getNote() { return note; }
    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) { this.note = note; }

    /** Lấy giá trị trường actorId. */
    public Long getActorId() { return actorId; }
    /** Gán giá trị mới cho trường actorId. */
    public void setActorId(Long actorId) { this.actorId = actorId; }

    /** Lấy giá trị trường actor. */
    public User getActor() { return actor; }
    /** Gán giá trị mới cho trường actor. */
    public void setActor(User actor) {
        this.actor = actor;
        this.actorId = actor == null ? null : actor.getId();
    }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
