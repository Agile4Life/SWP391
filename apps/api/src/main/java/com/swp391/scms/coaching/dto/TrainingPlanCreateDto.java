package com.swp391.scms.coaching.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Dữ liệu tạo giáo án: hội viên, HLV, lớp, tiêu đề, mục tiêu, thời gian áp dụng, trạng thái, có kích hoạt ngay
 * không, nguồn AI và danh sách bài tập.
 */
public class TrainingPlanCreateDto {

    @JsonAlias("member_id")
    @NotNull(message = "{validation.coaching.member_id.not_null}")
    private Long memberId;

    @JsonAlias("coach_id")
    private Long coachId;

    @JsonAlias("class_id")
    private Long classId;

    @Size(max = 255, message = "{validation.coaching.goal.size}")
    private String title;

    @Size(max = 255, message = "{validation.coaching.goal.size}")
    private String goal;

    @JsonAlias("start_date")
    @NotNull(message = "{validation.coaching.start_date.not_null}")
    private LocalDate startDate;

    @JsonAlias("end_date")
    @NotNull(message = "{validation.coaching.end_date.not_null}")
    private LocalDate endDate;

    private String status;

    private Boolean activate;

    @JsonAlias({"is_ai_generated", "isAiGenerated"})
    private Boolean aiGenerated;

    @JsonAlias({"ai_recommendation_id", "ai_recommendation_log_id", "aiRecommendationLogId"})
    private Long aiRecommendationId;

    @Valid
    private List<TrainingPlanItemCreateDto> items;

    /** Constructor rỗng cho Jackson khi đọc JSON. */
    public TrainingPlanCreateDto() {}

    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    /** Lấy giá trị trường coachId. */
    public Long getCoachId() { return coachId; }
    /** Gán giá trị mới cho trường coachId. */
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    /** Lấy giá trị trường classId. */
    public Long getClassId() { return classId; }
    /** Gán giá trị mới cho trường classId. */
    public void setClassId(Long classId) { this.classId = classId; }
    /** Lấy giá trị trường title. */
    public String getTitle() { return title; }
    /** Gán giá trị mới cho trường title. */
    public void setTitle(String title) { this.title = title; }
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
    /** Lấy giá trị trường activate. */
    public Boolean getActivate() { return activate; }
    /** Gán giá trị mới cho trường activate. */
    public void setActivate(Boolean activate) { this.activate = activate; }
    /** Lấy giá trị trường aiGenerated. */
    public Boolean getAiGenerated() { return aiGenerated; }
    /** Gán giá trị mới cho trường aiGenerated. */
    public void setAiGenerated(Boolean aiGenerated) { this.aiGenerated = aiGenerated; }
    /** Lấy giá trị trường aiRecommendationId. */
    public Long getAiRecommendationId() { return aiRecommendationId; }
    /** Gán giá trị mới cho trường aiRecommendationId. */
    public void setAiRecommendationId(Long aiRecommendationId) { this.aiRecommendationId = aiRecommendationId; }
    /** Lấy giá trị trường items. */
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
}

