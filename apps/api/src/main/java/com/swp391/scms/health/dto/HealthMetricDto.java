package com.swp391.scms.health.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Một số đo trả cho client: id, tên chỉ số, giá trị, đơn vị, người ghi và thời điểm ghi. */
public record HealthMetricDto(
    Long id,
    @NotBlank(message = "{validation.health.metric_name.not_blank}")
    String metricName,
    @NotNull(message = "{validation.health.metric_value.not_null}")
    @DecimalMin(value = "0.01", message = "{validation.health.metric_value.min}")
    BigDecimal metricValue,
    String unit,
    Long recordedBy,
    LocalDateTime recordedAt
) {}
