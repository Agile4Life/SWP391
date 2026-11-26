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
        /** Null khi gói tập bình thường; FROZEN (đang bảo lưu), NO_ACTIVE (hôm nay không có gói hợp lệ) hoặc NOT_COVERED (gói kết thúc trước ngày PT). */
        String membershipIssue,
        /** Số buổi PT sắp tới được gộp vào dòng PT_1_1 (mỗi hội viên một dòng); null với giáo án và lớp. */
        Integer sessionCount
) {}
