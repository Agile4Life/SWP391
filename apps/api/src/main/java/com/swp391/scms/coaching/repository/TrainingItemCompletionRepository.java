package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.TrainingItemCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface TrainingItemCompletionRepository extends JpaRepository<TrainingItemCompletion, Long> {
    List<TrainingItemCompletion> findByMemberUserIdAndExerciseDate(Long memberUserId, LocalDate exerciseDate);
    boolean existsByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(Long memberUserId, Long itemId, LocalDate exerciseDate);
    long deleteByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(Long memberUserId, Long itemId, LocalDate exerciseDate);
}
