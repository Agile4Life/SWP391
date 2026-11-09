package com.swp391.scms.health.dto;

/** A registered member nobody has measured yet, offered to coaches for the first assessment. */
public record FirstAssessmentCandidateDto(Long memberId, String membershipCode, String fullName, String phone) {
}
