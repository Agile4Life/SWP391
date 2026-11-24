package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Nhóm các DTO yêu cầu đặt/hủy nhiều buổi học; MAX_BULK giới hạn số phần tử mỗi lần.
 *
 * Request payloads for per-session booking, including the bulk (week / month / hand-picked) option.
 */
public final class SessionBookingRequests {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private SessionBookingRequests() {
    }

    public static final int MAX_BULK = 62;

    /**
     * Yêu cầu đặt nhiều buổi: danh sách id buổi học.
     *
     * Sessions to book in one go; the client resolves "whole week" or "whole month" into concrete session ids.
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
