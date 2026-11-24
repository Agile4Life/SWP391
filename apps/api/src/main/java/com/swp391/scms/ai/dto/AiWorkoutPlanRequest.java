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

    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    /** Lấy giá trị trường coachId. */
    public Long getCoachId() { return coachId; }
    /** Gán giá trị mới cho trường coachId. */
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    /** Lấy giá trị trường additionalRequirements. */
    public String getAdditionalRequirements() { return additionalRequirements; }
    /** Gán giá trị mới cho trường additionalRequirements. */
    public void setAdditionalRequirements(String additionalRequirements) { this.additionalRequirements = additionalRequirements; }
    /** Lấy giá trị trường durationWeeks. */
    public Integer getDurationWeeks() { return durationWeeks; }
    /** Gán giá trị mới cho trường durationWeeks. */
    public void setDurationWeeks(Integer durationWeeks) { this.durationWeeks = durationWeeks; }
}
