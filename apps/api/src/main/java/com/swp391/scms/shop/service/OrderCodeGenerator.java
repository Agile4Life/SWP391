package com.swp391.scms.shop.service;

import com.swp391.scms.shop.repository.ProductOrderRepository;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Sinh mã đơn hàng dạng SOL-yyMMdd-XXXX (bảng chữ bỏ ký tự dễ nhầm) và kiểm tra không trùng. */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@Component
public class OrderCodeGenerator {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyMMdd");
    private final SecureRandom random = new SecureRandom();
    private final ProductOrderRepository orders;

    /** Constructor không kiểm tra trùng trong DB (dùng trong test). */
    public OrderCodeGenerator() {
        this(null);
    }

    /** Constructor chính: nhận repository đơn (tùy chọn) để kiểm tra mã đã tồn tại. */
    @Autowired
    public OrderCodeGenerator(@Autowired(required = false) ProductOrderRepository orders) {
        this.orders = orders;
    }

    /** Sinh mã đơn cho ngày cho trước: thử tối đa 5 lần với 4 ký tự ngẫu nhiên an toàn; vẫn trùng thì ném lỗi. */
    public String next(LocalDate date) {
        String datePart = (date != null ? date : LocalDate.now()).format(DATE_FMT);
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder suffix = new StringBuilder(4);
            for (int i = 0; i < 4; i++) {
                suffix.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            }
            String candidate = "SOL-" + datePart + "-" + suffix;
            if (orders == null || !orders.existsByCode(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate unique order code after 5 attempts");
    }
}
