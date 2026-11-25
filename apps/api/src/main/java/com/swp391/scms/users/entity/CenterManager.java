package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/** Bảng center_managers: hồ sơ riêng của quản lý trung tâm (ngày vào làm), khóa chính trùng id người dùng. */
@Entity
@Table(name = "center_managers")
public class CenterManager {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    /** Lấy giá trị trường userId. */
    public Long getUserId() { return userId; }
    /** Gán giá trị mới cho trường userId. */
    public void setUserId(Long userId) { this.userId = userId; }
    /** Lấy giá trị trường user. */
    public User getUser() { return user; }
    /** Gán giá trị mới cho trường user. */
    public void setUser(User user) { this.user = user; }
    /** Lấy giá trị trường hireDate. */
    public LocalDate getHireDate() { return hireDate; }
    /** Gán giá trị mới cho trường hireDate. */
    public void setHireDate(LocalDate hireDate) { this.hireDate = hireDate; }
}
