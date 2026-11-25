package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "product_categories",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_product_categories_slug", columnNames = "slug"),
        @UniqueConstraint(name = "uq_product_categories_name", columnNames = "name")
    }
)
/** Entity danh mục sản phẩm (bảng product_categories): tên, slug, thứ tự hiển thị và trạng thái hoạt động. */
public class ProductCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 80)
    private String slug;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }

    /** Lấy giá trị trường slug. */
    public String getSlug() { return slug; }
    /** Gán giá trị mới cho trường slug. */
    public void setSlug(String slug) { this.slug = slug; }

    /** Lấy giá trị trường sortOrder. */
    public int getSortOrder() { return sortOrder; }
    /** Gán giá trị mới cho trường sortOrder. */
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    /** Cho biết active (trường boolean). */
    public boolean isActive() { return active; }
    /** Gán giá trị mới cho trường active. */
    public void setActive(boolean active) { this.active = active; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
