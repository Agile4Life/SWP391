package com.swp391.scms.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Dữ liệu hội viên nộp giấy tờ: loại giấy tờ (CCCD/PASSPORT), số giấy tờ, họ tên, quốc tịch, ảnh mặt trước và
 * mặt sau.
 */
public record MemberKycRequest(
    String documentType,
    @NotBlank(message = "{validation.users.kyc.citizen_id.not_blank}")
    @Size(max = 30, message = "{validation.users.kyc.citizen_id.size}")
    String citizenId,
    @NotBlank(message = "{validation.users.full_name.not_blank}")
    @Size(max = 150, message = "{validation.users.full_name.size}")
    String fullName,
    String nationality,
    @NotBlank(message = "{validation.users.kyc.front_image.not_blank}")
    String frontImageUrl,
    String backImageUrl
) {
    /** Loại giấy tờ đã chuẩn hóa chữ hoa; bỏ trống thì mặc định CCCD. */
    public String resolvedDocumentType() {
        return documentType != null && !documentType.isBlank() ? documentType.trim().toUpperCase() : "CCCD";
    }
}
