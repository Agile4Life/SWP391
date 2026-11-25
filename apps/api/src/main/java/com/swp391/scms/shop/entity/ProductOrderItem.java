package com.swp391.scms.shop.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Check;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Entity
@Table(
    name = "product_order_items",
    indexes = @Index(name = "ix_product_order_items_order", columnList = "order_id")
)
/**
 * Entity một dòng sản phẩm trong đơn (bảng product_order_items): biến thể, tên/nhãn/SKU chụp lại tại lúc đặt,
 * đơn giá, số lượng, thành tiền.
 */
@Check(name = "ck_product_order_items_qty", constraints = "quantity between 1 and 20")
public class ProductOrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private ProductOrder order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @Column(name = "product_name", nullable = false, length = 160)
    private String productName;

    @Column(name = "variant_label", nullable = false, length = 80)
    private String variantLabel;

    @Column(nullable = false, length = 40)
    private String sku;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "line_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;

    /** Tạo dòng đơn từ biến thể: chụp lại tên, nhãn, SKU, đơn giá làm tròn tới đồng và tính thành tiền. */
    public static ProductOrderItem snapshot(ProductVariant variant, int quantity) {
        ProductOrderItem item = new ProductOrderItem();
        item.setVariant(variant);
        item.setProductName(variant.getProduct() == null ? "" : variant.getProduct().getName());
        item.setVariantLabel(variant.getLabel());
        item.setSku(variant.getSku());
        BigDecimal unit = variant.getPrice().setScale(0, RoundingMode.HALF_UP);
        item.setUnitPrice(unit);
        item.setQuantity(quantity);
        item.setLineTotal(unit.multiply(BigDecimal.valueOf(quantity)));
        return item;
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường order. */
    public ProductOrder getOrder() { return order; }
    /** Gán giá trị mới cho trường order. */
    public void setOrder(ProductOrder order) { this.order = order; }

    /** Lấy giá trị trường variant. */
    public ProductVariant getVariant() { return variant; }
    /** Gán giá trị mới cho trường variant. */
    public void setVariant(ProductVariant variant) { this.variant = variant; }

    /** Lấy giá trị trường productName. */
    public String getProductName() { return productName; }
    /** Gán giá trị mới cho trường productName. */
    public void setProductName(String productName) { this.productName = productName; }

    /** Lấy giá trị trường variantLabel. */
    public String getVariantLabel() { return variantLabel; }
    /** Gán giá trị mới cho trường variantLabel. */
    public void setVariantLabel(String variantLabel) { this.variantLabel = variantLabel; }

    /** Lấy giá trị trường sku. */
    public String getSku() { return sku; }
    /** Gán giá trị mới cho trường sku. */
    public void setSku(String sku) { this.sku = sku; }

    /** Lấy giá trị trường unitPrice. */
    public BigDecimal getUnitPrice() { return unitPrice; }
    /** Gán giá trị mới cho trường unitPrice. */
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    /** Lấy giá trị trường quantity. */
    public int getQuantity() { return quantity; }
    /** Gán giá trị mới cho trường quantity. */
    public void setQuantity(int quantity) { this.quantity = quantity; }

    /** Lấy giá trị trường lineTotal. */
    public BigDecimal getLineTotal() { return lineTotal; }
    /** Gán giá trị mới cho trường lineTotal. */
    public void setLineTotal(BigDecimal lineTotal) { this.lineTotal = lineTotal; }
}
