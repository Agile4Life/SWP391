package com.swp391.scms.operations.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Quyết định của quản lý: trạng thái (APPROVED/REJECTED), ghi chú (bắt buộc khi từ chối) và cờ xác nhận khi
 * đơn nghỉ của HLV có xung đột lịch lớp/PT (truyền false để chặn duyệt khi phát hiện xung đột).
 */
public record StaffInternalRequestReviewDto(
        @NotBlank(message = "{error.operations.request.review_status_required}")
        String status, // APPROVED, REJECTED

        @Size(max = 2000, message = "{validation.support.message.size}")
        String managerNotes,

        Boolean confirmConflicts
) {
    /** Constructor tương thích ngược với 2 tham số. */
    public StaffInternalRequestReviewDto(String status, String managerNotes) {
        this(status, managerNotes, null);
    }
}

