package com.swp391.scms.operations.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.operations.dto.StaffInternalRequestCreateDto;
import com.swp391.scms.operations.dto.StaffInternalRequestDto;
import com.swp391.scms.operations.dto.StaffInternalRequestReviewDto;
import com.swp391.scms.operations.entity.StaffInternalRequest;
import com.swp391.scms.operations.repository.StaffInternalRequestRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import com.swp391.scms.common.i18n.MessageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Nghiệp vụ đơn từ nội bộ: nhân viên gửi/hủy đơn, quản lý duyệt/từ chối; thông báo cho quản lý khi có đơn mới
 * và cho người gửi khi có kết quả.
 */
@Service
public class StaffInternalRequestService {

    private static final Set<String> VALID_TYPES = Set.of(
            "LEAVE", "SHIFT_EXCHANGE", "SCHEDULE_CHANGE", "OTHER"
    );

    private final StaffInternalRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;

    private static final Set<String> REPLACEMENT_ROLES = Set.of("COACH", "RECEPTIONIST");

    @Autowired(required = false)
    private com.swp391.scms.scheduling.repository.ClassSessionRepository classSessionRepository;

    @Autowired(required = false)
    private com.swp391.scms.coaching.repository.CoachBookingRepository coachBookingRepository;

    /** Constructor cho test với repository bắt buộc. */
    public StaffInternalRequestService(StaffInternalRequestRepository requestRepository,
                                       UserRepository userRepository) {
        this(requestRepository, userRepository, null);
    }

    /** Constructor cho test có NotificationService. */
    public StaffInternalRequestService(StaffInternalRequestRepository requestRepository,
                                       UserRepository userRepository,
                                       NotificationService notificationService) {
        this(requestRepository, userRepository, notificationService, null);
    }

    /** Constructor Spring dùng; NotificationService là tùy chọn. */
    @Autowired
    public StaffInternalRequestService(StaffInternalRequestRepository requestRepository,
                                       UserRepository userRepository,
                                       @Autowired(required = false) NotificationService notificationService, MessageService messageService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    /**
     * Tạo đơn: loại đơn phải hợp lệ, ngày kết thúc không trước ngày bắt đầu, đơn nghỉ bắt buộc có ngày. Đơn
     * nghỉ trùng ngày với đơn khác thì báo trước, chỉ gửi khi người dùng xác nhận. Người thay ca phải là nhân
     * viên khác đang hoạt động có vai trò phù hợp. Lưu đơn ở trạng thái PENDING và báo cho mọi quản lý.
     */
    @Transactional
    public StaffInternalRequestDto createRequest(Long userId, StaffInternalRequestCreateDto requestDto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", userId));

        String type = requestDto.requestType().toUpperCase().trim();
        if (!VALID_TYPES.contains(type)) {
            throw new BadRequestException("INVALID_REQUEST_TYPE", "error.operations.request.invalid_type", null, "Loại đơn từ không hợp lệ.");
        }

        if (requestDto.startDate() != null && requestDto.endDate() != null
                && requestDto.endDate().isBefore(requestDto.startDate())) {
            throw new BadRequestException("INVALID_DATE_RANGE", "error.operations.request.invalid_date_range", null, "End date must not precede start date.");
        }

        if ("LEAVE".equals(type) && (requestDto.startDate() == null || requestDto.endDate() == null)) {
            throw new BadRequestException("LEAVE_DATES_REQUIRED", "error.operations.request.leave_dates_required", null, "A leave request needs its start and end dates.");
        }

        // Đơn nghỉ thứ hai vào những ngày đã xin thường là nhầm: cảnh báo trước, chỉ gửi khi người dùng xác
        // nhận.
        if ("LEAVE".equals(type) && !Boolean.TRUE.equals(requestDto.confirmOverlap())) {
            List<StaffInternalRequest> overlaps = requestRepository.findOverlappingLeaves(userId, requestDto.startDate(), requestDto.endDate());
            if (!overlaps.isEmpty()) {
                StaffInternalRequest first = overlaps.get(0);
                var dmy = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
                LocalDate end = first.getEndDate() != null ? first.getEndDate() : first.getStartDate();
                throw new com.swp391.scms.common.exception.ConflictException("LEAVE_OVERLAP",
                        "APPROVED".equals(first.getStatus()) ? "error.operations.request.leave_overlap_approved"
                                : "error.operations.request.leave_overlap_pending",
                        new Object[]{first.getStartDate().format(dmy), end.format(dmy)},
                        "You already have a leave request on these days.");
            }
        }

        // Người thay thế phải là nhân viên đang hoạt động khác, có thể thực sự phủ ca.
        User replacement = null;
        if (requestDto.replacementUserId() != null) {
            replacement = userRepository.findByIdAndDeletedAtIsNull(requestDto.replacementUserId())
                    .filter(candidate -> !candidate.getId().equals(userId)
                            && "active".equalsIgnoreCase(candidate.getStatus())
                            && candidate.getRole() != null
                            && REPLACEMENT_ROLES.contains(candidate.getRole().getCode().toUpperCase(java.util.Locale.ROOT)))
                    .orElseThrow(() -> new BadRequestException("INVALID_REPLACEMENT", "error.operations.request.invalid_replacement", null, "Choose another active staff member."));
        }

        StaffInternalRequest req = new StaffInternalRequest();
        req.setUser(user);
        req.setRequestType(type);
        req.setTitle(requestDto.title().trim());
        req.setReason(requestDto.reason().trim());
        req.setStartDate(requestDto.startDate());
        req.setEndDate(requestDto.endDate());
        req.setTargetShift(requestDto.targetShift() != null && !requestDto.targetShift().isBlank() ? requestDto.targetShift().trim() : null);
        req.setReplacementUser(replacement);
        req.setStatus("PENDING");
        req.setCreatedAt(LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE));

        StaffInternalRequest saved = requestRepository.save(req);

        // Thông báo cho quản lý về yêu cầu mới.
        if (notificationService != null) {
            List<User> managers = userRepository.findActiveManagers().stream()
                    .filter(u -> u.getRole() != null && 
                            ("MANAGER".equalsIgnoreCase(u.getRole().getCode()) || "CENTER_MANAGER".equalsIgnoreCase(u.getRole().getCode())))
                    .toList();
            for (User mgr : managers) {
                String roleCode = user.getRole() != null ? user.getRole().getCode() : "STAFF";
                notificationService.send(
                        mgr.getId(),
                        msg("notifications.operations.created.title"),
                        msg("notifications.operations.created.body", user.getFullName(), roleCode, type, saved.getTitle()),
                        "system",
                        null,
                        saved.getId(),
                        "/manager/requests"
                );
            }
        }

        return mapToDto(saved);
    }

    /** Các đơn của một nhân viên, lọc theo trạng thái (ALL hoặc trống là tất cả), mới nhất trước. */
    @Transactional(readOnly = true)
    public List<StaffInternalRequestDto> getMyRequests(Long userId, String status) {
        List<StaffInternalRequest> list;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            list = requestRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status.toUpperCase().trim());
        } else {
            list = requestRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }
        return list.stream().map(this::mapToDto).toList();
    }

    /** Nhân viên hủy đơn của chính mình; chỉ hủy được khi đơn đang chờ duyệt. */
    @Transactional
    public StaffInternalRequestDto cancelRequest(Long userId, Long requestId) {
        StaffInternalRequest req = requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.staff_internal_request", requestId));

        if (!req.getUser().getId().equals(userId)) {
            throw new ForbiddenException("FORBIDDEN", "error.operations.request.forbidden", null, "Bạn không có quyền thao tác trên đơn từ của người khác.");
        }

        if (!"PENDING".equalsIgnoreCase(req.getStatus())) {
            throw new BadRequestException("CANNOT_CANCEL", "error.operations.request.cannot_cancel", null, "Chỉ có thể hủy đơn khi đang ở trạng thái Chờ duyệt.");
        }

        req.setStatus("CANCELLED");
        req.setUpdatedAt(LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE));
        StaffInternalRequest updated = requestRepository.save(req);
        return mapToDto(updated);
    }

    /** Mọi đơn cho quản lý, lọc theo trạng thái và loại (ALL hoặc trống là bỏ qua). */
    @Transactional(readOnly = true)
    public List<StaffInternalRequestDto> getAllRequests(String status, String requestType) {
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) ? status.toUpperCase().trim() : null;
        String cleanType = (requestType != null && !requestType.isBlank() && !"ALL".equalsIgnoreCase(requestType.trim())) ? requestType.toUpperCase().trim() : null;
        return requestRepository.findWithFilters(cleanStatus, cleanType).stream()
                .map(this::mapToDto)
                .toList();
    }

    /**
     * Quản lý duyệt hoặc từ chối đơn đang chờ (từ chối phải có ghi chú); lưu người và thời điểm duyệt. Duyệt
     * đơn nghỉ thì báo cho quản lý số lớp/buổi PT bị ảnh hưởng. Gửi thông báo kết quả cho người gửi.
     */
    @Transactional
    public StaffInternalRequestDto reviewRequest(Long managerUserId, Long requestId, StaffInternalRequestReviewDto reviewDto) {
        StaffInternalRequest req = requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.staff_internal_request", requestId));

        if (!"PENDING".equalsIgnoreCase(req.getStatus())) {
            throw new BadRequestException("ALREADY_REVIEWED", "error.operations.request.already_reviewed", null, "Đơn từ này đã được xử lý trước đó.");
        }

        String newStatus = reviewDto.status().toUpperCase().trim();
        if (!"APPROVED".equals(newStatus) && !"REJECTED".equals(newStatus)) {
            throw new BadRequestException("INVALID_STATUS", "error.operations.request.invalid_status", null, "Trạng thái phê duyệt chỉ có thể là APPROVED hoặc REJECTED.");
        }

        if ("REJECTED".equals(newStatus) && (reviewDto.managerNotes() == null || reviewDto.managerNotes().isBlank())) {
            throw new BadRequestException("REJECTION_REASON_REQUIRED", "error.operations.request.rejection_reason_required", null, "Vui lòng nhập lý do từ chối đơn.");
        }

        User manager = userRepository.findById(managerUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", managerUserId));

        req.setStatus(newStatus);
        req.setManagerNotes(reviewDto.managerNotes() != null ? reviewDto.managerNotes().trim() : null);
        req.setReviewedBy(manager);
        LocalDateTime reviewedNow = LocalDateTime.now(com.swp391.scms.common.CenterTime.ZONE);
        req.setReviewedAt(reviewedNow);
        req.setUpdatedAt(reviewedNow);

        StaffInternalRequest saved = requestRepository.save(req);

        if ("APPROVED".equals(newStatus)) {
            reportLeaveImpact(saved, manager);
        }

        // Gửi thông báo trong ứng dụng cho người gửi yêu cầu.
        if (notificationService != null) {
            String title = msg("APPROVED".equals(newStatus) ? "notifications.operations.approved.title" : "notifications.operations.rejected.title");
            String message = msg("notifications.operations.reviewed.body", saved.getTitle(),
                    manager.getFullName(), msg("operations.status." + newStatus.toLowerCase(java.util.Locale.ROOT)),
                    saved.getManagerNotes() != null ? saved.getManagerNotes() : "");

            notificationService.send(
                    saved.getUser().getId(),
                    title,
                    message,
                    "system",
                    "staff_internal_request",
                    saved.getId(),
                    "/staff/requests"
            );
        }

        return mapToDto(saved);
    }

    /** Chuyển đơn sang DTO trả cho client. */
    private StaffInternalRequestDto mapToDto(StaffInternalRequest r) {
        return new StaffInternalRequestDto(
                r.getId(),
                r.getUser().getId(),
                r.getUser().getFullName(),
                r.getUser().getEmail(),
                r.getUser().getRole() != null ? r.getUser().getRole().getCode() : null,
                r.getRequestType(),
                r.getTitle(),
                r.getReason(),
                r.getStartDate(),
                r.getEndDate(),
                r.getTargetShift(),
                r.getReplacementUser() != null ? r.getReplacementUser().getId() : null,
                r.getReplacementUser() != null ? r.getReplacementUser().getFullName() : null,
                r.getStatus(),
                r.getManagerNotes(),
                r.getReviewedBy() != null ? r.getReviewedBy().getId() : null,
                r.getReviewedBy() != null ? r.getReviewedBy().getFullName() : null,
                r.getReviewedAt(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Khi duyệt đơn nghỉ của HLV: đếm số buổi lớp và buổi PT đã lên lịch trong thời gian nghỉ, nếu có thì báo
     * cho quản lý để sắp xếp người dạy thay. (Đơn nghỉ đã duyệt cũng chặn đặt PT mới trong thời gian đó.)
     *
     * Nghỉ phép HLV đã duyệt chặn các lượt đặt 1:1 mới (xem CoachBookingService); các lớp và buổi đã xếp
     * trong kỳ nghỉ được báo cho quản lý duyệt để sắp xếp người thay.
     */
    private void reportLeaveImpact(StaffInternalRequest leave, User manager) {
        if (!"LEAVE".equals(leave.getRequestType()) || leave.getStartDate() == null || notificationService == null) {
            return;
        }
        java.time.LocalDate end = leave.getEndDate() != null ? leave.getEndDate() : leave.getStartDate();
        Long staffId = leave.getUser().getId();
        long classSessions = classSessionRepository != null
                ? classSessionRepository.countScheduledForCoachBetween(staffId, leave.getStartDate(), end) : 0;
        long ptSessions = coachBookingRepository != null
                ? coachBookingRepository.countConfirmedForCoachBetween(staffId, leave.getStartDate(), end) : 0;
        if (classSessions == 0 && ptSessions == 0) {
            return;
        }
        notificationService.send(
                manager.getId(),
                msg("notifications.operations.leave_impact.title"),
                msg("notifications.operations.leave_impact.body", leave.getUser().getFullName(),
                        leave.getStartDate(), end, classSessions, ptSessions),
                "system",
                null,
                leave.getId());
    }
}
