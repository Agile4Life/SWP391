package com.swp391.scms.attendance.repository;

import com.swp391.scms.attendance.entity.SessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionAttendanceRepository extends JpaRepository<SessionAttendance, Long> {

    List<SessionAttendance> findBySessionId(Long sessionId);

    @Query("""
            select a from SessionAttendance a
            join fetch a.member m
            join fetch a.recordedBy r
            where a.session.id = :sessionId
            """)
    List<SessionAttendance> findBySessionIdWithDetails(@Param("sessionId") Long sessionId);

    Optional<SessionAttendance> findBySessionIdAndMemberUserId(Long sessionId, Long memberId);

    boolean existsBySessionIdAndMemberUserId(Long sessionId, Long memberId);

    List<SessionAttendance> findByMemberUserId(Long memberId);

    long countBySessionIdAndStatus(Long sessionId, String status);
}
