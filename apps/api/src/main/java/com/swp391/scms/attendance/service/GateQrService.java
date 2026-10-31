package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.dto.CheckinResponses.GateQrDto;
import com.swp391.scms.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/** Gate challenges have a separate signing domain from membership QR codes. */
@Service
public class GateQrService {
    public static final long TTL_SECONDS = 60;
    private static final String PREFIX = "SOL:GATE:1:";
    private static final Map<String, String> GATES = Map.of(
            "A1", "Turnstile A1 - Sảnh Chính", "A2", "Turnstile A2 - Sảnh Chính",
            "B1", "Turnstile B1 - Tầng Mezzanine");
    private final byte[] secret;

    public GateQrService(@Value("${app.qr.secret:${app.jwt.secret}}") String secret) {
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("Gate QR signing secret is required");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public GateQrDto generate(String gateId, long nowMillis) {
        String gate = gateName(gateId);
        String payload = PREFIX + gateId + ":" + nowMillis;
        return new GateQrDto(payload + ":" + sign(payload), gateId, gate,
                Instant.ofEpochMilli(nowMillis), Instant.ofEpochMilli(nowMillis + TTL_SECONDS * 1000), TTL_SECONDS);
    }

    public String verify(String qr, long nowMillis) {
        if (qr == null || qr.length() > 256 || !qr.startsWith(PREFIX)) throw invalid();
        String[] parts = qr.split(":", -1);
        if (parts.length != 6 || !GATES.containsKey(parts[3])) throw invalid();
        String payload = String.join(":", parts[0], parts[1], parts[2], parts[3], parts[4]);
        if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8), parts[5].getBytes(StandardCharsets.UTF_8))) throw invalid();
        long issued;
        try { issued = Long.parseLong(parts[4]); } catch (NumberFormatException e) { throw invalid(); }
        if (issued > nowMillis || issued <= nowMillis - TTL_SECONDS * 1000) {
            throw new BadRequestException("GATE_QR_EXPIRED", "error.attendance.gate_qr_expired", null, "error.attendance.gate_qr_expired");
        }
        return parts[3];
    }

    public String gateName(String gateId) {
        if (gateId == null || !GATES.containsKey(gateId)) throw invalid();
        return GATES.get(gateId);
    }

    private BadRequestException invalid() {
        return new BadRequestException("GATE_QR_INVALID", "error.attendance.gate_qr_invalid", null, "error.attendance.gate_qr_invalid");
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("Cannot sign gate challenge", e);
        }
    }
}
