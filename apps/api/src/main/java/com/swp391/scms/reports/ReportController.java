package com.swp391.scms.reports;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.service.RevenueReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Reports & Analytics", description = "Báo cáo doanh thu tài chính, thống kê gói tập và ảnh chụp snapshot")
@PreAuthorize("hasRole('CENTER_MANAGER')")
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final RevenueReportService reportService;
    private final MessageService messageService;

    public ReportController(RevenueReportService reportService) {
        this(reportService, null);
    }

    @Autowired
    public ReportController(RevenueReportService reportService, MessageService messageService) {
        this.reportService = reportService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Báo cáo doanh thu theo từng ngày", description = "Thống kê tổng doanh thu và số lượng giao dịch thành công theo từng ngày trong kỳ")
    @GetMapping("/revenue/daily")
    public ResponseEntity<ApiResponse<List<DailyRevenueDto>>> getDailyRevenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<DailyRevenueDto> dailyRevenue = reportService.getDailyRevenue(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.revenue.daily"), dailyRevenue));
    }

    @Operation(summary = "Báo cáo doanh thu theo gói tập", description = "Thống kê doanh thu, số lượng bán và tỷ trọng (%) theo từng loại gói tập")
    @GetMapping("/revenue/by-package")
    public ResponseEntity<ApiResponse<List<PackageRevenueDto>>> getRevenueByPackage(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<PackageRevenueDto> packageRevenue = reportService.getRevenueByPackage(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.revenue.by_package"), packageRevenue));
    }

    @Operation(summary = "Lưu ảnh chụp báo cáo định kỳ", description = "Tạo ảnh chụp báo cáo (snapshot) định dạng JSON phục vụ đối soát cho Quản lý")
    @PostMapping("/snapshots/generate")
    public ResponseEntity<ApiResponse<ReportSnapshotDto>> generateSnapshot(
            @Valid @RequestBody ReportSnapshotCreateDto dto) {
        ReportSnapshotDto created = reportService.generateSnapshot(dto, null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("reports.snapshot.created"), created));
    }

    @Operation(summary = "Danh sách ảnh chụp báo cáo đã lưu", description = "Lấy tất cả các snapshot báo cáo đã tạo xếp theo thời gian mới nhất")
    @GetMapping("/snapshots")
    public ResponseEntity<ApiResponse<List<ReportSnapshotDto>>> getSnapshots() {
        List<ReportSnapshotDto> list = reportService.getSnapshots();
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.snapshot.list"), list));
    }

    @Operation(summary = "Chi tiết một ảnh chụp báo cáo", description = "Tra cứu chi tiết ảnh chụp báo cáo theo ID")
    @GetMapping("/snapshots/{id}")
    public ResponseEntity<ApiResponse<ReportSnapshotDto>> getSnapshotById(@PathVariable Long id) {
        ReportSnapshotDto snapshot = reportService.getSnapshotById(id);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.snapshot.detail"), snapshot));
    }
}

