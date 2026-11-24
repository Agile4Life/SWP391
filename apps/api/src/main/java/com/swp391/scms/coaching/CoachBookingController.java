package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.*;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * API đặt lịch PT 1:1: danh sách HLV, slot trống, hạn mức, đặt/hủy lịch, điểm danh và thu tiền buổi lẻ.
 *
 * SCRUM-133: REST Controller for 1-on-1 coach booking (PT hourly booking).
 */
@RestController
@RequestMapping("/api/v1/coach-bookings")
public class CoachBookingController {

    private final CoachBookingService coachBookingService;
    private final MessageService messageService;

    /** Khởi tạo controller với CoachBookingService và MessageService. */
    public CoachBookingController(CoachBookingService coachBookingService, MessageService messageService) {
        this.coachBookingService = coachBookingService;
        this.messageService = messageService;
    }

    /** GET /coaches: danh sách HLV công khai để hội viên chọn. */
    @GetMapping("/coaches")
    public ResponseEntity<ApiResponse<List<CoachPublicDto>>> getCoaches() {
        List<CoachPublicDto> coaches = coachBookingService.getPublicCoaches();
        String msg = messageService != null
                ? messageService.getMessage("message.coach.list_success", "Lấy danh sách HLV thành công")
                : "Lấy danh sách HLV thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, coaches));
    }

    /** GET /available-slots: các khung giờ còn trống của HLV trong một ngày. */
    @GetMapping("/available-slots")
    public ResponseEntity<ApiResponse<List<CoachAvailableSlotDto>>> getAvailableSlots(
            @RequestParam("coachId") Long coachId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Long memberId = principal != null ? principal.id() : null;
        List<CoachAvailableSlotDto> slots = coachBookingService.getAvailableSlots(coachId, date, memberId);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.slots_success", "Lấy danh sách khung giờ thành công")
                : "Lấy danh sách khung giờ thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, slots));
    }

    /** GET /quota-status: số buổi PT còn lại trong hạn mức gói của hội viên đang đăng nhập. */
    @GetMapping("/quota-status")
    public ResponseEntity<ApiResponse<CoachQuotaStatusDto>> getQuotaStatus(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        CoachQuotaStatusDto status = coachBookingService.getMemberQuotaStatus(principal.id());
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.quota_success", "Lấy trạng thái hạn mức PT thành công")
                : "Lấy trạng thái hạn mức PT thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, status));
    }

    /** POST: hội viên tạo booking PT 1:1 mới. */
    @PostMapping
    public ResponseEntity<ApiResponse<CoachBookingDto>> createBooking(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody CoachBookingCreateDto request) {
        CoachBookingDto booking = coachBookingService.createBooking(principal, request);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.created_success", "Đặt lịch HLV 1:1 thành công")
                : "Đặt lịch HLV 1:1 thành công";
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(msg, booking));
    }

    /** GET /my: danh sách booking PT của hội viên đang đăng nhập. */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<CoachBookingDto>>> getMyBookings(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<CoachBookingDto> bookings = coachBookingService.getMemberBookings(principal.id());
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.my_list_success", "Lấy danh sách lịch 1:1 thành công")
                : "Lấy danh sách lịch 1:1 thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, bookings));
    }

    /** GET /coach-schedule: lịch dạy 1:1 của HLV đang đăng nhập. */
    @GetMapping("/coach-schedule")
    public ResponseEntity<ApiResponse<List<CoachBookingDto>>> getCoachSchedule(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<CoachBookingDto> schedule = coachBookingService.getCoachSchedule(principal.id());
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.coach_schedule_success", "Lấy danh sách lịch dạy kèm 1:1 thành công")
                : "Lấy danh sách lịch dạy kèm 1:1 thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, schedule));
    }

    /** GET /attendance: danh sách buổi 1:1 cần điểm danh, lọc theo khoảng ngày và kết quả (có mặt/vắng). */
    @GetMapping("/attendance")
    public ResponseEntity<ApiResponse<List<CoachBookingDto>>> getAttendance(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(value = "from", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(value = "to", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @RequestParam(value = "outcome", required = false) String outcome) {
        List<CoachBookingDto> rows = coachBookingService.getAttendance(principal, from, to, outcome);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.attendance_list", "Danh sách điểm danh buổi 1:1")
                : "Danh sách điểm danh buổi 1:1";
        return ResponseEntity.ok(ApiResponse.ok(msg, rows));
    }

    /** POST /{id}/mark-attended: HLV hoặc lễ tân ghi nhận hội viên có mặt ở buổi 1:1. */
    @PostMapping("/{id}/mark-attended")
    public ResponseEntity<ApiResponse<CoachBookingDto>> markAttended(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id) {
        CoachBookingDto marked = coachBookingService.markAttended(principal, id);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.attendance_marked", "Đã ghi nhận hội viên có mặt")
                : "Đã ghi nhận hội viên có mặt";
        return ResponseEntity.ok(ApiResponse.ok(msg, marked));
    }

    /** POST /{id}/unmark-attended: bỏ ghi nhận có mặt đã đánh dấu nhầm. */
    @PostMapping("/{id}/unmark-attended")
    public ResponseEntity<ApiResponse<CoachBookingDto>> unmarkAttended(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id) {
        CoachBookingDto result = coachBookingService.unmarkAttended(principal, id);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.attendance_unmarked", "Đã bỏ ghi nhận có mặt")
                : "Đã bỏ ghi nhận có mặt";
        return ResponseEntity.ok(ApiResponse.ok(msg, result));
    }

    /** GET /unpaid: danh sách buổi 1:1 trả theo giờ chưa thanh toán. */
    @GetMapping("/unpaid")
    public ResponseEntity<ApiResponse<List<CoachBookingDto>>> getUnpaidBookings(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        List<CoachBookingDto> bookings = coachBookingService.getUnpaidBookings(principal);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.unpaid_list", "Danh sách buổi 1:1 chưa thanh toán")
                : "Danh sách buổi 1:1 chưa thanh toán";
        return ResponseEntity.ok(ApiResponse.ok(msg, bookings));
    }

    /** POST /{id}/confirm-payment: lễ tân xác nhận đã thu tiền buổi 1:1 theo phương thức truyền vào. */
    @PostMapping("/{id}/confirm-payment")
    public ResponseEntity<ApiResponse<CoachBookingDto>> confirmPayment(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id,
            @RequestParam(value = "method", required = false) String method) {
        CoachBookingDto paid = coachBookingService.confirmHourlyPayment(principal, id, method);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.payment_confirmed", "Đã xác nhận thu tiền buổi 1:1")
                : "Đã xác nhận thu tiền buổi 1:1";
        return ResponseEntity.ok(ApiResponse.ok(msg, paid));
    }

    /** DELETE /{id}: hủy booking 1:1 kèm lý do (tùy chọn). */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<CoachBookingDto>> cancelBooking(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("id") Long id,
            @RequestParam(value = "reason", required = false) String reason) {
        CoachBookingDto cancelled = coachBookingService.cancelBooking(principal, id, reason);
        String msg = messageService != null
                ? messageService.getMessage("message.coach_booking.cancelled_success", "Hủy lịch 1:1 thành công")
                : "Hủy lịch 1:1 thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, cancelled));
    }
}
