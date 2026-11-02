package com.swp391.scms.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CheckinRequests {

    private CheckinRequests() {}

    public record SelfScan(
            @NotBlank(message = "{validation.attendance.gate_qr.not_blank}")
            @Size(max = 256, message = "{validation.attendance.gate_qr.size}")
            String gateQr
    ) {}

    public record Scan(
            @NotBlank(message = "{validation.attendance.qr_code.not_blank}")
            String qrCode,
            @Size(max = 50, message = "{validation.attendance.gate.size}")
            String gate
    ) {}
}
