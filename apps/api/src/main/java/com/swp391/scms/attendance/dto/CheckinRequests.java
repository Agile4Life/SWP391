package com.swp391.scms.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nhóm DTO request cho check-in. */
public final class CheckinRequests {

    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private CheckinRequests() {}

    /** Hội viên tự quét: chuỗi QR cổng. */
    public record SelfScan(
            @NotBlank(message = "{validation.attendance.gate_qr.not_blank}")
            @Size(max = 256, message = "{validation.attendance.gate_qr.size}")
            String gateQr
    ) {}

    /** Quầy quét: chuỗi QR trên thẻ hội viên và tên cổng. */
    public record Scan(
            @NotBlank(message = "{validation.attendance.qr_code.not_blank}")
            String qrCode,
            @Size(max = 50, message = "{validation.attendance.gate.size}")
            String gate
    ) {}
}
