package com.swp391.scms.wallet;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Bảng wallets: Ví SÖL của một người dùng (mỗi người một ví), gồm số dư và thời điểm cập nhật. */
@Entity
@org.hibernate.annotations.Check(name = "ck_wallets_balance_nonneg", constraints = "balance >= 0")
@Table(name = "wallets")
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Constructor rỗng cho JPA. */
    public Wallet() {}

    /** Lấy giá trị trường id. */
    public Long getId() {
        return id;
    }

    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) {
        this.id = id;
    }

    /** Lấy giá trị trường user. */
    public User getUser() {
        return user;
    }

    /** Gán giá trị mới cho trường user. */
    public void setUser(User user) {
        this.user = user;
    }

    /** Lấy giá trị trường balance. */
    public BigDecimal getBalance() {
        return balance;
    }

    /** Gán giá trị mới cho trường balance. */
    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
