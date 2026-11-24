package com.swp391.scms.coaching.dto;

import java.time.LocalDate;

/**
 * Một học viên trong danh sách phân công của HLV: thông tin hội viên, mục tiêu/trình độ/ghi chú sức khỏe, loại
 * phân công, thời gian, buổi kế tiếp, trạng thái, id bản ghi và vấn đề gói tập (nếu có).
 */
public record CoachAssignmentStudentDto(
        Long memberId,
        String membershipCode,
        String fullName,
        String phone,
        String email,
        String avatarUrl,
        String fitnessGoal,
        String fitnessLevel,
        String healthNotes,
        String assignmentType,
        String assignmentTypeLabel,
        String detail,
        LocalDate startDate,
        LocalDate endDate,
        String nextSession,
        String status,
        Long referenceId,
        /** Null when the plan is fine; FROZEN (on hold), NO_ACTIVE (no valid plan today) or NOT_COVERED (plan ends before the PT day). */
        String membershipIssue
) {
    /** Constructor rút gọn không có membershipIssue (mặc định null). */
    public CoachAssignmentStudentDto(Long memberId, String membershipCode, String fullName, String phone, String email,
                                     String avatarUrl, String fitnessGoal, String fitnessLevel, String healthNotes,
                                     String assignmentType, String assignmentTypeLabel, String detail, LocalDate startDate,
                                     LocalDate endDate, String nextSession, String status, Long referenceId) {
        this(memberId, membershipCode, fullName, phone, email, avatarUrl, fitnessGoal, fitnessLevel, healthNotes,
                assignmentType, assignmentTypeLabel, detail, startDate, endDate, nextSession, status, referenceId, null);
    }
}

