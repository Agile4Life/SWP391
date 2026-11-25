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

/** Truy cập dữ liệu bài tập trong giáo án (bảng training_plan_items). */
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
    /** Lấy bài tập theo id kèm giáo án và hội viên, khóa dòng để đánh dấu hoàn thành không bị ghi trùng. */
    Optional<TrainingPlanItem> findLockedById(@Param("id") Long id);
}

