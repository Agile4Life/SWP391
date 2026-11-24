package com.swp391.scms.coaching.dto;

/** Thông tin một bài tập trong giáo án trả về client. */
public class TrainingPlanItemDto {

    private Long id;
    private Long trainingPlanId;
    private Integer dayOfWeek;
    private String exerciseName;
    private String description;
    private Integer restSeconds;

    private Integer sets;
    private Integer reps;
    private Integer durationMinutes;
    private int orderIndex;

    /** Constructor rỗng cho Jackson. */
    public TrainingPlanItemDto() {}

    /** Constructor đầy đủ để tạo DTO từ entity. */
    public TrainingPlanItemDto(Long id, Long trainingPlanId, Integer dayOfWeek, String exerciseName,
                               String description, Integer sets, Integer reps, Integer durationMinutes, int orderIndex) {
        this.id = id;
        this.trainingPlanId = trainingPlanId;
        this.dayOfWeek = dayOfWeek;
        this.exerciseName = exerciseName;
        this.description = description;
        this.sets = sets;
        this.reps = reps;
        this.durationMinutes = durationMinutes;
        this.orderIndex = orderIndex;
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường trainingPlanId. */
    public Long getTrainingPlanId() { return trainingPlanId; }
    /** Gán giá trị mới cho trường trainingPlanId. */
    public void setTrainingPlanId(Long trainingPlanId) { this.trainingPlanId = trainingPlanId; }
    /** Lấy giá trị trường dayOfWeek. */
    public Integer getDayOfWeek() { return dayOfWeek; }
    /** Gán giá trị mới cho trường dayOfWeek. */
    public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
    /** Lấy giá trị trường exerciseName. */
    public String getExerciseName() { return exerciseName; }
    /** Gán giá trị mới cho trường exerciseName. */
    public void setExerciseName(String exerciseName) { this.exerciseName = exerciseName; }
    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }
    /** Lấy giá trị trường restSeconds. */
    public Integer getRestSeconds() { return restSeconds; }
    /** Gán giá trị mới cho trường restSeconds. */
    public void setRestSeconds(Integer restSeconds) { this.restSeconds = restSeconds; }
    /** Lấy giá trị trường sets. */
    public Integer getSets() { return sets; }
    /** Gán giá trị mới cho trường sets. */
    public void setSets(Integer sets) { this.sets = sets; }
    /** Lấy giá trị trường reps. */
    public Integer getReps() { return reps; }
    /** Gán giá trị mới cho trường reps. */
    public void setReps(Integer reps) { this.reps = reps; }
    /** Lấy giá trị trường durationMinutes. */
    public Integer getDurationMinutes() { return durationMinutes; }
    /** Gán giá trị mới cho trường durationMinutes. */
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    /** Lấy giá trị trường orderIndex. */
    public int getOrderIndex() { return orderIndex; }
    /** Gán giá trị mới cho trường orderIndex. */
    public void setOrderIndex(int orderIndex) { this.orderIndex = orderIndex; }
}

