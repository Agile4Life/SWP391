package com.swp391.scms.attendance.repository;

import com.swp391.scms.attendance.entity.CenterCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CenterCheckinRepository extends JpaRepository<CenterCheckin, Long> {

    @Query("select c.checkInTime from CenterCheckin c where c.member.userId = :memberId "
            + "and c.status = 'GRANTED' and c.checkInTime <= :until order by c.checkInTime")
    List<LocalDateTime> findGrantedVisitTimes(@Param("memberId") Long memberId,
                                            @Param("until") LocalDateTime until);

    /**
     * A granted visit that was inside the center while a session ran: it began no earlier than {@code earliest} (a
     * bound so a forgotten checkout from the morning does not cover an evening class), no later than the session end,
     * and was still open or ended after the session start. Returns the earliest such check-in time.
     */
    @Query("select min(c.checkInTime) from CenterCheckin c where c.member.userId = :memberId and c.status = 'GRANTED' "
            + "and c.checkInTime >= :earliest and c.checkInTime <= :end "
            + "and (c.checkOutTime is null or c.checkOutTime >= :start)")
    LocalDateTime findCoveringVisitStart(@Param("memberId") Long memberId, @Param("earliest") LocalDateTime earliest,
                                         @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CenterCheckin c where c.id = :id")
    Optional<CenterCheckin> findByIdForUpdate(@Param("id") Long id);

    boolean existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(Long memberId, String status);

    default boolean existsByMemberUserIdAndCheckOutTimeIsNull(Long memberId) {
        return existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(memberId, "GRANTED");
    }

    Optional<CenterCheckin> findFirstByMemberUserIdAndStatusAndCheckOutTimeIsNullOrderByCheckInTimeDesc(
            Long memberId, String status);

    default Optional<CenterCheckin> findFirstByMemberUserIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(Long memberId) {
        return findFirstByMemberUserIdAndStatusAndCheckOutTimeIsNullOrderByCheckInTimeDesc(memberId, "GRANTED");
    }

    List<CenterCheckin> findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
            LocalDateTime start, LocalDateTime end);

    List<CenterCheckin> findByMemberUserIdAndCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
            Long memberId, LocalDateTime start, LocalDateTime end);

    List<CenterCheckin> findByMemberUserIdAndStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(
            Long memberId, String status, LocalDateTime cutoff);

    List<CenterCheckin> findByStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(
            String status, LocalDateTime cutoff);

    boolean existsByMemberUserIdAndCheckInTimeGreaterThanEqual(Long memberId, LocalDateTime since);
}
