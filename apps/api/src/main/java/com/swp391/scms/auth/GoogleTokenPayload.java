package com.swp391.scms.auth;

public record GoogleTokenPayload(
    String sub,
    String email,
    boolean emailVerified,
    String name,
    String picture
) {}
