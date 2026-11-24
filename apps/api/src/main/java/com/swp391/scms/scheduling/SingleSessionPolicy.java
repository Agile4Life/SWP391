package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.BadRequestException;

/**
 * Chính sách: lớp một buổi và ghi danh từng buổi đã ngừng, mọi lớp đều là khóa học định kỳ.
 *
 * One-off classes and per-session enrollment are retired: every class is a recurring course and a member
 * enrolls in the whole course (spec 2026-11-09-membership-benefits, section 1.3).
 */
public final class SingleSessionPolicy {
    /** Constructor private: lớp tiện ích chỉ có hàm static. */
    private SingleSessionPolicy() {}

    /** Tạo lỗi BadRequest chuẩn khi có yêu cầu tạo lớp/ghi danh một buổi. */
    public static BadRequestException rejection() {
        return new BadRequestException("SCHEDULING_SINGLE_SESSION_DISABLED",
                "error.scheduling.single_session_disabled", null,
                "Single-session classes are retired. Create a recurring course and enroll in the whole course.");
    }
}
