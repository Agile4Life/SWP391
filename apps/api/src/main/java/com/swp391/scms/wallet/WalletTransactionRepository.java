package com.swp391.scms.wallet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    List<WalletTransaction> findTop50ByWallet_IdOrderByCreatedAtDescIdDesc(Long walletId);

    boolean existsByWallet_IdAndReferenceId(Long walletId, String referenceId);

    /** Automatic refunds of VNPay money confirmed too late: wallet credits keyed by the gateway reference. */
    String LATE_REFUND_FILTER = "(w.referenceType = 'VNPAY_LATE_REFUND' or w.referenceId like 'ORDER!_LATE!_REFUND!_%' escape '!')";

    @org.springframework.data.jpa.repository.Query(
            value = "select w from WalletTransaction w join fetch w.wallet wa join fetch wa.user where " + LATE_REFUND_FILTER
                    + " and w.createdAt >= :from and w.createdAt < :to order by w.createdAt desc, w.id desc",
            countQuery = "select count(w) from WalletTransaction w where " + LATE_REFUND_FILTER
                    + " and w.createdAt >= :from and w.createdAt < :to")
    org.springframework.data.domain.Page<WalletTransaction> findLateRefunds(
            @org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
            @org.springframework.data.repository.query.Param("to") java.time.LocalDateTime to,
            org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("select count(w) from WalletTransaction w where " + LATE_REFUND_FILTER
            + " and w.createdAt >= :from and w.createdAt < :to")
    long countLateRefunds(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
                          @org.springframework.data.repository.query.Param("to") java.time.LocalDateTime to);

    @org.springframework.data.jpa.repository.Query("select coalesce(sum(w.amount), 0) from WalletTransaction w where " + LATE_REFUND_FILTER
            + " and w.createdAt >= :from and w.createdAt < :to")
    java.math.BigDecimal sumLateRefunds(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
                                        @org.springframework.data.repository.query.Param("to") java.time.LocalDateTime to);

    List<WalletTransaction> findAllByReferenceIdInOrderByCreatedAtAscIdAsc(java.util.Collection<String> referenceIds);
}
