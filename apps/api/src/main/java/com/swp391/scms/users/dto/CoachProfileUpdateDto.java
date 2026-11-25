package com.swp391.scms.users.dto;

import jakarta.validation.constraints.Size;

/** Dữ liệu HLV tự cập nhật: chuyên môn, giới thiệu và chứng chỉ. */
public record CoachProfileUpdateDto(
    @Size(max = 150, message = "{validation.users.coach.specialization.max}")
    String specialization,
    
    String bio,
    
    @Size(max = 255, message = "{validation.users.coach.certification.max}")
    String certification
) {}
