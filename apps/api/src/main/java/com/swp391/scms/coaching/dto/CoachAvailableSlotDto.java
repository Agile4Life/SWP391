package com.swp391.scms.coaching.dto;

import java.time.LocalTime;

/**
 * Một khung giờ PT của HLV: giờ bắt đầu/kết thúc, còn trống hay không và lý do nếu không (quá sát giờ, HLV bận,
 * hội viên bận).
 */
public record CoachAvailableSlotDto(
        LocalTime startTime,
        LocalTime endTime,
        boolean available,
        String reason // null, "too_soon", "coach_busy", "member_busy"
) {}
