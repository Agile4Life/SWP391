package com.swp391.scms.coaching.dto;

import java.time.LocalDate;

public record CoachAssignmentStudentDto(
        Long memberId,
        String membershipCode,
        String fullName,
        String phone,
        String email,
        String avatarUrl,
        String fitnessGoal,
        String fitnessLevel,
        String healthNotes,
        String assignmentType,
        String assignmentTypeLabel,
        String detail,
        LocalDate startDate,
        LocalDate endDate,
        String nextSession,
        String status,
        Long referenceId,
        /** Null when the plan is fine; FROZEN (on hold), NO_ACTIVE (no valid plan today) or NOT_COVERED (plan ends before the PT day). */
        String membershipIssue
) {
    public CoachAssignmentStudentDto(Long memberId, String membershipCode, String fullName, String phone, String email,
                                     String avatarUrl, String fitnessGoal, String fitnessLevel, String healthNotes,
                                     String assignmentType, String assignmentTypeLabel, String detail, LocalDate startDate,
                                     LocalDate endDate, String nextSession, String status, Long referenceId) {
        this(memberId, membershipCode, fullName, phone, email, avatarUrl, fitnessGoal, fitnessLevel, healthNotes,
                assignmentType, assignmentTypeLabel, detail, startDate, endDate, nextSession, status, referenceId, null);
    }
}

