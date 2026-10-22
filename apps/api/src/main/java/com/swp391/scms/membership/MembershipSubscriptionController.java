package com.swp391.scms.membership;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.HoldRequestDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
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
 * Controller for managing membership subscriptions (SCRUM-71).
 */
@Tag(name = "Membership Subscriptions", description = "Purchase, renewal, upgrade, hold and member subscription status (SCRUM-71)")
@PreAuthorize("hasRole('MEMBER')")
@RestController
@RequestMapping({"/api/v1/memberships/subscriptions", "/api/v1/subscriptions"})
public class MembershipSubscriptionController {

    private final MembershipSubscriptionService service;
    private final MessageService messageService;

    public MembershipSubscriptionController(MembershipSubscriptionService service) {
        this(service, null);
    }

    @Autowired
    public MembershipSubscriptionController(MembershipSubscriptionService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Create a membership subscription awaiting payment")
    @PostMapping
    public ResponseEntity<ApiResponse<SubscriptionDto>> create(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody SubscriptionRequests.Create request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("membership.subscription.created"), service.create(principal, request)));
    }

    @Operation(summary = "Renew a membership subscription")
    @PostMapping("/{id}/renew")
    public ResponseEntity<ApiResponse<SubscriptionDto>> renew(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("membership.subscription.renewed"), service.renew(principal, id)));
    }

    @Operation(summary = "Upgrade an active membership subscription to a higher package")
    @PostMapping("/{id}/upgrade")
    public ResponseEntity<ApiResponse<SubscriptionDto>> upgrade(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody SubscriptionRequests.Upgrade request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("membership.subscription.upgraded"), service.upgrade(principal, id, request)));
    }

    @Operation(summary = "Cancel a pending payment membership subscription request")
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<SubscriptionDto> cancelPending(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.cancelled"), service.cancelPending(principal, id));
    }

    @Operation(summary = "Resume a frozen subscription without payment, preserving remaining days")
    @PostMapping("/{id}/resume")
    public ApiResponse<SubscriptionDto> resume(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.resumed"), service.resume(principal, id));
    }

    @Operation(summary = "Request a hold/freeze on an active membership subscription")
    @PostMapping("/{id}/hold")
    public ApiResponse<SubscriptionDto> requestHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody SubscriptionRequests.HoldRequest request) {
        return ApiResponse.ok(msg("membership.subscription.hold_requested"), service.requestHold(principal, id, request));
    }

    @Operation(summary = "Get the authenticated member's current active subscription (or null if none)")
    @GetMapping("/my")
    public ApiResponse<SubscriptionDto> getMy(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("membership.subscription.current"), service.current(principal));
    }

    @Operation(summary = "Get a fresh dynamic QR code for the authenticated member's active subscription")
    @GetMapping("/my/dynamic-qr")
    public ApiResponse<com.swp391.scms.membership.dto.SubscriptionResponses.DynamicQrDto> getDynamicQr(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("membership.subscription.qr_generated"), service.generateDynamicQr(principal));
    }

    @Operation(summary = "Get the authenticated member's subscription history")
    @GetMapping("/history")
    public ApiResponse<List<SubscriptionDto>> getHistory(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("membership.subscription.list"), service.mine(principal));
    }

    @Operation(summary = "List all pending payment subscriptions for receptionist confirmation")
    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<List<com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto>> getPending() {
        return ApiResponse.ok(msg("membership.subscription.list"), service.listPending());
    }

    @Operation(summary = "List all pending hold requests for receptionist processing")
    @GetMapping("/holds/pending")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<List<HoldRequestDto>> getPendingHolds() {
        return ApiResponse.ok(msg("membership.subscription.hold_list"), service.listPendingHolds());
    }

    @Operation(summary = "Approve a hold request and cancel future booked class schedules")
    @PostMapping("/{id}/hold/approve")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<HoldRequestDto> approveHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_approved"), service.approveHold(principal, id));
    }

    @Operation(summary = "Reject a hold request")
    @PostMapping("/{id}/hold/reject")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<HoldRequestDto> rejectHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_rejected"), service.rejectHold(principal, id));
    }
}
