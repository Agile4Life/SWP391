package com.swp391.scms.shop.entity;

import com.swp391.scms.shop.service.AddressService.ShippingSnapshot;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.Check;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "product_orders",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_product_orders_code", columnNames = "code"),
        @UniqueConstraint(name = "uq_product_orders_member_request", columnNames = {"member_id", "client_request_id"})
    },
    indexes = {
        @Index(name = "ix_product_orders_member_created", columnList = "member_id, created_at"),
        @Index(name = "ix_product_orders_status_created", columnList = "status, created_at")
    }
)
@Check(name = "ck_product_orders_total", constraints = "total = subtotal + shipping_fee")
public class ProductOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "client_request_id", nullable = false, length = 36)
    private String clientRequestId;

    @Column(nullable = false, length = 20)
    private String status = OrderStatus.pending_payment.name();

    @Column(nullable = false, length = 10)
    private String fulfillment;

    @Column(name = "payment_method", nullable = false, length = 10)
    private String paymentMethod;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "shipping_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    /** Tier discount already taken off {@code subtotal}; kept for reconciliation (list price = subtotal + amount). */
    @Column(name = "member_discount_percent")
    private Integer memberDiscountPercent;

    @Column(name = "member_discount_amount", precision = 12, scale = 2)
    private BigDecimal memberDiscountAmount;

    @Column(name = "ship_recipient_name", length = 80)
    private String shipRecipientName;

    @Column(name = "ship_phone", length = 15)
    private String shipPhone;

    @Column(name = "ship_province_name", length = 80)
    private String shipProvinceName;

    @Column(name = "ship_ward_name", length = 80)
    private String shipWardName;

    @Column(name = "ship_street_line", length = 200)
    private String shipStreetLine;

    @Column(name = "ship_note", length = 200)
    private String shipNote;

    @Column(name = "payment_due_at")
    private LocalDateTime paymentDueAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "processing_at")
    private LocalDateTime processingAt;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "ready_at")
    private LocalDateTime readyAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "cancelled_by_id")
    private Long cancelledById;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_id", insertable = false, updatable = false)
    private User cancelledBy;

    @Column(name = "tracking_carrier", length = 60)
    private String trackingCarrier;

    @Column(name = "tracking_number", length = 60)
    private String trackingNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ProductOrderItem> items = new ArrayList<>();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void applyShipping(ShippingSnapshot ship) {
        if (ship == null) {
            this.shipRecipientName = null;
            this.shipPhone = null;
            this.shipProvinceName = null;
            this.shipWardName = null;
            this.shipStreetLine = null;
            this.shipNote = null;
        } else {
            this.shipRecipientName = ship.recipientName();
            this.shipPhone = ship.phone();
            this.shipProvinceName = ship.provinceName();
            this.shipWardName = ship.wardName();
            this.shipStreetLine = ship.streetLine();
            this.shipNote = ship.note();
        }
    }

    public void addItem(ProductOrderItem item) {
        if (item != null) {
            item.setOrder(this);
            this.items.add(item);
        }
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường code. */
    public String getCode() { return code; }
    /** Gán giá trị mới cho trường code. */
    public void setCode(String code) { this.code = code; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường clientRequestId. */
    public String getClientRequestId() { return clientRequestId; }
    /** Gán giá trị mới cho trường clientRequestId. */
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }

    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }

    /** Lấy giá trị trường fulfillment. */
    public String getFulfillment() { return fulfillment; }
    /** Gán giá trị mới cho trường fulfillment. */
    public void setFulfillment(String fulfillment) { this.fulfillment = fulfillment; }

    /** Lấy giá trị trường paymentMethod. */
    public String getPaymentMethod() { return paymentMethod; }
    /** Gán giá trị mới cho trường paymentMethod. */
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    /** Lấy giá trị trường memberDiscountPercent. */
    public Integer getMemberDiscountPercent() { return memberDiscountPercent; }
    /** Gán giá trị mới cho trường memberDiscountPercent. */
    public void setMemberDiscountPercent(Integer value) { this.memberDiscountPercent = value; }
    /** Lấy giá trị trường memberDiscountAmount. */
    public BigDecimal getMemberDiscountAmount() { return memberDiscountAmount; }
    /** Gán giá trị mới cho trường memberDiscountAmount. */
    public void setMemberDiscountAmount(BigDecimal value) { this.memberDiscountAmount = value; }
    /** Lấy giá trị trường subtotal. */
    public BigDecimal getSubtotal() { return subtotal; }
    /** Gán giá trị mới cho trường subtotal. */
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    /** Lấy giá trị trường shippingFee. */
    public BigDecimal getShippingFee() { return shippingFee; }
    /** Gán giá trị mới cho trường shippingFee. */
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee; }

    /** Lấy giá trị trường total. */
    public BigDecimal getTotal() { return total; }
    /** Gán giá trị mới cho trường total. */
    public void setTotal(BigDecimal total) { this.total = total; }

    /** Lấy giá trị trường shipRecipientName. */
    public String getShipRecipientName() { return shipRecipientName; }
    /** Gán giá trị mới cho trường shipRecipientName. */
    public void setShipRecipientName(String shipRecipientName) { this.shipRecipientName = shipRecipientName; }

    /** Lấy giá trị trường shipPhone. */
    public String getShipPhone() { return shipPhone; }
    /** Gán giá trị mới cho trường shipPhone. */
    public void setShipPhone(String shipPhone) { this.shipPhone = shipPhone; }

    /** Lấy giá trị trường shipProvinceName. */
    public String getShipProvinceName() { return shipProvinceName; }
    /** Gán giá trị mới cho trường shipProvinceName. */
    public void setShipProvinceName(String shipProvinceName) { this.shipProvinceName = shipProvinceName; }

    /** Lấy giá trị trường shipWardName. */
    public String getShipWardName() { return shipWardName; }
    /** Gán giá trị mới cho trường shipWardName. */
    public void setShipWardName(String shipWardName) { this.shipWardName = shipWardName; }

    /** Lấy giá trị trường shipStreetLine. */
    public String getShipStreetLine() { return shipStreetLine; }
    /** Gán giá trị mới cho trường shipStreetLine. */
    public void setShipStreetLine(String shipStreetLine) { this.shipStreetLine = shipStreetLine; }

    /** Lấy giá trị trường shipNote. */
    public String getShipNote() { return shipNote; }
    /** Gán giá trị mới cho trường shipNote. */
    public void setShipNote(String shipNote) { this.shipNote = shipNote; }

    /** Lấy giá trị trường paymentDueAt. */
    public LocalDateTime getPaymentDueAt() { return paymentDueAt; }
    /** Gán giá trị mới cho trường paymentDueAt. */
    public void setPaymentDueAt(LocalDateTime paymentDueAt) { this.paymentDueAt = paymentDueAt; }

    /** Lấy giá trị trường paidAt. */
    public LocalDateTime getPaidAt() { return paidAt; }
    /** Gán giá trị mới cho trường paidAt. */
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }

    /** Lấy giá trị trường processingAt. */
    public LocalDateTime getProcessingAt() { return processingAt; }
    /** Gán giá trị mới cho trường processingAt. */
    public void setProcessingAt(LocalDateTime processingAt) { this.processingAt = processingAt; }

    /** Lấy giá trị trường shippedAt. */
    public LocalDateTime getShippedAt() { return shippedAt; }
    /** Gán giá trị mới cho trường shippedAt. */
    public void setShippedAt(LocalDateTime shippedAt) { this.shippedAt = shippedAt; }

    /** Lấy giá trị trường readyAt. */
    public LocalDateTime getReadyAt() { return readyAt; }
    /** Gán giá trị mới cho trường readyAt. */
    public void setReadyAt(LocalDateTime readyAt) { this.readyAt = readyAt; }

    /** Lấy giá trị trường completedAt. */
    public LocalDateTime getCompletedAt() { return completedAt; }
    /** Gán giá trị mới cho trường completedAt. */
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    /** Lấy giá trị trường cancelledAt. */
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    /** Gán giá trị mới cho trường cancelledAt. */
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }

    /** Lấy giá trị trường cancelReason. */
    public String getCancelReason() { return cancelReason; }
    /** Gán giá trị mới cho trường cancelReason. */
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }

    /** Lấy giá trị trường cancelledById. */
    public Long getCancelledById() { return cancelledById; }
    /** Gán giá trị mới cho trường cancelledById. */
    public void setCancelledById(Long cancelledById) { this.cancelledById = cancelledById; }

    /** Lấy giá trị trường cancelledBy. */
    public User getCancelledBy() { return cancelledBy; }
    public void setCancelledBy(User cancelledBy) {
        this.cancelledBy = cancelledBy;
        this.cancelledById = cancelledBy == null ? null : cancelledBy.getId();
    }

    /** Lấy giá trị trường trackingCarrier. */
    public String getTrackingCarrier() { return trackingCarrier; }
    /** Gán giá trị mới cho trường trackingCarrier. */
    public void setTrackingCarrier(String trackingCarrier) { this.trackingCarrier = trackingCarrier; }

    /** Lấy giá trị trường trackingNumber. */
    public String getTrackingNumber() { return trackingNumber; }
    /** Gán giá trị mới cho trường trackingNumber. */
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /** Lấy giá trị trường items. */
    public List<ProductOrderItem> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(List<ProductOrderItem> items) { this.items = items; }
}
