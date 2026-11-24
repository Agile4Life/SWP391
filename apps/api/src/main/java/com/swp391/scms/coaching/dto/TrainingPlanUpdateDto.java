package com.swp391.scms.coaching.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Dữ liệu cập nhật giáo án: mục tiêu, ngày bắt đầu/kết thúc và danh sách bài tập (mỗi phần tử không được null).
 *
 * Partial header update with optional full values for existing exercises; omitted items stay unchanged.
 */
public class TrainingPlanUpdateDto {

    @Size(max = 255, message = "{validation.coaching.goal.size}")
    private String goal;

    @JsonAlias("start_date")
    private LocalDate startDate;

    @JsonAlias("end_date")
    private LocalDate endDate;

    @jakarta.validation.Valid
    private java.util.List<@jakarta.validation.constraints.NotNull(message = "{validation.coaching.item_id.required}") TrainingPlanItemUpdateDto> items;
    /** Lấy giá trị trường items. */
    public java.util.List<TrainingPlanItemUpdateDto> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(java.util.List<TrainingPlanItemUpdateDto> items) { this.items = items; }

    /** Lấy giá trị trường goal. */
    public String getGoal() { return goal; }
    /** Gán giá trị mới cho trường goal. */
    public void setGoal(String goal) { this.goal = goal; }
    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}
