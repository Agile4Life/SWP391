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

/** Truy cập bảng membership_subscriptions (các kỳ gói tập của hội viên). */
@Repository
public interface MembershipSubscriptionRepository extends JpaRepository<MembershipSubscription, Long> {
    /** Kiểm tra có tồn tại bản ghi có membershipPackageId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByMembershipPackageId(Long packageId);


    /** Lấy kỳ gói và khóa dòng để ghi (FOR UPDATE). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MembershipSubscription s where s.id = :id")
    Optional<MembershipSubscription> findByIdForUpdate(@Param("id") Long id);

    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<MembershipSubscription> findByMemberUserId(Long memberId);

    /** Tìm các bản ghi có qrCode = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @Lock(LockModeType.PESSIMISTIC_READ)
    Optional<MembershipSubscription> findByQrCode(String qrCode);

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<MembershipSubscription> findByMemberUserIdOrderByCreatedAtDesc(Long memberId);

    /**
     * Tìm các bản ghi có status = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<MembershipSubscription> findByStatusOrderByCreatedAtDesc(String status);

    /**
     * Tìm các bản ghi có status = tham số và updatedAt ≥ tham số, sắp xếp theo updatedAt giảm dần (Spring Data
     * tự sinh truy vấn từ tên hàm).
     */
    List<MembershipSubscription> findByStatusAndUpdatedAtGreaterThanEqualOrderByUpdatedAtDesc(String status, java.time.LocalDateTime since);

    /**
     * Tìm các bản ghi có holdStatus = tham số, sắp xếp theo holdRequestedAt giảm dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    List<MembershipSubscription> findByHoldStatusOrderByHoldRequestedAtDesc(String holdStatus);

    /** Tìm các bản ghi có memberUserId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<MembershipSubscription> findByMemberUserIdAndStatus(Long memberId, String status);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status = tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatus(Long memberId, String status);

    /** Kiểm tra có tồn tại bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByMemberUserId(Long memberId);

    /**
     * Kiểm tra có tồn tại bản ghi có previousSubscriptionId = tham số và status thuộc danh sách tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByPreviousSubscriptionIdAndStatusIn(Long previousId, java.util.Collection<String> statuses);

    @Query("""
            select count(s) from MembershipSubscription s
            where s.endDate between :start and :end and s.status in ('active', 'expired')
              and exists (select p.id from Payment p where p.subscriptionId = s.id and p.status = 'success')
            """)
    /**
     * Đếm số kỳ đã trả tiền (active/expired, có thanh toán thành công) kết thúc trong khoảng ngày; dùng tính tỷ
     * lệ gia hạn.
     */
    long countExpiredPaidPeriods(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("""
            select count(s) from MembershipSubscription s
            where s.endDate between :start and :end and s.status in ('active', 'expired')
              and exists (select p.id from Payment p where p.subscriptionId = s.id and p.status = 'success')
              and exists (select next.id from MembershipSubscription next
                  where next.previousSubscription = s and next.status in ('active', 'expired', 'frozen')
                    and exists (select p2.id from Payment p2 where p2.subscriptionId = next.id and p2.status = 'success'))
            """)
    /**
     * Đếm số kỳ đã trả tiền kết thúc trong khoảng ngày và đã có kỳ tiếp theo cũng được trả tiền; dùng tính tỷ
     * lệ gia hạn.
     */
    long countRenewedExpiredPaidPeriods(@Param("start") LocalDate start, @Param("end") LocalDate end);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status = tham số và endDate ≥ tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(Long memberId, String status, LocalDate date);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status = tham số và startDate ≤ tham số và
     * endDate ≥ tham số (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            Long memberId, String status, LocalDate startDate, LocalDate endDate);

    /**
     * Tìm các bản ghi có memberUserId = tham số và status = tham số, sắp xếp theo endDate giảm dần (chỉ lấy bản
     * ghi đầu tiên) (Spring Data tự sinh truy vấn từ tên hàm).
     */
    Optional<MembershipSubscription> findFirstByMemberUserIdAndStatusOrderByEndDateDesc(Long memberId,
            String status);

    /**
     * Tìm các bản ghi có memberUserId = tham số và status = tham số và startDate ≤ tham số và endDate ≥ tham
     * số, sắp xếp theo endDate giảm dần (chỉ lấy bản ghi đầu tiên) (Spring Data tự sinh truy vấn từ tên hàm).
     */
    Optional<MembershipSubscription> findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
            Long memberId, String status, LocalDate todayForStart, LocalDate todayForEnd);

    @Query("""
            select (count(s) > 0) from MembershipSubscription s
            where s.member.userId = :memberId and s.status = 'active'
              and s.startDate <= :date and s.endDate >= :date
            """)
    /** Hội viên có kỳ gói active hiệu lực vào ngày cho trước không. */
    boolean hasActiveMembership(@Param("memberId") Long memberId, @Param("date") LocalDate date);

    @Query("""
            select (count(s) > 0) from MembershipSubscription s
            where s.member.userId = :memberId and s.status = 'active'
              and s.startDate <= :today and s.endDate >= :today
              and s.startDate <= :sessionDate and s.endDate >= :sessionDate
              and (coalesce(s.holdStatus, '') <> 'APPROVED' or s.holdStartDate is null or s.holdEndDate is null
                   or s.holdStartDate > :sessionDate or s.holdEndDate < :sessionDate)
            """)
    /**
     * Hội viên có kỳ gói active hiệu lực cả hôm nay lẫn ngày diễn ra buổi tập, và ngày đó không nằm trong
     * khoảng bảo lưu đã duyệt.
     */
    boolean hasActiveMembershipCoveringSession(@Param("memberId") Long memberId,
                                               @Param("today") LocalDate today,
                                               @Param("sessionDate") LocalDate sessionDate);

    /** True when an approved hold (running or still to start) covers {@code date}; used to say "on hold" instead of "no plan". */
    @Query("""
            select (count(s) > 0) from MembershipSubscription s
            where s.member.userId = :memberId and s.status in ('active', 'frozen')
              and s.holdStatus = 'APPROVED'
              and s.holdStartDate <= :date and s.holdEndDate >= :date
            """)
    /** Có bảo lưu đã duyệt (gói active hoặc frozen) bao phủ ngày cho trước không. */
    boolean existsApprovedHoldCovering(@Param("memberId") Long memberId, @Param("date") LocalDate date);

    @Query("""
            select s from MembershipSubscription s
            join fetch s.member m
            join fetch m.user u
            join fetch s.membershipPackage p
            where s.status = 'active'
              and s.endDate = :endDate
            """)
    /** Các kỳ gói active hết hạn đúng ngày cho trước, nạp sẵn hội viên, tài khoản và gói; dùng gửi nhắc gia hạn. */
    List<MembershipSubscription> findActiveSubscriptionsExpiringOn(@Param("endDate") LocalDate endDate);

    /** A paid, frozen or awaiting-payment period that is still running or ended after {@code since}. */
    @Query("""
            select (count(s) > 0) from MembershipSubscription s
            where s.member.userId = :memberId
              and s.status in ('active', 'expired', 'frozen', 'pending_payment')
              and (s.endDate is null or s.endDate >= :since)
            """)
    /**
     * Hội viên có quyền lợi (active/expired/frozen/chờ thanh toán) kết thúc từ ngày cho trước trở về sau không;
     * dùng khi dọn tài khoản không hoạt động.
     */
    boolean existsEntitlementEndingOnOrAfter(@Param("memberId") Long memberId, @Param("since") LocalDate since);

    /**
     * Tìm các bản ghi có status = tham số và holdStatus = tham số và holdResolvedAt ≤ tham số (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    List<MembershipSubscription> findByStatusAndHoldStatusAndHoldResolvedAtLessThanEqual(
            String status, String holdStatus, java.time.LocalDateTime resolvedBefore);

    /** Approved holds that begin today or earlier but are still running as active memberships. */
    @Query("""
            select s.id from MembershipSubscription s
            where s.status = 'active' and s.holdStatus = 'APPROVED'
              and s.holdStartDate is not null and s.holdStartDate <= :today
            """)
    /** Id các kỳ active có bảo lưu đã duyệt mà ngày bắt đầu bảo lưu đã tới (cần chuyển sang frozen). */
    List<Long> findHoldsDueToStart(@Param("today") LocalDate today);

    /** Frozen memberships whose dated hold has ended before {@code today}. */
    @Query("""
            select s.id from MembershipSubscription s
            where s.status = 'frozen' and s.holdStatus = 'APPROVED'
              and s.holdEndDate is not null and s.holdEndDate < :today
            """)
    /** Id các kỳ frozen có bảo lưu đã duyệt mà ngày kết thúc bảo lưu đã qua (cần tiếp tục lại). */
    List<Long> findDatedHoldsDueForResume(@Param("today") LocalDate today);

    @Query("""
            select s from MembershipSubscription s
            where s.holdStatus is not null or s.holdUsed = true
            order by s.holdRequestedAt desc nulls last, s.id desc
            """)
    /** Các kỳ có yêu cầu bảo lưu hoặc đã từng dùng lượt bảo lưu, mới nhất trước; dùng cho màn lịch sử bảo lưu. */
    List<MembershipSubscription> findAllWithHoldHistory();

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status thuộc danh sách tham số và endDate ≥ tham
     * số (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatusInAndEndDateGreaterThanEqual(
            Long memberId, java.util.Collection<String> statuses, LocalDate date);
}
