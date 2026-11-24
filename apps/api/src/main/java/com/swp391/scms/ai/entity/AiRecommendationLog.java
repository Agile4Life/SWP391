package com.swp391.scms.ai.entity;

import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Bảng ai_recommendation_logs: một lần AI đề xuất giáo án (HLV, hội viên, dữ liệu đầu vào JSON, nội dung đề
 * xuất JSON, model, đã áp dụng chưa, thời điểm).
 *
 * Entity mapping table ai_recommendation_logs (schema is generated code-first by Hibernate).
 */
@Entity
@Table(name = "ai_recommendation_logs")
public class AiRecommendationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_context", nullable = false)
    private String inputContext;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recommended_content", nullable = false)
    private String recommendedContent;

    @Column(name = "model_name", length = 100)
    private String modelName;

    @Column(name = "is_applied", nullable = false)
    private boolean applied;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường inputContext. */
    public String getInputContext() { return inputContext; }
    /** Gán giá trị mới cho trường inputContext. */
    public void setInputContext(String inputContext) { this.inputContext = inputContext; }
    /** Lấy giá trị trường recommendedContent. */
    public String getRecommendedContent() { return recommendedContent; }
    /** Gán giá trị mới cho trường recommendedContent. */
    public void setRecommendedContent(String recommendedContent) { this.recommendedContent = recommendedContent; }
    /** Lấy giá trị trường modelName. */
    public String getModelName() { return modelName; }
    /** Gán giá trị mới cho trường modelName. */
    public void setModelName(String modelName) { this.modelName = modelName; }
    /** Cho biết applied (trường boolean). */
    public boolean isApplied() { return applied; }
    /** Gán giá trị mới cho trường applied. */
    public void setApplied(boolean applied) { this.applied = applied; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
