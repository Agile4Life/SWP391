package com.swp391.scms.shop;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Cấu hình shop (tiền tố app.shop): phí ship, ngưỡng miễn phí ship, thời gian chờ thanh toán, thời gian giữ
 * hàng tại quầy, địa chỉ nhận hàng và có tạo dữ liệu mẫu không.
 */
@Component
@ConfigurationProperties(prefix = "app.shop")
public class ShopProperties {
    private BigDecimal shippingFee = BigDecimal.valueOf(30000);
    private BigDecimal freeShippingThreshold = BigDecimal.valueOf(500000);
    private int paymentWindowMinutes = 30;
    private int counterHoldHours = 48;
    private String pickupAddress = "120 Hai Bà Trưng, Phường Sài Gòn, TP. Hồ Chí Minh — quầy lễ tân";
    private boolean seedSamples = false;

    /** Lấy giá trị trường shippingFee. */
    public BigDecimal getShippingFee() { return shippingFee; }
    /** Gán giá trị mới cho trường shippingFee. */
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee; }
    /** Phí giao hàng (kiểu truy cập dạng record). */
    public BigDecimal shippingFee() { return shippingFee; }

    /** Lấy giá trị trường freeShippingThreshold. */
    public BigDecimal getFreeShippingThreshold() { return freeShippingThreshold; }
    /** Gán giá trị mới cho trường freeShippingThreshold. */
    public void setFreeShippingThreshold(BigDecimal freeShippingThreshold) { this.freeShippingThreshold = freeShippingThreshold; }
    /** Giá trị đơn tối thiểu để được miễn phí giao hàng. */
    public BigDecimal freeShippingThreshold() { return freeShippingThreshold; }

    /** Lấy giá trị trường paymentWindowMinutes. */
    public int getPaymentWindowMinutes() { return paymentWindowMinutes; }
    /** Gán giá trị mới cho trường paymentWindowMinutes. */
    public void setPaymentWindowMinutes(int paymentWindowMinutes) { this.paymentWindowMinutes = paymentWindowMinutes; }
    /** Số phút chờ thanh toán online trước khi đơn bị hủy. */
    public int paymentWindowMinutes() { return paymentWindowMinutes; }

    /** Lấy giá trị trường counterHoldHours. */
    public int getCounterHoldHours() { return counterHoldHours; }
    /** Gán giá trị mới cho trường counterHoldHours. */
    public void setCounterHoldHours(int counterHoldHours) { this.counterHoldHours = counterHoldHours; }
    /** Số giờ giữ hàng cho đơn thanh toán tại quầy. */
    public int counterHoldHours() { return counterHoldHours; }

    /** Lấy giá trị trường pickupAddress. */
    public String getPickupAddress() { return pickupAddress; }
    /** Gán giá trị mới cho trường pickupAddress. */
    public void setPickupAddress(String pickupAddress) { this.pickupAddress = pickupAddress; }
    /** Địa chỉ nhận hàng tại quầy. */
    public String pickupAddress() { return pickupAddress; }

    /** Cho biết seed samples (trường boolean). */
    public boolean isSeedSamples() { return seedSamples; }
    /** Gán giá trị mới cho trường seedSamples. */
    public void setSeedSamples(boolean seedSamples) { this.seedSamples = seedSamples; }
    /** Có tạo dữ liệu sản phẩm mẫu khi khởi động không. */
    public boolean seedSamples() { return seedSamples; }
}
