package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.TrainingPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrainingPlanItemRepository extends JpaRepository<TrainingPlanItem, Long> {

    List<TrainingPlanItem> findByTrainingPlanIdOrderByOrderIndexAscIdAsc(Long trainingPlanId);
}

