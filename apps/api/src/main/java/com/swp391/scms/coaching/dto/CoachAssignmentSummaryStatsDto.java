package com.swp391.scms.coaching.dto;

/** Số liệu tổng hợp màn phân công: tổng HLV, HLV đang làm, tổng học viên và số học viên theo PT, giáo án, lớp. */
public record CoachAssignmentSummaryStatsDto(
        int totalCoaches,
        int activeCoaches,
        int totalAssignedStudents,
        int totalPtStudents,
        int totalPlanStudents,
        int totalClassStudents
) {}

