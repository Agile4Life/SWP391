package com.swp391.scms.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AiWorkoutPlanRequest {

    @JsonAlias("member_id")
    @NotNull(message = "{validation.ai.member_id.not_null}")
    private Long memberId;

    @JsonAlias("coach_id")
    private Long coachId;

    @JsonAlias({"additional_requirements", "prompt", "coach_notes", "coachNotes", "requirements"})
    @Size(max = 1000, message = "{validation.ai.requirements.size}")
    private String additionalRequirements;

    @JsonAlias("duration_weeks")
    @Min(value = 1, message = "{validation.ai.duration_weeks.range}")
    @Max(value = 52, message = "{validation.ai.duration_weeks.range}")
    private Integer durationWeeks;

    public AiWorkoutPlanRequest() {}

    public AiWorkoutPlanRequest(Long memberId, String additionalRequirements, Integer durationWeeks) {
        this.memberId = memberId;
        this.additionalRequirements = additionalRequirements;
        this.durationWeeks = durationWeeks;
    }

    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    public Long getCoachId() { return coachId; }
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    public String getAdditionalRequirements() { return additionalRequirements; }
    public void setAdditionalRequirements(String additionalRequirements) { this.additionalRequirements = additionalRequirements; }
    public Integer getDurationWeeks() { return durationWeeks; }
    public void setDurationWeeks(Integer durationWeeks) { this.durationWeeks = durationWeeks; }
}
