package com.swp391.scms.attendance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Điểm danh hàng loạt: danh sách học viên và cờ có gửi kết quả đánh giá cho học viên không.
 *
 * SCRUM-111: Batch attendance request payload.
 */
public record BatchAttendanceRequest(
        @NotEmpty(message = "{validation.attendance.records.not_empty}")
        @Valid
        List<AttendanceItem> records,
        boolean publishEvaluations
) {

    /** Constructor không gửi kết quả đánh giá. */
    public BatchAttendanceRequest(List<AttendanceItem> records) { this(records, false); }

    /** Điểm danh một học viên: id, trạng thái (present/absent/late/excused), ghi chú và điểm tiến bộ (tùy chọn). */
    public record AttendanceItem(
            @NotNull(message = "{validation.attendance.member_id.not_null}")
            Long memberId,

            @NotBlank(message = "{validation.attendance.status.not_blank}")
            @Pattern(regexp = "(?i)present|absent|late|excused", message = "{validation.attendance.status.invalid}")
            String status,

            @Size(max = 255, message = "{validation.attendance.notes.size}")
            String notes,

            @Min(value = 1, message = "{validation.coaching.progress_score.range}")
            @Max(value = 100, message = "{validation.coaching.progress_score.range}")
            Integer progressScore
    ) {
        /** Constructor không có điểm tiến bộ. */
        public AttendanceItem(Long memberId, String status, String notes) {
            this(memberId, status, notes, null);
        }
    }
}
