package com.swp391.scms.support;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.support.dto.CreateSupportMessageDto;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.EscalateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestMessageDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.support.entity.SupportRequestMessage;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Nghiệp vụ khiếu nại/hỗ trợ: hội viên gửi phiếu và nhắn tin; lễ tân phụ trách cho tới khi chuyển lên quản lý;
 * luồng trạng thái open → in_progress → resolved → closed; tự đóng phiếu đã giải quyết sau 72 giờ; gửi thông
 * báo cho đúng người ở mỗi bước.
 */
@Service
public class SupportRequestService {

    static final long AUTO_CLOSE_HOURS = 72;
    private static final Set<String> VALID_STATUSES = Set.of("open", "in_progress", "resolved", "closed");
    private static final Set<String> STAFF_ROLES = Set.of("CENTER_MANAGER", "RECEPTIONIST");
    private static final String MANAGER = "CENTER_MANAGER";
    private static final String RECEPTIONIST = "RECEPTIONIST";

    private final SupportRequestRepository supportRequestRepository;
    private final SupportRequestMapper supportRequestMapper;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final SupportRequestMessageRepository supportRequestMessageRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final Clock clock;

    /** Constructor cho test với repository bắt buộc. */
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository) {
        this(supportRequestRepository, supportRequestMapper, memberRepository, userRepository, null, null, null, null);
    }

    /** Constructor cho test có repository tin nhắn. */
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository,
                                 SupportRequestMessageRepository supportRequestMessageRepository) {
        this(supportRequestRepository, supportRequestMapper, memberRepository, userRepository, supportRequestMessageRepository, null, null, null);
    }

    /** Constructor cho test có NotificationService. */
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository,
                                 NotificationService notificationService,
                                 MessageService messageService) {
        this(supportRequestRepository, supportRequestMapper, memberRepository, userRepository, null, notificationService, messageService, null);
    }

    /** Constructor cho test có MessageService. */
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository,
                                 SupportRequestMessageRepository supportRequestMessageRepository,
                                 NotificationService notificationService,
                                 MessageService messageService) {
        this(supportRequestRepository, supportRequestMapper, memberRepository, userRepository, supportRequestMessageRepository, notificationService, messageService, null);
    }

    /** Constructor Spring dùng; các phụ thuộc phụ là tùy chọn. */
    @Autowired
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository,
                                 SupportRequestMessageRepository supportRequestMessageRepository,
                                 NotificationService notificationService,
                                 MessageService messageService,
                                 @Autowired(required = false) Clock clock) {
        this.supportRequestRepository = supportRequestRepository;
        this.supportRequestMapper = supportRequestMapper;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.supportRequestMessageRepository = supportRequestMessageRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /** Hội viên (chưa bị xóa) gửi phiếu mới; báo cho lễ tân (quản lý chỉ được báo khi phiếu được chuyển lên). */
    @Transactional
    public SupportRequestDto createRequest(Long memberId, CreateSupportRequestDto dto) {
        Member member = memberRepository.findById(memberId)
                .filter(m -> m.getUser() == null || m.getUser().getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));

        SupportRequest request = new SupportRequest(member, dto.subject(), dto.description());
        SupportRequest saved = supportRequestRepository.save(request);
        // Khiếu nại mới đến lễ tân trước; quản lý chỉ được thông báo khi phiếu được chuyển lên
        // (quản lý không được phép mở khiếu nại chưa được chuyển lên).
        notifyStaff(RECEPTIONIST, "notifications.support.new_request.title", "notifications.support.new_request.body",
                saved.getId(), dto.subject());
        return supportRequestMapper.toDto(saved).forMember();
    }

    /**
     * Hội viên đóng phiếu của mình: chỉ khi phiếu đang mở (rút lại) hoặc đã giải quyết (xác nhận); cả hai đều
     * thành closed.
     *
     * Hội viên rút lại ticket đang mở hoặc xác nhận ticket đã giải quyết; cả hai đều kết thúc ở {@code
     * closed}.
     */
    @Transactional
    @Audited(action = "SUPPORT_STATUS_UPDATE", entity = "support_requests")
    public SupportRequestDto closeByMember(Long id, Long memberId) {
        SupportRequest request = supportRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", id));
        if (request.getMember() == null || !Objects.equals(request.getMember().getUserId(), memberId)) {
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        }
        String status = request.getStatus() == null ? "" : request.getStatus().toLowerCase(Locale.ROOT);
        if (!"open".equals(status) && !"resolved".equals(status)) {
            throw new BadRequestException("INVALID_STATE_TRANSITION", "support.close.invalid_state", null,
                    "Only an open or resolved request can be closed by the member");
        }
        request.setStatus("closed");
        if (request.getResolvedAt() == null) request.setResolvedAt(LocalDateTime.now(clock));
        SupportRequest saved = supportRequestRepository.save(request);
        return supportRequestMapper.toDto(saved != null ? saved : request).forMember();
    }

    /**
     * Đóng các phiếu đã giải quyết mà hội viên không phản hồi quá 72 giờ; trả số phiếu đã đóng.
     *
     * Ticket đã giải quyết mà hội viên không phản hồi trong 72 giờ sẽ được đóng tự động.
     */
    @Transactional
    public int closeStaleResolved() {
        LocalDateTime cutoff = LocalDateTime.now(clock).minusHours(AUTO_CLOSE_HOURS);
        int closed = 0;
        for (SupportRequest request : supportRequestRepository.findByStatusAndResolvedAtBefore("resolved", cutoff)) {
            request.setStatus("closed");
            supportRequestRepository.save(request);
            closed++;
        }
        return closed;
    }

    /** Job chạy mỗi giờ để tự đóng phiếu quá hạn; lỗi thì để lần chạy sau thử lại. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${app.support.auto-close.cron:0 0 * * * ?}")
    public void autoCloseResolved() {
        try {
            closeStaleResolved();
        } catch (RuntimeException ignored) {
            // Được thử lại ở lần chạy theo giờ kế tiếp.
        }
    }

    /** Các phiếu của hội viên (ẩn lý do chuyển lên nội bộ), mới nhất trước. */
    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getMyRequests(Long memberId, Pageable pageable) {
        return supportRequestRepository.findByMemberUserIdOrderByCreatedAtDesc(memberId, pageable)
                .map(request -> supportRequestMapper.toDto(request).forMember());
    }

    /**
     * Hộp thư phiếu cho nhân viên: trạng thái lọc phải hợp lệ; quản lý chỉ thấy phiếu đã chuyển lên, lễ tân
     * thấy tất cả.
     */
    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getAllRequests(String status, Pageable pageable, String role) {
        String normalizedStatus = (status == null || status.isBlank()) ? null : status.trim().toLowerCase(Locale.ROOT);
        if (normalizedStatus != null && !VALID_STATUSES.contains(normalizedStatus)) {
            throw new BadRequestException("INVALID_SUPPORT_STATUS", "validation.support.status.invalid", null,
                    "Invalid support request status: " + status);
        }
        requireInboxRole(role);
        Page<SupportRequest> page = isManager(role)
                ? supportRequestRepository.findEscalatedByStatus(normalizedStatus, pageable)
                : supportRequestRepository.findAllByStatus(normalizedStatus, pageable);
        return page.map(supportRequestMapper::toDto);
    }

    /**
     * Đổi trạng thái và/hoặc người phụ trách: người thao tác phải là người đang phụ trách theo cấp (lễ tân
     * trước khi chuyển lên, quản lý sau đó); phiếu đã đóng không sửa được; chuyển trạng thái phải theo đúng
     * luồng; người phụ trách mới phải là nhân viên active đúng vai trò. Đổi trạng thái thì báo cho hội viên.
     */
    @Transactional
    @Audited(action = "SUPPORT_STATUS_UPDATE", entity = "support_requests")
    public SupportRequestDto updateStatus(Long id, UpdateSupportRequestStatusDto dto, String actorRole) {
        SupportRequest request = supportRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", id));
        requireHandler(request, actorRole);

        if ("closed".equalsIgnoreCase(request.getStatus())) {
            throw new com.swp391.scms.common.exception.AppException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "INVALID_STATE_TRANSITION",
                    "support.status.closed_cannot_reopen",
                    new Object[]{request.getStatus(), dto != null ? dto.status() : null},
                    "Closed support request cannot be modified"
            );
        }

        if (dto == null || (dto.status() == null && dto.assignedTo() == null)) {
            throw new BadRequestException("EMPTY_SUPPORT_UPDATE", "support.status.empty_update", null,
                    "At least one of status or assignedTo must be provided");
        }

        boolean statusChanged = false;
        if (dto.status() != null) {
            String currentStatus = request.getStatus();
            String targetStatus = dto.status().trim().toLowerCase(Locale.ROOT);
            validateStatusTransition(currentStatus, targetStatus);
            statusChanged = currentStatus == null || !currentStatus.equalsIgnoreCase(targetStatus);

            request.setStatus(targetStatus);
            if ("resolved".equals(targetStatus) || "closed".equals(targetStatus)) {
                if (request.getResolvedAt() == null) {
                    request.setResolvedAt(LocalDateTime.now(clock));
                }
            } else {
                request.setResolvedAt(null);
            }
        }

        if (dto.assignedTo() != null) {
            User assignee = userRepository.findByIdAndDeletedAtIsNull(dto.assignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.user", dto.assignedTo()));
            if (assignee.getStatus() != null && !"active".equalsIgnoreCase(assignee.getStatus())) {
                throw new BadRequestException("INVALID_ASSIGNEE", "support.assignee.invalid", null,
                        "Assignee must be an active staff account");
            }
            String requiredAssigneeRole = request.isEscalated() ? MANAGER : RECEPTIONIST;
            if (assignee.getRole() != null && assignee.getRole().getCode() != null
                    && !requiredAssigneeRole.equals(normalizeRole(assignee.getRole().getCode()))) {
                throw new BadRequestException("INVALID_ASSIGNEE", "support.assignee.invalid", null,
                        "Assignee must hold the role that handles this request");
            }
            request.setAssignedTo(assignee);
        }

        SupportRequest saved = supportRequestRepository.save(request);
        if (statusChanged && notificationService != null && request.getMember() != null) {
            Long memberUserId = request.getMember().getUserId() != null
                    ? request.getMember().getUserId()
                    : (request.getMember().getUser() != null ? request.getMember().getUser().getId() : null);
            if (memberUserId != null && memberReachable(request)) {
                String title = messageService != null
                        ? messageService.getMessage("notifications.support.status_updated.title")
                        : "notifications.support.status_updated.title";
                String body = messageService != null
                        ? messageService.getMessage("notifications.support.status_updated.body", request.getSubject(), request.getStatus())
                        : "notifications.support.status_updated.body";
                notificationService.send(memberUserId, title, body, "support_reply", "support_request", saved != null ? saved.getId() : id);
            }
        }
        return supportRequestMapper.toDto(saved != null ? saved : request);
    }

    /**
     * Gửi tin nhắn trong phiếu: hội viên chỉ nhắn phiếu của mình, nhân viên phải là người đang phụ trách; cùng
     * clientMessageId thì trả lại tin đã gửi (gửi lại không bị trùng); phiếu đã đóng không nhắn được. Nhân viên
     * trả lời phiếu đang mở thì tự chuyển sang in_progress và nhận phụ trách. Báo cho phía bên kia.
     */
    @Transactional
    public SupportRequestMessageDto sendMessage(Long requestId, Long senderUserId, String senderRole, CreateSupportMessageDto dto) {
        SupportRequest request = supportRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", requestId));

        boolean staff = isStaffRole(senderRole);
        Long memberUserId = request.getMember() != null ? request.getMember().getUserId() : null;
        if (!staff) {
            if (memberUserId == null || !Objects.equals(memberUserId, senderUserId)) {
                throw new ForbiddenException(
                        "FORBIDDEN",
                        "support.message.forbidden",
                        null,
                        "You are not allowed to send messages in this support request"
                );
            }
        } else {
            requireHandler(request, senderRole);
        }

        User sender = requireActor(senderUserId, senderRole);
        if (dto.clientMessageId() != null) {
            var existing = supportRequestMessageRepository.findBySupportRequestIdAndSenderIdAndClientMessageId(requestId, senderUserId, dto.clientMessageId());
            if (existing.isPresent()) {
                if (!Objects.equals(existing.get().getMessage(), dto.message().trim()))
                    throw new com.swp391.scms.common.exception.ConflictException("SUPPORT_MESSAGE_KEY_REUSED", "support.message.key_reused", null, null);
                return supportRequestMapper.toMessageDto(existing.get());
            }
        }

        if ("closed".equalsIgnoreCase(request.getStatus())) {
            throw new BadRequestException(
                    "TICKET_CLOSED",
                    "support.message.ticket_closed",
                    new Object[]{requestId},
                    "Cannot send message to a closed support request"
            );
        }

        // Tiện ích 1 bước: khi nhân viên trả lời một phiếu đang mở, tự động chuyển sang in_progress
        // và tự gán nếu chưa có người xử lý, để nhân viên không phải PATCH trạng thái riêng trước.
        if (staff) {
            boolean updatedTicket = false;
            if ("open".equalsIgnoreCase(request.getStatus())) {
                request.setStatus("in_progress");
                updatedTicket = true;
            }
            if (request.getAssignedTo() == null) {
                request.setAssignedTo(sender);
                updatedTicket = true;
            }
            if (updatedTicket) {
                supportRequestRepository.save(request);
            }
        }

        SupportRequestMessage message = new SupportRequestMessage(request, sender, dto.message().trim());
        message.setClientMessageId(dto.clientMessageId());
        SupportRequestMessage saved = supportRequestMessageRepository != null
                ? supportRequestMessageRepository.save(message)
                : message;

        // Tự động gửi thông báo trong ứng dụng cho phía đối diện.
        if (notificationService != null) {
            String senderName = sender.getFullName() != null && !sender.getFullName().isBlank()
                    ? sender.getFullName()
                    : sender.getUsername();
            String title = messageService != null
                    ? messageService.getMessage("notifications.support.new_message.title")
                    : "notifications.support.new_message.title";
            String body = messageService != null
                    ? messageService.getMessage("notifications.support.new_message.body", senderName, request.getSubject())
                    : "notifications.support.new_message.body";

            Long targetRequestId = request.getId() != null ? request.getId() : requestId;
            if (staff) {
                // Nếu nhân viên trả lời, thông báo cho hội viên (tài khoản đã xóa không có hộp thư để thông
                // báo).
                if (memberUserId != null && memberReachable(request)) {
                    notificationService.send(memberUserId, title, body, "support_reply", "support_request", targetRequestId);
                }
            } else {
                // Nếu hội viên gửi tin nhắn, thông báo cho người xử lý được gán (nếu có).
                if (request.getAssignedTo() != null && request.getAssignedTo().getId() != null) {
                    notificationService.send(request.getAssignedTo().getId(), title, body, "support_reply", "support_request", targetRequestId);
                } else {
                    // Chưa gán: báo cho người đang xử lý, lễ tân trước và quản lý khi đã chuyển lên.
                    notifyStaff(request.isEscalated() ? MANAGER : RECEPTIONIST,
                            "notifications.support.new_message.title", "notifications.support.new_message.body",
                            targetRequestId, senderName, request.getSubject());
                }
            }
        }

        return supportRequestMapper.toMessageDto(saved);
    }

    /** Tin nhắn của phiếu theo thứ tự thời gian, sau khi kiểm tra quyền xem. */
    @Transactional(readOnly = true)
    public List<SupportRequestMessageDto> getMessages(Long requestId, Long currentUserId, String currentRole) {
        SupportRequest request = supportRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", requestId));

        boolean staff = isStaffRole(currentRole);
        Long memberUserId = request.getMember() != null ? request.getMember().getUserId() : null;
        if (!staff) {
            if (memberUserId == null || !Objects.equals(memberUserId, currentUserId)) {
                throw new ForbiddenException(
                        "FORBIDDEN",
                        "support.message.forbidden",
                        null,
                        "You are not allowed to view messages in this support request"
                );
            }
        }

        requireActor(currentUserId, currentRole);
        if (staff) requireReadable(request, currentRole);
        if (supportRequestMessageRepository == null) {
            return List.of();
        }

        List<SupportRequestMessage> messages = supportRequestMessageRepository.findBySupportRequestIdOrderByCreatedAtAsc(requestId);
        return messages.stream().map(supportRequestMapper::toMessageDto).toList();
    }

    /** Chi tiết phiếu sau khi kiểm tra quyền; hội viên không thấy lý do chuyển lên nội bộ. */
    @Transactional(readOnly = true)
    public SupportRequestDto getRequest(Long requestId, Long actorId, String role) {
        SupportRequestDto dto = supportRequestMapper.toDto(requireTicket(requestId, actorId, role));
        return isStaffRole(role) ? dto : dto.forMember();
    }

    /** Lấy phiếu và kiểm tra quyền: hội viên chỉ phiếu của mình; quản lý chỉ phiếu đã chuyển lên. */
    @Transactional(readOnly = true)
    public SupportRequest requireTicket(Long requestId, Long actorId, String role) {
        requireActor(actorId, role);
        SupportRequest request = supportRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", requestId));
        if (!isStaffRole(role) && (request.getMember() == null || !Objects.equals(request.getMember().getUserId(), actorId)))
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        if (isStaffRole(role)) requireReadable(request, role);
        return request;
    }

    /**
     * Người thao tác phải là tài khoản active, chưa bị xóa, vai trò trong database khớp vai trò trong token và
     * là hội viên hoặc nhân viên hỗ trợ.
     */
    public User requireActor(Long actorId, String role) {
        User actor = userRepository.findByIdAndDeletedAtIsNull(actorId)
                .orElseThrow(() -> new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null));
        if (!"active".equalsIgnoreCase(actor.getStatus()) || actor.getRole() == null
                || !Objects.equals(actor.getRole().getCode(), role)
                || !("MEMBER".equals(role) || STAFF_ROLES.contains(role)))
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        return actor;
    }

    /** Chuẩn hóa mã vai trò: bỏ tiền tố ROLE_ và chuyển chữ hoa. */
    private static String normalizeRole(String role) {
        if (role == null) return "";
        String normalized = role.startsWith("ROLE_") ? role.substring(5) : role;
        return normalized.toUpperCase(Locale.ROOT);
    }

    /** Vai trò quản lý (CENTER_MANAGER hoặc MANAGER). */
    private static boolean isManager(String role) {
        String normalized = normalizeRole(role);
        return MANAGER.equals(normalized) || "MANAGER".equals(normalized);
    }

    /** Vai trò lễ tân (RECEPTIONIST hoặc STAFF). */
    private static boolean isReceptionist(String role) {
        String normalized = normalizeRole(role);
        return RECEPTIONIST.equals(normalized) || "STAFF".equals(normalized);
    }

    /**
     * Nhân viên xử lý khiếu nại chỉ gồm lễ tân và quản lý (HLV không tham gia).
     *
     * HLV không còn tham gia xử lý khiếu nại: chỉ lễ tân và quản lý là nhân viên ở đây.
     */
    private boolean isStaffRole(String role) {
        return isManager(role) || isReceptionist(role);
    }

    /** Chỉ nhân viên xử lý khiếu nại mới xem được hộp thư. */
    private void requireInboxRole(String role) {
        if (!isStaffRole(role)) {
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        }
    }

    /**
     * Lễ tân xem mọi phiếu; quản lý chỉ xem phiếu đã chuyển lên.
     *
     * Lễ tân thấy mọi khiếu nại; quản lý chỉ thấy những khiếu nại được chuyển lên.
     */
    private void requireReadable(SupportRequest request, String role) {
        if (isManager(role) && !request.isEscalated()) {
            throw new ForbiddenException("SUPPORT_NOT_ESCALATED", "support.manager.not_escalated", null, null);
        }
    }

    /**
     * Lễ tân xử lý phiếu cho tới khi chuyển lên; sau đó chỉ quản lý được thao tác.
     *
     * Lễ tân xử lý khiếu nại cho đến khi nó được chuyển lên; từ đó chỉ quản lý được thao tác.
     */
    private void requireHandler(SupportRequest request, String role) {
        if (isManager(role)) {
            if (!request.isEscalated()) {
                throw new ForbiddenException("SUPPORT_NOT_ESCALATED", "support.manager.not_escalated", null, null);
            }
        } else if (isReceptionist(role)) {
            if (request.isEscalated()) {
                throw new ForbiddenException("SUPPORT_ESCALATED_LOCKED", "support.escalated.locked", null, null);
            }
        } else {
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        }
    }

    /**
     * Lễ tân chuyển phiếu đang mở/đang xử lý lên quản lý: lưu thời điểm, người chuyển, lý do, bỏ người phụ
     * trách cũ; báo cho quản lý và hội viên.
     *
     * Chuyển lên cho quản lý khiếu nại mà lễ tân không giải quyết được.
     */
    @Transactional
    @Audited(action = "SUPPORT_ESCALATE", entity = "support_requests")
    public SupportRequestDto escalate(Long id, Long actorId, String role, EscalateSupportRequestDto dto) {
        if (!isReceptionist(role)) {
            throw new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null);
        }
        User actor = requireActor(actorId, role);
        SupportRequest request = supportRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", id));
        if (request.isEscalated()) {
            throw new ConflictException("SUPPORT_ALREADY_ESCALATED", "support.escalate.already", null,
                    "Support request is already escalated");
        }
        String status = request.getStatus() == null ? "" : request.getStatus().toLowerCase(Locale.ROOT);
        if (!"open".equals(status) && !"in_progress".equals(status)) {
            throw new BadRequestException("SUPPORT_ESCALATE_INVALID_STATE", "support.escalate.invalid_state", null,
                    "Only an open or in-progress request can be escalated");
        }
        request.setEscalatedAt(LocalDateTime.now(clock));
        request.setEscalatedBy(actor);
        request.setEscalationReason(dto.reason().trim());
        request.setAssignedTo(null);
        SupportRequest saved = supportRequestRepository.save(request);
        SupportRequest result = saved != null ? saved : request;
        notifyStaff(MANAGER, "notifications.support.escalated_manager.title", "notifications.support.escalated_manager.body",
                id, result.getSubject());
        if (notificationService != null && result.getMember() != null && result.getMember().getUserId() != null
                && memberReachable(result)) {
            notificationService.send(result.getMember().getUserId(),
                    text("notifications.support.escalated_member.title"),
                    text("notifications.support.escalated_member.body", result.getSubject()),
                    "support_reply", "support_request", id);
        }
        return supportRequestMapper.toDto(result);
    }

    /**
     * Hội viên còn nhận được thông báo không (tài khoản chưa bị xóa); phiếu của tài khoản đã xóa vẫn xử lý được
     * nhưng bỏ qua thông báo.
     *
     * Thông báo xác định người nhận trong các người dùng chưa bị xóa. Việc trả lời hay cập nhật khiếu nại của
     * hội viên đã xóa vẫn phải hoạt động, nên bỏ qua thông báo trong ứng dụng thay vì làm hỏng cả lần ghi.
     */
    private static boolean memberReachable(SupportRequest request) {
        Member member = request.getMember();
        return member != null && (member.getUser() == null || member.getUser().getDeletedAt() == null);
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String text(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** Gửi thông báo cho mọi nhân viên đang hoạt động thuộc vai trò cho trước (quản lý hoặc lễ tân). */
    private void notifyStaff(String roleCode, String titleKey, String bodyKey, Long requestId, Object... bodyArgs) {
        if (notificationService == null || userRepository == null) return;
        List<User> staff = userRepository.findActiveStaffUsers();
        if (staff == null) return;
        for (User user : staff) {
            boolean match = MANAGER.equals(roleCode)
                    ? isManager(user.getRole() != null ? user.getRole().getCode() : null)
                    : isReceptionist(user.getRole() != null ? user.getRole().getCode() : null);
            if (user.getId() != null && user.getRole() != null && match) {
                notificationService.send(user.getId(), text(titleKey), text(bodyKey, bodyArgs),
                        "support_reply", "support_request", requestId);
            }
        }
    }

    /**
     * Kiểm tra chuyển trạng thái hợp lệ: open → in_progress; in_progress → open/resolved; resolved →
     * in_progress/closed; giữ nguyên trạng thái luôn hợp lệ.
     */
    private void validateStatusTransition(String currentStatus, String targetStatus) {
        if (currentStatus != null && currentStatus.equalsIgnoreCase(targetStatus)) {
            return;
        }
        boolean valid = switch (currentStatus == null ? "" : currentStatus.toLowerCase()) {
            // Nhân viên nhận ticket trước khi giải quyết; đóng ticket diễn ra sau khi giải quyết (hội viên xác
            // nhận hoặc qua 72 giờ).
            case "open" -> "in_progress".equalsIgnoreCase(targetStatus);
            case "in_progress" -> "open".equalsIgnoreCase(targetStatus) || "resolved".equalsIgnoreCase(targetStatus);
            case "resolved" -> "in_progress".equalsIgnoreCase(targetStatus) || "closed".equalsIgnoreCase(targetStatus);
            default -> false;
        };
        if (!valid) {
            throw new com.swp391.scms.common.exception.AppException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "INVALID_STATE_TRANSITION",
                    "support.status.invalid_transition",
                    new Object[]{currentStatus, targetStatus},
                    "Invalid state transition from " + currentStatus + " to " + targetStatus
            );
        }
    }
}
