package com.swp391.scms.auth;

import com.swp391.scms.auth.dto.GoogleUserInfo;

/**
 * Cổng (interface) xác minh thông tin đăng nhập Google; tách riêng để test có thể thay bằng bản giả.
 *
 * Interface cổng (port) để xác minh Google ID Token, Access Token và Authorization Code. Theo kiến trúc
 * Hexagonal / IoC để unit test và mock xác minh gọn gàng.
 */
public interface GoogleTokenVerifierPort {
    /** Xác minh Google ID Token và trả thông tin người dùng. */
    GoogleUserInfo verify(String idToken);

    /** Xác minh Access Token; mặc định chưa hỗ trợ. */
    default GoogleUserInfo verifyAccessToken(String accessToken) {
        throw new UnsupportedOperationException("Access token verification is not configured");
    }

    /** Đổi Authorization Code lấy thông tin người dùng; mặc định chưa hỗ trợ. */
    default GoogleUserInfo verifyAuthorizationCode(String code, String redirectUri) {
        throw new UnsupportedOperationException("Authorization code verification is not configured");
    }
}
