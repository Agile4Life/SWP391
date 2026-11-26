package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Nhóm DTO request cho gói tập. */
public final class SubscriptionRequests {

    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private SubscriptionRequests() {}

    /** Lý do hủy yêu cầu chưa thanh toán; bắt buộc riêng cho thao tác tại quầy lễ tân. */
    public record CancelPendingRequest(
            @Size(max = 500, message = "{validation.membership.pending_cancel_reason.size}") String reason
    ) {}

    /** Đăng ký gói mới: id gói bắt buộc. */
    public record Create(
            @NotNull(message = "{validation.membership.package_id.not_null}")
            Long packageId
    ) {}

    /** Nâng cấp sang gói khác: id gói đích bắt buộc. */
    public record Upgrade(
            @NotNull(message = "{validation.membership.package_id.not_null}")
            Long packageId
    ) {}

    /** Từ chối bảo lưu: lý do bắt buộc, tối đa 500 ký tự. */
    public record HoldRejectRequest(
            @NotBlank(message = "{validation.membership.hold_rejection_reason.required}")
            @Size(max = 500, message = "{validation.membership.hold_rejection_reason.size}")
            String reason
    ) {}

    /**
     * Yêu cầu bảo lưu: lý do bắt buộc (tối đa 500 ký tự), ngày bắt đầu (cách hiện tại ít nhất 24 giờ) và ngày
     * kết thúc (tính cả ngày đó).
     */
    public record HoldRequest(
            @NotBlank(message = "{validation.membership.hold_reason.not_blank}")
            @Size(max = 500, message = "{validation.membership.hold_reason.size}")
            String reason,
            /** Ngày đầu tiên của đợt bảo lưu; phải cách thời điểm hiện tại ít nhất 24 giờ. */
            java.time.LocalDate startDate,
            /** Ngày cuối cùng của đợt bảo lưu (tính cả ngày này). */
            java.time.LocalDate endDate
    ) {
        /** Yêu cầu bảo lưu chỉ có lý do (dùng ở code cũ và test). */
        public HoldRequest(String reason) {
            this(reason, null, null);
        }
    }
}
