package com.swp391.scms.users.dto;

import jakarta.validation.constraints.Size;

/** Dữ liệu cập nhật ca làm của lễ tân. */
public record ReceptionistProfileUpdateDto(
    @Size(max = 50, message = "{validation.users.receptionist.shift.max}")
    String shift
) {}
