package com.swp391.scms.scheduling.dto;

/** Kết quả đếm: id buổi học và số lượt đặt chỗ còn hiệu lực. */
public record SessionBookingCount(Long sessionId, long bookedCount) {}
