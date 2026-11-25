package com.swp391.scms.attendance.dto;

import java.time.LocalDateTime;

/** Nhóm DTO phản hồi cho check-in. */
public final class CheckinResponses {

    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private CheckinResponses() {}

    /** Mã QR cổng: chuỗi QR, mã và tên cổng, thời điểm tạo, thời điểm hết hạn và số giây sống. */
    public record GateQrDto(String qrCode, String gateId, String gate, java.time.Instant generatedAt,
                            java.time.Instant expiresAt, long expiresInSeconds) {}

    /**
     * Một lượt ra vào: hội viên, giờ vào/ra, cách thức, cổng, kết quả (GRANTED/DENIED), lý do từ chối (đã
     * dịch), ảnh, tên gói và số ngày còn lại của gói.
     */
    public record CheckinDto(
            Long id,
            Long memberId,
            String memberName,
            LocalDateTime checkInTime,
            LocalDateTime checkOutTime,
            String method,
            String gate,
            String status,
            String denialReason,
            String avatarUrl,
            String packageName,
            Long remainingDays
    ) {
        /** Constructor không có ảnh, tên gói và số ngày còn lại. */
        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status, String denialReason) {
            this(id, memberId, memberName, checkInTime, checkOutTime, method, gate, status, denialReason, null, null, null);
        }
        /** Constructor đầy đủ (dùng khi cho vào để quầy thấy thông tin gói). */
        public CheckinDto(Long id, Long memberId, String memberName, LocalDateTime checkInTime,
                          LocalDateTime checkOutTime, String method, String gate, String status) {
            this(id, memberId, memberName, checkInTime, checkOutTime, method, gate, status, null);
        }
    }
}
