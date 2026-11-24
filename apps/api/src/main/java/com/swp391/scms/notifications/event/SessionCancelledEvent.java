package com.swp391.scms.notifications.event;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * SCRUM-113: Sự kiện phát ra khi HLV hoặc quản lý hủy một buổi lớp học, báo cho các listener gửi thông báo tới
 * danh sách hội viên đã đăng ký bị ảnh hưởng.
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
