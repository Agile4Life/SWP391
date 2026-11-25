package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Yêu cầu gói trải nghiệm: loại giấy tờ, số giấy tờ (trường cccd cũ vẫn được nhận), họ tên, quốc tịch, ảnh mặt
 * trước/sau.
 */
public record TrialClaimRequest(
        String documentType,
        String documentNumber,
        String cccd,
        @Size(max = 150, message = "{validation.trial.full_name.size}")
        String fullName,
        String nationality,
        String frontImageUrl,
        String backImageUrl
) {
    /** Constructor rút gọn kiểu cũ chỉ có CCCD và họ tên. */
    public TrialClaimRequest(String cccd, String fullName) {
        this("CCCD", cccd, cccd, fullName, null, null, null);
    }

    /** Loại giấy tờ đã chuẩn hóa chữ hoa; trống thì mặc định CCCD. */
    public String resolvedDocumentType() {
        if (documentType != null && !documentType.isBlank()) {
            return documentType.trim().toUpperCase();
        }
        return "CCCD";
    }

    /** Số giấy tờ: ưu tiên documentNumber, không có thì dùng trường cccd cũ; không có thì chuỗi rỗng. */
    public String resolvedDocumentNumber() {
        if (documentNumber != null && !documentNumber.isBlank()) {
            return documentNumber.trim();
        }
        if (cccd != null && !cccd.isBlank()) {
            return cccd.trim();
        }
        return "";
    }

    /** Giữ tương thích với code cũ: trả số giấy tờ đã giải quyết. */
    public String cccd() {
        return resolvedDocumentNumber();
    }
}
