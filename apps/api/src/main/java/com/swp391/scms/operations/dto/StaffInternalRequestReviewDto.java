package com.swp391.scms.operations.dto;

import jakarta.validation.constraints.NotBlank;

/** Quyết định của quản lý: trạng thái (APPROVED/REJECTED) và ghi chú (bắt buộc khi từ chối). */
public record StaffInternalRequestReviewDto(
        @NotBlank(message = "{error.operations.request.review_status_required}")
        String status, // APPROVED, REJECTED

        String managerNotes
) {}

