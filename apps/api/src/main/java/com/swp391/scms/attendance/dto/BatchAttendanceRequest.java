package com.swp391.scms.attendance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * SCRUM-111: Batch attendance request payload.
 */
public record BatchAttendanceRequest(
        @NotEmpty(message = "{validation.attendance.records.not_empty}")
        @Valid
        List<AttendanceItem> records
) {

    public record AttendanceItem(
            @NotNull(message = "{validation.attendance.member_id.not_null}")
            Long memberId,

            @NotBlank(message = "{validation.attendance.status.not_blank}")
            @Pattern(regexp = "(?i)present|absent|late|excused", message = "{validation.attendance.status.invalid}")
            String status,

            @Size(max = 255, message = "{validation.attendance.notes.size}")
            String notes
    ) {
    }
}
