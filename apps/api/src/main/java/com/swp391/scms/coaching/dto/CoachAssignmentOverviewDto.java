package com.swp391.scms.coaching.dto;

import java.util.List;

/**
 * Tổng quan một HLV trong màn phân công: thông tin liên hệ, chuyên môn, trạng thái làm việc, số học viên theo
 * loại (PT, giáo án, lớp) và danh sách học viên.
 */
public record CoachAssignmentOverviewDto(
        Long coachId,
        String coachName,
        String coachEmail,
        String coachPhone,
        String specialization,
        String bio,
        String employmentStatus,
        int totalStudentsCount,
        int ptStudentsCount,
        int planStudentsCount,
        int classStudentsCount,
        List<CoachAssignmentStudentDto> students
) {}

