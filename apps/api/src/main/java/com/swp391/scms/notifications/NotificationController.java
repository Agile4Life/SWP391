package com.swp391.scms.notifications;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.dto.NotificationDto;
import com.swp391.scms.notifications.dto.UnreadCountDto;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Notifications", description = "Quản lý hộp thư thông báo in-app của người dùng")
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final MessageService messageService;

    public NotificationController(NotificationService notificationService, MessageService messageService) {
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Lấy danh sách thông báo", description = "Lấy danh sách thông báo của người dùng đang đăng nhập, có phân trang")
    @GetMapping
    public ApiResponse<Page<NotificationDto>> getNotifications(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<NotificationDto> notifications = notificationService.getUserNotifications(principal.id(), pageable);
        return ApiResponse.ok(msg("notifications.list.success"), notifications);
    }

    @Operation(summary = "Đếm số thông báo chưa đọc", description = "Trả về số lượng thông báo chưa đọc của người dùng")
    @GetMapping("/unread-count")
    public ApiResponse<UnreadCountDto> getUnreadCount(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        long count = notificationService.getUnreadCount(principal.id());
        return ApiResponse.ok(msg("notifications.count.success"), new UnreadCountDto(count));
    }

    @Operation(summary = "Đánh dấu đã đọc một thông báo", description = "Cập nhật trạng thái isRead = true cho một thông báo cụ thể")
    @PatchMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id) {
        notificationService.markAsRead(id, principal.id());
        return ApiResponse.ok(msg("notifications.mark_read.success"), null);
    }

    @Operation(summary = "Đánh dấu tất cả là đã đọc", description = "Cập nhật trạng thái isRead = true cho toàn bộ thông báo chưa đọc của người dùng")
    @PatchMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        notificationService.markAllAsRead(principal.id());
        return ApiResponse.ok(msg("notifications.mark_all_read.success"), null);
    }

}

