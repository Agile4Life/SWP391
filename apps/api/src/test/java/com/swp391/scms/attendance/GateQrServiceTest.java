package com.swp391.scms.attendance;

import com.swp391.scms.attendance.service.GateQrService;
import com.swp391.scms.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GateQrServiceTest {
    private final GateQrService service = new GateQrService("test-gate-signing-secret");
    private final long now = 1793256000000L;

    @Test void signedGateHasShortLifetimeAndVerifies() {
        var qr = service.generate("A1", now);
        assertEquals("A1", service.verify(qr.qrCode(), now + 59000));
        assertEquals(60, qr.expiresInSeconds());
        assertThrows(BadRequestException.class, () -> service.verify(qr.qrCode(), now + 60000));
    }

    @Test void rejectsTamperingWrongTypeUnknownGateAndFutureTimestamp() {
        var qr = service.generate("A1", now).qrCode();
        assertThrows(BadRequestException.class, () -> service.verify(qr.replace(":A1:", ":A2:"), now));
        assertThrows(BadRequestException.class, () -> service.verify(qr.replace("SOL:GATE:", "DYN:"), now));
        assertThrows(BadRequestException.class, () -> service.generate("unknown", now));
        assertThrows(BadRequestException.class, () -> service.verify(qr, now - 1000));
        assertThrows(BadRequestException.class, () -> service.verify("", now));
    }
}
