package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.Payment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Truy cập bảng payments (khoản thanh toán). */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    @EntityGraph(attributePaths = {"member", "member.user", "receivedBy"})
    List<Payment> findByNoteAndStatusOrderByPaidAtDesc(String note, String status);

    List<Payment> findBySubscriptionIdIsNotNullAndStatusInOrderByPaidAtDesc(List<String> statuses);


    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice", "member", "member.user", "receivedBy"})
    List<Payment> findByMemberUserId(Long memberId);

    /** Tìm các bản ghi có id = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @Override
    @EntityGraph(attributePaths = {"invoice", "member", "member.user", "receivedBy"})
    Optional<Payment> findById(Long id);

    /** Lấy khoản thu và khóa dòng để ghi (FOR UPDATE), tránh hai luồng cập nhật trạng thái đồng thời. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id")
    Optional<Payment> findByIdForUpdate(@Param("id") Long id);

    /** Tìm các bản ghi có status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByStatus(String status);

    /** Tìm các bản ghi có subscriptionId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice"})
    Optional<Payment> findBySubscriptionId(Long subscriptionId);

    /** Tìm các bản ghi có subscriptionId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findAllBySubscriptionId(Long subscriptionId);

    /**
     * Tìm các bản ghi có subscriptionId đã có giá trị và status thuộc danh sách tham số và paidAt ≥ tham số,
     * sắp xếp theo paidAt giảm dần (Spring Data tự sinh truy vấn từ tên hàm).
     *
     * Các thanh toán membership đã tất toán từ một thời điểm, mới nhất trước: lịch sử các yêu cầu đã xử lý
     * của quầy.
     */
    List<Payment> findBySubscriptionIdIsNotNullAndStatusInAndPaidAtGreaterThanEqualOrderByPaidAtDesc(
            java.util.Collection<String> statuses, java.time.LocalDateTime since);

    /**
     * Tìm các bản ghi có note = tham số và status = tham số và paidAt ≥ tham số, sắp xếp theo paidAt giảm dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     *
     * Các khoản nạp ví thu tại quầy từ một thời điểm, mới nhất trước.
     */
    @EntityGraph(attributePaths = {"member", "member.user", "receivedBy"})
    List<Payment> findByNoteAndStatusAndPaidAtGreaterThanEqualOrderByPaidAtDesc(
            String note, String status, java.time.LocalDateTime since);

    /** Tìm các bản ghi có coachBookingId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<Payment> findAllByCoachBookingId(Long coachBookingId);
    /** Tìm các bản ghi có productOrderId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<Payment> findAllByProductOrderId(Long productOrderId);

    /**
     * Kiểm tra có tồn tại bản ghi có subscriptionId = tham số và status = tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    boolean existsBySubscriptionIdAndStatus(Long subscriptionId, String status);

    @Query("""
            select (count(p) > 0) from Payment p join p.classEnrollment e
            where p.member.userId = :memberId and e.status = 'booked'
              and p.status in ('pending', 'success')
              and (not exists (select s.id from ClassSession s where s.gymClass = e.gymClass)
                or exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                  and s.status = 'scheduled'
                  and (s.sessionDate > :today or (s.sessionDate = :today and s.endTime >= :nowTime))))
            """)
    /**
     * Hội viên còn khoản thu khóa học (đang chờ hoặc đã trả) cho đăng ký đang giữ chỗ mà khóa chưa diễn ra hết
     * không; dùng khi xét hủy gói.
     */
    boolean hasUnsettledUpcomingEnrollmentPayment(@Param("memberId") Long memberId,
            @Param("today") java.time.LocalDate today, @Param("nowTime") java.time.LocalTime nowTime);

    /** Tìm các bản ghi có classEnrollmentId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice"})
    Optional<Payment> findByClassEnrollmentId(Long classEnrollmentId);

    /** Tìm mọi khoản thanh toán gắn với một lượt ghi danh khóa học. */
    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findAllByClassEnrollmentId(Long classEnrollmentId);

    /**
     * Đóng nguyên tử khoản nạp ví đang chờ khi không còn lượt VNPay chờ hoặc thành công nào.
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            update Payment p
            set p.status = 'failed'
            where p.id = :paymentId
              and p.status = 'pending'
              and p.note like 'WALLET_TOPUP%'
              and not exists (
                  select t.reference from VnpayTransaction t
                  where t.payment.id = :paymentId and t.status in ('pending', 'success')
              )
            """)
    int failOrphanPendingWalletTopup(@Param("paymentId") Long paymentId);

    /**
     * Các khoản học phí khóa học đang chờ được tạo trước mốc thời gian (để tự hủy khi quá hạn).
     *
     * Các phí khóa học chưa trả (pending, gắn với ghi danh lớp) được tạo trước mốc cutoff.
     */
    @org.springframework.data.jpa.repository.Query("select p from Payment p where p.status = 'pending' and p.classEnrollmentId is not null and p.createdAt < :before")
    java.util.List<Payment> findPendingCourseFeesCreatedBefore(@org.springframework.data.repository.query.Param("before") java.time.LocalDateTime before);

    /**
     * Kiểm tra có tồn tại bản ghi có classEnrollmentGymClassId = tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    boolean existsByClassEnrollmentGymClassId(Long classId);

    /**
     * Tìm các bản ghi có status = tham số và paidAt nằm trong khoảng hai tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByStatusAndPaidAtBetween(String status, java.time.LocalDateTime start, java.time.LocalDateTime end);

    /** Tìm các bản ghi có paidAt nằm trong khoảng hai tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByPaidAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và paidAt ≥ tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    boolean existsByMemberUserIdAndPaidAtGreaterThanEqual(Long memberId, java.time.LocalDateTime since);

    /**
     * Thanh toán online tự phục vụ (không có thu ngân) bị đánh dấu đã trả mà không có lần thử VNPay thành
     * công và không có khoản trừ ví {@code WALLET_PAY_<id>}: không bao giờ được xảy ra.
     */
    @Query("""
            select count(p) from Payment p
            where p.status = 'success' and p.method = 'online_wallet' and p.receivedBy is null
              and not exists (select t from VnpayTransaction t where t.payment = p and t.status = 'success')
              and not exists (select w from WalletTransaction w
                              where w.referenceId = concat('WALLET_PAY_', cast(p.id as String)))
            """)
    /**
     * Đếm khoản thanh toán online được đánh dấu đã trả mà không có lượt VNPay thành công lẫn bút toán trừ ví:
     * lẽ ra không bao giờ xảy ra (dùng cho đối soát).
     */
    long countOnlinePaymentsWithoutSource();
}
