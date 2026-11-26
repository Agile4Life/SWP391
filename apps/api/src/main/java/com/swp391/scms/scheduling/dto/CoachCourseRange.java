package com.swp391.scms.scheduling.dto;

import java.time.LocalDate;

/** Khoảng ngày đang chạy của một khóa (buổi đầu → buổi cuối còn lịch) do một HLV dạy. */
public record CoachCourseRange(Long coachId, Long classId, String className, LocalDate firstDate, LocalDate lastDate) {}
