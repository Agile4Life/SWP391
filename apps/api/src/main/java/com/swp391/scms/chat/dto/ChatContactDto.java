package com.swp391.scms.chat.dto;

/** Một người có thể chat: id, họ tên, vai trò, có đang nhận tin không và ảnh đại diện. */
public record ChatContactDto(Long id, String name, String role, boolean available, String avatarUrl) {
    /** Constructor không có ảnh đại diện. */
    public ChatContactDto(Long id, String name, String role, boolean available) {
        this(id, name, role, available, null);
    }
}
