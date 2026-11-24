package com.swp391.scms.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;

/**
 * Thông tin Google gửi lên: ID Token hoặc Access Token (luồng popup), hoặc code + redirectUri (chỉ dùng nội bộ
 * trong luồng chuyển hướng đã kiểm tra state).
 *
 * Google credentials. HTTP popup requests accept tokens only; the state-validated redirect service uses code/redirectUri internally.
 */
public record GoogleOAuthCallbackRequest(
        String idToken,
        String accessToken,
        String code,
        String redirectUri
) {
    /** Cho biết popup credential (trường boolean). */
    @JsonIgnore
    @AssertTrue(message = "{auth.google.invalid_token}")
    public boolean isPopupCredential() {
        return code == null && redirectUri == null
                && ((idToken != null && !idToken.isBlank()) || (accessToken != null && !accessToken.isBlank()));
    }

    /** Constructor chỉ có ID Token. */
    public GoogleOAuthCallbackRequest(String idToken) {
        this(idToken, null, null, null);
    }
}
