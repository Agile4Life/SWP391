package com.swp391.scms.notifications.event;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * SCRUM-113: Event emitted when a class session is cancelled by a coach or manager.
 * Informs listeners to notify affected enrolled members.
 */
public record SessionCancelledEvent(
        Long sessionId,
        Long classId,
        String className,
        LocalDate sessionDate,
        LocalTime startTime,
        String reason,
        List<Long> affectedMemberUserIds
) {
}
