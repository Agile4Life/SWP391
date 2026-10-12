package com.swp391.scms.scheduling.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * SCRUM-72: request payloads for class and session management.
 */
public final class SchedulingRequests {

    private SchedulingRequests() {
    }

    /**
     * SCRUM-72 AC: Manager creates a class (discipline, coach, room, capacity, level).
     */
    public record CreateClassRequest(
            @NotBlank(message = "{validation.scheduling.class_name.not_blank}")
            @Size(max = 150, message = "{validation.scheduling.class_name.size}")
            String name,

            @NotNull(message = "{validation.scheduling.discipline.not_null}")
            Long disciplineId,

            @NotNull(message = "{validation.scheduling.coach.not_null}")
            Long coachId,

            @NotNull(message = "{validation.scheduling.room.not_null}")
            Long roomId,

            @NotNull(message = "{validation.scheduling.capacity.not_null}")
            @Min(value = 1, message = "{validation.scheduling.capacity.min}")
            Integer capacity,

            String level,

            String description
    ) {
    }

    /**
     * SCRUM-72 AC: schedule a concrete session for a class.
     */
    public record CreateSessionRequest(
            @NotNull(message = "{validation.scheduling.session_date.not_null}")
            java.time.LocalDate sessionDate,

            @NotNull(message = "{validation.scheduling.start_time.not_null}")
            java.time.LocalTime startTime,

            @NotNull(message = "{validation.scheduling.end_time.not_null}")
            java.time.LocalTime endTime
    ) {
    }
}
