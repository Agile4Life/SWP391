package com.swp391.scms.users.dto;

import jakarta.validation.constraints.*;

/**
 * Dữ liệu quản lý nhập khi tạo tài khoản nhân viên: họ tên, email, SĐT, mật khẩu, giới tính và vai trò
 * (COACH/RECEPTIONIST).
 */
public record StaffAccountCreateDto(
        @NotBlank(message = "{validation.users.full_name.not_blank}")
        @Size(max = 150, message = "{validation.users.full_name.size}") String fullName,
        @NotBlank(message = "{validation.users.email.not_blank}")
        @Email(message = "{validation.users.email.invalid}")
        @Size(max = 150, message = "{validation.users.email.size}") String email,
        @Size(max = 20, message = "{validation.users.phone.size}") String phone,
        @NotBlank(message = "{validation.users.password.not_blank}")
        @jakarta.validation.constraints.Pattern(regexp = com.swp391.scms.auth.PasswordPolicy.REGEX, message = "{validation.auth.password.policy}") String password,
        @NotBlank(message = "{validation.users.gender.not_blank}")
        @Pattern(regexp = "^(male|female|other)$", message = "{validation.users.gender.invalid}") String gender,
        @NotBlank(message = "{validation.users.staff_role}")
        @Pattern(regexp = "^(COACH|RECEPTIONIST)$", message = "{validation.users.staff_role}") String roleCode) {}
