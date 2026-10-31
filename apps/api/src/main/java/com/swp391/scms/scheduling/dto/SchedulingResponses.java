package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * SCRUM-72: response payloads for class and session read models.
 */
public final class SchedulingResponses {

    private SchedulingResponses() {
    }

    public record GymClassDto(
            Long id,
            String name,
            Long disciplineId,
            String disciplineName,
            Long coachId,
            String coachName,
            Long roomId,
            String roomName,
            int capacity,
            String level,
            String description,
            String status
    ) {
    }

    public record ClassSessionDto(
            Long id,
            Long classId,
            String className,
            Long disciplineId,
            String disciplineName,
            Long coachId,
            String coachName,
            Long roomId,
            String roomName,
            LocalDate sessionDate,
            LocalTime startTime,
            LocalTime endTime,
            String status,
            String cancelReason,
            int capacity,
            long bookedCount
    ) {
    }

    public record EnrolledStudentDto(
            Long id,
            Long memberId,
            String membershipCode,
            String fullName,
            String email,
            String phone,
            String avatarUrl,
            String fitnessGoal,
            String healthNotes,
            String fitnessLevel,
            String emergencyContactName,
            String emergencyContactPhone,
            LocalDateTime enrolledAt,
            String status
    ) {
    }

    public record CoachOptionDto(
            Long id,
            String fullName,
            String email,
            String phone,
            String status
    ) {
    }
}
