package com.swp391.scms.membership.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Yêu cầu gói trải nghiệm hiển thị ở quầy: hội viên, giấy tờ (số che và số đầy đủ khi đang chờ duyệt), ảnh,
 * trạng thái, người duyệt, lý do từ chối và kỳ gói đã tạo.
 */
public record ReceptionTrialDto(
        Long id,
        Long memberId,
        String membershipCode,
        String memberName,
        String memberEmail,
        String memberPhone,
        String documentType,
        String documentNumberMasked,
        /** Số đầy đủ, chỉ có khi đơn đang chờ duyệt. */
        String documentNumber,
        String documentFullName,
        String nationality,
        String frontImageUrl,
        String backImageUrl,
        String status,
        LocalDateTime requestedAt,
        Long reviewedBy,
        LocalDateTime reviewedAt,
        String rejectionReason,
        Long subscriptionId,
        LocalDate subscriptionStartDate,
        LocalDate subscriptionEndDate,
        String subscriptionStatus
) {}

