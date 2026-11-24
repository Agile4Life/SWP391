package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.SessionBookingRequests.BulkBookRequest;
import com.swp391.scms.scheduling.dto.SessionBookingRequests.BulkCancelRequest;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.BulkBookResult;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.BulkCancelResult;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.SessionBookingDto;
import com.swp391.scms.scheduling.service.SessionBookingService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * API đặt chỗ từng buổi học của hội viên (đã ngừng; chỉ bật khi app.legacy.classes-enabled=true).
 *
 * Đặt chỗ lớp theo từng buổi: một buổi, tập buổi chọn tay, cả tuần hoặc cả tháng, và việc hủy chúng.
 */
@Tag(name = "Session Bookings", description = "Book and cancel individual class sessions, singly or in bulk")
@RestController
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
@RequestMapping("/api/v1/classes")
public class SessionBookingController {

    private final SessionBookingService service;
    private final MessageService messageService;

    /** Khởi tạo controller với SessionBookingService và MessageService. */
    public SessionBookingController(SessionBookingService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** POST /sessions/{id}/bookings: đặt chỗ một buổi — đã ngừng, luôn ném lỗi SingleSessionPolicy. */
    @Operation(summary = "Book one class session for the authenticated member")
    @PostMapping("/sessions/{id}/bookings")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<SessionBookingDto>> book(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                              @PathVariable Long id) {
        throw SingleSessionPolicy.rejection();
    }

    /** POST /session-bookings/bulk: đặt nhiều buổi — đã ngừng, luôn ném lỗi SingleSessionPolicy. */
    @Operation(summary = "Book many sessions at once (a week, a month or a hand-picked set); failures are reported per session")
    @PostMapping("/session-bookings/bulk")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<BulkBookResult>> bookMany(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                               @Valid @RequestBody BulkBookRequest request) {
        throw SingleSessionPolicy.rejection();
    }

    /** GET /session-bookings/my: các lượt đặt chỗ của hội viên, lọc theo trạng thái và khoảng ngày. */
    @Operation(summary = "List the authenticated member's session bookings, optionally by status and date range")
    @GetMapping("/session-bookings/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<List<SessionBookingDto>> mine(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                    @RequestParam(required = false) String status,
                                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(msg("scheduling.booking.list"), service.myBookings(principal, status, from, to));
    }

    /** DELETE /session-bookings/{id}: hủy một lượt đặt chỗ (chủ sở hữu hoặc nhân viên). */
    @Operation(summary = "Cancel one session booking (owner or staff)")
    @DeleteMapping("/session-bookings/{id}")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<SessionBookingDto> cancel(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                @PathVariable Long id) {
        return ApiResponse.ok(msg("scheduling.booking.cancelled"), service.cancel(principal, id));
    }

    /** POST /session-bookings/cancel: hủy nhiều lượt đặt chỗ; lượt nào lỗi được báo riêng. */
    @Operation(summary = "Cancel many session bookings at once; failures are reported per booking")
    @PostMapping("/session-bookings/cancel")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<BulkCancelResult> cancelMany(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                   @Valid @RequestBody BulkCancelRequest request) {
        return ApiResponse.ok(msg("scheduling.booking.bulk_cancelled"), service.cancelMany(principal, request.bookingIds()));
    }
}
