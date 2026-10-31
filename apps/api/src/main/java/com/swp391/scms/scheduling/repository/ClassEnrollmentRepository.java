package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.dto.ClassBookingCount;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    @Query("select new com.swp391.scms.scheduling.dto.ClassBookingCount(e.gymClass.id, count(e)) "
            + "from ClassEnrollment e where e.gymClass.id in :classIds and e.status = :status group by e.gymClass.id")
    List<ClassBookingCount> countByClassIdsAndStatus(@Param("classIds") List<Long> classIds, @Param("status") String status);

    /** SCRUM-73 BR-03: a member may only hold one active booking per class. */
    Optional<ClassEnrollment> findByGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"member", "member.user"})
    List<ClassEnrollment> findByGymClassIdAndStatus(Long classId, String status);
}
