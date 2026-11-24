package com.swp391.scms.coaching.entity;

import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import org.hibernate.Length;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity mapping monthly performance review, badges and ranking of coaches (SCRUM-134).
 * The feature was removed (#144); the entity stays only so the code-first schema still describes the existing table.
 */
@Entity
@Table(name = "coach_monthly_reviews", indexes = {
        @Index(name = "ix_coach_month_rev_coach", columnList = "coach_id"),
        @Index(name = "ix_coach_month_rev_period", columnList = "review_year, review_month")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_coach_month_review", columnNames = {"coach_id", "review_year", "review_month"})
})
/**
 * Entity tổng kết tháng của HLV (bảng coach_monthly_reviews): điểm trung bình, số đánh giá/buổi, xếp hạng, huy
 * hiệu, thưởng và nhận xét của quản lý.
 */
public class CoachMonthlyReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    @Column(name = "review_year", nullable = false)
    private Integer year;

    @Column(name = "review_month", nullable = false)
    private Integer month;

    @Column(name = "average_rating", precision = 3, scale = 2)
    private BigDecimal averageRating;

    @Column(name = "total_reviews", nullable = false)
    private Integer totalReviews = 0;

    @Column(name = "total_sessions", nullable = false)
    private Integer totalSessions = 0;

    @Column(name = "rank_position")
    private Integer rankPosition;

    @Column(name = "badge", length = 100)
    private String badge;

    @Column(name = "bonus_amount", precision = 12, scale = 2)
    private BigDecimal bonusAmount = BigDecimal.ZERO;

    @Column(name = "manager_feedback", length = Length.LONG32)
    private String managerFeedback;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "published"; // draft, published

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Tự cập nhật updatedAt trước mỗi lần thêm mới hoặc cập nhật. */
    @PrePersist
    @PreUpdate
    public void onSave() {
        this.updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }

    /** Lấy giá trị trường manager. */
    public User getManager() { return manager; }
    /** Gán giá trị mới cho trường manager. */
    public void setManager(User manager) { this.manager = manager; }

    /** Lấy giá trị trường year. */
    public Integer getYear() { return year; }
    /** Gán giá trị mới cho trường year. */
    public void setYear(Integer year) { this.year = year; }

    /** Lấy giá trị trường month. */
    public Integer getMonth() { return month; }
    /** Gán giá trị mới cho trường month. */
    public void setMonth(Integer month) { this.month = month; }

    /** Lấy giá trị trường averageRating. */
    public BigDecimal getAverageRating() { return averageRating; }
    /** Gán giá trị mới cho trường averageRating. */
    public void setAverageRating(BigDecimal averageRating) { this.averageRating = averageRating; }

    /** Lấy giá trị trường totalReviews. */
    public Integer getTotalReviews() { return totalReviews; }
    /** Gán giá trị mới cho trường totalReviews. */
    public void setTotalReviews(Integer totalReviews) { this.totalReviews = totalReviews; }

    /** Lấy giá trị trường totalSessions. */
    public Integer getTotalSessions() { return totalSessions; }
    /** Gán giá trị mới cho trường totalSessions. */
    public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }

    /** Lấy giá trị trường rankPosition. */
    public Integer getRankPosition() { return rankPosition; }
    /** Gán giá trị mới cho trường rankPosition. */
    public void setRankPosition(Integer rankPosition) { this.rankPosition = rankPosition; }

    /** Lấy giá trị trường badge. */
    public String getBadge() { return badge; }
    /** Gán giá trị mới cho trường badge. */
    public void setBadge(String badge) { this.badge = badge; }

    /** Lấy giá trị trường bonusAmount. */
    public BigDecimal getBonusAmount() { return bonusAmount; }
    /** Gán giá trị mới cho trường bonusAmount. */
    public void setBonusAmount(BigDecimal bonusAmount) { this.bonusAmount = bonusAmount; }

    /** Lấy giá trị trường managerFeedback. */
    public String getManagerFeedback() { return managerFeedback; }
    /** Gán giá trị mới cho trường managerFeedback. */
    public void setManagerFeedback(String managerFeedback) { this.managerFeedback = managerFeedback; }

    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }

    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

