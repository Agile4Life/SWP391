package com.swp391.scms.support.dto;

import java.time.LocalDateTime;

/**
 * Phiếu hỗ trợ trả cho client: hội viên, người phụ trách, tiêu đề, mô tả, trạng thái, thời điểm tạo/giải quyết
 * và thông tin chuyển lên quản lý.
 */
public record SupportRequestDto(
    Long id,
    Long memberId,
    String memberName,
    Long assignedTo,
    String assignedToName,
    String subject,
    String description,
    String status,
    LocalDateTime createdAt,
    LocalDateTime resolvedAt,
    LocalDateTime escalatedAt,
    String escalatedByName,
    String escalationReason,
    String lastMessage,
    LocalDateTime lastMessageAt,
    Long unreadCount
) {
    public SupportRequestDto(Long id, Long memberId, String memberName, Long assignedTo, String assignedToName,
            String subject, String description, String status, LocalDateTime createdAt, LocalDateTime resolvedAt,
            LocalDateTime escalatedAt, String escalatedByName, String escalationReason) {
        this(id, memberId, memberName, assignedTo, assignedToName, subject, description, status, createdAt,
                resolvedAt, escalatedAt, escalatedByName, escalationReason, null, null, null);
    }
    public SupportRequestDto withInbox(String preview, LocalDateTime at, long count) {
        return new SupportRequestDto(id, memberId, memberName, assignedTo, assignedToName, subject, description,
                status, createdAt, resolvedAt, escalatedAt, escalatedByName, escalationReason, preview, at, count);
    }
    /** Constructor không có thông tin chuyển lên quản lý. */
    public SupportRequestDto(Long id, Long memberId, String memberName, Long assignedTo, String assignedToName,
                             String subject, String description, String status, LocalDateTime createdAt,
                             LocalDateTime resolvedAt) {
        this(id, memberId, memberName, assignedTo, assignedToName, subject, description, status, createdAt,
                resolvedAt, null, null, null);
    }

    /**
     * Bản dành cho hội viên: cho biết phiếu đã được chuyển lên, nhưng ẩn người chuyển và lý do nội bộ.
     *
     * Điều hội viên được thấy: rằng khiếu nại đã được chuyển lên, chứ không phải lý do nội bộ của lễ tân.
     */
    public SupportRequestDto forMember() {
        return new SupportRequestDto(id, memberId, memberName, assignedTo, assignedToName, subject, description,
                status, createdAt, resolvedAt, escalatedAt, null, null);
    }
}

