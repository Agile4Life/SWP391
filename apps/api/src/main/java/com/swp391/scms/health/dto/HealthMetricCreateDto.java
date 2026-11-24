package com.swp391.scms.health.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Dữ liệu ghi một số đo: hội viên (tùy chọn), tên chỉ số, giá trị và đơn vị.
 *
 * DTO yêu cầu ghi một chỉ số sức khỏe qua POST /api/v1/health/metrics (SCRUM-119).
 */
public record HealthMetricCreateDto(
        Long memberId,

        @NotBlank(message = "{validation.health.metric_name.not_blank}")
        String metricName,

        @NotNull(message = "{validation.health.metric_value.not_null}")
        @DecimalMin(value = "0.01", message = "{validation.health.metric_value.min}")
        BigDecimal metricValue,

        String unit
) {
}
