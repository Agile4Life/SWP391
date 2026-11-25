package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Set;

/** Bảng roles: vai trò (mã, tên) và tập quyền gán qua bảng nối role_permissions. */
@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "role_permissions",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions;

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
    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường permissions. */
    public Set<Permission> getPermissions() { return permissions; }
    /** Gán giá trị mới cho trường permissions. */
    public void setPermissions(Set<Permission> permissions) { this.permissions = permissions; }
}
