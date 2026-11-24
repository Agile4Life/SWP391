package com.swp391.scms.reports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Doanh thu một ngày: ngày, tổng tiền thực thu và số giao dịch. */
@Schema(description = "Báo cáo doanh thu tài chính theo từng ngày")
public class DailyRevenueDto {

    @Schema(description = "Ngày ghi nhận doanh thu", example = "2026-10-05")
    private LocalDate date;

    @Schema(description = "Tổng doanh thu trong ngày (VNĐ)", example = "15000000.00")
    private BigDecimal revenue;

    @Schema(description = "Số lượng giao dịch thành công trong ngày", example = "12")
    private int transactionCount;

    /** Constructor rỗng cho Jackson. */
    public DailyRevenueDto() {}

    /** Tạo dòng doanh thu theo ngày. */
    public DailyRevenueDto(LocalDate date, BigDecimal revenue, int transactionCount) {
        this.date = date;
        this.revenue = revenue;
        this.transactionCount = transactionCount;
    }

    /** Lấy giá trị trường date. */
    public LocalDate getDate() { return date; }
    /** Gán giá trị mới cho trường date. */
    public void setDate(LocalDate date) { this.date = date; }

    /** Lấy giá trị trường revenue. */
    public BigDecimal getRevenue() { return revenue; }
    /** Gán giá trị mới cho trường revenue. */
    public void setRevenue(BigDecimal revenue) { this.revenue = revenue; }

    /** Lấy giá trị trường transactionCount. */
    public int getTransactionCount() { return transactionCount; }
    /** Gán giá trị mới cho trường transactionCount. */
    public void setTransactionCount(int transactionCount) { this.transactionCount = transactionCount; }
}
