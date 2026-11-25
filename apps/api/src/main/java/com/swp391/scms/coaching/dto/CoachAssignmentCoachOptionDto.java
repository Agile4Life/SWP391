package com.swp391.scms.coaching.dto;

/** Một lựa chọn HLV trong ô chọn khi điều chuyển: id, họ tên và chuyên môn. */
public record CoachAssignmentCoachOptionDto(Long coachId, String coachName, String specialization) {}
