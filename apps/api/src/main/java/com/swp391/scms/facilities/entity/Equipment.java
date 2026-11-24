package com.swp391.scms.facilities.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Entity mapping table equipment (Quản lý máy móc, trang thiết bị phòng gym).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_equipment_status", constraints = "status IN ('active','maintenance','broken','retired')")
@Table(name = "equipment", indexes = {
        @Index(name = "ix_equipment_room", columnList = "room_id"),
        @Index(name = "ix_equipment_status", columnList = "status")
})
/** Bảng equipment: thiết bị (tên, mã, loại, phòng, số lượng, trạng thái, ngày mua/bảo trì, ghi chú). */
public class Equipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 60, unique = true)
    private String code;

    @Column(length = 80)
    private String category; // Cardio, Strength, Free Weights, Diagnostic, Recovery

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(nullable = false)
    private int quantity = 1;

    @Column(nullable = false, length = 30)
    private String status = "active"; // active, maintenance, broken, retired

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "maintenance_date")
    private LocalDate maintenanceDate;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);

    /** Hibernate gọi trước khi cập nhật: cập nhật thời điểm sửa. */
    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);
    }

    /** Constructor rỗng cho JPA. */
    public Equipment() {}

    /** Tạo thiết bị với thông tin cơ bản. */
    public Equipment(String name, String code, String category, Room room, int quantity, String status) {
        this.name = name;
        this.code = code;
        this.category = category;
        this.room = room;
        this.quantity = quantity;
        this.status = status != null ? status : "active";
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }
    /** Lấy giá trị trường code. */
    public String getCode() { return code; }
    /** Gán giá trị mới cho trường code. */
    public void setCode(String code) { this.code = code; }
    /** Lấy giá trị trường category. */
    public String getCategory() { return category; }
    /** Gán giá trị mới cho trường category. */
    public void setCategory(String category) { this.category = category; }
    /** Lấy giá trị trường room. */
    public Room getRoom() { return room; }
    /** Gán giá trị mới cho trường room. */
    public void setRoom(Room room) { this.room = room; }
    /** Lấy giá trị trường quantity. */
    public int getQuantity() { return quantity; }
    /** Gán giá trị mới cho trường quantity. */
    public void setQuantity(int quantity) { this.quantity = quantity; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường purchaseDate. */
    public LocalDate getPurchaseDate() { return purchaseDate; }
    /** Gán giá trị mới cho trường purchaseDate. */
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }
    /** Lấy giá trị trường maintenanceDate. */
    public LocalDate getMaintenanceDate() { return maintenanceDate; }
    /** Gán giá trị mới cho trường maintenanceDate. */
    public void setMaintenanceDate(LocalDate maintenanceDate) { this.maintenanceDate = maintenanceDate; }
    /** Lấy giá trị trường note. */
    public String getNote() { return note; }
    /** Gán giá trị mới cho trường note. */
    public void setNote(String note) { this.note = note; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}

