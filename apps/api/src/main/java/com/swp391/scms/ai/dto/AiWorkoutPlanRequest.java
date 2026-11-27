package com.swp391.scms.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Yêu cầu AI đề xuất giáo án: hội viên, HLV, yêu cầu thêm và số tuần. */
public class AiWorkoutPlanRequest {

    @JsonAlias("member_id")
    @NotNull(message = "{validation.ai.member_id.not_null}")
    private Long memberId;

    @JsonAlias({"additional_requirements", "prompt", "coach_notes", "coachNotes", "requirements"})
    @Size(max = 1000, message = "{validation.ai.requirements.size}")
    private String additionalRequirements;

    @JsonAlias("duration_weeks")
    @Min(value = 1, message = "{validation.ai.duration_weeks.range}")
    @Max(value = 52, message = "{validation.ai.duration_weeks.range}")
    private Integer durationWeeks;

    /** Constructor rỗng cho Jackson. */
    public AiWorkoutPlanRequest() {}

    /** Tạo yêu cầu với hội viên, yêu cầu thêm và số tuần. */
    public AiWorkoutPlanRequest(Long memberId, String additionalRequirements, Integer durationWeeks) {
        this.memberId = memberId;
        this.additionalRequirements = additionalRequirements;
        this.durationWeeks = durationWeeks;
    }

    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    /** Lấy giá trị trường additionalRequirements. */
    public String getAdditionalRequirements() { return additionalRequirements; }
    /** Gán giá trị mới cho trường additionalRequirements. */
    public void setAdditionalRequirements(String additionalRequirements) { this.additionalRequirements = additionalRequirements; }
    /** Lấy giá trị trường durationWeeks. */
    public Integer getDurationWeeks() { return durationWeeks; }
    /** Gán giá trị mới cho trường durationWeeks. */
    public void setDurationWeeks(Integer durationWeeks) { this.durationWeeks = durationWeeks; }
}
