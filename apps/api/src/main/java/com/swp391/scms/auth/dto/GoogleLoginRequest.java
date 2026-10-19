package com.swp391.scms.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Yêu cầu đăng nhập hoặc kích hoạt tài khoản bằng Google ID Token")
public record GoogleLoginRequest(
    @Schema(description = "Google ID Token trả về từ Google Identity Services SDK", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "{validation.google.token_required}")
    String idToken
) {}
