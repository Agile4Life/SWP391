package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.SessionEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionEvaluationRepository extends JpaRepository<SessionEvaluation, Long> {

    List<SessionEvaluation> findByMemberUserIdOrderByEvaluatedAtDesc(Long memberId);

    List<SessionEvaluation> findByCoachUserIdOrderByEvaluatedAtDesc(Long coachId);

    List<SessionEvaluation> findBySessionIdOrderByEvaluatedAtDesc(Long sessionId);
}
