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

    /** Evaluation summary per session: [sessionId, count, average progress score, latest evaluatedAt]. */
    @org.springframework.data.jpa.repository.Query("select e.session.id, count(e), avg(e.progressScore), max(e.evaluatedAt) "
            + "from SessionEvaluation e where e.session.id in :ids group by e.session.id")
    List<Object[]> summarizeForSessions(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
}
