package com.swp391.scms.ai.dto;

import com.swp391.scms.coaching.dto.TrainingPlanItemCreateDto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Gợi ý giáo án AI trả cho client: hội viên, HLV, model, đã áp dụng chưa, mục tiêu, phân tích, danh sách bài
 * tập và thời điểm tạo.
 */
public class AiWorkoutPlanResponse {

    private Long id;
    private Long memberId;
    private String memberCode;
    private String memberName;
    private Long coachId;
    private String modelName;
    private boolean applied;
    private Map<String, Object> inputContext;
    private String goal;
    private String analysis;
    private List<TrainingPlanItemCreateDto> items;
    private LocalDateTime createdAt;

    /** Constructor rỗng cho Jackson. */
    public AiWorkoutPlanResponse() {}

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường memberId. */
    public Long getMemberId() { return memberId; }
    /** Gán giá trị mới cho trường memberId. */
    public void setMemberId(Long memberId) { this.memberId = memberId; }
    /** Lấy giá trị trường memberCode. */
    public String getMemberCode() { return memberCode; }
    /** Gán giá trị mới cho trường memberCode. */
    public void setMemberCode(String memberCode) { this.memberCode = memberCode; }
    /** Lấy giá trị trường memberName. */
    public String getMemberName() { return memberName; }
    /** Gán giá trị mới cho trường memberName. */
    public void setMemberName(String memberName) { this.memberName = memberName; }
    /** Lấy giá trị trường coachId. */
    public Long getCoachId() { return coachId; }
    /** Gán giá trị mới cho trường coachId. */
    public void setCoachId(Long coachId) { this.coachId = coachId; }
    /** Lấy giá trị trường modelName. */
    public String getModelName() { return modelName; }
    /** Gán giá trị mới cho trường modelName. */
    public void setModelName(String modelName) { this.modelName = modelName; }
    /** Cho biết applied (trường boolean). */
    public boolean isApplied() { return applied; }
    /** Gán giá trị mới cho trường applied. */
    public void setApplied(boolean applied) { this.applied = applied; }
    /** Lấy giá trị trường inputContext. */
    public Map<String, Object> getInputContext() { return inputContext; }
    /** Gán giá trị mới cho trường inputContext. */
    public void setInputContext(Map<String, Object> inputContext) { this.inputContext = inputContext; }
    /** Lấy giá trị trường goal. */
    public String getGoal() { return goal; }
    /** Gán giá trị mới cho trường goal. */
    public void setGoal(String goal) { this.goal = goal; }
    /** Lấy giá trị trường analysis. */
    public String getAnalysis() { return analysis; }
    /** Gán giá trị mới cho trường analysis. */
    public void setAnalysis(String analysis) { this.analysis = analysis; }
    /** Lấy giá trị trường items. */
    public List<TrainingPlanItemCreateDto> getItems() { return items; }
    /** Gán giá trị mới cho trường items. */
    public void setItems(List<TrainingPlanItemCreateDto> items) { this.items = items; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
