package com.swp391.scms.support;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Service
public class SupportRequestService {

    private static final Set<String> VALID_STATUSES = Set.of("open", "in_progress", "resolved", "closed");
    private static final Set<String> STAFF_ROLES = Set.of("CENTER_MANAGER", "RECEPTIONIST");

    private final SupportRequestRepository supportRequestRepository;
    private final SupportRequestMapper supportRequestMapper;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;

    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository) {
        this(supportRequestRepository, supportRequestMapper, memberRepository, userRepository, null, null);
    }

    @Autowired
    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository,
                                 NotificationService notificationService,
                                 MessageService messageService) {
        this.supportRequestRepository = supportRequestRepository;
        this.supportRequestMapper = supportRequestMapper;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    @Transactional
    public SupportRequestDto createRequest(Long memberId, CreateSupportRequestDto dto) {
        Member member = memberRepository.findById(memberId)
                .filter(m -> m.getUser() == null || m.getUser().getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));

        SupportRequest request = new SupportRequest(member, dto.subject(), dto.description());
        supportRequestRepository.save(request);
        return supportRequestMapper.toDto(request);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getMyRequests(Long memberId, Pageable pageable) {
        return supportRequestRepository.findByMemberUserIdOrderByCreatedAtDesc(memberId, pageable)
                .map(supportRequestMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getAllRequests(String status, Pageable pageable) {
        String normalizedStatus = (status == null || status.isBlank()) ? null : status.trim().toLowerCase(Locale.ROOT);
        if (normalizedStatus != null && !VALID_STATUSES.contains(normalizedStatus)) {
            throw new BadRequestException("INVALID_SUPPORT_STATUS", "validation.support.status.invalid", null,
                    "Invalid support request status: " + status);
        }
        return supportRequestRepository.findAllByStatus(normalizedStatus, pageable)
                .map(supportRequestMapper::toDto);
    }

    @Transactional
    public SupportRequestDto updateStatus(Long id, UpdateSupportRequestStatusDto dto) {
        SupportRequest request = supportRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", id));

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
                    request.setResolvedAt(LocalDateTime.now());
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
            if (assignee.getRole() != null && assignee.getRole().getCode() != null
                    && !STAFF_ROLES.contains(assignee.getRole().getCode().toUpperCase(Locale.ROOT))) {
                throw new BadRequestException("INVALID_ASSIGNEE", "support.assignee.invalid", null,
                        "Assignee must hold a staff role");
            }
            request.setAssignedTo(assignee);
        }

        SupportRequest saved = supportRequestRepository.save(request);
        if (statusChanged && notificationService != null && request.getMember() != null) {
            Long memberUserId = request.getMember().getUserId() != null
                    ? request.getMember().getUserId()
                    : (request.getMember().getUser() != null ? request.getMember().getUser().getId() : null);
            if (memberUserId != null) {
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

    private void validateStatusTransition(String currentStatus, String targetStatus) {
        if (currentStatus != null && currentStatus.equalsIgnoreCase(targetStatus)) {
            return;
        }
        boolean valid = switch (currentStatus == null ? "" : currentStatus.toLowerCase()) {
            case "open" -> "in_progress".equalsIgnoreCase(targetStatus);
            case "in_progress" -> "open".equalsIgnoreCase(targetStatus) || "resolved".equalsIgnoreCase(targetStatus);
            case "resolved" -> "closed".equalsIgnoreCase(targetStatus);
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
