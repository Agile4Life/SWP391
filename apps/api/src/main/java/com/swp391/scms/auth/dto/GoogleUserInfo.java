package com.swp391.scms.auth.dto;

public record GoogleUserInfo(
    String sub,
    String email,
    boolean emailVerified,
    String name,
    String picture,
    String hostedDomain
) {
    public GoogleUserInfo(String sub, String email, boolean emailVerified, String name, String picture) {
        this(sub, email, emailVerified, name, picture, null);
    }
}
