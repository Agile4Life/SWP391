package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.TrainingItemCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

/** Truy cập dữ liệu bài tập đã hoàn thành theo ngày (bảng training_item_completions). */
public interface TrainingItemCompletionRepository extends JpaRepository<TrainingItemCompletion, Long> {
    /**
     * Tìm các bản ghi có memberUserId = tham số và exerciseDate = tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<TrainingItemCompletion> findByMemberUserIdAndExerciseDate(Long memberUserId, LocalDate exerciseDate);
    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và trainingPlanItemId = tham số và exerciseDate =
     * tham số (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(Long memberUserId, Long itemId, LocalDate exerciseDate);
    /**
     * Xóa các bản ghi có memberUserId = tham số và trainingPlanItemId = tham số và exerciseDate = tham số
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    long deleteByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(Long memberUserId, Long itemId, LocalDate exerciseDate);
}
