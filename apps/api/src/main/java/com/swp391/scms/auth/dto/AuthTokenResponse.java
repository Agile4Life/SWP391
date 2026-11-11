package com.swp391.scms.auth.dto;

/** {@code fullName} is the person's display name (never the login identifier); null for legacy callers. */
public record AuthTokenResponse(String token, String username, String role, String fullName) {
    public AuthTokenResponse(String token, String username, String role) {
        this(token, username, role, null);
    }
}
