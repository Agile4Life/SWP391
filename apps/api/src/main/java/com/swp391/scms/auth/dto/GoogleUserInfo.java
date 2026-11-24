package com.swp391.scms.auth.dto;

/**
 * Thông tin người dùng Google sau khi xác minh: sub (mã định danh Google), email, đã xác minh email chưa, tên,
 * ảnh và hostedDomain (domain Google Workspace, nếu có).
 */
public record GoogleUserInfo(
    String sub,
    String email,
    boolean emailVerified,
    String name,
    String picture,
    String hostedDomain
) {
    /** Constructor không có hostedDomain. */
    public GoogleUserInfo(String sub, String email, boolean emailVerified, String name, String picture) {
        this(sub, email, emailVerified, name, picture, null);
    }
}
