package com.swp391.scms.users.dto;

/**
 * Thông tin tối thiểu để xác thực JWT: id, tên đăng nhập, trạng thái, mã vai trò và thời điểm đổi mật khẩu
 * cuối.
 *
 * Scalar account state for request authentication; does not hydrate profile entities.
 */
public record AuthenticationUser(Long id, String username, String status, String roleCode,
                                 java.time.LocalDateTime passwordChangedAt) {
    /** Constructor không có thời điểm đổi mật khẩu. */
    public AuthenticationUser(Long id, String username, String status, String roleCode) {
        this(id, username, status, roleCode, null);
    }
}
