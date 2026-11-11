package com.swp391.scms.auth.dto;

public record AuthSessionResponse(String username, String role, String fullName) {
    public AuthSessionResponse(String username, String role) {
        this(username, role, null);
    }
}
