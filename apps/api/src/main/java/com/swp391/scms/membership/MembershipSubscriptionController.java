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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
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

    @Operation(summary = "List a member's paid subscriptions for renewal at reception")
    @GetMapping("/members/{memberId}/renewal-candidates")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<List<SubscriptionDto>> renewalCandidates(
            @AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long memberId) {
        return ApiResponse.ok(msg("membership.subscription.list"), service.renewalCandidatesForStaff(principal, memberId));
    }

    @Operation(summary = "Create a pending membership renewal at reception")
    @PostMapping("/members/{memberId}/renew/{id}")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<ApiResponse<SubscriptionDto>> renewForMember(
            @AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long memberId,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("membership.subscription.renewed"), service.renewForMember(principal, memberId, id)));
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

    @Operation(summary = "Request a hold on an active subscription (multipart: reason, startDate, endDate, documents)")
    @PostMapping(value = "/{id}/hold", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<SubscriptionDto> requestHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @RequestParam(value = "reason", required = false) String reason,
            @RequestParam(value = "startDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(value = "endDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(value = "documents", required = false) List<MultipartFile> documents) throws IOException {
        List<MembershipSubscriptionService.HoldDocumentUpload> uploads = new ArrayList<>();
        if (documents != null) {
            for (MultipartFile file : documents) {
                if (file == null || file.isEmpty()) continue;
                uploads.add(new MembershipSubscriptionService.HoldDocumentUpload(
                        file.getOriginalFilename(), file.getContentType(), file.getBytes()));
            }
        }
        var request = new SubscriptionRequests.HoldRequest(reason == null ? "" : reason, startDate, endDate);
        return ApiResponse.ok(msg("membership.subscription.hold_requested"),
                service.requestHold(principal, id, request, uploads));
    }

    @Operation(summary = "Withdraw a hold request that is still pending")
    @DeleteMapping("/{id}/hold")
    public ApiResponse<SubscriptionDto> cancelHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_withdrawn"), service.cancelHoldRequest(principal, id));
    }

    @Operation(summary = "Hold allowance of a subscription: allowed, used, min/max days, notice, document limits")
    @GetMapping("/{id}/hold/policy")
    public ApiResponse<com.swp391.scms.membership.dto.SubscriptionResponses.HoldPolicyDto> holdPolicy(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_detail"), service.holdPolicy(principal, id));
    }

    @Operation(summary = "Desk withdraws a pending or not-yet-started approved hold on behalf of the member")
    @PostMapping("/{id}/hold/withdraw")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<SubscriptionDto> withdrawHoldForMember(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_withdrawn"), service.withdrawHoldForMember(principal, id));
    }

    @Operation(summary = "Hold request details and document list (owner or desk staff)")
    @GetMapping("/{id}/hold")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<HoldRequestDto> getHold(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ApiResponse.ok(msg("membership.subscription.hold_detail"), service.getHold(principal, id));
    }

    @Operation(summary = "Download a medical document of a hold request (owner or desk staff)")
    @GetMapping("/{id}/hold/documents/{documentId}")
    @PreAuthorize("hasAnyRole('MEMBER', 'CENTER_MANAGER', 'RECEPTIONIST')")
    public ResponseEntity<byte[]> downloadHoldDocument(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long documentId) {
        var document = service.getHoldDocument(principal, id, documentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(document.getFileName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(document.getContent());
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

    @Operation(summary = "List hold requests and hold history for the desk (status: ALL, PENDING, APPROVED, REJECTED, COMPLETED)")
    @GetMapping("/holds")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<List<HoldRequestDto>> listHolds(@RequestParam(value = "status", required = false) String status) {
        return ApiResponse.ok(msg("membership.subscription.hold_list"), service.listHolds(status));
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
