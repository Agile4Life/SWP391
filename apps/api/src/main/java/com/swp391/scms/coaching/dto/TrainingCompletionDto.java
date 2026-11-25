package com.swp391.scms.coaching.dto;

import java.time.LocalDate;

/** Kết quả đánh dấu hoàn thành: id bài tập, ngày tập và trạng thái đã hoàn thành hay chưa. */
public record TrainingCompletionDto(Long itemId, LocalDate exerciseDate, boolean completed) {}
