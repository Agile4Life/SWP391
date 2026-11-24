package com.swp391.scms.membership;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.dto.MembershipRealtimeSession;
import com.swp391.scms.membership.service.MembershipRealtimeService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** API mở kênh realtime (Supabase) để trang gói tập của hội viên tự tải lại khi thanh toán xong. */
@RestController
@PreAuthorize("hasRole('MEMBER')")
public class MembershipRealtimeController {
    private final MembershipRealtimeService service;
    private final MessageService messages;

    /** Nhận MembershipRealtimeService và MessageService. */
    public MembershipRealtimeController(MembershipRealtimeService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    /**
     * POST /api/v1/memberships/subscriptions/realtime-session: trả thông tin kết nối realtime (hoặc báo chưa
     * bật).
     */
    @PostMapping("/api/v1/memberships/subscriptions/realtime-session")
    public ResponseEntity<ApiResponse<MembershipRealtimeSession>> open(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
                ApiResponse.ok(messages.getMessage("membership.realtime.ready"), service.open(principal)));
    }
}
