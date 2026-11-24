package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.BadRequestException;

/**
 * Chính sách: lớp một buổi và ghi danh từng buổi đã ngừng, mọi lớp đều là khóa học định kỳ.
 *
 * Lớp lẻ và ghi danh theo buổi đã ngừng: mọi lớp là khóa học định kỳ và hội viên ghi danh cả khóa (spec
 * 2026-11-09-membership-benefits, mục 1.3).
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
