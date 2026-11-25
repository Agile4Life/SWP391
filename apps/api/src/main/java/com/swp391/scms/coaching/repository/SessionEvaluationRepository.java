package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.SessionEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập dữ liệu đánh giá buổi tập (bảng session_evaluations). */
@Repository
public interface SessionEvaluationRepository extends JpaRepository<SessionEvaluation, Long> {

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo evaluatedAt giảm dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    List<SessionEvaluation> findByMemberUserIdOrderByEvaluatedAtDesc(Long memberId);

    /**
     * Tìm các bản ghi có coachUserId = tham số, sắp xếp theo evaluatedAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<SessionEvaluation> findByCoachUserIdOrderByEvaluatedAtDesc(Long coachId);

    /**
     * Tìm các bản ghi có sessionId = tham số, sắp xếp theo evaluatedAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<SessionEvaluation> findBySessionIdOrderByEvaluatedAtDesc(Long sessionId);

    /** Kiểm tra có tồn tại đánh giá buổi tập nào thuộc các buổi của lớp này không. */
    boolean existsBySessionGymClassId(Long classId);

    /** Tổng hợp đánh giá theo từng buổi: [sessionId, số đánh giá, điểm tiến bộ trung bình, evaluatedAt gần nhất]. */
    @org.springframework.data.jpa.repository.Query("select e.session.id, count(e), avg(e.progressScore), max(e.evaluatedAt) "
            + "from SessionEvaluation e where e.session.id in :ids group by e.session.id")
    List<Object[]> summarizeForSessions(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
}
