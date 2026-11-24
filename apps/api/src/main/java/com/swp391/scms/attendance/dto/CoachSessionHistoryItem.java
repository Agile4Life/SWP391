package com.swp391.scms.attendance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Một buổi lớp đã qua trong lịch sử điểm danh: lớp, phòng, ngày giờ, số có mặt/muộn/vắng/có phép, số đã đánh
 * giá, điểm trung bình, lần đánh giá cuối và còn sửa điểm danh được không.
 *
 * A past class session that has attendance or evaluations recorded, for the coach's history tabs.
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
        /** Average progress score of the session's evaluations (1-100); null when none. */
        BigDecimal averageScore,
        LocalDateTime lastEvaluatedAt,
        /** False once the session is more than SessionCompletionScheduler.GRACE_DAYS old: statuses are locked. */
        boolean attendanceEditable
) {}
