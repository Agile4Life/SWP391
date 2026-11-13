package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.VnpayTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VnpayTransactionRepository extends JpaRepository<VnpayTransaction, String>, JpaSpecificationExecutor<VnpayTransaction> {
    Optional<VnpayTransaction> findFirstByPaymentIdAndStatusOrderByCreatedAtDesc(Long paymentId, String status);
    List<VnpayTransaction> findAllByPaymentId(Long paymentId);
    boolean existsByPaymentIdAndStatus(Long paymentId, String status);
    boolean existsByPaymentId(Long paymentId);

    /** Payments with a pending attempt whose gateway expiry passed before {@code cutoff}. */
    @Query("""
            select distinct t.payment.id from VnpayTransaction t
            where t.status = 'pending' and t.expiresAt < :cutoff
            """)
    List<Long> findPaymentIdsWithPendingExpiredBefore(@Param("cutoff") LocalDateTime cutoff);

    // --- Admin reconciliation (read only) ---

    @Override
    @EntityGraph(attributePaths = {"payment", "payment.member", "payment.member.user"})
    Page<VnpayTransaction> findAll(Specification<VnpayTransaction> spec, Pageable pageable);

    long countByStatusAndExpiresAtBefore(String status, LocalDateTime cutoff);

    long countByStatusAndExpiresAtGreaterThanEqual(String status, LocalDateTime cutoff);

    /** Payments with two or more attempts, at least one of them created in {@code [from, to)}. */
    @Query("""
            select count(p) from Payment p
            where (select count(t) from VnpayTransaction t where t.payment = p) > 1
              and exists (select t2 from VnpayTransaction t2 where t2.payment = p
                          and t2.createdAt >= :from and t2.createdAt < :to)
            """)
    long countMultiAttemptPayments(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Successful attempts whose payment is neither paid nor refunded: should never happen. */
    @Query("""
            select count(t) from VnpayTransaction t
            where t.status = 'success' and t.payment.status not in ('success', 'refunded')
            """)
    long countSuccessAttemptsOnUnpaidPayments();

    /** Rows of {@code [paymentId, attemptCount]} for the given payments. */
    @Query("""
            select t.payment.id, count(t) from VnpayTransaction t
            where t.payment.id in :paymentIds group by t.payment.id
            """)
    List<Object[]> countAttemptsByPaymentIds(@Param("paymentIds") Collection<Long> paymentIds);

    @EntityGraph(attributePaths = {"payment"})
    List<VnpayTransaction> findAllByReferenceIn(Collection<String> references);
}
