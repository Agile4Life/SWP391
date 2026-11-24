package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Nhóm DTO cho yêu cầu hủy gói tập. */
public final class CancellationDtos {
    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private CancellationDtos() {}

    /** Hội viên gửi yêu cầu hủy: lý do bắt buộc. */
    public record Request(
            @NotBlank(message = "{validation.membership.cancellation_reason.not_blank}")
            @Size(max = 500, message = "{validation.membership.cancellation_reason.size}") String reason) {}

    /**
     * Lễ tân gửi yêu cầu hủy thay hội viên: theo hội viên hoặc kỳ gói, lý do bắt buộc và số tiền hoàn đề xuất
     * (tùy chọn).
     */
    public record StaffRequest(
            Long memberId,
            Long subscriptionId,
            @NotBlank(message = "{validation.membership.cancellation_reason.not_blank}")
            @Size(max = 500, message = "{validation.membership.cancellation_reason.size}") String reason,
            @PositiveOrZero BigDecimal refundAmount) {}

    /** Quyết định của quản lý: ghi chú và số tiền hoàn (tùy chọn, ghi đè số đề xuất). */
    public record Decision(
        /** Quyết định chỉ có ghi chú. */
            @Size(max = 500, message = "{validation.membership.cancellation_note.size}") String note,
            @PositiveOrZero BigDecimal refundAmount) {
        public Decision(String note) {
            this(note, null);
        }
    }

    /**
     * Yêu cầu hủy trả cho client: hội viên, kỳ gói, lý do, trạng thái, các mốc thời gian, người quyết định, ghi
     * chú, số tiền hoàn và người gửi yêu cầu.
     */
    public record Response(Long id, Long memberId, String memberName, Long subscriptionId,
            String packageName, String reason, String status, LocalDateTime requestedAt,
            Long resolvedById, LocalDateTime resolvedAt, String resolutionNote,
            BigDecimal refundAmount, Long requestedById, String requestedByName) {
        /** Constructor rút gọn không có số tiền hoàn và người gửi yêu cầu. */
        public Response(Long id, Long memberId, String memberName, Long subscriptionId,
                String packageName, String reason, String status, LocalDateTime requestedAt,
                Long resolvedById, LocalDateTime resolvedAt, String resolutionNote) {
            this(id, memberId, memberName, subscriptionId, packageName, reason, status,
                    requestedAt, resolvedById, resolvedAt, resolutionNote, null, null, null);
        }
    }
}
