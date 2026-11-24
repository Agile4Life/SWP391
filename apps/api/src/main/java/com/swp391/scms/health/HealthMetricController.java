package com.swp391.scms.health;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.health.dto.HealthMetricCreateDto;
import com.swp391.scms.health.dto.HealthMetricDto;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API chỉ số cơ thể của hội viên (tính năng đã ngừng, chỉ bật khi app.health.metrics.enabled=true): xem, thêm,
 * sửa, xóa số đo.
 *
 * Mặc định tắt: các endpoint chỉ số sức khỏe và theo dõi tiến độ cơ thể của hội viên đã bị gỡ khỏi phạm vi
 * đang chạy.
 */
@ConditionalOnProperty(name = "app.health.metrics.enabled", havingValue = "true")
@Tag(name = "Health Metrics", description = "Quản lý và ghi nhận chỉ số sức khỏe của hội viên")
@RestController
public class HealthMetricController {

    private final HealthMetricService healthMetricService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public HealthMetricController(HealthMetricService healthMetricService) {
        this(healthMetricService, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public HealthMetricController(HealthMetricService healthMetricService, MessageService messageService) {
        this.healthMetricService = healthMetricService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /api/v1/members/{memberId}/health-metrics: lịch sử số đo của hội viên (mới nhất trước). */
    @Operation(summary = "Xem lịch sử chỉ số sức khỏe", description = "Lấy danh sách các chỉ số sức khỏe đã đo của hội viên")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('MEMBER', 'COACH', 'CENTER_MANAGER')")
    @GetMapping("/api/v1/members/{memberId}/health-metrics")
    public ApiResponse<List<HealthMetricDto>> getMetrics(@PathVariable Long memberId,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.list.success"),
                healthMetricService.getMetrics(memberId, principal.id(), principal.role()));
    }

    /** POST /api/v1/members/{memberId}/health-metrics: thêm một số đo. */
    @Operation(summary = "Thêm chỉ số sức khỏe mới", description = "Ghi nhận chỉ số thể chất mới (chiều cao, cân nặng, huyết áp, v.v.)")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    @PostMapping("/api/v1/members/{memberId}/health-metrics")
    public ApiResponse<HealthMetricDto> addMetric(@PathVariable Long memberId,
                                                  @Valid @RequestBody HealthMetricDto request,
                                                  @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.add.success"),
                healthMetricService.addMetric(memberId, request, principal.id(), principal.role()));
    }

    /** POST /api/v1/members/{memberId}/health-metrics/batch: thêm nhiều số đo của một lần đánh giá cùng lúc. */
    @Operation(summary = "Ghi nhận nhiều chỉ số sức khỏe cùng lúc", description = "Một lần đánh giá có thể gồm cân nặng, chiều cao, tỷ lệ mỡ, khối lượng cơ...; BMI tự tính từ chiều cao và cân nặng")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    @PostMapping("/api/v1/members/{memberId}/health-metrics/batch")
    public ApiResponse<List<HealthMetricDto>> addMetrics(@PathVariable Long memberId,
                                                         @Valid @RequestBody com.swp391.scms.health.dto.HealthMetricBatchDto request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.add.success"),
                healthMetricService.addMetrics(memberId, request, principal.id(), principal.role()));
    }

    /** PUT /api/v1/members/{memberId}/health-metrics/{metricId}: sửa một số đo. */
    @Operation(summary = "Cập nhật chỉ số sức khỏe", description = "Chỉnh sửa giá trị chỉ số thể chất đã đo")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
    @PutMapping("/api/v1/members/{memberId}/health-metrics/{metricId}")
    public ApiResponse<HealthMetricDto> updateMetric(@PathVariable Long memberId,
                                                     @PathVariable Long metricId,
                                                     @Valid @RequestBody HealthMetricDto request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.update.success"),
                healthMetricService.updateMetric(memberId, metricId, request, principal.id(), principal.role()));
    }

    /** DELETE /api/v1/members/{memberId}/health-metrics/{metricId}: xóa một số đo. */
    @Operation(summary = "Xóa chỉ số sức khỏe", description = "Xóa một bản ghi chỉ số thể chất")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER')")
    @DeleteMapping("/api/v1/members/{memberId}/health-metrics/{metricId}")
    public ApiResponse<Void> deleteMetric(@PathVariable Long memberId,
                                          @PathVariable Long metricId,
                                          @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        healthMetricService.deleteMetric(memberId, metricId, principal.id(), principal.role());
        return ApiResponse.ok(msg("health.metrics.delete.success"), null);
    }

    /** POST /api/v1/health/metrics: ghi một số đo (hội viên đích lấy trong body, mặc định là người gọi). */
    @Operation(summary = "Ghi nhận chỉ số sức khỏe mới (SCRUM-119)", description = "HLV được phân công hoặc Quản lý ghi nhận chỉ số sức khỏe mới (cân nặng, tỷ lệ mỡ, vòng eo, BMI...)")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('COACH', 'CENTER_MANAGER', 'RECEPTIONIST')")
    @PostMapping("/api/v1/health/metrics")
    public ApiResponse<HealthMetricDto> recordMetric(@Valid @RequestBody HealthMetricCreateDto request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.add.success"),
                healthMetricService.recordMetric(request, principal.id(), principal.role()));
    }

    /** GET /api/v1/health/metrics/my: số đo của chính hội viên theo thứ tự thời gian, để vẽ biểu đồ. */
    @Operation(summary = "Chuỗi dữ liệu lịch sử chỉ số sức khỏe cá nhân (SCRUM-119)", description = "Trả về lịch sử chỉ số sức khỏe sắp xếp tăng dần theo recorded_at để vẽ biểu đồ tiến độ (Line Chart)")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('MEMBER')")
    @GetMapping("/api/v1/health/metrics/my")
    public ApiResponse<List<HealthMetricDto>> getMyMetricsChronological(
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.list.success"),
                healthMetricService.getMyMetricsChronological(principal.id()));
    }
}
