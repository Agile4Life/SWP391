package com.swp391.scms.ai.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;

/**
 * Dữ liệu áp dụng gợi ý AI: ngày bắt đầu/kết thúc, lớp, HLV, mục tiêu, danh sách bài tập đã chỉnh và có kích
 * hoạt ngay không.
 */
public class AiApplyRecommendationRequest {

    @JsonAlias("start_date")
    private LocalDate startDate;

    @JsonAlias("end_date")
    private LocalDate endDate;

    @JsonAlias("class_id")
    private Long classId;

    private String goal;

    @Valid
    private List<TrainingPlanItemCreateDto> items;

    private Boolean activate;

    /** Constructor rỗng cho Jackson. */
    public AiApplyRecommendationRequest() {}

    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    /** Lấy giá trị trường classId. */
    public Long getClassId() { return classId; }
    /** Gán giá trị mới cho trường classId. */
    public void setClassId(Long classId) { this.classId = classId; }
    /** Lấy giá trị trường goal. */
    public String getGoal() { return goal; }
    /** Gán giá trị mới cho trường goal. */
    public void setGoal(String goal) { this.goal = goal; }
    /** Lấy giá trị trường items. */
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
    /** Lấy giá trị trường activate. */
    public Boolean getActivate() { return activate; }
    /** Gán giá trị mới cho trường activate. */
    public void setActivate(Boolean activate) { this.activate = activate; }
}
