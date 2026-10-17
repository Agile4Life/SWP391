package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MembershipSubscription;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MembershipSubscriptionRepository extends JpaRepository<MembershipSubscription, Long> {

    List<MembershipSubscription> findByMemberUserId(Long memberId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    Optional<MembershipSubscription> findByQrCode(String qrCode);

    List<MembershipSubscription> findByMemberUserIdOrderByCreatedAtDesc(Long memberId);

    List<MembershipSubscription> findByMemberUserIdAndStatus(Long memberId, String status);

    boolean existsByMemberUserIdAndStatus(Long memberId, String status);

    boolean existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(Long memberId, String status, LocalDate date);

    boolean existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            Long memberId, String status, LocalDate startDate, LocalDate endDate);

    Optional<MembershipSubscription> findFirstByMemberUserIdAndStatusOrderByEndDateDesc(Long memberId,
            String status);

    Optional<MembershipSubscription> findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
            Long memberId, String status, LocalDate todayForStart, LocalDate todayForEnd);

    @Query("""
            select (count(s) > 0) from MembershipSubscription s
            where s.member.userId = :memberId and s.status = 'active'
              and s.startDate <= :date and s.endDate >= :date
            """)
    boolean hasActiveMembership(@Param("memberId") Long memberId, @Param("date") LocalDate date);
}
