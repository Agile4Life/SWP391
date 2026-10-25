package com.swp391.scms.coaching.entity;

import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "training_item_completions", uniqueConstraints =
        @UniqueConstraint(name = "uk_training_completion_member_item_date",
                columnNames = {"member_id", "training_plan_item_id", "exercise_date"}))
public class TrainingItemCompletion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "training_plan_item_id", nullable = false)
    private TrainingPlanItem trainingPlanItem;

    @Column(name = "exercise_date", nullable = false)
    private LocalDate exerciseDate;

    @Column(name = "completed_at", nullable = false)
    private LocalDateTime completedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public TrainingPlanItem getTrainingPlanItem() { return trainingPlanItem; }
    public void setTrainingPlanItem(TrainingPlanItem trainingPlanItem) { this.trainingPlanItem = trainingPlanItem; }
    public LocalDate getExerciseDate() { return exerciseDate; }
    public void setExerciseDate(LocalDate exerciseDate) { this.exerciseDate = exerciseDate; }
    public LocalDateTime getCompletedAt() { return completedAt; }
}
