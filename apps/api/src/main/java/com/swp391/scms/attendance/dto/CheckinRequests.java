package com.swp391.scms.attendance.dto;

import jakarta.validation.constraints.NotBlank;

public final class CheckinRequests {

    private CheckinRequests() {}

    public record Scan(
            @NotBlank(message = "{validation.attendance.qr_code.not_blank}")
            String qrCode,
            String gate
    ) {}
}
