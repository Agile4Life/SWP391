package com.swp391.scms.users.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/**
 * Bảng coaches: hồ sơ HLV (chuyên môn, giới thiệu, chứng chỉ, ngày vào làm, trạng thái làm việc), khóa chính
 * trùng id người dùng.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_coaches_status", constraints = "employment_status IN ('active','on_leave','terminated')")
@Table(name = "coaches")
public class Coach {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "specialization", length = 150)
    private String specialization;

    @Column(name = "bio", length = org.hibernate.Length.LONG32)
    private String bio;

    @Column(name = "certification", length = 255)
    private String certification;

    @Column(name = "hire_date")
    private LocalDate hireDate;

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

    /** Lấy giá trị trường specialization. */
    public String getSpecialization() { return specialization; }
    /** Gán giá trị mới cho trường specialization. */
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    /** Lấy giá trị trường bio. */
    public String getBio() { return bio; }
    /** Gán giá trị mới cho trường bio. */
    public void setBio(String bio) { this.bio = bio; }

    /** Lấy giá trị trường certification. */
    public String getCertification() { return certification; }
    /** Gán giá trị mới cho trường certification. */
    public void setCertification(String certification) { this.certification = certification; }

    /** Lấy giá trị trường hireDate. */
    public LocalDate getHireDate() { return hireDate; }
    /** Gán giá trị mới cho trường hireDate. */
    public void setHireDate(LocalDate hireDate) { this.hireDate = hireDate; }

    /** Lấy giá trị trường employmentStatus. */
    public String getEmploymentStatus() { return employmentStatus; }
    /** Gán giá trị mới cho trường employmentStatus. */
    public void setEmploymentStatus(String employmentStatus) { this.employmentStatus = employmentStatus; }
}
