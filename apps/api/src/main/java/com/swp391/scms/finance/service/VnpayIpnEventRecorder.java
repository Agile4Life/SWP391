package com.swp391.scms.finance.service;

import com.swp391.scms.finance.entity.VnpayIpnEvent;
import com.swp391.scms.finance.repository.VnpayIpnEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Ghi nhật ký mỗi callback VNPay trong transaction riêng (vì xử lý chính có thể đã rollback); lỗi bị bỏ qua để
 * câu trả lời cho VNPay không đổi.
 *
 * Keeps an audit row for each VNPay callback in its own transaction: the settlement may have rolled back (code 99)
 * and the handler runs outside any transaction. Failures are swallowed so the answer to VNPay never changes.
 */
@Service
public class VnpayIpnEventRecorder {
    private static final Logger log = LoggerFactory.getLogger(VnpayIpnEventRecorder.class);
    private final VnpayIpnEventRepository events;
    private final Clock clock;

    /** Nhận repository nhật ký callback và Clock. */
    public VnpayIpnEventRecorder(VnpayIpnEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    /** Lưu một bản ghi callback trong transaction riêng; lỗi chỉ ghi cảnh báo. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String source, Map<String, String> params, String rspCode) {
        try {
            events.save(toEvent(source, params, rspCode));
        } catch (RuntimeException e) {
            log.warn("Could not record VNPay callback event ({})", e.getClass().getSimpleName());
        }
    }

    /**
     * Dựng bản ghi từ các trường không nhạy cảm của cổng (mã tham chiếu, mã phản hồi, trạng thái, mã giao dịch,
     * số tiền) và mã đã trả lời.
     *
     * Builds the row from the whitelisted, non-sensitive gateway fields only.
     */
    VnpayIpnEvent toEvent(String source, Map<String, String> params, String rspCode) {
        Map<String, String> p = params != null ? params : Map.of();
        String normalizedSource = VnpayIpnEvent.SOURCE_RETURN.equals(source) ? VnpayIpnEvent.SOURCE_RETURN : VnpayIpnEvent.SOURCE_IPN;
        return new VnpayIpnEvent(
                clip(p.get("vnp_TxnRef"), 32),
                normalizedSource,
                clip(p.get("vnp_ResponseCode"), 2),
                clip(p.get("vnp_TransactionStatus"), 2),
                clip(p.get("vnp_TransactionNo"), 20),
                amount(p.get("vnp_Amount")),
                clip(rspCode != null ? rspCode : "99", 2),
                LocalDateTime.now(clock));
    }

    /** Cắt chuỗi về độ dài tối đa; trống thì null. */
    private static String clip(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    /** Đổi số tiền VNPay (đơn vị xu, nhân 100) về đồng; giá trị không hợp lệ hoặc quá lớn thì null. */
    private static BigDecimal amount(String raw) {
        if (raw == null || !raw.matches("[0-9]{1,14}")) return null;
        BigDecimal value = new BigDecimal(raw).movePointLeft(2);
        return value.compareTo(new BigDecimal("9999999999.99")) > 0 ? null : value;
    }
}
