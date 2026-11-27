package com.swp391.scms.operations.service;

import com.swp391.scms.common.CenterTime;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.config.I18nConfig;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.operations.dto.StaffInternalRequestCreateDto;
import com.swp391.scms.operations.dto.StaffInternalRequestDto;
import com.swp391.scms.operations.dto.StaffInternalRequestReviewDto;
import com.swp391.scms.operations.entity.StaffInternalRequest;
import com.swp391.scms.operations.repository.StaffInternalRequestRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Nghiệp vụ đơn từ nội bộ: nhân viên gửi/hủy đơn, quản lý duyệt/từ chối; thông báo cho quản lý khi có đơn mới
 * và cho người gửi khi có kết quả.
 */
@Service
public class StaffInternalRequestService {

    private static final Logger log = LoggerFactory.getLogger(StaffInternalRequestService.class);

    private static final Set<String> VALID_TYPES = Set.of(
            "LEAVE", "SHIFT_EXCHANGE", "SCHEDULE_CHANGE", "OTHER"
    );
    private static final long MAX_LEAVE_SPAN_DAYS = 90L;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_TARGET_SHIFT_LENGTH = 100;
    private static final int MAX_TEXT_LENGTH = 2000;
    private static final int MAX_LIST_RESULTS = 200;
    private static final String COACH_ASSIGNMENTS_PATH = "/manager/coach-assignments";
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private record LeaveImpact(long classSessions, long ptSessions) {
        static final LeaveImpact NONE = new LeaveImpact(0L, 0L);

        boolean hasConflicts() {
            return classSessions > 0 || ptSessions > 0;
        }
    }

    private final StaffInternalRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private Clock clock = Clock.system(CenterTime.ZONE);

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
                                       @Autowired(required = false) NotificationService notificationService,
                                       @Autowired(required = false) MessageService messageService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    /** Tiêm Clock chuẩn (múi giờ trung tâm {@link CenterTime#ZONE}); hữu ích cho kiểm thử cố định thời gian. */
    @Autowired(required = false)
    public void setClock(Clock clock) {
        if (clock != null) {
            this.clock = clock;
        }
    }

    /**
     * Tạo đơn: loại đơn phải hợp lệ, không được gửi ngày quá khứ hay endDate mồ côi, khoảng nghỉ tối đa 90 ngày,
     * đơn nghỉ bắt buộc có ngày bắt đầu và kết thúc. Đơn nghỉ trùng ngày với đơn khác thì báo trước, chỉ gửi khi
     * người dùng xác nhận. Người thay ca phải là nhân viên khác đang hoạt động cùng nhóm vai trò chức năng và
     * không đang nghỉ phép đã duyệt trong khoảng ngày đó. Lưu đơn ở trạng thái PENDING và báo cho mọi quản lý.
     */
    @Transactional
    public StaffInternalRequestDto createRequest(Long userId, StaffInternalRequestCreateDto requestDto) {
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", userId));

        String type = requestDto.requestType().trim().toUpperCase(Locale.ROOT);
        if (!VALID_TYPES.contains(type)) {
            throw new BadRequestException("INVALID_REQUEST_TYPE", "error.operations.request.invalid_type", null, "Loại đơn từ không hợp lệ.");
        }

        if ("LEAVE".equals(type)) {
            userRepository.findByIdForUpdate(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.user", userId));
        }

        String title = requestDto.title().trim();
        String reason = requestDto.reason().trim();
        String targetShift = requestDto.targetShift() != null && !requestDto.targetShift().isBlank()
                ? requestDto.targetShift().trim() : null;

        if (title.length() > MAX_TITLE_LENGTH) {
            throw new BadRequestException("TITLE_TOO_LONG", "error.invalid_parameter", null,
                    "Title must not exceed " + MAX_TITLE_LENGTH + " characters.");
        }
        if (reason.length() > MAX_TEXT_LENGTH) {
            throw new BadRequestException("REASON_TOO_LONG", "validation.support.message.size", null,
                    "Reason must not exceed " + MAX_TEXT_LENGTH + " characters.");
        }
        if (targetShift != null && targetShift.length() > MAX_TARGET_SHIFT_LENGTH) {
            throw new BadRequestException("TARGET_SHIFT_TOO_LONG", "error.invalid_parameter", null,
                    "Target shift must not exceed " + MAX_TARGET_SHIFT_LENGTH + " characters.");
        }

        if (requestDto.startDate() == null && requestDto.endDate() != null) {
            throw new BadRequestException("INVALID_DATE_RANGE", "error.operations.request.invalid_date_range", null,
                    "Start date is required when end date is provided.");
        }

        if (requestDto.startDate() != null && requestDto.endDate() != null
                && requestDto.endDate().isBefore(requestDto.startDate())) {
            throw new BadRequestException("INVALID_DATE_RANGE", "error.operations.request.invalid_date_range", null, "End date must not precede start date.");
        }

        LocalDate today = LocalDate.now(clock.withZone(CenterTime.ZONE));
        if (requestDto.startDate() != null && requestDto.startDate().isBefore(today)) {
            throw new BadRequestException("PAST_DATE_NOT_ALLOWED", "validation.scheduling.session_date.future_or_present", null,
                    "Start date cannot be in the past.");
        }

        if ("LEAVE".equals(type) && (requestDto.startDate() == null || requestDto.endDate() == null)) {
            throw new BadRequestException("LEAVE_DATES_REQUIRED", "error.operations.request.leave_dates_required", null, "A leave request needs its start and end dates.");
        }

        // Nghỉ phép phải báo trước: ngày bắt đầu sớm nhất là ngày mai tại trung tâm.
        if ("LEAVE".equals(type) && !requestDto.startDate().isAfter(today)) {
            throw new BadRequestException("LEAVE_START_MUST_BE_FUTURE", "error.operations.request.leave_start_future", null,
                    "Leave must start tomorrow or later.");
        }

        if (requestDto.startDate() != null && requestDto.endDate() != null
                && ChronoUnit.DAYS.between(requestDto.startDate(), requestDto.endDate()) > MAX_LEAVE_SPAN_DAYS) {
            throw new BadRequestException("LEAVE_SPAN_TOO_LONG", "error.operations.request.invalid_date_range", null,
                    "Request date span cannot exceed " + MAX_LEAVE_SPAN_DAYS + " days.");
        }

        // Đơn nghỉ thứ hai vào những ngày đã xin thường là nhầm: cảnh báo trước, chỉ gửi khi người dùng xác
        // nhận.
        if ("LEAVE".equals(type) && !Boolean.TRUE.equals(requestDto.confirmOverlap())) {
            List<StaffInternalRequest> overlaps = requestRepository.findOverlappingLeaves(userId, requestDto.startDate(), requestDto.endDate());
            if (!overlaps.isEmpty()) {
                StaffInternalRequest first = overlaps.get(0);
                LocalDate end = first.getEndDate() != null ? first.getEndDate() : first.getStartDate();
                throw new ConflictException("LEAVE_OVERLAP",
                        "APPROVED".equals(first.getStatus()) ? "error.operations.request.leave_overlap_approved"
                                : "error.operations.request.leave_overlap_pending",
                        new Object[]{first.getStartDate().format(DMY), end.format(DMY)},
                        "You already have a leave request on these days.");
            }
        }

        // Người thay thế phải là nhân viên đang hoạt động khác, cùng nhóm vai trò chức năng và không đang nghỉ phép đã duyệt.
        User replacement = null;
        if (requestDto.replacementUserId() != null) {
            String requesterGroup = functionalRoleGroup(user);
            replacement = userRepository.findByIdAndDeletedAtIsNull(requestDto.replacementUserId())
                    .filter(candidate -> !candidate.getId().equals(userId)
                            && "active".equalsIgnoreCase(candidate.getStatus())
                            && requesterGroup != null
                            && requesterGroup.equals(functionalRoleGroup(candidate)))
                    .orElseThrow(() -> new BadRequestException("INVALID_REPLACEMENT", "error.operations.request.invalid_replacement", null, "Choose another active staff member in the same role group."));

            if (requestDto.startDate() != null) {
                LocalDate rangeEnd = requestDto.endDate() != null ? requestDto.endDate() : requestDto.startDate();
                if (requestRepository.existsApprovedLeaveOverlapping(replacement.getId(), requestDto.startDate(), rangeEnd)) {
                    throw new BadRequestException("INVALID_REPLACEMENT", "error.operations.request.invalid_replacement", null,
                            "Replacement staff member is on approved leave during the requested dates.");
                }
            }
        }

        StaffInternalRequest req = new StaffInternalRequest();
        req.setUser(user);
        req.setRequestType(type);
        req.setTitle(title);
        req.setReason(reason);
        req.setStartDate(requestDto.startDate());
        req.setEndDate(requestDto.endDate());
        req.setTargetShift(targetShift);
        req.setReplacementUser(replacement);
        req.setStatus("PENDING");
        req.setCreatedAt(LocalDateTime.now(clock.withZone(CenterTime.ZONE)));

        StaffInternalRequest saved = requestRepository.save(req);

        // Thông báo cho quản lý về yêu cầu mới.
        if (notificationService != null) {
            List<User> managers = userRepository.findActiveManagers().stream()
                    .filter(u -> u.getRole() != null &&
                            ("MANAGER".equalsIgnoreCase(u.getRole().getCode()) || "CENTER_MANAGER".equalsIgnoreCase(u.getRole().getCode())))
                    .toList();
            String roleLabel = localizedRoleLabel(user);
            String typeLabel = localizedRequestTypeLabel(type);
            for (User mgr : managers) {
                try {
                    notificationService.send(
                            mgr.getId(),
                            msg("notifications.operations.created.title"),
                            msg("notifications.operations.created.body", user.getFullName(), roleLabel, typeLabel, saved.getTitle()),
                            "system",
                            null,
                            saved.getId(),
                            "/manager/requests"
                    );
                } catch (ResourceNotFoundException ex) {
                    log.warn("Skipping manager notification for missing or deleted manager {}", mgr.getId());
                }
            }
        }

        return mapToDto(saved);
    }

    /** Các đơn của một nhân viên, lọc theo trạng thái (ALL hoặc trống là tất cả), giới hạn tối đa 200 đơn mới nhất. */
    @Transactional(readOnly = true)
    public List<StaffInternalRequestDto> getMyRequests(Long userId, String status) {
        var limit = PageRequest.of(0, MAX_LIST_RESULTS);
        List<StaffInternalRequest> list;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
            list = requestRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status.trim().toUpperCase(Locale.ROOT), limit);
        } else {
            list = requestRepository.findByUserIdOrderByCreatedAtDesc(userId, limit);
        }
        return list.stream().map(this::mapToDto).toList();
    }

    /** Nhân viên hủy đơn của chính mình; chỉ hủy được khi đơn đang chờ duyệt. */
    @Transactional
    public StaffInternalRequestDto cancelRequest(Long userId, Long requestId) {
        lockRequestOwner(requestId);
        StaffInternalRequest req = requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.staff_internal_request", requestId));

        if (!req.getUser().getId().equals(userId)) {
            throw new ForbiddenException("FORBIDDEN", "error.operations.request.forbidden", null, "Bạn không có quyền thao tác trên đơn từ của người khác.");
        }

        if (!"PENDING".equalsIgnoreCase(req.getStatus())) {
            throw new BadRequestException("CANNOT_CANCEL", "error.operations.request.cannot_cancel", null, "Chỉ có thể hủy đơn khi đang ở trạng thái Chờ duyệt.");
        }

        req.setStatus("CANCELLED");
        req.setUpdatedAt(LocalDateTime.now(clock.withZone(CenterTime.ZONE)));
        StaffInternalRequest updated = requestRepository.save(req);
        return mapToDto(updated);
    }

    /** Mọi luồng đổi trạng thái cùng lấy khóa nhân viên trước khóa đơn để tránh đảo thứ tự khóa. */
    private void lockRequestOwner(Long requestId) {
        Long ownerId = requestRepository.findOwnerId(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.staff_internal_request", requestId));
        userRepository.findByIdForUpdate(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", ownerId));
    }

    /** Mọi đơn cho quản lý, lọc theo trạng thái và loại (ALL hoặc trống là bỏ qua), tối đa 200 đơn mới nhất. */
    @Transactional(readOnly = true)
    public List<StaffInternalRequestDto> getAllRequests(String status, String requestType) {
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim()))
                ? status.trim().toUpperCase(Locale.ROOT) : null;
        String cleanType = (requestType != null && !requestType.isBlank() && !"ALL".equalsIgnoreCase(requestType.trim()))
                ? requestType.trim().toUpperCase(Locale.ROOT) : null;
        return requestRepository.findWithFilters(cleanStatus, cleanType, PageRequest.of(0, MAX_LIST_RESULTS)).stream()
                .map(this::mapToDto)
                .toList();
    }

    /**
     * Quản lý duyệt hoặc từ chối đơn đang chờ (chặn tự duyệt, từ chối phải có ghi chú); lưu người và thời điểm
     * duyệt. Duyệt đơn nghỉ thì kiểm tra chồng chéo đơn đã duyệt, báo cho quản lý số lớp/buổi PT bị ảnh hưởng kèm
     * đường dẫn xử lý. Gửi thông báo kết quả cho người gửi nếu tài khoản chưa bị xóa mềm.
     */
    @Transactional
    public StaffInternalRequestDto reviewRequest(Long managerUserId, Long requestId, StaffInternalRequestReviewDto reviewDto) {
        // Cùng thứ tự nhân viên → đơn: hai đơn khác nhau cũng không thể cùng vượt kiểm tra trùng.
        lockRequestOwner(requestId);
        StaffInternalRequest req = requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.staff_internal_request", requestId));

        if (req.getUser() != null && Objects.equals(req.getUser().getId(), managerUserId)) {
            throw new ForbiddenException("SELF_REVIEW_FORBIDDEN", "error.forbidden", null,
                    "Bạn không thể tự phê duyệt đơn từ của chính mình.");
        }

        if (!"PENDING".equalsIgnoreCase(req.getStatus())) {
            throw new BadRequestException("ALREADY_REVIEWED", "error.operations.request.already_reviewed", null, "Đơn từ này đã được xử lý trước đó.");
        }

        String newStatus = reviewDto.status().trim().toUpperCase(Locale.ROOT);
        if (!"APPROVED".equals(newStatus) && !"REJECTED".equals(newStatus)) {
            throw new BadRequestException("INVALID_STATUS", "error.operations.request.invalid_status", null, "Trạng thái phê duyệt chỉ có thể là APPROVED hoặc REJECTED.");
        }

        String trimmedNotes = reviewDto.managerNotes() != null ? reviewDto.managerNotes().trim() : null;
        if (trimmedNotes != null && trimmedNotes.length() > MAX_TEXT_LENGTH) {
            throw new BadRequestException("MANAGER_NOTES_TOO_LONG", "validation.support.message.size", null,
                    "Manager notes must not exceed " + MAX_TEXT_LENGTH + " characters.");
        }

        if ("REJECTED".equals(newStatus) && (trimmedNotes == null || trimmedNotes.isBlank())) {
            throw new BadRequestException("REJECTION_REASON_REQUIRED", "error.operations.request.rejection_reason_required", null, "Vui lòng nhập lý do từ chối đơn.");
        }

        User manager = userRepository.findByIdAndDeletedAtIsNull(managerUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", managerUserId));

        LeaveImpact impact = LeaveImpact.NONE;
        if ("APPROVED".equals(newStatus) && "LEAVE".equals(req.getRequestType()) && req.getStartDate() != null) {
            LocalDate leaveEnd = req.getEndDate() != null ? req.getEndDate() : req.getStartDate();
            if (req.getUser() != null) {
                List<StaffInternalRequest> existingApproved = requestRepository.findApprovedOverlappingLeavesForUpdate(
                        req.getUser().getId(), req.getId(), req.getStartDate(), leaveEnd);
                if (existingApproved != null && !existingApproved.isEmpty()) {
                    StaffInternalRequest first = existingApproved.get(0);
                    LocalDate existingEnd = first.getEndDate() != null ? first.getEndDate() : first.getStartDate();
                    throw new ConflictException("LEAVE_OVERLAP",
                            "error.operations.request.leave_overlap_approved",
                            new Object[]{first.getStartDate().format(DMY), existingEnd.format(DMY)},
                            "Staff already has an approved leave overlapping these dates.");
                }
                impact = computeLeaveImpact(req);
                if (Boolean.FALSE.equals(reviewDto.confirmConflicts()) && impact.hasConflicts()) {
                    throw new ConflictException("COACH_LEAVE_HAS_CONFLICTS",
                            leaveImpactBodyKey(impact),
                            new Object[]{req.getUser().getFullName(), req.getStartDate().format(DMY), leaveEnd.format(DMY),
                                    impact.classSessions(), impact.ptSessions()},
                            "Coach has scheduled class or PT sessions during this leave period.");
                }
            }
        }

        // Đọc đồng hồ sau khi lấy khóa và kiểm tra tác động, ngay trước khi đổi trạng thái.
        LocalDateTime reviewedNow = LocalDateTime.now(clock.withZone(CenterTime.ZONE));
        if ("APPROVED".equals(newStatus) && "LEAVE".equals(req.getRequestType())
                && req.getStartDate() != null && !req.getStartDate().isAfter(reviewedNow.toLocalDate())) {
            throw new BadRequestException("LEAVE_APPROVAL_DEADLINE_PASSED", "error.operations.request.leave_approval_deadline", null,
                    "Leave approval deadline passed. The staff member must follow their normal work schedule.");
        }
        req.setStatus(newStatus);
        req.setManagerNotes(trimmedNotes);
        req.setReviewedBy(manager);
        req.setReviewedAt(reviewedNow);
        req.setUpdatedAt(reviewedNow);

        StaffInternalRequest saved = requestRepository.save(req);

        if ("APPROVED".equals(newStatus) && impact.hasConflicts()) {
            reportLeaveImpact(saved, manager, impact);
        }

        // Gửi thông báo trong ứng dụng cho người gửi yêu cầu (bỏ qua an toàn nếu nhân sự đã bị xóa mềm).
        if (notificationService != null && saved.getUser() != null && saved.getUser().getDeletedAt() == null) {
            String title = msg("APPROVED".equals(newStatus) ? "notifications.operations.approved.title" : "notifications.operations.rejected.title");
            String message = msg("notifications.operations.reviewed.body", saved.getTitle(),
                    manager.getFullName(), msg("operations.status." + newStatus.toLowerCase(Locale.ROOT)),
                    saved.getManagerNotes() != null ? saved.getManagerNotes() : "");

            try {
                notificationService.send(
                        saved.getUser().getId(),
                        title,
                        message,
                        "system",
                        null,
                        saved.getId()
                );
            } catch (ResourceNotFoundException ex) {
                log.warn("Skipping review notification for missing or deleted staff user {}", saved.getUser().getId());
            }
        }

        return mapToDto(saved, impact.classSessions(), impact.ptSessions());
    }

    /** Nhóm vai trò chức năng hợp lệ cho người thay thế: COACH ↔ COACH, RECEPTIONIST/STAFF ↔ RECEPTIONIST/STAFF. */
    private static String functionalRoleGroup(User user) {
        if (user == null || user.getRole() == null || user.getRole().getCode() == null) {
            return null;
        }
        String code = user.getRole().getCode().trim().toUpperCase(Locale.ROOT);
        if (code.startsWith("ROLE_")) {
            code = code.substring("ROLE_".length());
        }
        return switch (code) {
            case "COACH" -> "COACH";
            case "RECEPTIONIST", "STAFF" -> "DESK_STAFF";
            default -> null;
        };
    }

    /** Chuyển đơn sang DTO trả cho client (không có xung đột kèm theo). */
    private StaffInternalRequestDto mapToDto(StaffInternalRequest r) {
        return mapToDto(r, 0L, 0L);
    }

    /** Chuyển đơn sang DTO trả cho client kèm số buổi lớp và PT bị ảnh hưởng (nếu có). */
    private StaffInternalRequestDto mapToDto(StaffInternalRequest r,
                                             long affectedClassSessionCount,
                                             long affectedPtSessionCount) {
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
                r.getUpdatedAt(),
                affectedClassSessionCount,
                affectedPtSessionCount
        );
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** Kiểm tra locale hiện tại có phải tiếng Anh không (mặc định tiếng Việt ngoài luồng HTTP). */
    private static boolean isEnglishLocale() {
        Locale locale = LocaleContextHolder.getLocaleContext() != null
                ? LocaleContextHolder.getLocale()
                : I18nConfig.LOCALE_VI;
        return locale != null && "en".equalsIgnoreCase(locale.getLanguage());
    }

    /** Chuyển mã vai trò sang nhãn hiển thị đã bản địa hóa, tránh ghép mã enum thô vào thông báo. */
    private static String localizedRoleLabel(User user) {
        String raw = (user != null && user.getRole() != null && user.getRole().getCode() != null)
                ? user.getRole().getCode().trim().toUpperCase(Locale.ROOT)
                : "STAFF";
        if (raw.startsWith("ROLE_")) {
            raw = raw.substring("ROLE_".length());
        }
        boolean en = isEnglishLocale();
        return switch (raw) {
            case "COACH" -> en ? "Coach" : "Huấn luyện viên";
            case "RECEPTIONIST" -> en ? "Receptionist" : "Lễ tân";
            case "CENTER_MANAGER", "MANAGER" -> en ? "Center Manager" : "Quản lý trung tâm";
            case "ADMIN" -> en ? "Administrator" : "Quản trị viên";
            default -> en ? "Staff" : "Nhân viên";
        };
    }

    /** Chuyển mã loại đơn nội bộ sang nhãn hiển thị đã bản địa hóa, tránh ghép mã enum thô vào thông báo. */
    private static String localizedRequestTypeLabel(String type) {
        String normalized = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        boolean en = isEnglishLocale();
        return switch (normalized) {
            case "LEAVE" -> en ? "Leave" : "Xin nghỉ phép";
            case "SHIFT_EXCHANGE" -> en ? "Shift exchange" : "Đổi ca trực";
            case "SCHEDULE_CHANGE" -> en ? "Schedule change" : "Đổi lịch dạy";
            default -> en ? "Other" : "Khác";
        };
    }

    /** Đếm số buổi lớp và buổi PT 1:1 bị ảnh hưởng trong thời gian nghỉ phép của nhân sự. */
    /** Chọn câu thông báo theo loại buổi bị ảnh hưởng; loại nào bằng 0 thì không nhắc tới. */
    static String leaveImpactBodyKey(LeaveImpact impact) {
        if (impact.ptSessions() <= 0) {
            return "notifications.operations.leave_impact.body_classes";
        }
        if (impact.classSessions() <= 0) {
            return "notifications.operations.leave_impact.body_pt";
        }
        return "notifications.operations.leave_impact.body";
    }

    private LeaveImpact computeLeaveImpact(StaffInternalRequest leave) {
        if (!"LEAVE".equals(leave.getRequestType()) || leave.getStartDate() == null || leave.getUser() == null) {
            return LeaveImpact.NONE;
        }
        LocalDate end = leave.getEndDate() != null ? leave.getEndDate() : leave.getStartDate();
        Long staffId = leave.getUser().getId();
        long classSessions = classSessionRepository != null
                ? classSessionRepository.countScheduledForCoachBetween(staffId, leave.getStartDate(), end) : 0L;
        long ptSessions = coachBookingRepository != null
                ? coachBookingRepository.countConfirmedForCoachBetween(staffId, leave.getStartDate(), end) : 0L;
        return new LeaveImpact(classSessions, ptSessions);
    }

    /**
     * Khi duyệt đơn nghỉ của HLV: báo cho quản lý số buổi lớp và buổi PT bị ảnh hưởng kèm đường dẫn điều hướng
     * tới màn phân công HLV ({@code /manager/coach-assignments}) để sắp xếp người dạy thay.
     */
    private void reportLeaveImpact(StaffInternalRequest leave, User manager, LeaveImpact impact) {
        if (notificationService == null || !impact.hasConflicts() || leave.getStartDate() == null) {
            return;
        }
        LocalDate end = leave.getEndDate() != null ? leave.getEndDate() : leave.getStartDate();
        try {
            notificationService.send(
                    manager.getId(),
                    msg("notifications.operations.leave_impact.title"),
                    msg(leaveImpactBodyKey(impact), leave.getUser().getFullName(),
                            leave.getStartDate().format(DMY), end.format(DMY), impact.classSessions(), impact.ptSessions()),
                    "system",
                    null,
                    leave.getId(),
                    COACH_ASSIGNMENTS_PATH);
        } catch (ResourceNotFoundException ex) {
            log.warn("Skipping leave impact notification for missing or deleted manager {}", manager.getId());
        }
    }
}
