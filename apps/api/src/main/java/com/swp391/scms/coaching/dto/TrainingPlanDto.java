package com.swp391.scms.coaching.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Thông tin giáo án trả về client: hội viên, HLV, lớp, mục tiêu, thời gian, trạng thái, nguồn AI, mốc thời gian
 * và danh sách bài tập.
 */
public class TrainingPlanDto {

    private Long id;
    private Long memberId;
    private String memberName;
    private Long coachId;
    private String coachName;
    private Long classId;
    private String goal;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private boolean aiGenerated;
    private Long aiRecommendationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<TrainingPlanItemDto> items;

    /** Constructor rỗng cho Jackson và cho việc gán từng trường. */
    public TrainingPlanDto() {}

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    /** Lấy giá trị trường memberName. */
    public String getMemberName() { return memberName; }
    /** Gán giá trị mới cho trường memberName. */
    public void setMemberName(String memberName) { this.memberName = memberName; }
    /** Lấy giá trị trường coachId. */
    public Long getCoachId() { return coachId; }
    /** Gán giá trị mới cho trường coachId. */
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    /** Lấy giá trị trường coachName. */
    public String getCoachName() { return coachName; }
    /** Gán giá trị mới cho trường coachName. */
    public void setCoachName(String coachName) { this.coachName = coachName; }
    /** Lấy giá trị trường classId. */
    public Long getClassId() { return classId; }
    /** Gán giá trị mới cho trường classId. */
    public void setClassId(Long classId) { this.classId = classId; }
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
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Cho biết ai generated (trường boolean). */
    public boolean isAiGenerated() { return aiGenerated; }
    /** Gán giá trị mới cho trường aiGenerated. */
    public void setAiGenerated(boolean aiGenerated) { this.aiGenerated = aiGenerated; }
    /** Lấy giá trị trường aiRecommendationId. */
    public Long getAiRecommendationId() { return aiRecommendationId; }
    /** Gán giá trị mới cho trường aiRecommendationId. */
    public void setAiRecommendationId(Long aiRecommendationId) { this.aiRecommendationId = aiRecommendationId; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    /** Lấy giá trị trường items. */
    public List<TrainingPlanItemDto> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(List<TrainingPlanItemDto> items) { this.items = items; }
}

