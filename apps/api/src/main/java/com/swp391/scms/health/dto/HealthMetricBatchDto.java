package com.swp391.scms.health.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Several measurements taken in one assessment, saved together (BMI is derived, never submitted). */
public record HealthMetricBatchDto(
        @NotEmpty(message = "{validation.health.metrics.not_empty}")
        @Size(max = 10, message = "{validation.health.metrics.max}")
        List<@Valid Item> metrics
) {
    public record Item(
            @NotBlank(message = "{validation.health.metric_name.not_blank}")
            String metricName,

            @NotNull(message = "{validation.health.metric_value.not_null}")
            @DecimalMin(value = "0.01", message = "{validation.health.metric_value.min}")
            BigDecimal metricValue,

            String unit
    ) {
    }
}
