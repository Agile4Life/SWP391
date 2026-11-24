package com.swp391.scms.users.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Thông tin người dùng trả cho màn quản trị: thông tin cá nhân, mã vai trò, trạng thái, thời điểm tạo/đăng nhập
 * cuối/xóa mềm và cờ hội viên đang bảo lưu gói.
 */
public class UserDto {
    private Long id;
    private String roleCode;
    private String fullName;
    private String email;
    private String phone;
    private LocalDate dob;
    private String gender;
    private String avatarUrl;
    private String address;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
    private LocalDateTime deletedAt;
    private Boolean subscriptionFrozen;

    // Getters and Setters
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường roleCode. */
    public String getRoleCode() { return roleCode; }
    /** Gán giá trị mới cho trường roleCode. */
    public void setRoleCode(String roleCode) { this.roleCode = roleCode; }
    /** Lấy giá trị trường fullName. */
    public String getFullName() { return fullName; }
    /** Gán giá trị mới cho trường fullName. */
    public void setFullName(String fullName) { this.fullName = fullName; }
    /** Lấy giá trị trường email. */
    public String getEmail() { return email; }
    /** Gán giá trị mới cho trường email. */
    public void setEmail(String email) { this.email = email; }
    /** Lấy giá trị trường phone. */
    public String getPhone() { return phone; }
    /** Gán giá trị mới cho trường phone. */
    public void setPhone(String phone) { this.phone = phone; }
    /** Lấy giá trị trường dob. */
    public LocalDate getDob() { return dob; }
    /** Gán giá trị mới cho trường dob. */
    public void setDob(LocalDate dob) { this.dob = dob; }
    /** Lấy giá trị trường gender. */
    public String getGender() { return gender; }
    /** Gán giá trị mới cho trường gender. */
    public void setGender(String gender) { this.gender = gender; }
    /** Lấy giá trị trường avatarUrl. */
    public String getAvatarUrl() { return avatarUrl; }
    /** Gán giá trị mới cho trường avatarUrl. */
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    /** Lấy giá trị trường address. */
    public String getAddress() { return address; }
    /** Gán giá trị mới cho trường address. */
    public void setAddress(String address) { this.address = address; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường lastLoginAt. */
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    /** Gán giá trị mới cho trường lastLoginAt. */
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    /** Lấy giá trị trường deletedAt. */
    public LocalDateTime getDeletedAt() { return deletedAt; }
    /** Gán giá trị mới cho trường deletedAt. */
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
    /** Lấy giá trị trường subscriptionFrozen. */
    public Boolean getSubscriptionFrozen() { return subscriptionFrozen; }
    /** Gán giá trị mới cho trường subscriptionFrozen. */
    public void setSubscriptionFrozen(Boolean subscriptionFrozen) { this.subscriptionFrozen = subscriptionFrozen; }
}

