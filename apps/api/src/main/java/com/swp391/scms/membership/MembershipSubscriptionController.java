package com.swp391.scms.membership;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;<<<<<<<Updated upstream<<<<<<<Updated upstream
import com.swp391.scms.membership.dto.SubscriptionCreateRequest;
import com.swp391.scms.membership.dto.SubscriptionDto;=======
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;>>>>>>>Stashed changes=======
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;>>>>>>>Stashed changes
import com.swp391.scms.membership.service.MembershipSubscriptionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;<<<<<<<Updated upstream=======
import org.springframework.beans.factory.annotation.Autowired;>>>>>>>Stashed changes
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;<<<<<<<Updated upstream<<<<<<<Updated upstream

import java.util.List;

@Tag(name="Membership Subscriptions",description="Purchase, renewal and current membership subscription status")=======

import java.util.List;

/**
 * Controller for managing membership subscriptions (SCRUM-71).
 */
@Tag(name = "Membership Subscriptions", description = "Purchase, renewal and member subscription status (SCRUM-71)")
>>>>>>>Stashed changes @RestController @RequestMapping("/api/v1/memberships/subscriptions")public class MembershipSubscriptionController {

    private final MembershipSubscriptionService service;
    private final MessageService messageService;

    public MembershipSubscriptionController(MembershipSubscriptionService service) {
        this(service, null);
    }

    <<<<<<<Updated upstream

    @org.springframework.beans.factory.annotation.Autowired
=======
    @Autowired
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
            @Valid @RequestBody SubscriptionCreateRequest request) {
=======
            @Valid @RequestBody SubscriptionRequests.Create request) {
>>>>>>> Stashed changes
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

<<<<<<<Updated upstream @Operation(summary="Get the authenticated member's subscription history and current status")@GetMapping("/my")

public ApiResponse<List<SubscriptionDto>> getMy(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("membership.subscription.list"), service.getMy(principal));
=======
import java.util.List;

@RestController
@RequestMapping("/api/v1/memberships/subscriptions")
@Tag(name = "Membership subscriptions", description = "Subscription lifecycle (SCRUM-71)")
public class MembershipSubscriptionController {
    private final MembershipSubscriptionService service;
    private final MessageService messages;

    public MembershipSubscriptionController(MembershipSubscriptionService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    @PostMapping
    @Operation(summary = "Create a subscription pending payment")
    public ResponseEntity<ApiResponse<SubscriptionDto>> create(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody SubscriptionRequests.Create request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                messages.getMessage("success.membership.subscription_created"), service.create(principal, request)));
    }

    @PostMapping("/{id}/renew")
    @Operation(summary = "Create a renewal pending payment")
    public ResponseEntity<ApiResponse<SubscriptionDto>> renew(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse
                .created(messages.getMessage("success.membership.subscription_renewed"), service.renew(principal, id)));
    }

    @GetMapping("/my") @Operation(summary = "List the authenticated member's subscriptions")
    public ApiResponse<List<SubscriptionDto>> mine(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(messages.getMessage("success.membership.subscription_list"), service.mine(principal));
>>>>>>> Stashed changes
=======

    @Operation(summary = "Get the authenticated member's subscriptions and current status")
    @GetMapping("/my")
    public ApiResponse<List<SubscriptionDto>> getMy(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("membership.subscription.list"), service.mine(principal));
>>>>>>> Stashed changes
    }
}
