package com.swp391.scms.attendance;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API check-in/check-out tại cổng trung tâm (/api/v1/check-in): quầy hiển thị QR cổng và quét QR của hội viên;
 * hội viên tự quét QR cổng để vào/ra; xem lịch sử ra vào.
 *
 * Controller cho check-in QR vào trung tâm, check-out và lịch sử theo ngày (SCRUM-75).
 */
@Tag(name = "Center Check-in", description = "QR check-in, checkout and daily history (SCRUM-75)")
@RestController
@RequestMapping("/api/v1/check-in")
public class CenterCheckinController {

    private final CenterCheckinService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public CenterCheckinController(CenterCheckinService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @Autowired
    public CenterCheckinController(CenterCheckinService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /gate-qr?gateId=: quầy lấy mã QR cổng có chữ ký, sống 60 giây, để hội viên quét vào. */
    @GetMapping("/gate-qr")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'CENTER_MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<com.swp391.scms.attendance.dto.CheckinResponses.GateQrDto>> gateQr(
            @AuthenticationPrincipal AuthenticatedPrincipal principal, @RequestParam(defaultValue = "A1") String gate) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(ApiResponse.ok(msg("attendance.gate_qr.success"), service.gateQr(principal, gate)));
    }

    /** POST /self: hội viên quét QR cổng để check-in (mọi lượt, dù được vào hay bị từ chối, đều được ghi lại). */
    @PostMapping("/self")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<CheckinDto>> selfScan(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckinRequests.SelfScan request) {
        CheckinDto dto = service.selfScan(principal, request);
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(org.springframework.http.CacheControl.noStore())
                .body(ApiResponse.created(msg("GRANTED".equals(dto.status()) ? "attendance.checkin.granted" : "attendance.checkin.denied"), dto));
    }

    /** POST /scan: quầy quét mã QR động trên thẻ hội viên để cho vào. */
    @Operation(summary = "Scan a membership QR code at center gate (Staff only)")
    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'CENTER_MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<CheckinDto>> scan(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckinRequests.Scan request) {
        CheckinDto dto = service.scan(principal, request);
        String msgKey = "GRANTED".equalsIgnoreCase(dto.status())
                ? "attendance.checkin.granted"
                : "attendance.checkin.denied";
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg(msgKey), dto));
    }

    /** POST /{id}/checkout: quầy ghi nhận giờ ra cho một lượt vào. */
    @Operation(summary = "Check out of the center (Staff only)")
    @PostMapping("/{id}/checkout")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'CENTER_MANAGER', 'ADMIN')")
    public ApiResponse<CheckinDto> checkout(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("attendance.checkout.success"), service.checkout(principal, id));
    }

    /** GET /history?from=&to=: lịch sử ra vào (nhân viên xem tất cả, hội viên chỉ của mình), mặc định hôm nay. */
    @Operation(summary = "Get today's center check-in history")
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('RECEPTIONIST', 'CENTER_MANAGER', 'MEMBER', 'ADMIN')")
    public ApiResponse<List<CheckinDto>> history(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate fromDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate toDate) {
        List<CheckinDto> rows = fromDate == null && toDate == null
                ? service.history(principal)
                : service.history(principal, fromDate, toDate);
        return ApiResponse.ok(msg("attendance.history.success"), rows);
    }

    /** POST /self/checkout: hội viên quét QR cổng để check-out. */
    @Operation(summary = "Member checks out by scanning the gate QR")
    @PostMapping("/self/checkout")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<CheckinDto>> selfCheckout(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CheckinRequests.SelfScan request) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(ApiResponse.ok(msg("attendance.self_checkout.success"), service.selfCheckout(principal, request)));
    }
}
