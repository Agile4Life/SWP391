package com.swp391.scms.shop.entity;

/**
 * Các trạng thái đơn hàng shop: chờ thanh toán, đã thanh toán, đang xử lý, đang giao, chờ nhận tại quầy, hoàn
 * tất, đã hủy.
 */
public enum OrderStatus {
    pending_payment,
    paid,
    processing,
    shipping,
    ready_for_pickup,
    completed,
    cancelled;

    /** True nếu là trạng thái kết thúc (hoàn tất hoặc đã hủy), không chuyển tiếp được nữa. */
    public boolean terminal() {
        return this == completed || this == cancelled;
    }
}
