package com.swp391.scms.reports.dto;

/** Tỷ lệ gia hạn: số kỳ đã hết hạn, số kỳ được gia hạn và tỷ lệ % (null khi chưa có kỳ nào hết hạn). */
public record RenewalRateDto(long expiredCount, long renewedCount, Double renewalRate) {}
