package com.swp391.scms.ai.dto;

import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class AiWorkoutPlanResponse {

    private Long id;
    private Long memberId;
    private String memberCode;
    private String memberName;
    private Long coachId;
    private String modelName;
    private boolean applied;
    private Map<String, Object> inputContext;
    private String goal;
    private String analysis;
    private List<TrainingPlanItemCreateDto> items;
    private LocalDateTime createdAt;

    public AiWorkoutPlanResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    public String getMemberCode() { return memberCode; }
    public void setMemberCode(String memberCode) { this.memberCode = memberCode; }
    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }
    public Long getCoachId() { return coachId; }
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public boolean isApplied() { return applied; }
    public void setApplied(boolean applied) { this.applied = applied; }
    public Map<String, Object> getInputContext() { return inputContext; }
    public void setInputContext(Map<String, Object> inputContext) { this.inputContext = inputContext; }
    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public String getAnalysis() { return analysis; }
    public void setAnalysis(String analysis) { this.analysis = analysis; }
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
