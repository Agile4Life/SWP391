package com.swp391.scms.notifications;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.notifications.dto.NotificationDto;
import com.swp391.scms.notifications.entity.Notification;
import com.swp391.scms.notifications.port.NotificationDispatcher;
import com.swp391.scms.notifications.port.NotificationChannel;
import com.swp391.scms.notifications.port.NotificationPayload;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Gửi và đọc thông báo: lưu thông báo trong ứng dụng, rồi sau khi transaction commit thì phát ra các kênh ngoài
 * (đẩy, và email cho loại quan trọng như đổi mật khẩu, thanh toán, đổi lịch, gói sắp hết hạn).
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Chỉ các loại này được gửi email; còn lại chỉ hiện trong app (tránh spam hộp thư). */
    private static final Set<String> EMAIL_TYPES = Set.of("password_changed", "payment", "schedule_change", "package_expiry");

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationMapper notificationMapper;
    private final NotificationDispatcher notificationDispatcher;

    /** Constructor cho test, không có kênh ngoài. */
    public NotificationService(NotificationRepository notificationRepository, 
                               UserRepository userRepository,
                               NotificationMapper notificationMapper) {
        this(notificationRepository, userRepository, notificationMapper, null);
    }

    private final com.swp391.scms.common.i18n.MessageService messageService;

    /** Constructor cho test, có bộ phát kênh ngoài. */
    public NotificationService(NotificationRepository notificationRepository, 
                               UserRepository userRepository,
                               NotificationMapper notificationMapper,
                               @Autowired(required = false) NotificationDispatcher notificationDispatcher) {
        this(notificationRepository, userRepository, notificationMapper, notificationDispatcher, null);
    }

    /** Constructor Spring dùng; bộ phát kênh ngoài và MessageService là tùy chọn. */
    @Autowired
    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository,
            NotificationMapper notificationMapper, @Autowired(required = false) NotificationDispatcher notificationDispatcher,
            @Autowired(required = false) com.swp391.scms.common.i18n.MessageService messageService) {
        this.messageService = messageService;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.notificationMapper = notificationMapper;
        this.notificationDispatcher = notificationDispatcher;
    }

    /** Loại yêu cầu hội viên gửi tới quầy lễ tân kèm đường dẫn màn hình xử lý tương ứng. */
    public enum ReceptionRequestKind {
        KYC("kyc", "/staff/kyc"),
        HOLD("hold", "/staff/holds"),
        TRIAL("trial", "/staff/reception"),
        PAYMENT("payment", "/staff/reception");

        private final String code;
        private final String actionPath;

        ReceptionRequestKind(String code, String actionPath) {
            this.code = code;
            this.actionPath = actionPath;
        }

        public String code() { return code; }
        public String actionPath() { return actionPath; }

        public static ReceptionRequestKind fromCode(String raw) {
            if (raw == null) throw new IllegalArgumentException("Unsupported reception request");
            String normalized = raw.trim().toLowerCase(Locale.ROOT);
            for (ReceptionRequestKind value : values()) {
                if (value.code.equals(normalized)) return value;
            }
            throw new IllegalArgumentException("Unsupported reception request: " + raw);
        }
    }

    /** Gửi đúng lễ tân đang hoạt động; lỗi gửi từng lễ tân chỉ ghi cảnh báo để không rollback giao dịch chính. */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void notifyReceptionists(String kind, Long requestId) {
        notifyReceptionists(ReceptionRequestKind.fromCode(kind), requestId);
    }

    /** Gửi thông báo cho các lễ tân đang hoạt động theo loại yêu cầu chuẩn hóa; không chứa giấy tờ hoặc ảnh. */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void notifyReceptionists(ReceptionRequestKind kind, Long requestId) {
        if (kind == null) throw new IllegalArgumentException("Unsupported reception request");
        String titleKey = "notifications.reception." + kind.code() + ".title";
        String bodyKey = "notifications.reception." + kind.code() + ".body";
        String title = messageService != null ? messageService.getMessage(titleKey) : titleKey;
        String body = messageService != null ? messageService.getMessage(bodyKey) : bodyKey;
        List<User> receptionists;
        try {
            receptionists = userRepository.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(
                    List.of("RECEPTIONIST", "ROLE_RECEPTIONIST"));
        } catch (RuntimeException ex) {
            log.warn("Could not load active receptionists for {} request {}", kind.code(), requestId, ex);
            return;
        }
        for (User user : receptionists) {
            if (user.getDeletedAt() == null && "active".equalsIgnoreCase(user.getStatus())) {
                try {
                    send(user.getId(), title, body, "system", null, requestId, kind.actionPath());
                } catch (RuntimeException ex) {
                    log.warn("Could not notify receptionist {} for {} request {}", user.getId(), kind.code(), requestId, ex);
                }
            }
        }
    }

    /** Thông báo của người dùng, mới nhất trước, có phân trang. */
    @Transactional(readOnly = true)
    public Page<NotificationDto> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(notificationMapper::toDto);
    }

    /** Số thông báo chưa đọc của người dùng. */
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    /** Đánh dấu một thông báo là đã đọc (phải thuộc đúng người dùng, không thì 404). */
    @Transactional
    public void markAsRead(Long id, Long userId) {
        Notification notification = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.notification", id));
        if (!notification.isRead()) {
            notification.setRead(true);
            notificationRepository.save(notification);
        }
    }

    /** Đánh dấu mọi thông báo của người dùng là đã đọc. */
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }

    /** Gửi thông báo không kèm đường dẫn mở trang. */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void send(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId) {
        send(userId, title, message, type, relatedEntityType, relatedEntityId, null);
    }

    /** Dịch mã thông báo đánh giá tiến độ; không có MessageService thì trả lại chính mã. */
    private String evaluationMessage(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** Báo cho hội viên có đánh giá tiến độ mới (bỏ qua nếu tài khoản không còn). */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void notifyEvaluation(Long memberId) {
        if (memberId == null) return;
        try {
            send(memberId, evaluationMessage("notifications.evaluation.title"),
                    evaluationMessage("notifications.evaluation.body"), "system", null, null,
                    "/member/progress");
        } catch (ResourceNotFoundException ex) {
            log.debug("Skipping evaluation notification for inactive or missing user {}", memberId);
        }
    }

    /**
     * Gửi thông báo: lưu vào database (giới hạn tiêu đề 150 ký tự, chuẩn hóa loại và loại bản ghi liên quan,
     * kèm đường dẫn mở trang theo vai trò), rồi sau khi transaction commit thì phát ra kênh ngoài. Lỗi ở kênh
     * ngoài chỉ ghi log và không làm hỏng thao tác chính.
     */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void send(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId, String actionPath) {
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", userId));

        String clampedTitle = Notification.clampTitle(title);
        String normalizedType = Notification.normalizeType(type);
        String normalizedEntityType = Notification.normalizeEntityType(relatedEntityType);
        String effectiveActionPath = resolveEffectiveActionPath(user, normalizedType, type, actionPath);

        Notification notification = new Notification(
                user,
                clampedTitle,
                message,
                normalizedType,
                normalizedEntityType,
                relatedEntityId
        );
        notification.setActionPath(effectiveActionPath);
        notificationRepository.save(notification);
        if (notificationDispatcher != null) {
            // password_changed không nằm trong ALLOWED_TYPES nên lưu DB là "system", nhưng kênh ngoài giữ
            // "password_changed" để gửi email và chọn đúng CTA bảo mật; order/wallet đã chuẩn hóa về "payment".
            String rawLower = type != null ? type.trim().toLowerCase(Locale.ROOT) : "";
            String dispatchType = "password_changed".equals(rawLower) ? "password_changed" : notification.getType();
            boolean important = EMAIL_TYPES.contains(dispatchType);
            Set<NotificationChannel> channels = important
                    ? Set.of(NotificationChannel.EMAIL, NotificationChannel.PUSH)
                    : Set.of(NotificationChannel.PUSH);
            NotificationPayload payload = NotificationPayload.builder()
                    .userId(userId)
                    .title(notification.getTitle())
                    .message(message)
                    .type(dispatchType)
                    .relatedEntityType(notification.getRelatedEntityType())
                    .relatedEntityId(relatedEntityId)
                    .actionPath(notification.getActionPath())
                    .channels(channels)
                    .build();
            Runnable dispatch = () -> {
                try {
                    notificationDispatcher.dispatch(payload);
                } catch (RuntimeException e) {
                    log.warn("Could not submit external notification for user {}", userId, e);
                }
            };
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCommit() { dispatch.run(); }
                });
            } else {
                dispatch.run();
            }
        }
    }

    /** Xác định đường dẫn mở trang phù hợp với vai trò người nhận khi caller không truyền actionPath tường minh. */
    private static String resolveEffectiveActionPath(User user, String normalizedType, String rawType, String actionPath) {
        if (actionPath != null && !actionPath.isBlank()) {
            return actionPath.trim();
        }
        String roleCode = user != null && user.getRole() != null ? user.getRole().getCode() : null;
        if (roleCode == null || roleCode.isBlank()) {
            return null;
        }
        String normalizedRole = roleCode.startsWith("ROLE_") ? roleCode.substring(5) : roleCode;
        if ("schedule_change".equals(normalizedType) && "COACH".equalsIgnoreCase(normalizedRole)) {
            return "/coach/classes";
        }
        if ("password_changed".equalsIgnoreCase(rawType != null ? rawType.trim() : "")
                && !"MEMBER".equalsIgnoreCase(normalizedRole)) {
            return "/portal";
        }
        return null;
    }

    /**
     * Phát thông báo bất đồng bộ qua nhiều kênh theo kiến trúc Port & Adapter (SCRUM-108); nếu không có bộ phát
     * thì chỉ lưu thông báo trong ứng dụng.
     */
    public void dispatchMultiChannel(Long userId, String title, String message, String type, String relatedEntityType, Long relatedEntityId) {
        if (notificationDispatcher != null) {
            notificationDispatcher.dispatch(userId, title, message, type, relatedEntityType, relatedEntityId);
        } else {
            send(userId, title, message, type, relatedEntityType, relatedEntityId);
        }
    }
}

