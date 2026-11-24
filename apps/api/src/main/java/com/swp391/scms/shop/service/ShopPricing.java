package com.swp391.scms.shop.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.shop.ShopProperties;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Tính phí giao hàng của đơn shop theo cấu hình. */
@Service
public class ShopPricing {
    private final ShopProperties props;

    /** Khởi tạo với cấu hình shop. */
    public ShopPricing(ShopProperties props) {
        this.props = props;
    }

    /**
     * Phí giao hàng: nhận tại quầy miễn phí, giao tận nơi miễn phí khi tạm tính đạt ngưỡng, ngược lại tính phí
     * cấu hình; hình thức nhận sai thì báo lỗi.
     */
    public BigDecimal shippingFee(String fulfillment, BigDecimal subtotal) {
        if (fulfillment == null || (!"delivery".equals(fulfillment) && !"pickup".equals(fulfillment))) {
            throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Invalid fulfillment");
        }
        if ("pickup".equals(fulfillment)) {
            return BigDecimal.ZERO;
        }
        BigDecimal safeSubtotal = subtotal == null ? BigDecimal.ZERO : subtotal;
        if (safeSubtotal.compareTo(props.getFreeShippingThreshold()) >= 0) {
            return BigDecimal.ZERO;
        }
        return props.getShippingFee().setScale(0, RoundingMode.HALF_UP);
    }
}
