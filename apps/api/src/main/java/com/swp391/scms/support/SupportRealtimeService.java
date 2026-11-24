package com.swp391.scms.support;

import com.swp391.scms.chat.dto.ChatRealtimeSession;
import com.swp391.scms.chat.service.ChatRealtimeService;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cấp phiên realtime cho khiếu nại sau khi kiểm tra quyền xem phiếu/hộp thư. */
@Service
@Transactional(readOnly = true)
public class SupportRealtimeService {
    private final SupportRequestService support;
    private final ChatRealtimeService realtime;
    /** Nhận dịch vụ hỗ trợ (để kiểm tra quyền) và dịch vụ realtime của chat. */
    public SupportRealtimeService(SupportRequestService support, ChatRealtimeService realtime) {
        this.support = support; this.realtime = realtime;
    }
    /** Phiên realtime của một phiếu: chỉ người được xem phiếu mới mở được. */
    public ChatRealtimeSession ticket(Long id, AuthenticatedPrincipal actor) {
        support.requireTicket(id, actor.id(), actor.role());
        return realtime.supportSession(actor.id(), "scms:support:ticket:" + id);
    }
    /** Phiên realtime của hộp thư chung: chỉ lễ tân và quản lý trung tâm. */
    public ChatRealtimeSession inbox(AuthenticatedPrincipal actor) {
        support.requireActor(actor.id(), actor.role());
        if (!"CENTER_MANAGER".equals(actor.role()) && !"RECEPTIONIST".equals(actor.role()))
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        return realtime.supportSession(actor.id(), "scms:support:inbox");
    }
}
