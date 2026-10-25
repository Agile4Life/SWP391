package com.swp391.scms.reports.dto;

/**
 * DTO representing utilization and attendance metrics for a class and its discipline (SCRUM-120).
 */
public record ClassUtilizationDto(
        Long classId,
        String className,
        Long disciplineId,
        String disciplineName,
        int capacity,
        long enrolledCount,
        long presentCount,
        double utilizationRate,
        double attendanceRate
) {
}
