package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, Long> {

    List<ClassEnrollment> findByMemberUserId(Long memberId);

    List<ClassEnrollment> findByGymClassId(Long classId);

    Optional<ClassEnrollment> findByGymClassIdAndMemberUserId(Long classId, Long memberId);

    long countByGymClassIdAndStatus(Long classId, String status);

    @Query("""
        SELECT ce FROM ClassEnrollment ce
        JOIN FETCH ce.gymClass gc
        LEFT JOIN FETCH gc.coach c
        LEFT JOIN FETCH c.user u
        LEFT JOIN FETCH gc.room r
        WHERE ce.member.userId = :memberId
          AND (:status IS NULL OR LOWER(ce.status) = LOWER(:status))
        ORDER BY ce.enrolledAt DESC
    """)
    List<ClassEnrollment> findByMemberUserIdWithDetails(
            @Param("memberId") Long memberId,
            @Param("status") String status);

    /** SCRUM-73 BR-03: a member may only hold one active booking per class. */
    Optional<ClassEnrollment> findByGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);
}
