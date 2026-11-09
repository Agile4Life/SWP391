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
            String status,
            java.math.BigDecimal price,
            LocalDate startDate,
            LocalDate endDate,
            String recurringDays,
            LocalTime startTime,
            LocalTime endTime,
            /** {@code weekly} or {@code monthly}. */
            String repeatType,
            /** Days of the month of a monthly course, for example "5,20". */
            String monthDays
    ) {
        public GymClassDto(
                Long id, String name, Long disciplineId, String disciplineName, Long coachId, String coachName,
                Long roomId, String roomName, int capacity, String level, String description, String status,
                java.math.BigDecimal price, LocalDate startDate, LocalDate endDate, String recurringDays,
                LocalTime startTime, LocalTime endTime
        ) {
            this(id, name, disciplineId, disciplineName, coachId, coachName, roomId, roomName, capacity, level,
                    description, status, price, startDate, endDate, recurringDays, startTime, endTime, "weekly", null);
        }

        public GymClassDto(
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
            this(id, name, disciplineId, disciplineName, coachId, coachName, roomId, roomName, capacity, level, description, status, java.math.BigDecimal.ZERO, null, null, null, null, null, "weekly", null);
        }
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
            String status,
            String gender
    ) {
        public CoachOptionDto(Long id, String fullName, String email, String phone, String status) {
            this(id, fullName, email, phone, status, null);
        }
    }
}
