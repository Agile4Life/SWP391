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

/** API tra cứu nhanh hội viên cho quầy lễ tân (/api/v1/members/lookup). */
@Tag(name = "Reception", description = "Receptionist tools: quick member lookup")
@PreAuthorize("hasAnyRole('CENTER_MANAGER', 'RECEPTIONIST')")
@RestController
@RequestMapping("/api/v1/members")
public class MemberLookupController {

    private final MemberLookupService service;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public MemberLookupController(MemberLookupService service) {
        this(service, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public MemberLookupController(MemberLookupService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /lookup?q=: tìm hội viên theo mã, họ tên, email hoặc SĐT (tối thiểu 2 ký tự, tối đa 20 kết quả). */
    @Operation(summary = "Quick member lookup by code, name, email or phone (max 20 results)")
    @GetMapping("/lookup")
    public ApiResponse<List<MemberLookupDto>> lookup(@RequestParam("q") String query) {
        return ApiResponse.ok(msg("reception.lookup.success"), service.search(query));
    }
}



