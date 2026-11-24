package com.swp391.scms.ai.repository;

import com.swp391.scms.ai.entity.AiRecommendationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập bảng ai_recommendation_logs (nhật ký gợi ý giáo án AI). */
@Repository
public interface AiRecommendationLogRepository extends JpaRepository<AiRecommendationLog, Long> {

    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<AiRecommendationLog> findByMemberUserId(Long memberId);

    /** Tìm các bản ghi có coachUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<AiRecommendationLog> findByCoachUserId(Long coachId);
}
