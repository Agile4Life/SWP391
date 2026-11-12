package com.swp391.scms.membership;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.dto.SubscriptionResponses.RequestHistoryDto;
import com.swp391.scms.membership.service.MembershipRequestHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Membership Subscriptions")
@RequestMapping({"/api/v1/memberships/subscriptions", "/api/v1/subscriptions"})
public class MembershipRequestHistoryController {
    private final MembershipRequestHistoryService service;
    private final MessageService messages;

    public MembershipRequestHistoryController(MembershipRequestHistoryService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    @Operation(summary = "Membership requests (register, renew, upgrade) the desk has processed in the last N days")
    @GetMapping("/requests/history")
    @PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
    public ApiResponse<List<RequestHistoryDto>> history(@RequestParam(value = "days", required = false) Integer days) {
        return ApiResponse.ok(messages.getMessage("membership.subscription.request_history"), service.history(days));
    }
}
