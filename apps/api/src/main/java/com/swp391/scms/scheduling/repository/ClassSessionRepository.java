package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    List<ClassSession> findByGymClassIdOrderBySessionDateAscStartTimeAsc(Long classId);

    /**
     * SCRUM-72 BR-06: schedule lookup with optional filters by date range, discipline and coach.
     * All filters are optional (null means "no filter").
     */
    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            join fetch c.discipline d
            join fetch c.coach co
            join fetch c.room r
            where (:fromDate is null or s.sessionDate >= :fromDate)
              and (:toDate is null or s.sessionDate <= :toDate)
              and (:disciplineId is null or d.id = :disciplineId)
              and (:coachId is null or co.userId = :coachId)
            order by s.sessionDate asc, s.startTime asc
            """)
    List<ClassSession> searchSessions(@Param("fromDate") LocalDate fromDate,
                                      @Param("toDate") LocalDate toDate,
                                      @Param("disciplineId") Long disciplineId,
                                      @Param("coachId") Long coachId);

    long countByGymClassIdAndStatus(Long classId, String status);
}
