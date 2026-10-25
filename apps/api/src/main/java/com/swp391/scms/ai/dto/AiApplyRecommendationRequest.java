package com.swp391.scms.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;

public class AiApplyRecommendationRequest {

    @JsonAlias("start_date")
    private LocalDate startDate;

    @JsonAlias("end_date")
    private LocalDate endDate;

    @JsonAlias("class_id")
    private Long classId;

    private String goal;

    @Valid
    private List<TrainingPlanItemCreateDto> items;

    private Boolean activate;

    public AiApplyRecommendationRequest() {}

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }
    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
    public Boolean getActivate() { return activate; }
    public void setActivate(Boolean activate) { this.activate = activate; }
}
