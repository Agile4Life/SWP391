package com.swp391.scms.membership;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.dto.CancellationDtos;
import com.swp391.scms.membership.service.MembershipCancellationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/memberships/cancellations")
public class MembershipCancellationController {
    private final MembershipCancellationService service;
    private final MessageService messages;

    public MembershipCancellationController(MembershipCancellationService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    @Operation(summary = "Member requests cancellation of an active subscription; no rights change before approval")
    @PostMapping("/subscriptions/{subscriptionId}")
    @PreAuthorize("hasRole('MEMBER')")
    public ResponseEntity<ApiResponse<CancellationDtos.Response>> request(
            @AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long subscriptionId,
            @Valid @RequestBody CancellationDtos.Request body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                messages.getMessage("membership.cancellation.requested"), service.request(principal, subscriptionId, body)));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<List<CancellationDtos.Response>> mine(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(messages.getMessage("membership.cancellation.list"), service.mine(principal));
    }

    @GetMapping
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ApiResponse<List<CancellationDtos.Response>> all() {
        return ApiResponse.ok(messages.getMessage("membership.cancellation.list"), service.all());
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ApiResponse<CancellationDtos.Response> approve(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id, @Valid @RequestBody CancellationDtos.Decision body) {
        return ApiResponse.ok(messages.getMessage("membership.cancellation.approved"), service.decide(principal, id, true, body));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ApiResponse<CancellationDtos.Response> reject(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id, @Valid @RequestBody CancellationDtos.Decision body) {
        return ApiResponse.ok(messages.getMessage("membership.cancellation.rejected"), service.decide(principal, id, false, body));
    }
}
