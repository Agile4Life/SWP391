package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.BadRequestException;

/**
 * One-off classes and per-session enrollment are retired: every class is a recurring course and a member
 * enrolls in the whole course (spec 2026-11-09-membership-benefits, section 1.3).
 */
public final class SingleSessionPolicy {
    private SingleSessionPolicy() {}

    public static BadRequestException rejection() {
        return new BadRequestException("SCHEDULING_SINGLE_SESSION_DISABLED",
                "error.scheduling.single_session_disabled", null,
                "Single-session classes are retired. Create a recurring course and enroll in the whole course.");
    }
}
