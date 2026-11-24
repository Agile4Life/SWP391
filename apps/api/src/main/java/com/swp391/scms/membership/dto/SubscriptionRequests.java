package com.swp391.scms.membership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Nhóm DTO request cho gói tập. */
public final class SubscriptionRequests {

    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private SubscriptionRequests() {}

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
            /** First day of the hold; must be at least 24 hours away. */
            java.time.LocalDate startDate,
            /** Last day of the hold, inclusive. */
            java.time.LocalDate endDate
    ) {
        /** Yêu cầu bảo lưu chỉ có lý do (dùng ở code cũ và test). */
        public HoldRequest(String reason) {
            this(reason, null, null);
        }
    }
}
