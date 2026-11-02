package com.swp391.scms.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UserCreateDto {
    @NotBlank(message = "{validation.users.full_name.not_blank}")
    @Size(max = 150, message = "{validation.users.full_name.size}")
    private String fullName;

    @NotBlank(message = "{validation.users.email.not_blank}")
    @Email(message = "{validation.users.email.invalid}")
    @Size(max = 150, message = "{validation.users.email.size}")
    private String email;

    @Size(max = 20, message = "{validation.users.phone.size}")
    private String phone;

    @NotBlank(message = "{validation.users.password.not_blank}")
    @Size(min = 6, max = 50, message = "{validation.users.password.size}")
    private String password;

    @NotNull(message = "{validation.users.role_id.not_null}")
    private Long roleId;

    @NotBlank(message = "{validation.users.gender.not_blank}")
    @Pattern(regexp = "^(male|female|other)$", message = "{validation.users.gender.invalid}")
    private String gender;

    // Getters and Setters
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Long getRoleId() { return roleId; }
    public void setRoleId(Long roleId) { this.roleId = roleId; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
}
