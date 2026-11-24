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

/** Truy cập bảng vnpay_transactions (các lượt thanh toán VNPay), hỗ trợ truy vấn động. */
public interface VnpayTransactionRepository extends JpaRepository<VnpayTransaction, String>, JpaSpecificationExecutor<VnpayTransaction> {
    /**
     * Tìm các bản ghi có paymentId = tham số và status = tham số, sắp xếp theo createdAt giảm dần (chỉ lấy bản
     * ghi đầu tiên) (Spring Data tự sinh truy vấn từ tên hàm).
     */
    Optional<VnpayTransaction> findFirstByPaymentIdAndStatusOrderByCreatedAtDesc(Long paymentId, String status);
    /** Tìm các bản ghi có paymentId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<VnpayTransaction> findAllByPaymentId(Long paymentId);
    /**
     * Kiểm tra có tồn tại bản ghi có paymentId = tham số và status = tham số (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    boolean existsByPaymentIdAndStatus(Long paymentId, String status);
    /** Kiểm tra có tồn tại bản ghi có paymentId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByPaymentId(Long paymentId);

    /** Các thanh toán có lần thử đang chờ mà hạn của cổng đã qua trước {@code cutoff}. */
    @Query("""
            select distinct t.payment.id from VnpayTransaction t
            where t.status = 'pending' and t.expiresAt < :cutoff
            """)
    /** Id các khoản thu có lượt VNPay đang chờ đã hết hạn trước mốc (để đóng lượt bị bỏ dở). */
    List<Long> findPaymentIdsWithPendingExpiredBefore(@Param("cutoff") LocalDateTime cutoff);

    // --- Đối soát dành cho quản trị viên (chỉ đọc) ---

    /** Lượt VNPay theo điều kiện động, nạp sẵn khoản thu và hội viên (cho màn đối soát). */
    @Override
    @EntityGraph(attributePaths = {"payment", "payment.member", "payment.member.user"})
    Page<VnpayTransaction> findAll(Specification<VnpayTransaction> spec, Pageable pageable);

    /** Đếm số bản ghi có status = tham số và expiresAt trước tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByStatusAndExpiresAtBefore(String status, LocalDateTime cutoff);

    /** Đếm số bản ghi có status = tham số và expiresAt ≥ tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByStatusAndExpiresAtGreaterThanEqual(String status, LocalDateTime cutoff);

    /** Các thanh toán có từ hai lần thử trở lên, ít nhất một lần tạo trong {@code [from, to)}. */
    @Query("""
            select count(p) from Payment p
            where (select count(t) from VnpayTransaction t where t.payment = p) > 1
              and exists (select t2 from VnpayTransaction t2 where t2.payment = p
                          and t2.createdAt >= :from and t2.createdAt < :to)
            """)
    /** Số khoản thu có từ hai lượt VNPay trở lên, có ít nhất một lượt tạo trong khoảng thời gian. */
    long countMultiAttemptPayments(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Các lần thử thành công mà thanh toán không phải đã trả cũng không phải đã hoàn: không bao giờ được xảy
     * ra.
     */
    @Query("""
            select count(t) from VnpayTransaction t
            where t.status = 'success' and t.payment.status not in ('success', 'refunded')
            """)
    /** Số lượt VNPay thành công mà khoản thu chưa trả hoặc chưa hoàn: lẽ ra không bao giờ xảy ra. */
    long countSuccessAttemptsOnUnpaidPayments();

    /** Các dòng {@code [paymentId, attemptCount]} cho các thanh toán đã cho. */
    @Query("""
            select t.payment.id, count(t) from VnpayTransaction t
            where t.payment.id in :paymentIds group by t.payment.id
            """)
    /** Số lượt VNPay của từng khoản thu (cặp [id khoản thu, số lượt]). */
    List<Object[]> countAttemptsByPaymentIds(@Param("paymentIds") Collection<Long> paymentIds);

    /** Tìm các bản ghi có reference thuộc danh sách tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"payment"})
    List<VnpayTransaction> findAllByReferenceIn(Collection<String> references);
}
