package com.swp391.scms.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AiWorkoutPlanRequest {

    @JsonAlias("member_id")
    @NotNull(message = "{validation.ai.member_id.not_null}")
    private Long memberId;

    @JsonAlias({"additional_requirements", "prompt", "coach_notes", "coachNotes", "requirements"})
    @Size(max = 1000, message = "{validation.ai.requirements.size}")
    private String additionalRequirements;

    @JsonAlias("duration_weeks")
    private Integer durationWeeks;

    public AiWorkoutPlanRequest() {}

    public AiWorkoutPlanRequest(Long memberId, String additionalRequirements, Integer durationWeeks) {
        this.memberId = memberId;
        this.additionalRequirements = additionalRequirements;
        this.durationWeeks = durationWeeks;
    }

    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    public String getAdditionalRequirements() { return additionalRequirements; }
    public void setAdditionalRequirements(String additionalRequirements) { this.additionalRequirements = additionalRequirements; }
    public Integer getDurationWeeks() { return durationWeeks; }
    public void setDurationWeeks(Integer durationWeeks) { this.durationWeeks = durationWeeks; }
}
