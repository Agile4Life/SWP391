package com.swp391.scms.coaching.dto;

import com.swp391.scms.common.ScheduleSlot;
import java.time.LocalTime;

/**
 * Một khung giờ PT cố định (Slot 1–Slot 5, 07:00–20:30) của HLV: số slot, giờ bắt đầu/kết thúc, còn trống hay không
 * và lý do nếu không (HLV nghỉ phép, quá sát giờ, HLV bận, hội viên bận).
 */
public record CoachAvailableSlotDto(
        Integer slotNumber,
        LocalTime startTime,
        LocalTime endTime,
        boolean available,
        String reason // Lý do nếu không trống: null, "coach_on_leave", "too_soon", "coach_busy", "member_busy"
) {
    /** Constructor 4 tham số giữ tương thích ngược; tự suy ra {@code slotNumber} từ khung giờ chuẩn. */
    public CoachAvailableSlotDto(LocalTime startTime, LocalTime endTime, boolean available, String reason) {
        this(ScheduleSlot.fromRange(startTime, endTime).map(ScheduleSlot::slotNumber).orElse(null),
                startTime, endTime, available, reason);
    }
}
