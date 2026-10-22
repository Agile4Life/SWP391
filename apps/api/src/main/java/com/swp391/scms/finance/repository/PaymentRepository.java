package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByMemberUserId(Long memberId);

    List<Payment> findByStatus(String status);

    Optional<Payment> findBySubscriptionId(Long subscriptionId);

    List<Payment> findAllBySubscriptionId(Long subscriptionId);

    boolean existsBySubscriptionIdAndStatus(Long subscriptionId, String status);

    Optional<Payment> findByClassEnrollmentId(Long classEnrollmentId);

    List<Payment> findByStatusAndPaidAtBetween(String status, java.time.LocalDateTime start, java.time.LocalDateTime end);

    List<Payment> findByPaidAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);
}
