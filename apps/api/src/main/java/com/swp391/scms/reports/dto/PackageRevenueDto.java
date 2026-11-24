package com.swp391.scms.reports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/** Doanh thu một gói: id và tên gói, tổng tiền, số lượt mua và tỷ trọng (%) trên tổng doanh thu gói. */
@Schema(description = "Báo cáo doanh thu và tỷ trọng theo từng gói tập")
public class PackageRevenueDto {

    @Schema(description = "ID gói tập", example = "1")
    private Long packageId;

    @Schema(description = "Tên gói tập", example = "Gói Gold 6 Tháng")
    private String packageName;

    @Schema(description = "Tổng doanh thu từ gói này (VNĐ)", example = "45000000.00")
    private BigDecimal revenue;

    @Schema(description = "Số lượng đăng ký gói", example = "15")
    private int subscriptionCount;

    @Schema(description = "Tỷ trọng doanh thu (%) so với tổng", example = "35.5")
    private Double percentage;

    /** Constructor rỗng cho Jackson. */
    public PackageRevenueDto() {}

    /** Tạo dòng doanh thu theo gói. */
    public PackageRevenueDto(Long packageId, String packageName, BigDecimal revenue, int subscriptionCount, Double percentage) {
        this.packageId = packageId;
        this.packageName = packageName;
        this.revenue = revenue;
        this.subscriptionCount = subscriptionCount;
        this.percentage = percentage;
    }

    /** Lấy giá trị trường packageId. */
    public Long getPackageId() { return packageId; }
    /** Gán giá trị mới cho trường packageId. */
    public void setPackageId(Long packageId) { this.packageId = packageId; }

    /** Lấy giá trị trường packageName. */
    public String getPackageName() { return packageName; }
    /** Gán giá trị mới cho trường packageName. */
    public void setPackageName(String packageName) { this.packageName = packageName; }

    /** Lấy giá trị trường revenue. */
    public BigDecimal getRevenue() { return revenue; }
    /** Gán giá trị mới cho trường revenue. */
    public void setRevenue(BigDecimal revenue) { this.revenue = revenue; }

    /** Lấy giá trị trường subscriptionCount. */
    public int getSubscriptionCount() { return subscriptionCount; }
    /** Gán giá trị mới cho trường subscriptionCount. */
    public void setSubscriptionCount(int subscriptionCount) { this.subscriptionCount = subscriptionCount; }

    /** Lấy giá trị trường percentage. */
    public Double getPercentage() { return percentage; }
    /** Gán giá trị mới cho trường percentage. */
    public void setPercentage(Double percentage) { this.percentage = percentage; }
}
