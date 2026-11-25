package com.swp391.scms.users.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Dữ liệu sửa người dùng; trường nào null thì giữ nguyên. */
public class UserUpdateDto {
    @Size(max = 150, message = "{validation.users.full_name.size}")
    private String fullName;

    @jakarta.validation.constraints.Pattern(regexp = "^\\s*$|^(0|\\+84)(3|5|7|8|9)[0-9]{8}$", message = "{validation.users.phone.invalid}")
    @Size(max = 20, message = "{validation.users.phone.size}")
    private String phone;

    private Long roleId;

    @Pattern(regexp = "^(male|female|other)$", message = "{validation.users.gender.invalid}")
    private String gender;

    // Getter và Setter.
    /** Lấy giá trị trường fullName. */
    public String getFullName() { return fullName; }
    /** Gán giá trị mới cho trường fullName. */
    public void setFullName(String fullName) { this.fullName = fullName; }
    /** Lấy giá trị trường phone. */
    public String getPhone() { return phone; }
    /** Gán giá trị mới cho trường phone. */
    public void setPhone(String phone) { this.phone = phone; }
    /** Lấy giá trị trường roleId. */
    public Long getRoleId() { return roleId; }
    /** Gán giá trị mới cho trường roleId. */
    public void setRoleId(Long roleId) { this.roleId = roleId; }
    /** Lấy giá trị trường gender. */
    public String getGender() { return gender; }
    /** Gán giá trị mới cho trường gender. */
    public void setGender(String gender) { this.gender = gender; }
}
