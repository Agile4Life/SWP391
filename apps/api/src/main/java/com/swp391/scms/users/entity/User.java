package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Bảng users: tài khoản đăng nhập của mọi vai trò (tên đăng nhập, email, SĐT, mật khẩu băm, vai trò, trạng
 * thái, Google sub, thời điểm xóa mềm...) cùng các hồ sơ theo vai trò (Member, Coach, Receptionist).
 */
@Entity
@org.hibernate.annotations.DynamicUpdate
@org.hibernate.annotations.Check(name = "ck_users_gender", constraints = "gender IN ('male','female','other')")
@org.hibernate.annotations.Check(name = "ck_users_status", constraints = "status IN ('active','inactive','locked')")
@Table(name = "users")
public class User {

    public static final String DEFAULT_AVATAR_URL = "/images/default-avatar.png";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(length = 50)
    private String username;

    @Column(length = 20)
    private String phone;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    private LocalDate dob;

    @Column(length = 10)
    private String gender;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    @Column(length = 255)
    private String address;

    @Column(nullable = false, length = 20)
    private String status = "active";

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /** Tokens issued before this moment are rejected, so a password change signs out every other session. */
    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "google_sub", unique = true, length = 100)
    private String googleSub;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Member member;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Coach coach;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Receptionist receptionist;

    /** Hibernate gọi trước khi cập nhật bản ghi: tự cập nhật updatedAt. */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường role. */
    public Role getRole() { return role; }
    /** Gán giá trị mới cho trường role. */
    public void setRole(Role role) { this.role = role; }

    /** Lấy giá trị trường fullName. */
    public String getFullName() { return fullName; }
    /** Gán giá trị mới cho trường fullName. */
    public void setFullName(String fullName) { this.fullName = fullName; }

    /** Lấy giá trị trường email. */
    public String getEmail() { return email; }
    /** Lấy giá trị trường username. */
    public String getUsername() { return username; }
    /** Gán giá trị mới cho trường username. */
    public void setUsername(String username) { this.username = username; }
    /** Gán giá trị mới cho trường email. */
    public void setEmail(String email) { this.email = email; }

    /** Lấy giá trị trường phone. */
    public String getPhone() { return phone; }
    /** Gán giá trị mới cho trường phone. */
    public void setPhone(String phone) { this.phone = phone; }

    /** Lấy giá trị trường passwordHash. */
    public String getPasswordHash() { return passwordHash; }
    /**
     * Đặt mật khẩu (bản băm). Khi thay một mật khẩu đã có (đặt lại/đổi), ghi lại thời điểm đổi để mọi JWT cấp
     * trước đó mất hiệu lực; đặt mật khẩu lần đầu thì không.
     */
    public void setPasswordHash(String passwordHash) {
        // Replacing an existing password (reset, change) revokes older tokens; setting the first one does not.
        if (this.passwordHash != null && !this.passwordHash.equals(passwordHash)) {
            this.passwordChangedAt = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        }
        this.passwordHash = passwordHash;
    }
    /** Lấy giá trị trường passwordChangedAt. */
    public LocalDateTime getPasswordChangedAt() { return passwordChangedAt; }
    /** Gán giá trị mới cho trường passwordChangedAt. */
    public void setPasswordChangedAt(LocalDateTime passwordChangedAt) { this.passwordChangedAt = passwordChangedAt; }

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

    /** Lấy giá trị trường lastLoginAt. */
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    /** Gán giá trị mới cho trường lastLoginAt. */
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /** Lấy giá trị trường deletedAt. */
    public LocalDateTime getDeletedAt() { return deletedAt; }
    /** Gán giá trị mới cho trường deletedAt. */
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }

    /** Lấy giá trị trường receptionist. */
    public Receptionist getReceptionist() { return receptionist; }
    /** Gán giá trị mới cho trường receptionist. */
    public void setReceptionist(Receptionist receptionist) { this.receptionist = receptionist; }

    /** Lấy giá trị trường googleSub. */
    public String getGoogleSub() { return googleSub; }
    /** Gán giá trị mới cho trường googleSub. */
    public void setGoogleSub(String googleSub) { this.googleSub = googleSub; }
}
