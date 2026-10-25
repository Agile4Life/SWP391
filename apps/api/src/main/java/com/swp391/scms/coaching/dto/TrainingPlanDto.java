package com.swp391.scms.coaching.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class TrainingPlanDto {

    private Long id;
    private Long memberId;
    private String memberName;
    private Long coachId;
    private String coachName;
    private Long classId;
    private String goal;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private boolean aiGenerated;
    private Long aiRecommendationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<TrainingPlanItemDto> items;

    public TrainingPlanDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }
    public Long getCoachId() { return coachId; }
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    public String getCoachName() { return coachName; }
    public void setCoachName(String coachName) { this.coachName = coachName; }
    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }
    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isAiGenerated() { return aiGenerated; }
    public void setAiGenerated(boolean aiGenerated) { this.aiGenerated = aiGenerated; }
    public Long getAiRecommendationId() { return aiRecommendationId; }
    public void setAiRecommendationId(Long aiRecommendationId) { this.aiRecommendationId = aiRecommendationId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<TrainingPlanItemDto> getItems() { return items; }
    public void setItems(List<TrainingPlanItemDto> items) { this.items = items; }
}

