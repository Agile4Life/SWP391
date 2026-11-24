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
    String escalationReason
) {
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
     * What a member may see: that the complaint was escalated, not the receptionist's internal reason.
     */
    public SupportRequestDto forMember() {
        return new SupportRequestDto(id, memberId, memberName, assignedTo, assignedToName, subject, description,
                status, createdAt, resolvedAt, escalatedAt, null, null);
    }
}

