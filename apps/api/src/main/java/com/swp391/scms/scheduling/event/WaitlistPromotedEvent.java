package com.swp391.scms.scheduling.event;

import java.time.LocalDateTime;

/**
 * Event published when a waiting member is promoted to 'notified' status
 * with a reservation window to confirm booking.
 */
public record WaitlistPromotedEvent(
        Long waitlistId,
        Long classId,
        String className,
        Long memberUserId,
        LocalDateTime notifiedAt,
        LocalDateTime reservationExpiresAt
) {
}
