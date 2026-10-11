package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MembershipSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MembershipSubscriptionRepository extends JpaRepository<MembershipSubscription, Long> {

    List<MembershipSubscription> findByMemberUserId(Long memberId);

    List<MembershipSubscription> findByMemberUserIdOrderByCreatedAtDesc(Long memberId);

    Optional<MembershipSubscription> findByQrCode(String qrCode);

    List<MembershipSubscription> findByMemberUserIdAndStatus(Long memberId, String status);

    boolean existsByMemberUserIdAndStatus(Long memberId, String status);

    boolean existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(Long memberId, String status, LocalDate date);

    boolean existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            Long memberId, String status, LocalDate startDate, LocalDate endDate);

    Optional<MembershipSubscription> findFirstByMemberUserIdAndStatusOrderByEndDateDesc(Long memberId, String status);
}
