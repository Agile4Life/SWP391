package com.swp391.scms.reports.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

@Schema(description = "Yêu cầu lưu ảnh chụp báo cáo định kỳ")
public class ReportSnapshotCreateDto {

    @NotBlank(message = "{validation.reports.report_type.not_blank}")
    @jakarta.validation.constraints.Pattern(regexp = "(?i)^(revenue|membership|class_utilization)$", message = "{validation.reports.type.pattern}")
    @Schema(description = "Loại báo cáo (revenue, membership, class_utilization)", example = "revenue")
    private String reportType;

    @NotNull(message = "{validation.reports.period_start.not_null}")
    @Schema(description = "Ngày bắt đầu kỳ báo cáo", example = "2026-10-01")
    private LocalDate periodStart;

    @NotNull(message = "{validation.reports.period_end.not_null}")
    @Schema(description = "Ngày kết thúc kỳ báo cáo", example = "2026-10-31")
    private LocalDate periodEnd;

    @NotBlank(message = "{validation.reports.data.not_blank}")
    @Schema(description = "Dữ liệu báo cáo dạng JSON", example = "{\"totalRevenue\": 150000000, \"totalOrders\": 120}")
    private String data;

    @Schema(description = "ID người thực hiện tạo báo cáo (tùy chọn)", example = "1")
    private Long generatedById;

    public ReportSnapshotCreateDto() {}

    public ReportSnapshotCreateDto(String reportType, LocalDate periodStart, LocalDate periodEnd, String data, Long generatedById) {
        this.reportType = reportType;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.data = data;
        this.generatedById = generatedById;
    }

    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }

    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }

    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }

    public Long getGeneratedById() { return generatedById; }
    public void setGeneratedById(Long generatedById) { this.generatedById = generatedById; }
}
