package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.TrainingPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrainingPlanItemRepository extends JpaRepository<TrainingPlanItem, Long> {

    /**
     * Tìm các bản ghi có trainingPlanId = tham số, sắp xếp theo orderIndex tăng dần, id tăng dần (Spring Data
     * tự sinh truy vấn từ tên hàm).
     */
    List<TrainingPlanItem> findByTrainingPlanIdOrderByOrderIndexAscIdAsc(Long trainingPlanId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select item
            from TrainingPlanItem item
            join fetch item.trainingPlan plan
            join fetch plan.member
            where item.id = :id
            """)
    Optional<TrainingPlanItem> findLockedById(@Param("id") Long id);
}

