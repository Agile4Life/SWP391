package com.swp391.scms.coaching.entity;

import com.swp391.scms.ai.entity.AiRecommendationLog;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Entity giáo án tập luyện (bảng training_plans): hội viên, HLV, lớp, mục tiêu, thời gian, trạng thái, nguồn AI
 * và mốc thời gian.
 *
 * Entity mapping table training_plans (schema is generated code-first by Hibernate).
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_plans_status", constraints = "status IN ('draft','active','superseded','completed','cancelled')")
@Table(name = "training_plans")
public class TrainingPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    private GymClass gymClass;

    @Column(name = "goal", length = 255)
    private String goal;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "draft";

    @Column(name = "is_ai_generated", nullable = false)
    private boolean aiGenerated;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ai_recommendation_id")
    private AiRecommendationLog aiRecommendation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Tự cập nhật updatedAt trước mỗi lần cập nhật. */
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }
    /** Lấy giá trị trường gymClass. */
    public GymClass getGymClass() { return gymClass; }
    /** Gán giá trị mới cho trường gymClass. */
    public void setGymClass(GymClass gymClass) { this.gymClass = gymClass; }
    /** Lấy giá trị trường goal. */
    public String getGoal() { return goal; }
    /** Gán giá trị mới cho trường goal. */
    public void setGoal(String goal) { this.goal = goal; }
    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Cho biết ai generated (trường boolean). */
    public boolean isAiGenerated() { return aiGenerated; }
    /** Gán giá trị mới cho trường aiGenerated. */
    public void setAiGenerated(boolean aiGenerated) { this.aiGenerated = aiGenerated; }
    /** Lấy giá trị trường aiRecommendation. */
    public AiRecommendationLog getAiRecommendation() { return aiRecommendation; }
    /** Gán giá trị mới cho trường aiRecommendation. */
    public void setAiRecommendation(AiRecommendationLog aiRecommendation) { this.aiRecommendation = aiRecommendation; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
