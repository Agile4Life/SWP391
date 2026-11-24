package com.swp391.scms.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Bảng otp_challenges: mỗi địa chỉ (email/SĐT) có tối đa một mã OTP đang chờ, lưu bản băm của mã, hạn dùng, số
 * lần nhập sai và thời điểm tạo.
 */
@Entity
@Table(name = "otp_challenges")
public class OtpChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String target;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Constructor rỗng cho JPA. */
    protected OtpChallenge() {}

    /** Tạo mã OTP mới với địa chỉ, bản băm, hạn dùng và thời điểm tạo; số lần sai bắt đầu từ 0. */
    public OtpChallenge(String target, String codeHash, LocalDateTime expiresAt, LocalDateTime createdAt) {
        this.target = target;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường target. */
    public String getTarget() { return target; }
    /** Lấy giá trị trường codeHash. */
    public String getCodeHash() { return codeHash; }
    /** Lấy giá trị trường expiresAt. */
    public LocalDateTime getExpiresAt() { return expiresAt; }
    /** Lấy giá trị trường failedAttempts. */
    public int getFailedAttempts() { return failedAttempts; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường failedAttempts. */
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
}
