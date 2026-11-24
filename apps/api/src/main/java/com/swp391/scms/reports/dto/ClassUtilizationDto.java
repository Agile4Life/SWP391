package com.swp391.scms.reports.dto;

/**
 * Mức sử dụng một lớp: lớp, bộ môn, phòng, sức chứa, số đăng ký, số có mặt, tỷ lệ lấp đầy và tỷ lệ điểm danh
 * (%).
 */
public record ClassUtilizationDto(
        Long classId,
        String className,
        Long disciplineId,
        String disciplineName,
        String roomName,
        Integer capacity,
        Long enrolledCount,
        Long presentCount,
        Double utilizationRate,
        Double attendanceRate
) {
    /** Constructor rút gọn không có tên phòng. */
    public ClassUtilizationDto(
            Long classId,
            String className,
            Long disciplineId,
            String disciplineName,
            Integer capacity,
            Long enrolledCount,
            Long presentCount,
            Double utilizationRate,
            Double attendanceRate
    ) {
        this(classId, className, disciplineId, disciplineName, null, capacity, enrolledCount, presentCount, utilizationRate, attendanceRate);
    }
}
