package com.swp391.scms.auth;

/**
 * Quy tắc mật khẩu chung cho mọi mật khẩu mới (đăng ký, đặt lại, đổi, nhân viên do quản lý tạo): 8-50 ký tự, có
 * ít nhất một chữ và một số, không có khoảng trắng. Đăng nhập vẫn chấp nhận mật khẩu cũ.
 *
 * One rule for every new password (register, reset, change, staff-created accounts); login accepts old ones.
 */
public final class PasswordPolicy {
    /** 8-50 characters, at least one letter and one digit, no whitespace. */
    public static final String REGEX = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,50}$";

    /** Lớp chỉ chứa hằng số, không cho tạo đối tượng. */
    private PasswordPolicy() {}
}
