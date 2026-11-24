package com.swp391.scms.courts.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.courts.dto.CourtBookingRequests.*;
import com.swp391.scms.courts.dto.CourtBookingResponses.*;
import com.swp391.scms.courts.service.CourtBookingService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** API đặt sân Tennis/Cầu lông/Bơi lội (đã ngừng; chỉ bật khi app.legacy.courts-enabled=true). */
@RestController
@ConditionalOnProperty(name = "app.legacy.courts-enabled", havingValue = "true")
@RequestMapping("/api/v1")
public class CourtBookingController {
    private final CourtBookingService service;
    private final MessageService messages;
    /** Constructor cho test: không có MessageService. */
    public CourtBookingController(CourtBookingService service) { this(service, null); }
    /** Constructor chính: nhận CourtBookingService và MessageService. */
    @org.springframework.beans.factory.annotation.Autowired
    public CourtBookingController(CourtBookingService service, MessageService messages) {
        this.service = service; this.messages = messages;
    }
    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) { return messages == null ? key : messages.getMessage(key); }

    /** GET /courts: danh sách sân đang mở, lọc theo bộ môn. */
    @GetMapping("/courts")
    @PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST','STAFF','CENTER_MANAGER')")
    public ApiResponse<List<CourtDto>> courts(@RequestParam(required = false) String discipline) {
        return ApiResponse.ok(msg("success.courts.list"), service.listCourts(discipline));
    }

    /** GET /courts/{roomId}/availability: các khung 1 giờ của sân trong ngày kèm trạng thái và giá. */
    @GetMapping("/courts/{roomId}/availability")
    @PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST','STAFF','CENTER_MANAGER')")
    public ApiResponse<List<SlotDto>> availability(@PathVariable Long roomId, @RequestParam LocalDate date) {
        return ApiResponse.ok(msg("success.courts.availability"), service.availability(roomId, date));
    }

    /** POST /court-bookings: hội viên đặt một khung giờ sân. */
    @PostMapping("/court-bookings")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<BookingDto>> book(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                      @Valid @RequestBody BookRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(msg("success.courts.booked"), service.book(principal, request)));
    }

    /** GET /court-bookings/quota: hạn mức đặt sân của hội viên trong chu kỳ chứa ngày được chọn. */
    @GetMapping("/court-bookings/quota")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<QuotaDto> quota(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                       @RequestParam(required = false) LocalDate date) {
        return ApiResponse.ok(msg("success.courts.quota"), service.quota(principal, date));
    }

    /** GET /court-bookings/my: lịch sử đặt sân của hội viên, phân trang. */
    @GetMapping("/court-bookings/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<Page<BookingDto>> my(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(msg("success.courts.my"), service.my(principal, page, size));
    }

    /** GET /court-bookings: lễ tân/quản lý xem lượt đặt sân trong ngày, lọc theo sân, phân trang. */
    @GetMapping("/court-bookings")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER')")
    public ApiResponse<Page<BookingDto>> daily(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                              @RequestParam LocalDate date, @RequestParam(required = false) Long roomId,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(msg("success.courts.bookings"), service.daily(principal, date, roomId, page, size));
    }

    /** PATCH /court-bookings/{id}/cancel: hủy lượt đặt sân kèm lý do (tùy chọn). */
    @PatchMapping("/court-bookings/{id}/cancel")
    @PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST','STAFF','CENTER_MANAGER')")
    public ApiResponse<BookingDto> cancel(@AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long id,
                                         @Valid @RequestBody(required = false) CancelRequest request) {
        return ApiResponse.ok(msg("success.courts.cancelled"), service.cancel(principal, id, request == null ? null : request.reason()));
    }

    /** PATCH /court-bookings/{id}/confirm-payment: lễ tân xác nhận đã thu tiền mặt. */
    @PatchMapping("/court-bookings/{id}/confirm-payment")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','STAFF','CENTER_MANAGER')")
    public ApiResponse<BookingDto> confirmPayment(@AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long id) {
        return ApiResponse.ok(msg("success.courts.payment_confirmed"), service.confirmPayment(principal, id));
    }

}
