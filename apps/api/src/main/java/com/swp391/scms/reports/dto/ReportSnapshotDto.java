package com.swp391.scms.reports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Schema(description = "Thông tin chi tiết ảnh chụp báo cáo")
public class ReportSnapshotDto {

    @Schema(description = "ID ảnh chụp báo cáo", example = "1")
    private Long id;

    @Schema(description = "Loại báo cáo", example = "REVENUE_DAILY")
    private String reportType;

    @Schema(description = "Ngày bắt đầu kỳ", example = "2026-10-01")
    private LocalDate periodStart;

    @Schema(description = "Ngày kết thúc kỳ", example = "2026-10-31")
    private LocalDate periodEnd;

    @Schema(description = "Dữ liệu báo cáo dạng JSON")
    private String data;

    @Schema(description = "ID người khởi tạo", example = "1")
    private Long generatedById;

    @Schema(description = "Họ tên người khởi tạo", example = "Quản lý Nguyễn Văn A")
    private String generatedByName;

    @Schema(description = "Thời điểm lưu ảnh chụp báo cáo")
    private LocalDateTime generatedAt;

    public ReportSnapshotDto() {}

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường reportType. */
    public String getReportType() { return reportType; }
    /** Gán giá trị mới cho trường reportType. */
    public void setReportType(String reportType) { this.reportType = reportType; }

    /** Lấy giá trị trường periodStart. */
    public LocalDate getPeriodStart() { return periodStart; }
    /** Gán giá trị mới cho trường periodStart. */
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }

    /** Lấy giá trị trường periodEnd. */
    public LocalDate getPeriodEnd() { return periodEnd; }
    /** Gán giá trị mới cho trường periodEnd. */
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }

    /** Lấy giá trị trường data. */
    public String getData() { return data; }
    /** Gán giá trị mới cho trường data. */
    public void setData(String data) { this.data = data; }

    /** Lấy giá trị trường generatedById. */
    public Long getGeneratedById() { return generatedById; }
    /** Gán giá trị mới cho trường generatedById. */
    public void setGeneratedById(Long generatedById) { this.generatedById = generatedById; }

    /** Lấy giá trị trường generatedByName. */
    public String getGeneratedByName() { return generatedByName; }
    /** Gán giá trị mới cho trường generatedByName. */
    public void setGeneratedByName(String generatedByName) { this.generatedByName = generatedByName; }

    /** Lấy giá trị trường generatedAt. */
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    /** Gán giá trị mới cho trường generatedAt. */
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
}
