package com.swp391.scms.users.dto;

/**
 * Thông tin tối thiểu để xác thực JWT: id, tên đăng nhập, trạng thái, mã vai trò và thời điểm đổi mật khẩu
 * cuối.
 *
 * Trạng thái tài khoản dạng scalar cho xác thực request; không nạp các entity hồ sơ.
 */
public record AuthenticationUser(Long id, String username, String status, String roleCode,
                                 java.time.LocalDateTime passwordChangedAt) {
    /** Constructor không có thời điểm đổi mật khẩu. */
    public AuthenticationUser(Long id, String username, String status, String roleCode) {
        this(id, username, status, roleCode, null);
    }
}
