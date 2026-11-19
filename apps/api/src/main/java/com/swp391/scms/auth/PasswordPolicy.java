package com.swp391.scms.auth;

/** One rule for every new password (register, reset, change, staff-created accounts); login accepts old ones. */
public final class PasswordPolicy {
    /** 8-50 characters, at least one letter and one digit, no whitespace. */
    public static final String REGEX = "^(?=.*[A-Za-z])(?=.*\\d)\\S{8,50}$";

    private PasswordPolicy() {}
}
