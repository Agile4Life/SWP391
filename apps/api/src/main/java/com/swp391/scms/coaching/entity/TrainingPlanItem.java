package com.swp391.scms.coaching.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.Length;

/**
 * Entity ánh xạ bảng training_plan_items (schema do Hibernate sinh code-first): một bài tập trong giáo án gồm thứ
 * trong tuần, tên, mô tả, thời gian nghỉ, số hiệp/lần, thời lượng và thứ tự.
 */
@Entity
@org.hibernate.annotations.Check(name = "ck_plan_items_day", constraints = "day_of_week BETWEEN 1 AND 7")
@Table(name = "training_plan_items")
public class TrainingPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "training_plan_id", nullable = false)
    private TrainingPlan trainingPlan;

    @Column(name = "day_of_week")
    private Integer dayOfWeek;

    @Column(name = "exercise_name", nullable = false, length = 150)
    private String exerciseName;

    @Column(name = "description", length = Length.LONG32)
    private String description;

    @Column(name = "rest_seconds")
    private Integer restSeconds;

    @Column(name = "sets")
    private Integer sets;

    @Column(name = "reps")
    private Integer reps;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường trainingPlan. */
    public TrainingPlan getTrainingPlan() { return trainingPlan; }
    /** Gán giá trị mới cho trường trainingPlan. */
    public void setTrainingPlan(TrainingPlan trainingPlan) { this.trainingPlan = trainingPlan; }
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
