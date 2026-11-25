package com.swp391.scms.reports;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.reports.dto.ClassUtilizationDto;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import com.swp391.scms.reports.dto.RenewalRateDto;
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

/**
 * API báo cáo cho quản lý trung tâm (/api/v1/reports): doanh thu theo ngày/theo gói, giao dịch gần đây, tỷ lệ
 * gia hạn, mức lấp đầy lớp (tính năng cũ) và ảnh chụp báo cáo.
 */
@Tag(name = "Reports & Analytics", description = "Báo cáo doanh thu tài chính, thống kê gói tập và ảnh chụp snapshot")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'MANAGER')")
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final RevenueReportService reportService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public ReportController(RevenueReportService reportService) {
        this(reportService, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public ReportController(RevenueReportService reportService, MessageService messageService) {
        this.reportService = reportService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /revenue/daily: doanh thu từng ngày trong khoảng (mặc định 30 ngày gần nhất). */
    @Operation(summary = "Báo cáo doanh thu theo từng ngày", description = "Thống kê tổng doanh thu và số lượng giao dịch thành công theo từng ngày trong kỳ")
    @GetMapping("/revenue/daily")
    public ResponseEntity<ApiResponse<List<DailyRevenueDto>>> getDailyRevenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<DailyRevenueDto> dailyRevenue = reportService.getDailyRevenue(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.revenue.daily"), dailyRevenue));
    }

    /** GET /revenue/by-package: doanh thu và tỷ trọng theo từng gói tập. */
    @Operation(summary = "Báo cáo doanh thu theo gói tập", description = "Thống kê doanh thu, số lượng bán và tỷ trọng (%) theo từng loại gói tập")
    @GetMapping("/revenue/by-package")
    public ResponseEntity<ApiResponse<List<PackageRevenueDto>>> getRevenueByPackage(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<PackageRevenueDto> packageRevenue = reportService.getRevenueByPackage(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.revenue.by_package"), packageRevenue));
    }

    /** GET /transactions/recent: 10 giao dịch thành công gần nhất trong khoảng. */
    @Operation(summary = "Mười giao dịch thanh toán thành công gần nhất trong kỳ")
    @GetMapping("/transactions/recent")
    public ResponseEntity<ApiResponse<List<RecentTransactionDto>>> getRecentTransactions(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.transactions.recent"),
                reportService.getRecentTransactions(startDate, endDate)));
    }

    /** GET /renewal-rate: tỷ lệ kỳ gói hết hạn đã được gia hạn. */
    @Operation(summary = "Tỷ lệ gia hạn của các gói đã hết hạn trong kỳ")
    @GetMapping("/renewal-rate")
    public ResponseEntity<ApiResponse<RenewalRateDto>> getRenewalRate(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.renewal_rate"),
                reportService.getRenewalRate(startDate, endDate)));
    }

    /** GET /class-utilization: tỷ lệ lấp đầy và điểm danh của lớp nhóm (dữ liệu cũ), lọc theo bộ môn. */
    @Operation(summary = "Báo cáo công suất sử dụng và tỷ lệ lấp đầy lớp học (SCRUM-120)")
    @GetMapping("/class-utilization")
    @PreAuthorize("hasAnyRole('ADMIN', 'CENTER_MANAGER', 'MANAGER')")
    public ResponseEntity<ApiResponse<List<ClassUtilizationDto>>> getClassUtilization(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long disciplineId) {
        List<ClassUtilizationDto> list = reportService.getClassUtilization(startDate, endDate, disciplineId);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.class_utilization.list"), list));
    }

    /** POST /snapshots/generate: lưu ảnh chụp số liệu báo cáo (dữ liệu JSON) để xem lại sau. */
    @Operation(summary = "Lưu ảnh chụp báo cáo định kỳ", description = "Tạo ảnh chụp báo cáo (snapshot) định dạng JSON phục vụ đối soát cho Quản lý")
    @PostMapping("/snapshots/generate")
    public ResponseEntity<ApiResponse<ReportSnapshotDto>> generateSnapshot(
            @Valid @RequestBody ReportSnapshotCreateDto dto,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.swp391.scms.security.AuthenticatedPrincipal principal) {
        Long currentUserId = principal != null ? principal.id() : null;
        ReportSnapshotDto created = reportService.generateSnapshot(dto, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("reports.snapshot.created"), created));
    }

    /** GET /snapshots: danh sách ảnh chụp báo cáo, mới nhất trước. */
    @Operation(summary = "Danh sách ảnh chụp báo cáo đã lưu", description = "Lấy tất cả các snapshot báo cáo đã tạo xếp theo thời gian mới nhất")
    @GetMapping("/snapshots")
    public ResponseEntity<ApiResponse<List<ReportSnapshotDto>>> getSnapshots() {
        List<ReportSnapshotDto> list = reportService.getSnapshots();
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.snapshot.list"), list));
    }

    /** GET /snapshots/{id}: chi tiết một ảnh chụp báo cáo. */
    @Operation(summary = "Chi tiết một ảnh chụp báo cáo", description = "Tra cứu chi tiết ảnh chụp báo cáo theo ID")
    @GetMapping("/snapshots/{id}")
    public ResponseEntity<ApiResponse<ReportSnapshotDto>> getSnapshotById(@PathVariable Long id) {
        ReportSnapshotDto snapshot = reportService.getSnapshotById(id);
        return ResponseEntity.ok(ApiResponse.ok(msg("reports.snapshot.detail"), snapshot));
    }
}
