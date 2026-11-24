package com.swp391.scms.coaching.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Dữ liệu cập nhật một phần thông tin đầu mục giáo án (mục tiêu, ngày bắt đầu/kết thúc) kèm giá trị đầy đủ tùy chọn
 * cho các bài tập hiện có (mỗi phần tử không được null; bài tập không gửi lên sẽ giữ nguyên).
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
