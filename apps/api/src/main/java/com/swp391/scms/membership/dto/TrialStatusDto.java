package com.swp391.scms.membership.dto;

import java.time.LocalDateTime;

/**
 * Trạng thái gói trải nghiệm của hội viên: đủ điều kiện không, đã nhận chưa, trạng thái yêu cầu, giấy tờ (số
 * che), họ tên, quốc tịch, ảnh, lý do từ chối, thời điểm gửi, kỳ gói đã tạo, tên gói và số buổi PT kèm theo.
 */
public record TrialStatusDto(
        boolean eligible,
        boolean alreadyClaimed,
        String status,
        String documentType,
        String cccd,
        String fullName,
        String nationality,
        String frontImageUrl,
        String backImageUrl,
        String rejectionReason,
        LocalDateTime redeemedAt,
        Long subscriptionId,
        String packageName,
        Integer coachSessionQuota
) {
    /** Constructor rút gọn kiểu cũ. */
    public TrialStatusDto(
            boolean eligible,
            boolean alreadyClaimed,
            String cccd,
            String fullName,
            LocalDateTime redeemedAt,
            Long subscriptionId
    ) {
        this(
                eligible,
                alreadyClaimed,
                alreadyClaimed ? (subscriptionId != null ? "APPROVED" : "PENDING_APPROVAL") : "NONE",
                "CCCD",
                cccd,
                fullName,
                null,
                null,
                null,
                null,
                redeemedAt,
                subscriptionId,
                "Gói Trải Nghiệm 3 Ngày",
                1
        );
    }

    /** Lấy giá trị trường documentNumberMasked. */
    public String getDocumentNumberMasked() {
        return cccd;
    }

    /** Lấy giá trị trường requestedAt. */
    public LocalDateTime getRequestedAt() {
        return redeemedAt;
    }
}
