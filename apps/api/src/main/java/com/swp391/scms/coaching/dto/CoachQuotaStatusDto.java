package com.swp391.scms.coaching.dto;

/** Tình trạng hạn mức PT của hội viên: tên gói, số buổi/tháng, số buổi đã dùng và số buổi còn lại. */
public record CoachQuotaStatusDto(
        String packageName,
        int monthlyQuota,
        int usedThisMonth,
        int remainingQuota
) {}
