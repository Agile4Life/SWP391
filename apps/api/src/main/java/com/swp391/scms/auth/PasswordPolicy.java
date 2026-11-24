package com.swp391.scms.auth;

/**
 * Quy tắc mật khẩu chung cho mọi mật khẩu mới (đăng ký, đặt lại, đổi, nhân viên do quản lý tạo): 8-50 ký tự, có
 * ít nhất một chữ và một số, không có khoảng trắng. Đăng nhập vẫn chấp nhận mật khẩu cũ.
 *
 * Một quy tắc cho mọi mật khẩu mới (đăng ký, đặt lại, đổi, tài khoản nhân viên tạo); đăng nhập vẫn chấp nhận
 * mật khẩu cũ.
 */
public final class PasswordPolicy {
    /** 8-50 characters, at least one letter and one digit, no whitespace. */
    public static final String REGEX = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,50}$";

    /** Lớp chỉ chứa hằng số, không cho tạo đối tượng. */
    private PasswordPolicy() {}
}
