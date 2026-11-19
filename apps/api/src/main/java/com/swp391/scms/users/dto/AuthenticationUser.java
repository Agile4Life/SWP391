package com.swp391.scms.users.dto;

/** Scalar account state for request authentication; does not hydrate profile entities. */
public record AuthenticationUser(Long id, String username, String status, String roleCode,
                                 java.time.LocalDateTime passwordChangedAt) {
    public AuthenticationUser(Long id, String username, String status, String roleCode) {
        this(id, username, status, roleCode, null);
    }
}
