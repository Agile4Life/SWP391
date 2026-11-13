package com.swp391.scms.finance.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.ReconciliationDtos.*;
import com.swp391.scms.finance.service.PaymentReconciliationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Read-only payment reconciliation for administrators: VNPay attempts, callbacks and automatic late refunds. */
@RestController
@RequestMapping("/api/v1/admin/payments/reconciliation")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Payment Reconciliation", description = "Read-only VNPay reconciliation for administrators")
@SecurityRequirement(name = "bearerAuth")
public class AdminPaymentReconciliationController {
    private final PaymentReconciliationService reconciliation;
    private final MessageService messages;

    @Autowired
    public AdminPaymentReconciliationController(PaymentReconciliationService reconciliation,
                                                @Autowired(required = false) MessageService messages) {
        this.reconciliation = reconciliation;
        this.messages = messages;
    }

    private String msg(String key) { return messages != null ? messages.getMessage(key) : key; }

    @GetMapping("/summary")
    @Operation(summary = "Reconciliation overview for a date range (default: last 7 days)")
    public ApiResponse<ReconciliationSummaryDto> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(msg("finance.reconciliation.summary"), reconciliation.summary(from, to));
    }

    @GetMapping("/attempts")
    @Operation(summary = "VNPay attempts with filters")
    public ApiResponse<Page<VnpayAttemptRowDto>> attempts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean stale,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(msg("finance.reconciliation.attempts"),
                reconciliation.attempts(status, stale, q, from, to, page, size));
    }

    @GetMapping("/late-refunds")
    @Operation(summary = "Automatic wallet refunds for VNPay payments confirmed too late")
    public ApiResponse<Page<LateRefundRowDto>> lateRefunds(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(msg("finance.reconciliation.late_refunds"), reconciliation.lateRefunds(from, to, page, size));
    }

    @GetMapping("/ipn-events")
    @Operation(summary = "Recorded VNPay callbacks (IPN and verified returns)")
    public ApiResponse<Page<IpnEventRowDto>> ipnEvents(
            @RequestParam(required = false) String rspCode,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String reference,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(msg("finance.reconciliation.ipn_events"),
                reconciliation.ipnEvents(rspCode, source, reference, from, to, page, size));
    }

    @GetMapping("/payments/{paymentId}/timeline")
    @Operation(summary = "Full history of one payment")
    public ApiResponse<PaymentTimelineDto> timeline(@PathVariable Long paymentId) {
        return ApiResponse.ok(msg("finance.reconciliation.timeline"), reconciliation.timeline(paymentId));
    }
}
