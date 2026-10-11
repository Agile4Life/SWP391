package com.swp391.scms.attendance.repository;

import com.swp391.scms.attendance.entity.CenterCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CenterCheckinRepository extends JpaRepository<CenterCheckin, Long> {

    boolean existsByMemberUserIdAndCheckOutTimeIsNull(Long memberId);

    Optional<CenterCheckin> findFirstByMemberUserIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(Long memberId);

    List<CenterCheckin> findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
            LocalDateTime start, LocalDateTime end);
}
