package com.swp391.scms.reception;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@Tag(name = "Reception", description = "Receptionist tools: quick member lookup")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
@RestController
@RequestMapping("/api/v1/members")
public class MemberLookupController {

    private final MemberLookupService service;
    private final MessageService messageService;

    public MemberLookupController(MemberLookupService service) {
        this(service, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public MemberLookupController(MemberLookupService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Quick member lookup by code, name, email or phone (max 20 results)")
    @GetMapping("/lookup")
    public ApiResponse<List<MemberLookupDto>> lookup(@RequestParam("q") String query) {
        return ApiResponse.ok(msg("reception.lookup.success"), service.search(query));
    }
}



