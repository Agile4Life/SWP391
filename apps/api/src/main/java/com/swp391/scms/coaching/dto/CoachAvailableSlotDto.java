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
        String reason // Lý do nếu không trống: null, "too_soon" (quá sát giờ), "coach_busy" (HLV bận), "member_busy" (hội viên bận)
) {}
