package com.swp391.scms.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record GoogleIdTokenRequest(
    @NotBlank(message = "Google ID Token is required")
    @Schema(description = "Google ID Token (JWT) do Google OAuth cấp cho client", example = "eyJhbGciOiJSUzI1NiIs...")
    String idToken
) {}
