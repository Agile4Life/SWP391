package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, Long> {

    List<ClassEnrollment> findByMemberUserId(Long memberId);

    List<ClassEnrollment> findByGymClassId(Long classId);

    Optional<ClassEnrollment> findByGymClassIdAndMemberUserId(Long classId, Long memberId);

    long countByGymClassIdAndStatus(Long classId, String status);

    /** SCRUM-73 BR-03: a member may only hold one active booking per class. */
    Optional<ClassEnrollment> findByGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);
}
