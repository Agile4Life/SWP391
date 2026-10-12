package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassWaitlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassWaitlistRepository extends JpaRepository<ClassWaitlist, Long> {

    List<ClassWaitlist> findByMemberUserIdOrderByRequestedAtAsc(Long memberId);

    Optional<ClassWaitlist> findByGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);

    /** SCRUM-74 BR-04: FIFO ordering by requested_at. */
    List<ClassWaitlist> findByGymClassIdAndStatusOrderByRequestedAtAsc(Long classId, String status);

    long countByGymClassIdAndStatus(Long classId, String status);
}
