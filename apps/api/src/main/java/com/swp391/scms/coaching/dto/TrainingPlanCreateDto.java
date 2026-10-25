package com.swp391.scms.coaching.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public class TrainingPlanCreateDto {

    @JsonAlias("member_id")
    @NotNull(message = "{validation.coaching.member_id.not_null}")
    private Long memberId;

    @JsonAlias("coach_id")
    private Long coachId;

    @JsonAlias("class_id")
    private Long classId;

    @Size(max = 255, message = "{validation.coaching.goal.size}")
    private String goal;

    @JsonAlias("start_date")
    @NotNull(message = "{validation.coaching.start_date.not_null}")
    private LocalDate startDate;

    @JsonAlias("end_date")
    @NotNull(message = "{validation.coaching.end_date.not_null}")
    private LocalDate endDate;

    @JsonAlias({"is_ai_generated", "isAiGenerated"})
    private Boolean aiGenerated;

    @JsonAlias("ai_recommendation_id")
    private Long aiRecommendationId;

    @Valid
    private List<TrainingPlanItemCreateDto> items;

    public TrainingPlanCreateDto() {}

    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    public Long getCoachId() { return coachId; }
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }
    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Boolean getAiGenerated() { return aiGenerated; }
    public void setAiGenerated(Boolean aiGenerated) { this.aiGenerated = aiGenerated; }
    public Long getAiRecommendationId() { return aiRecommendationId; }
    public void setAiRecommendationId(Long aiRecommendationId) { this.aiRecommendationId = aiRecommendationId; }
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
}

