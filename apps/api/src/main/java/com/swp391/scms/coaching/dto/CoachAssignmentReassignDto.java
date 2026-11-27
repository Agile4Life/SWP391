package com.swp391.scms.coaching.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Dữ liệu yêu cầu điều chuyển giáo án: hội viên, HLV cũ, HLV mới, id giáo án và loại phân công (chỉ TRAINING_PLAN;
 * PT 1:1 không điều chuyển).
 */
public record CoachAssignmentReassignDto(
        @NotNull(message = "{validation.coach_assignment.member_id.not_null}")
        Long memberId,

        @NotNull(message = "{validation.coach_assignment.from_coach_id.not_null}")
        Long fromCoachId,

        @NotNull(message = "{validation.coach_assignment.to_coach_id.not_null}")
        Long toCoachId,

        @NotNull(message = "{validation.coach_assignment.reference.required}") Long referenceId,

        @NotBlank(message = "{validation.coach_assignment.type.required}")
        @Pattern(regexp = "TRAINING_PLAN", message = "{validation.coach_assignment.transfer_type}")
        String assignmentType,

        @NotBlank(message = "{validation.coach_assignment.reason.required}")
        @Size(max = 500, message = "{validation.coach_assignment.reason.size}") String reason
) {}

