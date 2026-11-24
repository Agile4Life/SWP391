package com.swp391.scms.finance.service;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.entity.VnpayIpnEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import java.util.*;

/**
 * Xử lý callback VNPay bên ngoài transaction thanh toán, để lỗi database/commit được trả về mã 99 (VNPay sẽ gọi
 * lại).
 *
 * Outside the settlement transaction so database/commit errors are returned as retryable VNPay responses.
 */
@Service
public class VnpayIpnHandler {
    private final VnpayPaymentService payments;
    private final MessageService messages;
    private final VnpayIpnEventRecorder recorder;
    /** Constructor cho test, không ghi nhật ký callback. */
    public VnpayIpnHandler(VnpayPaymentService payments, MessageService messages) {this(payments,messages,null);}
    /** Constructor Spring dùng. */
    @Autowired
    public VnpayIpnHandler(VnpayPaymentService payments, MessageService messages,
            @Autowired(required = false) VnpayIpnEventRecorder recorder) {
        this.payments=payments;this.messages=messages;this.recorder=recorder;
    }
    /** Xử lý tham số dạng Map từ IPN. */
    public Map<String,String> process(Map<String,String> params) {return process(params, VnpayIpnEvent.SOURCE_IPN);}
    /** Xử lý tham số dạng Map với nguồn chỉ định (IPN hoặc trang quay về); rỗng thì trả mã 97. */
    public Map<String,String> process(Map<String,String> params, String source) {
        if (params == null || params.isEmpty()) {
            record(source, Map.of(), "97");
            return response("97");
        }
        var multi = new org.springframework.util.LinkedMultiValueMap<String,String>();
        params.forEach((k, v) -> {
            if (k != null && v != null) multi.add(k, v);
        });
        return handle(multi, source);
    }
    /** Xử lý tham số dạng MultiValueMap từ IPN. */
    public Map<String,String> handle(MultiValueMap<String,String> params) {return handle(params, VnpayIpnEvent.SOURCE_IPN);}
    /** Xử lý callback: tham số lặp thì mã 97; gọi xử lý thanh toán, lỗi thì mã 99; ghi nhật ký rồi trả kết quả. */
    public Map<String,String> handle(MultiValueMap<String,String> params, String source) {
        String code;
        if(params.entrySet().stream().anyMatch(e->e.getValue().size()!=1)) code="97";
        else {
            try { code=payments.ipn(params.toSingleValueMap()); }
            catch(RuntimeException e) {
                org.slf4j.LoggerFactory.getLogger(VnpayIpnHandler.class).warn("VNPay settlement rolled back; callback can be retried ({})",e.getClass().getSimpleName());
                code="99";
            }
        }
        record(source, params.toSingleValueMap(), code);
        return response(code);
    }
    /**
     * Ghi nhật ký callback (việc phụ, không làm đổi hay chậm câu trả lời).
     *
     * Recording is best effort: it never changes or delays the code returned to VNPay.
     */
    private void record(String source, Map<String,String> params, String code) {
        if (recorder == null) return;
        try { recorder.record(source, params, code); }
        catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(VnpayIpnHandler.class).warn("VNPay callback event not recorded ({})",e.getClass().getSimpleName());
        }
    }
    /** Câu trả lời cho VNPay: RspCode và thông báo đã dịch. */
    private Map<String,String> response(String code) {
        return Map.of("RspCode",code,"Message",messages!=null?messages.getMessage("finance.vnpay.ipn."+code):"finance.vnpay.ipn."+code);
    }
}
