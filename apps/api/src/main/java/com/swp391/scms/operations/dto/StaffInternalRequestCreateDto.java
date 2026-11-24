package com.swp391.scms.operations.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * Dữ liệu gửi đơn nội bộ: loại đơn, tiêu đề, lý do, ngày bắt đầu/kết thúc, ca muốn đổi, người thay ca và cờ xác
 * nhận gửi dù trùng ngày nghỉ đã có.
 */
public record StaffInternalRequestCreateDto(
        @NotBlank(message = "{error.operations.request.type_required}")
        String requestType, // Giá trị hợp lệ: LEAVE, SHIFT_EXCHANGE, SCHEDULE_CHANGE, OTHER

        @NotBlank(message = "{error.operations.request.title_required}")
        String title,

        @NotBlank(message = "{error.operations.request.reason_required}")
        String reason,

        LocalDate startDate,
        LocalDate endDate,
        String targetShift,
        Long replacementUserId,
        /** True khi người dùng đã thấy cảnh báo trùng ngày nghỉ và vẫn muốn gửi đơn nghỉ này. */
        Boolean confirmOverlap
) {
    /** Constructor rút gọn không có cờ xác nhận trùng ngày. */
    public StaffInternalRequestCreateDto(String requestType, String title, String reason, LocalDate startDate,
                                         LocalDate endDate, String targetShift, Long replacementUserId) {
        this(requestType, title, reason, startDate, endDate, targetShift, replacementUserId, null);
    }
}

