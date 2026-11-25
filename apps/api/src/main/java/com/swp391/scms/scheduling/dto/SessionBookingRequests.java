package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Nhóm các DTO yêu cầu đặt/hủy nhiều buổi học; MAX_BULK giới hạn số phần tử mỗi lần.
 *
 * Các payload yêu cầu đặt chỗ theo buổi, gồm tùy chọn đặt hàng loạt (tuần / tháng / buổi chọn tay).
 */
public final class SessionBookingRequests {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private SessionBookingRequests() {
    }

    public static final int MAX_BULK = 62;

    /**
     * Yêu cầu đặt nhiều buổi: danh sách id buổi học.
     *
     * Các buổi đặt trong một lần; client quy "cả tuần" hoặc "cả tháng" thành các id buổi cụ thể.
     */
    public record BulkBookRequest(
            @NotEmpty(message = "{validation.scheduling.bulk.empty}")
            @Size(max = MAX_BULK, message = "{validation.scheduling.bulk.too_many}")
            List<Long> sessionIds) {
    }

    /** Yêu cầu hủy nhiều lượt đặt chỗ: danh sách id lượt đặt. */
    public record BulkCancelRequest(
            @NotEmpty(message = "{validation.scheduling.bulk.empty}")
            @Size(max = MAX_BULK, message = "{validation.scheduling.bulk.too_many}")
            List<Long> bookingIds) {
    }
}
