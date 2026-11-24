package com.swp391.scms.users.dto;

/** Thông tin một quyền trả cho client: id, mã, tên và module. */
public class PermissionDto {
    private Long id;
    private String code;
    private String name;
    private String module;

    // Getter và Setter.
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường code. */
    public String getCode() { return code; }
    /** Gán giá trị mới cho trường code. */
    public void setCode(String code) { this.code = code; }
    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }
    /** Lấy giá trị trường module. */
    public String getModule() { return module; }
    /** Gán giá trị mới cho trường module. */
    public void setModule(String module) { this.module = module; }
}
