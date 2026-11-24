package com.swp391.scms.shop.dto;

import com.swp391.scms.shop.dto.AddressDtos.AddressRequest;
import com.swp391.scms.shop.dto.QuoteDtos.QuoteLineRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Nhóm các DTO cho đơn hàng shop của hội viên. */
public final class OrderDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private OrderDtos() {}

    /**
     * Yêu cầu đặt hàng: mã yêu cầu chống gửi trùng, các dòng sản phẩm, hình thức nhận, phương thức thanh toán,
     * địa chỉ có sẵn hoặc mới, có lưu địa chỉ không và tổng tiền dự kiến.
     */
    public record CreateOrderRequest(
            @NotBlank @Size(min = 8, max = 36) String clientRequestId,
            @NotEmpty @Size(min = 1, max = 30) List<@Valid QuoteLineRequest> items,
            @NotBlank String fulfillment,
            @NotBlank String paymentMethod,
            Long addressId,
            @Valid AddressRequest shippingAddress,
            boolean saveAddress,
            @NotNull @DecimalMin("0") BigDecimal expectedTotal
    ) {
        /** Constructor rút gọn cho đơn nhận tại quầy (không có địa chỉ). */
        public CreateOrderRequest(
                String clientRequestId,
                List<QuoteLineRequest> items,
                String fulfillment,
                String paymentMethod,
                BigDecimal expectedTotal
        ) {
            this(clientRequestId, items, fulfillment, paymentMethod, null, null, false, expectedTotal);
        }
    }

    /** Yêu cầu hủy đơn: lý do tối đa 255 ký tự. */
    public record CancelOrderRequest(
            @Size(max = 255) String reason
    ) {}

    /** Một dòng sản phẩm trong đơn: biến thể, tên, nhãn, SKU, đơn giá, số lượng, thành tiền, slug và ảnh. */
    public record OrderItemDto(
            Long variantId,
            String productName,
            String variantLabel,
            String sku,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal,
            String slug,
            String imageUrl
    ) {}

    /** Thông tin giao hàng của đơn: người nhận, số điện thoại, tỉnh, phường, địa chỉ chi tiết và ghi chú. */
    public record OrderShippingDto(
            String recipientName,
            String phone,
            String provinceName,
            String wardName,
            String streetLine,
            String note
    ) {}

    /** Thông tin hội viên đặt đơn: id, họ tên và số điện thoại. */
    public record OrderMemberDto(
            Long id,
            String fullName,
            String phone
    ) {}

    /**
     * Chi tiết đơn hàng: mã, trạng thái, hình thức nhận, thanh toán, các dòng, tiền, giao hàng, địa chỉ nhận
     * tại quầy và các mốc thời gian.
     */
    public record OrderDto(
            Long id,
            String code,
            String status,
            String fulfillment,
            String paymentMethod,
            List<OrderItemDto> items,
            BigDecimal subtotal,
            BigDecimal shippingFee,
            BigDecimal total,
            OrderShippingDto shipping,
            String pickupAddress,
            LocalDateTime paymentDueAt,
            LocalDateTime createdAt,
            LocalDateTime paidAt,
            LocalDateTime processingAt,
            LocalDateTime shippedAt,
            LocalDateTime readyAt,
            LocalDateTime completedAt,
            LocalDateTime cancelledAt,
            String cancelReason,
            String trackingCarrier,
            String trackingNumber,
            boolean canCancel,
            boolean canPay,
            BigDecimal refundedAmount,
            OrderMemberDto member
    ) {}

    /**
     * Tóm tắt đơn trong danh sách: mã, trạng thái, hình thức nhận, thanh toán, tổng tiền, số dòng, tên sản phẩm
     * đầu và có thanh toán được không.
     */
    public record OrderSummaryDto(
            Long id,
            String code,
            String status,
            String fulfillment,
            String paymentMethod,
            BigDecimal total,
            int itemCount,
            String firstItemName,
            LocalDateTime createdAt,
            boolean canPay
    ) {}
}
