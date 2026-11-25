package com.swp391.scms.attendance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Một buổi lớp đã qua trong lịch sử điểm danh: lớp, phòng, ngày giờ, số có mặt/muộn/vắng/có phép, số đã đánh
 * giá, điểm trung bình, lần đánh giá cuối và còn sửa điểm danh được không.
 *
 * Một buổi học đã qua có điểm danh hoặc đánh giá được ghi nhận, dùng cho các tab lịch sử của HLV.
 */
public record CoachSessionHistoryItem(
        Long sessionId,
        Long classId,
        String className,
        String roomName,
        LocalDate sessionDate,
        LocalTime startTime,
        LocalTime endTime,
        long presentCount,
        long lateCount,
        long absentCount,
        long excusedCount,
        long evaluatedCount,
        /** Điểm tiến độ trung bình của các đánh giá trong buổi (1-100); null khi chưa có đánh giá. */
        BigDecimal averageScore,
        LocalDateTime lastEvaluatedAt,
        /** False khi buổi đã quá SessionCompletionScheduler.GRACE_DAYS ngày: trạng thái điểm danh bị khóa. */
        boolean attendanceEditable
) {}
