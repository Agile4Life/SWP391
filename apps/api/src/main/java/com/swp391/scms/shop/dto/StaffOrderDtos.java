package com.swp391.scms.shop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nhóm các DTO cho màn xử lý đơn của nhân viên. */
public final class StaffOrderDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private StaffOrderDtos() {}

    /** Yêu cầu giao hàng: đơn vị vận chuyển và mã vận đơn. */
    public record ShipRequest(
            @Size(max = 60) String carrier,
            @NotBlank @Size(min = 3, max = 60) String trackingNumber
    ) {}

    /** Yêu cầu xác nhận thu tiền tại quầy: phương thức thanh toán. */
    public record CounterPaymentRequest(
            @NotBlank String method
    ) {}

    /** Yêu cầu nhân viên hủy đơn: lý do (5–255 ký tự) và có hoàn kho không (mặc định có). */
    public record StaffCancelRequest(
            @NotBlank @Size(min = 5, max = 255) String reason,
            Boolean restock
    ) {
        /** Constructor nhận restock kiểu boolean nguyên thủy. */
        public StaffCancelRequest(String reason, boolean restock) {
            this(reason, Boolean.valueOf(restock));
        }

        /** True nếu cần hoàn kho (null được coi là có). */
        public boolean shouldRestock() {
            return restock == null || restock;
        }
    }

    /** Số đơn theo từng trạng thái cần xử lý: đã thanh toán, đang xử lý, chờ nhận, đang giao, chờ thu tại quầy. */
    public record OrderCountsDto(
            long paid,
            long processing,
            long ready_for_pickup,
            long shipping,
            long counter_pending
    ) {}
}
