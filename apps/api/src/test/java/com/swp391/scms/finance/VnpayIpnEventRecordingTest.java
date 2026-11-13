package com.swp391.scms.finance;

import com.swp391.scms.finance.controller.VnpayController;
import com.swp391.scms.finance.entity.VnpayIpnEvent;
import com.swp391.scms.finance.repository.VnpayIpnEventRepository;
import com.swp391.scms.finance.service.*;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.util.LinkedMultiValueMap;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VnpayIpnEventRecordingTest {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static Map<String, String> callback() {
        Map<String, String> p = new HashMap<>();
        p.put("vnp_TxnRef", "ABC123");
        p.put("vnp_ResponseCode", "00");
        p.put("vnp_TransactionStatus", "00");
        p.put("vnp_TransactionNo", "14567890");
        p.put("vnp_Amount", "15000000");
        p.put("vnp_SecureHash", "deadbeefsecret");
        return p;
    }

    private static LinkedMultiValueMap<String, String> multi(Map<String, String> p) {
        var m = new LinkedMultiValueMap<String, String>();
        p.forEach(m::add);
        return m;
    }

    @ParameterizedTest
    @ValueSource(strings = {"00", "02", "97"})
    void recordsTheCodeAnsweredToVnpay(String code) {
        var service = mock(VnpayPaymentService.class);
        var recorder = mock(VnpayIpnEventRecorder.class);
        when(service.ipn(anyMap())).thenReturn(code);
        var response = new VnpayIpnHandler(service, null, recorder).handle(multi(callback()));
        assertEquals(code, response.get("RspCode"));
        verify(recorder).record(eq(VnpayIpnEvent.SOURCE_IPN), argThat(m -> "ABC123".equals(m.get("vnp_TxnRef"))), eq(code));
    }

    @Test
    void rolledBackSettlementIsRecordedAsRetryable() {
        var service = mock(VnpayPaymentService.class);
        var recorder = mock(VnpayIpnEventRecorder.class);
        when(service.ipn(anyMap())).thenThrow(new org.springframework.dao.CannotAcquireLockException("lock"));
        assertEquals("99", new VnpayIpnHandler(service, null, recorder).handle(multi(callback())).get("RspCode"));
        verify(recorder).record(eq(VnpayIpnEvent.SOURCE_IPN), anyMap(), eq("99"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"00", "99"})
    void recorderFailureNeverChangesTheAnswer(String code) {
        var service = mock(VnpayPaymentService.class);
        var recorder = mock(VnpayIpnEventRecorder.class);
        if ("99".equals(code)) when(service.ipn(anyMap())).thenThrow(new IllegalStateException("db down"));
        else when(service.ipn(anyMap())).thenReturn(code);
        doThrow(new org.springframework.transaction.CannotCreateTransactionException("no db"))
                .when(recorder).record(anyString(), anyMap(), anyString());
        var response = new VnpayIpnHandler(service, null, recorder).handle(multi(callback()));
        assertEquals(code, response.get("RspCode"));
    }

    @Test
    void emptyCallbackIsRecordedAsInvalid() {
        var recorder = mock(VnpayIpnEventRecorder.class);
        var handler = new VnpayIpnHandler(mock(VnpayPaymentService.class), null, recorder);
        assertEquals("97", handler.process(Map.of(), VnpayIpnEvent.SOURCE_RETURN).get("RspCode"));
        verify(recorder).record(eq(VnpayIpnEvent.SOURCE_RETURN), eq(Map.of()), eq("97"));
    }

    @Test
    void verifyReturnRecordsReturnSource() {
        var payments = mock(VnpayPaymentService.class);
        var handler = mock(VnpayIpnHandler.class);
        var controller = new VnpayController(payments, handler, null);
        var params = callback();
        controller.verifyReturn(new AuthenticatedPrincipal(7L, "m@x.vn", "MEMBER"), params);
        verify(handler).process(params, VnpayIpnEvent.SOURCE_RETURN);
        verify(handler, never()).process(params);
    }

    @Test
    void recorderKeepsOnlyNonSensitiveFields() {
        var repo = mock(VnpayIpnEventRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-11-13T03:00:00Z"), ZONE);
        new VnpayIpnEventRecorder(repo, clock).record(VnpayIpnEvent.SOURCE_IPN, callback(), "00");
        var captor = ArgumentCaptor.forClass(VnpayIpnEvent.class);
        verify(repo).save(captor.capture());
        VnpayIpnEvent e = captor.getValue();
        assertEquals("ABC123", e.getReference());
        assertEquals("IPN", e.getSource());
        assertEquals("00", e.getGatewayResponseCode());
        assertEquals("00", e.getGatewayTransactionStatus());
        assertEquals("14567890", e.getGatewayTransactionNo());
        assertEquals(0, new BigDecimal("150000").compareTo(e.getAmount()));
        assertEquals("00", e.getRspCode());
        assertEquals(LocalDateTime.of(2026, 11, 13, 10, 0), e.getReceivedAt());
        for (var field : VnpayIpnEvent.class.getDeclaredFields()) {
            assertFalse(field.getName().toLowerCase().contains("hash"), field.getName());
            assertFalse(field.getName().toLowerCase().contains("address"), field.getName());
        }
    }

    @Test
    void recorderToleratesJunkAndSwallowsSaveErrors() {
        var repo = mock(VnpayIpnEventRepository.class);
        when(repo.save(any())).thenThrow(new IllegalStateException("db"));
        var recorder = new VnpayIpnEventRecorder(repo, Clock.system(ZONE));
        Map<String, String> junk = Map.of("vnp_TxnRef", "X".repeat(80), "vnp_Amount", "abc", "vnp_ResponseCode", "0000");
        assertDoesNotThrow(() -> recorder.record("weird", junk, "97"));
        var captor = ArgumentCaptor.forClass(VnpayIpnEvent.class);
        verify(repo).save(captor.capture());
        assertEquals(32, captor.getValue().getReference().length());
        assertNull(captor.getValue().getAmount());
        assertEquals("00", captor.getValue().getGatewayResponseCode());
        assertEquals("IPN", captor.getValue().getSource());
    }
}
