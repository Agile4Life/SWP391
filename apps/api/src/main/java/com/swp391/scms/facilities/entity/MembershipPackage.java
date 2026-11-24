package com.swp391.scms.facilities.entity;

import jakarta.persistence.*;
import com.swp391.scms.users.entity.User;
import org.hibernate.Length;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity ánh xạ bảng membership_packages (Module B: Danh mục cơ sở vật chất): gói tập gồm tên, mô tả, giá, số ngày,
 * hạn mức buổi lớp, trạng thái mở bán, hạng và người tạo.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_packages_status", constraints = "status IN ('active','inactive')")
@Table(name = "membership_packages")
public class MembershipPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = Length.LONG32)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(name = "class_credit_limit")
    private Integer classCreditLimit;

    @Column(nullable = false, length = 20)
    private String status = "active"; // Trạng thái: active, inactive

    @Column(length = 30)
    private String tier; // Hạng gói: SILVER, GOLD, PLATINUM

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** Hibernate gọi trước khi thêm bản ghi: gán thời điểm tạo và cập nhật. */
    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);
    }

    /** Hibernate gọi trước khi cập nhật: cập nhật thời điểm sửa. */
    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }
    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }
    /** Lấy giá trị trường price. */
    public BigDecimal getPrice() { return price; }
    /** Gán giá trị mới cho trường price. */
    public void setPrice(BigDecimal price) { this.price = price; }
    /** Lấy giá trị trường durationDays. */
    public int getDurationDays() { return durationDays; }
    /** Gán giá trị mới cho trường durationDays. */
    public void setDurationDays(int durationDays) { this.durationDays = durationDays; }
    /** Lấy giá trị trường classCreditLimit. */
    public Integer getClassCreditLimit() { return classCreditLimit; }
    /** Gán giá trị mới cho trường classCreditLimit. */
    public void setClassCreditLimit(Integer classCreditLimit) { this.classCreditLimit = classCreditLimit; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường tier. */
    public String getTier() { return tier; }
    /** Gán giá trị mới cho trường tier. */
    public void setTier(String tier) { this.tier = tier; }
    /** Lấy giá trị trường createdBy. */
    public User getCreatedBy() { return createdBy; }
    /** Gán giá trị mới cho trường createdBy. */
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
}
