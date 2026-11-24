package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/** Bảng receptionists: hồ sơ lễ tân (ca làm, ngày vào làm, trạng thái làm việc), khóa chính trùng id người dùng. */
@Entity
@org.hibernate.annotations.Check(name = "ck_receptionists_status", constraints = "employment_status IN ('active','on_leave','terminated')")
@Table(name = "receptionists")
public class Receptionist {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "shift", length = 50)
    private String shift;

    @Column(name = "employment_status", nullable = false, length = 20)
    private String employmentStatus = "active";

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

    /** Lấy giá trị trường shift. */
    public String getShift() { return shift; }
    /** Gán giá trị mới cho trường shift. */
    public void setShift(String shift) { this.shift = shift; }

    /** Lấy giá trị trường employmentStatus. */
    public String getEmploymentStatus() { return employmentStatus; }
    /** Gán giá trị mới cho trường employmentStatus. */
    public void setEmploymentStatus(String employmentStatus) { this.employmentStatus = employmentStatus; }
}
