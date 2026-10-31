package com.swp391.scms.reports.dto;

public record RenewalRateDto(long expiredCount, long renewedCount, Double renewalRate) {}
