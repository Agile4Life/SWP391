package com.swp391.scms.coaching.dto;

import java.time.LocalDate;

public record TrainingCompletionDto(Long itemId, LocalDate exerciseDate, boolean completed) {}
