package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/** Nhóm các DTO trả về cho nghiệp vụ đặt chỗ buổi học. */
public final class SessionBookingResponses {

    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private SessionBookingResponses() {
    }

    /**
     * Thông tin một lượt đặt chỗ: buổi, lớp, hội viên, ngày giờ, phòng, HLV, trạng thái, thời điểm đặt/hủy, lý
     * do và mã lô.
     */
    public record SessionBookingDto(
            Long id,
            Long sessionId,
            Long classId,
            String className,
            Long memberId,
            LocalDate sessionDate,
            LocalTime startTime,
            LocalTime endTime,
            String roomName,
            String coachName,
            String status,
            LocalDateTime bookedAt,
            LocalDateTime cancelledAt,
            String cancelReason,
            String batchId
    ) {
    }

    /**
     * Một phần tử bị bỏ qua khi xử lý hàng loạt: id, ngày, mã lỗi và thông báo.
     *
     * Một id không xử lý được trong yêu cầu hàng loạt, kèm mã lỗi API và lý do đã bản địa hóa.
     */
    public record Skipped(Long id, LocalDate date, String code, String message) {
    }

    /** Kết quả đặt nhiều buổi: các lượt đặt thành công và các buổi bị bỏ qua. */
    public record BulkBookResult(List<SessionBookingDto> booked, List<Skipped> skipped) {
    }

    /** Kết quả hủy nhiều lượt: các lượt đã hủy và các lượt bị bỏ qua. */
    public record BulkCancelResult(List<SessionBookingDto> cancelled, List<Skipped> skipped) {
    }
}
