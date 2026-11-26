package com.swp391.scms.chat.service;

import com.swp391.scms.chat.dto.*;
import com.swp391.scms.chat.entity.*;
import com.swp391.scms.chat.repository.*;
import com.swp391.scms.common.exception.*;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.User;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/**
 * Nghiệp vụ chat trực tiếp giữa hội viên và nhân viên (lễ tân, HLV): danh bạ theo vai trò, mở hội thoại, lịch
 * sử, gửi tin chống trùng, đếm và đánh dấu đã đọc.
 */
@Service
@Transactional(readOnly = true)
public class ChatService {
    private static final Set<String> STAFF = Set.of("RECEPTIONIST", "COACH");
    private final ChatConversationRepository conversations;
    private final ChatMessageRepository messages;
    private final ChatContactRepository contacts;

    /** Tùy chọn để service vẫn dựng được trong unit test; thiếu nó thì HLV không bắt đầu chat được. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.coaching.service.CurrentCoachMembers coachMembers;

    /** Nhận repository hội thoại, tin nhắn và danh bạ. */
    public ChatService(ChatConversationRepository conversations, ChatMessageRepository messages, ChatContactRepository contacts) {
        this.conversations = conversations; this.messages = messages; this.contacts = contacts;
    }

    /** Người gọi phải tồn tại, active và có vai trò khớp token, là hội viên/lễ tân/HLV; không thì 403. */
    public User requireActor(AuthenticatedPrincipal principal) {
        if (principal == null) throw forbidden();
        User actor = contacts.findUser(principal.id()).orElseThrow(ChatService::forbidden);
        checkActor(actor, principal);
        return actor;
    }

    /**
     * Danh bạ theo vai trò: hội viên thấy lễ tân và HLV đang dạy mình; lễ tân thấy mọi hội viên active; HLV
     * thấy học viên đang phụ trách. Từ khóa tối đa 80 ký tự.
     *
     * Những người người gọi được phép bắt đầu chat: hội viên tìm lễ tân và HLV, lễ tân tìm mọi hội viên đang
     * hoạt động, HLV tìm các hội viên họ đang dạy.
     */
    public Page<ChatContactDto> contacts(AuthenticatedPrincipal principal, String query, int page) {
        User actor = requireActor(principal);
        if (query == null || query.length() > 80) throw invalid("validation.chat.query");
        String term = query.trim();
        return switch (role(actor)) {
            case "MEMBER" -> contacts.searchForMember(actor.getId(), today(), term, page(page)).map(u -> contact(u, true));
            case "RECEPTIONIST" -> contacts.searchMembers(term, page(page)).map(u -> contact(u, true));
            default -> contacts.searchForCoach(actor.getId(), today(), term, page(page)).map(u -> contact(u, true));
        };
    }

    /** Ngày hôm nay theo giờ trung tâm. */
    private java.time.LocalDate today() {
        return coachMembers != null ? coachMembers.centerToday() : java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    /**
     * Các hội thoại của người gọi kèm tin cuối và số tin chưa đọc (tính gộp cho cả trang để tránh truy vấn từng
     * hội thoại).
     */
    public Page<ChatConversationDto> list(AuthenticatedPrincipal principal, int page) {
        requireActor(principal);
        Long userId = principal.id();
        Page<ChatConversation> rows = conversations.forUser(userId, page(page));
        List<Long> ids = rows.getContent().stream().map(ChatConversation::getId).toList();
        if (ids.isEmpty()) return rows.map(c -> conversation(c, userId));
        Map<Long, ChatMessage> latest = new HashMap<>();
        for (ChatMessage m : messages.latestIn(ids)) latest.put(m.getConversation().getId(), m);
        Map<Long, Long> unread = new HashMap<>();
        for (Object[] row : messages.unreadIn(userId, ids)) unread.put((Long) row[0], (Long) row[1]);
        return rows.map(c -> conversation(c, userId, latest.get(c.getId()), unread.getOrDefault(c.getId(), 0L)));
    }

    /** Tổng số tin chưa đọc của người gọi. */
    public ChatUnreadCount unreadCount(AuthenticatedPrincipal principal) {
        requireActor(principal);
        return new ChatUnreadCount(messages.unreadTotal(principal.id()));
    }

    /** Đánh dấu đã đọc tới một tin (không vượt quá tin mới nhất thật sự có), trả lại tổng chưa đọc. */
    @Transactional
    public ChatUnreadCount markRead(AuthenticatedPrincipal principal, Long id, MarkChatRead input) {
        User actor = requireActor(principal);
        if (input == null || input.lastMessageId() == null || input.lastMessageId() <= 0) throw invalid("validation.chat.cursor");
        ChatConversation c = conversations.lockById(id).orElseThrow(() -> missing(id));
        participant(c, actor);
        // Không cho đánh dấu vượt quá tin thật sự có trong hội thoại.
        messages.latestId(id).ifPresent(latestId -> c.markRead(actor.getId(), Math.min(latestId, input.lastMessageId())));
        return new ChatUnreadCount(messages.unreadTotal(actor.getId()));
    }

    /**
     * Mở hoặc dùng lại hội thoại duy nhất giữa hội viên và lễ tân/HLV, từ phía nào cũng được. Khóa dòng hội
     * viên để hai request song song không tạo trùng. Hội viên chỉ nhắn được HLV đang dạy mình; HLV chỉ nhắn học
     * viên đang phụ trách; lễ tân nhắn được mọi hội viên active.
     *
     * Mở (hoặc dùng lại) hội thoại duy nhất giữa hội viên và lễ tân/HLV, do bên nào bắt đầu cũng được.
     */
    @Transactional
    public ChatConversationDto open(AuthenticatedPrincipal principal, Long contactId) {
        User actor = requireActor(principal);
        if (contactId == null || contactId <= 0 || contactId.equals(principal.id())) throw invalid("validation.chat.contact");
        boolean memberStarts = "MEMBER".equals(role(actor));
        // Tuần tự hóa việc tạo cặp trên cùng dòng Member ở mọi instance của API.
        Long memberLockId = memberStarts ? principal.id() : contactId;
        User lockedMember = contacts.lockUser(memberLockId).orElseGet(() -> {
            if (memberStarts) throw forbidden();
            throw new ResourceNotFoundException("resource.chat.contact", contactId);
        });
        if (memberStarts) checkActor(lockedMember, principal);
        User other = contacts.findUser(contactId).filter(ChatService::active)
                .orElseThrow(() -> new ResourceNotFoundException("resource.chat.contact", contactId));
        User member, staff;
        if (memberStarts) {
            if (!STAFF.contains(role(other))) throw invalid("validation.chat.contact");
            // Hội viên chỉ được nhắn cho HLV mà họ đang có lớp, lượt đặt 1:1 hoặc kế hoạch; quầy lễ tân luôn
            // mở.
            if ("COACH".equals(role(other))) requireCoachOfMember(other.getId(), lockedMember.getId());
            member = lockedMember; staff = other;
        } else {
            if (!"MEMBER".equals(role(other))) throw invalid("validation.chat.contact");
            // HLV chỉ liên hệ được các hội viên họ đang dạy; quầy lễ tân liên hệ được mọi hội viên đang hoạt
            // động.
            if ("COACH".equals(role(actor)) && (coachMembers == null)) throw forbidden();
            if ("COACH".equals(role(actor))) coachMembers.requireCoachOf(actor.getId(), contactId);
            member = other; staff = actor;
        }
        Optional<ChatConversation> existing = conversations.findByMemberIdAndStaffId(member.getId(), staff.getId());
        if (existing.isPresent()) {
            ChatConversation c = existing.get();
            ChatMessage latest = null;
            long unread = 0L;
            if (c.getId() != null) {
                List<Long> ids = List.of(c.getId());
                List<ChatMessage> latestRows = messages.latestIn(ids);
                if (latestRows != null && !latestRows.isEmpty()) {
                    latest = latestRows.get(0);
                }
                List<Object[]> unreadRows = messages.unreadIn(principal.id(), ids);
                if (unreadRows != null && !unreadRows.isEmpty() && unreadRows.get(0)[1] instanceof Number n) {
                    unread = n.longValue();
                }
            }
            return conversation(c, principal.id(), latest, unread);
        }
        ChatConversation created = conversations.save(new ChatConversation(member, staff, Instant.now()));
        return conversation(created, principal.id());
    }

    /** HLV phải đang dạy hội viên; không thì báo lỗi riêng "chỉ chat được với HLV đang dạy bạn". */
    private void requireCoachOfMember(Long coachId, Long memberId) {
        try {
            if (coachMembers == null) throw forbidden();
            coachMembers.requireCoachOf(coachId, memberId);
        } catch (ForbiddenException e) {
            throw new ForbiddenException("CHAT_COACH_NOT_ENROLLED", "chat.coach.not_enrolled", null,
                    "You can only chat with coaches of classes you are enrolled in.");
        }
    }

    /**
     * Lịch sử tin của hội thoại theo mốc before (tin cũ hơn) hoặc after (tin mới hơn), mỗi lần tối đa 50 tin,
     * trả theo thứ tự thời gian.
     */
    public ChatHistory history(AuthenticatedPrincipal principal, Long id, Long before, Long after) {
        User actor = requireActor(principal);
        ChatConversation c = conversations.findById(id).orElseThrow(() -> missing(id));
        participant(c, actor);
        if ((before != null && after != null) || (before != null && before <= 0) || (after != null && after < 0))
            throw invalid("validation.chat.cursor");
        List<ChatMessage> rows = after == null ? messages.older(id, before, PageRequest.of(0, 51))
                : messages.newer(id, after, PageRequest.of(0, 51));
        boolean more = rows.size() > 50;
        var selected = new ArrayList<>(rows.subList(0, Math.min(50, rows.size())));
        if (after == null) Collections.reverse(selected);
        return new ChatHistory(selected.stream().map(m -> message(m, actor.getId())).toList(), more);
    }

    /**
     * Gửi tin: phải là thành viên hội thoại, nội dung 1-2000 ký tự; cùng mã tin phía client thì trả lại tin cũ
     * (khác nội dung thì báo xung đột); người nhận phải còn active. Lưu tin, cập nhật hoạt động và đánh dấu
     * người gửi đã đọc tới tin này.
     */
    @Transactional
    public ChatMessageDto send(AuthenticatedPrincipal principal, Long id, SendChatMessage input) {
        User actor = requireActor(principal);
        ChatConversation c = conversations.lockById(id).orElseThrow(() -> missing(id));
        participant(c, actor);
        if (input == null || input.clientMessageId() == null || input.message() == null
                || input.message().isBlank() || input.message().length() > 2000) throw invalid("validation.chat.message");
        String text = input.message().strip();
        var previous = messages.findByConversationIdAndSenderIdAndClientMessageId(id, actor.getId(), input.clientMessageId());
        if (previous.isPresent()) {
            if (!previous.get().getMessage().equals(text)) throw new ConflictException("CHAT_RETRY_CONFLICT", "chat.retry.conflict", null, null);
            return message(previous.get(), actor.getId());
        }
        User peer = peer(c, actor.getId());
        if (!availablePeer(c, peer)) throw new ConflictException("CHAT_PEER_UNAVAILABLE", "chat.peer.unavailable", null, null);
        // Kiểm tra lại phân công hiện tại khi hội thoại có HLV (lịch sử cũ vẫn chỉ đọc ở history()).
        if ("COACH".equals(role(c.getStaff()))) {
            if ("MEMBER".equals(role(actor))) {
                requireCoachOfMember(c.getStaff().getId(), c.getMember().getId());
            } else {
                if (coachMembers == null) throw forbidden();
                coachMembers.requireCoachOf(c.getStaff().getId(), c.getMember().getId());
            }
        }
        Instant now = Instant.now();
        var saved = messages.save(new ChatMessage(c, actor, input.clientMessageId(), text, now));
        c.touch(now);
        // Người gửi đã thấy toàn bộ hội thoại tới tin của chính mình.
        if (saved.getId() != null) c.markRead(actor.getId(), saved.getId());
        return message(saved, actor.getId());
    }

    /** Người gọi phải active, vai trò khớp token và là hội viên hoặc nhân viên chat. */
    private static void checkActor(User u, AuthenticatedPrincipal p) {
        String role = role(u);
        if (!active(u) || !role.equals(p.role()) || !("MEMBER".equals(role) || STAFF.contains(role))) throw forbidden();
    }
    /** Người dùng phải là một trong hai bên của hội thoại với đúng vai trò. */
    private static void participant(ChatConversation c, User u) {
        boolean member = c.getMember().getId().equals(u.getId()) && "MEMBER".equals(role(u));
        boolean staff = c.getStaff().getId().equals(u.getId()) && STAFF.contains(role(u));
        if (!member && !staff) throw forbidden();
    }
    /** Người còn lại trong hội thoại. */
    private static User peer(ChatConversation c, Long id) { return c.getMember().getId().equals(id) ? c.getStaff() : c.getMember(); }
    /** Người còn lại có còn nhận tin được không (active và đúng vai trò). */
    private static boolean availablePeer(ChatConversation c, User u) {
        return active(u) && (u.getId().equals(c.getMember().getId()) ? "MEMBER".equals(role(u)) : STAFF.contains(role(u)));
    }
    /** Chuyển hội thoại sang DTO không kèm tin cuối. */
    private static ChatConversationDto conversation(ChatConversation c, Long userId) { return conversation(c, userId, null, 0); }
    /** Chuyển hội thoại sang DTO kèm người còn lại, bản xem trước tin cuối và số chưa đọc. */
    private static ChatConversationDto conversation(ChatConversation c, Long userId, ChatMessage latest, long unread) {
        User other = peer(c, userId);
        String preview = latest == null ? null : preview(latest.getMessage());
        boolean mine = latest != null && latest.getSender().getId().equals(userId);
        return new ChatConversationDto(c.getId(), contact(other, availablePeer(c, other)), c.getCreatedAt(), c.getLastActivityAt(),
                preview, mine, unread);
    }
    /** Bản xem trước tin nhắn: gộp khoảng trắng, tối đa 120 ký tự. */
    private static String preview(String text) {
        String flat = text.replaceAll("\\s+", " ").strip();
        return flat.length() <= 120 ? flat : flat.substring(0, 119) + "…";
    }
    /** Chuyển người dùng sang thông tin liên hệ chat. */
    private static ChatContactDto contact(User u, boolean available) {
        return new ChatContactDto(u.getId(), u.getFullName(), role(u), available, u.getAvatarUrl());
    }
    /** Chuyển tin nhắn sang DTO (đánh dấu tin của chính người xem). */
    private static ChatMessageDto message(ChatMessage m, Long userId) {
        return new ChatMessageDto(m.getId(), m.getConversation().getId(), m.getClientMessageId(), m.getSender().getId(),
                m.getSender().getId().equals(userId), m.getMessage(), m.getCreatedAt());
    }
    /** Mã vai trò của người dùng. */
    private static String role(User u) { return u.getRole() == null ? "" : u.getRole().getCode(); }
    /** Tài khoản active và chưa bị xóa. */
    private static boolean active(User u) { return u.getDeletedAt() == null && "active".equals(u.getStatus()); }
    /** Trang thứ page (0 tới 100000), mỗi trang 20 mục. */
    private static PageRequest page(int page) {
        if (page < 0 || page > 100000) throw invalid("validation.chat.page");
        return PageRequest.of(page, 20);
    }
    /** Lỗi 400 dữ liệu chat không hợp lệ. */
    private static BadRequestException invalid(String key) { return new BadRequestException("CHAT_INVALID_INPUT", key, null, null); }
    /** Lỗi 403 không có quyền chat. */
    private static ForbiddenException forbidden() { return new ForbiddenException("CHAT_FORBIDDEN", "chat.forbidden", null, null); }
    /** Lỗi 404 không thấy hội thoại. */
    private static ResourceNotFoundException missing(Long id) { return new ResourceNotFoundException("resource.chat.conversation", id); }
}
