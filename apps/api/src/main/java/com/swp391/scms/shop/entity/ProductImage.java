package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "product_images",
    indexes = @Index(name = "ix_product_images_product", columnList = "product_id")
)
/** Entity ảnh sản phẩm (bảng product_images) lưu dạng data URL kèm loại nội dung. */
public class ProductImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "data_url", nullable = false, columnDefinition = "TEXT")
    private String dataUrl;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "alt_text", nullable = false, length = 160)
    private String altText;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường product. */
    public Product getProduct() { return product; }
    /** Gán giá trị mới cho trường product. */
    public void setProduct(Product product) { this.product = product; }

    /** Lấy giá trị trường dataUrl. */
    public String getDataUrl() { return dataUrl; }
    /** Gán giá trị mới cho trường dataUrl. */
    public void setDataUrl(String dataUrl) { this.dataUrl = dataUrl; }

    /** Lấy giá trị trường contentType. */
    public String getContentType() { return contentType; }
    /** Gán giá trị mới cho trường contentType. */
    public void setContentType(String contentType) { this.contentType = contentType; }

    /** Lấy giá trị trường altText. */
    public String getAltText() { return altText; }
    /** Gán giá trị mới cho trường altText. */
    public void setAltText(String altText) { this.altText = altText; }

    /** Lấy giá trị trường sortOrder. */
    public int getSortOrder() { return sortOrder; }
    /** Gán giá trị mới cho trường sortOrder. */
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
