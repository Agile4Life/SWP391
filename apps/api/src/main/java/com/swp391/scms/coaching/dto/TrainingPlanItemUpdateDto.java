package com.swp391.scms.coaching.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Dữ liệu một bài tập khi cập nhật giáo án: như khi tạo, thêm id bắt buộc của bài tập đã có trong giáo án
 * (không thêm bài mới qua cập nhật).
 *
 * Updates an existing exercise in place, preserving completion-history references.
 */
public class TrainingPlanItemUpdateDto extends TrainingPlanItemCreateDto {
    @NotNull(message = "{validation.coaching.item_id.required}")
    private Long id;
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
}
