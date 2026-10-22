package com.swp391.scms.health;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.health.dto.HealthMetricDto;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Health Metrics", description = "Quản lý và ghi nhận chỉ số sức khỏe của hội viên")
@RestController
@RequestMapping("/api/v1/members/{memberId}/health-metrics")
public class HealthMetricController {

    private final HealthMetricService healthMetricService;
    private final MessageService messageService;

    public HealthMetricController(HealthMetricService healthMetricService) {
        this(healthMetricService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public HealthMetricController(HealthMetricService healthMetricService, MessageService messageService) {
        this.healthMetricService = healthMetricService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Xem lịch sử chỉ số sức khỏe", description = "Lấy danh sách các chỉ số sức khỏe đã đo của hội viên")
    @GetMapping
    public ApiResponse<List<HealthMetricDto>> getMetrics(@PathVariable Long memberId,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.list.success"),
                healthMetricService.getMetrics(memberId, principal.id(), principal.role()));
    }

    @Operation(summary = "Thêm chỉ số sức khỏe mới", description = "Ghi nhận chỉ số thể chất mới (chiều cao, cân nặng, huyết áp, v.v.)")
    @PostMapping
    public ApiResponse<HealthMetricDto> addMetric(@PathVariable Long memberId,
                                                  @Valid @RequestBody HealthMetricDto request,
                                                  @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.add.success"),
                healthMetricService.addMetric(memberId, request, principal.id(), principal.role()));
    }

    @Operation(summary = "Cập nhật chỉ số sức khỏe", description = "Chỉnh sửa giá trị chỉ số thể chất đã đo")
    @PutMapping("/{metricId}")
    public ApiResponse<HealthMetricDto> updateMetric(@PathVariable Long memberId,
                                                     @PathVariable Long metricId,
                                                     @Valid @RequestBody HealthMetricDto request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("health.metrics.update.success"),
                healthMetricService.updateMetric(memberId, metricId, request, principal.id(), principal.role()));
    }

    @Operation(summary = "Xóa chỉ số sức khỏe", description = "Xóa một bản ghi chỉ số thể chất")
    @DeleteMapping("/{metricId}")
    public ApiResponse<Void> deleteMetric(@PathVariable Long memberId,
                                          @PathVariable Long metricId,
                                          @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        healthMetricService.deleteMetric(memberId, metricId, principal.id(), principal.role());
        return ApiResponse.ok(msg("health.metrics.delete.success"), null);
    }
}
