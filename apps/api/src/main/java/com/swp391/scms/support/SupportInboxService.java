package com.swp391.scms.support;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.support.dto.SupportReadResultDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.support.entity.SupportRequestMessage;
import com.swp391.scms.support.entity.SupportRequestRead;
import com.swp391.scms.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/** Hộp thư và mốc đã đọc riêng của từng nhân sự xử lý khiếu nại (lễ tân, quản lý); không thay đổi quy trình xử lý phiếu. */
@Service
public class SupportInboxService {
    private static final Set<String> INBOX_ROLES = Set.of("RECEPTIONIST", "CENTER_MANAGER");
    private final SupportRequestService access;
    private final SupportRequestRepository tickets;
    private final SupportRequestReadRepository reads;
    private final SupportRequestMessageRepository messages;
    private final SupportRequestMapper mapper;

    public SupportInboxService(SupportRequestService access, SupportRequestRepository tickets,
                               SupportRequestReadRepository reads, SupportRequestMessageRepository messages,
                               SupportRequestMapper mapper) {
        this.access = access;
        this.tickets = tickets;
        this.reads = reads;
        this.messages = messages;
        this.mapper = mapper;
    }

    private User requireStaffActor(Long userId, String role) {
        if (role == null || !INBOX_ROLES.contains(role)) {
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        }
        return access.requireActor(userId, role);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> inbox(Long userId, String role, String status,
                                         boolean unreadOnly, Pageable pageable) {
        return inbox(userId, role, status, unreadOnly, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> inbox(Long userId, String role, String status,
                                         boolean unreadOnly, String search, Pageable pageable) {
        requireStaffActor(userId, role);
        String normalized = status == null || status.isBlank() ? null : status.trim().toLowerCase(Locale.ROOT);
        if (normalized != null && !Set.of("open", "in_progress", "resolved", "closed").contains(normalized)) {
            throw new BadRequestException("INVALID_SUPPORT_STATUS", "validation.support.status.invalid", null, null);
        }
        // Sắp xếp toàn bộ hộp thư tại DB trước phân trang, không nhận sort riêng từ client.
        Pageable ordered = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        String query = search == null ? "" : search.trim();
        Page<SupportRequest> page = !query.isEmpty()
                ? tickets.searchInbox(normalized, unreadOnly, "CENTER_MANAGER".equals(role), userId, query, ordered)
                : "CENTER_MANAGER".equals(role)
                ? tickets.findInbox(normalized, unreadOnly, true, userId, ordered)
                : tickets.findReceptionistInbox(normalized, unreadOnly, userId, ordered);
        return page.map(ticket -> {
            var latest = messages.findFirstBySupportRequestIdOrderByCreatedAtDescIdDesc(ticket.getId());
            String senderName = latest.map(m -> {
                User sender = m.getSender();
                if (sender == null) return null;
                return sender.getFullName() != null && !sender.getFullName().isBlank()
                        ? sender.getFullName()
                        : sender.getUsername();
            }).orElse(null);
            boolean mine = latest.map(m -> m.getSender() != null && userId.equals(m.getSender().getId())).orElse(false);
            return mapper.toDto(ticket).withInbox(
                    latest.map(SupportRequestMessage::getMessage).orElse(ticket.getDescription()),
                    latest.map(SupportRequestMessage::getCreatedAt).orElse(ticket.getCreatedAt()),
                    unread(ticket.getId(), userId),
                    senderName,
                    mine);
        });
    }

    private long unread(Long ticketId, Long userId) {
        var receipt = reads.findBySupportRequestIdAndUserId(ticketId, userId);
        // Chưa có biên nhận: mô tả ban đầu là một tin đến, kể cả phiếu đã tồn tại trước tính năng này.
        // Chỉ đếm tin của hội viên sau mốc; tin gửi bởi nhân viên không làm tăng số chưa đọc.
        return (receipt.isEmpty() ? 1 : 0) + messages.countIncomingAfter(ticketId,
                receipt.map(SupportRequestRead::getLastMessageId).orElse(0L));
    }

    @Transactional
    public SupportReadResultDto markRead(Long ticketId, Long userId, String role, Long cursor) {
        User user = requireStaffActor(userId, role);
        access.requireTicket(ticketId, userId, role);
        // Dùng cùng khóa phiếu với gửi tin: tạo/cập nhật biên nhận được tuần tự hóa.
        SupportRequest ticket = tickets.findByIdForUpdate(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", ticketId));
        if (cursor == null || cursor < 0
                || (cursor > 0 && !messages.existsByIdAndSupportRequestId(cursor, ticketId))) {
            throw new BadRequestException("INVALID_SUPPORT_READ_CURSOR", "validation.support.read.cursor.invalid", null, null);
        }
        SupportRequestRead receipt = reads.findBySupportRequestIdAndUserId(ticketId, userId)
                .orElseGet(() -> new SupportRequestRead(ticket, user, 0));
        // Chỉ tiến mốc tới tin client đã tải; yêu cầu cũ không được kéo mốc lùi hoặc đọc hộ tin mới.
        receipt.advanceTo(cursor);
        reads.saveAndFlush(receipt);
        return new SupportReadResultDto(unread(ticketId, userId));
    }
}
