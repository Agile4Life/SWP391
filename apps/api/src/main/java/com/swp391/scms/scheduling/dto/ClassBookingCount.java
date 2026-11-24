package com.swp391.scms.scheduling.dto;

/** Kết quả đếm: id lớp và số lượt ghi danh theo trạng thái. */
public record ClassBookingCount(Long classId, long bookedCount) {}
