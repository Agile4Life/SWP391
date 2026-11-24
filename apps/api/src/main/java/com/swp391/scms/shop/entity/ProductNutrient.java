package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "product_nutrients",
    indexes = @Index(name = "ix_product_nutrients_product", columnList = "product_id")
)
public class ProductNutrient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 12)
    private String unit;

    @Column(name = "daily_value_percent")
    private Integer dailyValuePercent;

    @Column(name = "sub_row", nullable = false)
    private boolean subRow;

    @Column(nullable = false)
    private boolean highlight;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường product. */
    public Product getProduct() { return product; }
    /** Gán giá trị mới cho trường product. */
    public void setProduct(Product product) { this.product = product; }

    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }

    /** Lấy giá trị trường amount. */
    public BigDecimal getAmount() { return amount; }
    /** Gán giá trị mới cho trường amount. */
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    /** Lấy giá trị trường unit. */
    public String getUnit() { return unit; }
    /** Gán giá trị mới cho trường unit. */
    public void setUnit(String unit) { this.unit = unit; }

    /** Lấy giá trị trường dailyValuePercent. */
    public Integer getDailyValuePercent() { return dailyValuePercent; }
    /** Gán giá trị mới cho trường dailyValuePercent. */
    public void setDailyValuePercent(Integer dailyValuePercent) { this.dailyValuePercent = dailyValuePercent; }

    /** Cho biết sub row (trường boolean). */
    public boolean isSubRow() { return subRow; }
    /** Gán giá trị mới cho trường subRow. */
    public void setSubRow(boolean subRow) { this.subRow = subRow; }

    /** Cho biết highlight (trường boolean). */
    public boolean isHighlight() { return highlight; }
    /** Gán giá trị mới cho trường highlight. */
    public void setHighlight(boolean highlight) { this.highlight = highlight; }

    /** Lấy giá trị trường sortOrder. */
    public int getSortOrder() { return sortOrder; }
    /** Gán giá trị mới cho trường sortOrder. */
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
