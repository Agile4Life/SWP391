package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.hibernate.annotations.Check;

@Entity
@Table(
    name = "product_variants",
    uniqueConstraints = @UniqueConstraint(name = "uq_product_variants_sku", columnNames = "sku"),
    indexes = @Index(name = "ix_product_variants_product", columnList = "product_id")
)
/**
 * Entity biến thể sản phẩm (bảng product_variants): SKU, nhãn, giá, số khẩu phần mỗi hộp, tồn kho, trạng thái
 * và thứ tự.
 */
@Check(name = "ck_product_variants_stock_nonneg", constraints = "stock >= 0 and price > 0")
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 40)
    private String sku;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "servings_per_container")
    private Integer servingsPerContainer;

    @Column(nullable = false)
    private int stock;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** Giá mỗi khẩu phần = giá / số khẩu phần (làm tròn tới đồng); thiếu dữ liệu thì trả null. */
    public BigDecimal pricePerServing() {
        return servingsPerContainer == null || servingsPerContainer < 1 || price == null
                ? null
                : price.divide(BigDecimal.valueOf(servingsPerContainer), 0, RoundingMode.HALF_UP);
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường product. */
    public Product getProduct() { return product; }
    /** Gán giá trị mới cho trường product. */
    public void setProduct(Product product) { this.product = product; }

    /** Lấy giá trị trường sku. */
    public String getSku() { return sku; }
    /** Gán giá trị mới cho trường sku. */
    public void setSku(String sku) { this.sku = sku; }

    /** Lấy giá trị trường label. */
    public String getLabel() { return label; }
    /** Gán giá trị mới cho trường label. */
    public void setLabel(String label) { this.label = label; }

    /** Lấy giá trị trường price. */
    public BigDecimal getPrice() { return price; }
    /** Gán giá trị mới cho trường price. */
    public void setPrice(BigDecimal price) { this.price = price; }

    /** Lấy giá trị trường servingsPerContainer. */
    public Integer getServingsPerContainer() { return servingsPerContainer; }
    /** Gán giá trị mới cho trường servingsPerContainer. */
    public void setServingsPerContainer(Integer servingsPerContainer) { this.servingsPerContainer = servingsPerContainer; }

    /** Lấy giá trị trường stock. */
    public int getStock() { return stock; }
    /** Gán giá trị mới cho trường stock. */
    public void setStock(int stock) { this.stock = stock; }

    /** Cho biết active (trường boolean). */
    public boolean isActive() { return active; }
    /** Gán giá trị mới cho trường active. */
    public void setActive(boolean active) { this.active = active; }

    /** Lấy giá trị trường sortOrder. */
    public int getSortOrder() { return sortOrder; }
    /** Gán giá trị mới cho trường sortOrder. */
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
