package com.swp391.scms.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "{validation.auth.username.not_blank}") @Size(min = 3, message = "{validation.auth.username.size}") String username,
    @NotBlank(message = "{validation.auth.password.not_blank}") @Size(min = 6, message = "{validation.auth.password.size}") String password,
    @NotBlank(message = "{validation.auth.email.not_blank}") @Email(message = "{validation.auth.email.invalid}")
    @Pattern(regexp = "^\\s*[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}\\s*$", message = "{validation.auth.email.invalid}") String email,
    @Size(max = 20, message = "{validation.users.phone.size}")
    @Pattern(regexp = "^\\s*$|^(0|\\+84)(3|5|7|8|9)[0-9]{8}$", message = "{validation.users.phone.invalid}") String phone,
    String role
) {
    public RegisterRequest(String username, String password, String email, String role) {
        this(username, password, email, null, role);
    }
}