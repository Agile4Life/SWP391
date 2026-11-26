package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.CoachBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Truy cập dữ liệu booking PT 1:1 (bảng coach_bookings): tìm theo HLV/hội viên/ngày, đếm hạn mức, điểm danh,
 * thanh toán và job nền.
 */
@Repository
public interface CoachBookingRepository extends JpaRepository<CoachBooking, Long> {
    @Query("""
            select b from CoachBooking b join fetch b.member m join fetch m.user u
            left join fetch b.discipline
            where b.coach.userId = :coachId and b.status = 'confirmed'
              and (b.bookingDate > :today or (b.bookingDate = :today and b.startTime > :now))
              and u.deletedAt is null and u.status = 'active'
            order by b.bookingDate, b.startTime
            """)
    /**
     * Buổi PT confirmed sắp tới của một HLV (sau thời điểm hiện tại) với hội viên còn hoạt động, kèm hội viên
     * và bộ môn, sắp theo ngày giờ.
     */
    List<CoachBooking> findCurrentAssignments(@Param("coachId") Long coachId, @Param("today") LocalDate today,
            @Param("now") LocalTime now);
    /** Kiểm tra có tồn tại bản ghi có disciplineId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByDisciplineId(Long disciplineId);


    @Query("""
            select cb from CoachBooking cb
            join fetch cb.coach c
            join fetch c.user cu
            left join fetch cb.discipline d
            where cb.member.userId = :memberId
            order by cb.bookingDate desc, cb.startTime desc
            """)
    /** Toàn bộ booking của một hội viên kèm HLV và bộ môn, mới nhất trước. */
    List<CoachBooking> findByMemberId(@Param("memberId") Long memberId);

    @Query("""
            select cb from CoachBooking cb
            join fetch cb.member m
            join fetch m.user mu
            left join fetch cb.discipline d
            where cb.coach.userId = :coachId
            order by cb.bookingDate desc, cb.startTime desc
            """)
    /** Toàn bộ booking của một HLV kèm hội viên và bộ môn, mới nhất trước. */
    List<CoachBooking> findByCoachId(@Param("coachId") Long coachId);

    @Query("""
            select cb from CoachBooking cb
            where cb.coach.userId = :coachId
              and cb.bookingDate = :date
              and cb.status in ('confirmed', 'completed')
            """)
    /** Booking confirmed/completed của HLV trong một ngày, dùng để kiểm tra slot bận. */
    List<CoachBooking> findActiveByCoachAndDate(@Param("coachId") Long coachId, @Param("date") LocalDate date);

    @Query("""
            select cb from CoachBooking cb
            where cb.member.userId = :memberId
              and cb.bookingDate = :date
              and cb.status = 'confirmed'
            """)
    /** Booking confirmed của hội viên trong một ngày, dùng để chặn hội viên đặt trùng giờ. */
    List<CoachBooking> findActiveByMemberAndDate(@Param("memberId") Long memberId, @Param("date") LocalDate date);

    @Query("""
            select count(cb) from CoachBooking cb
            where cb.member.userId = :memberId
              and cb.bookingDate between :startDate and :endDate
              and cb.paymentMethod = :paymentMethod
              and (cb.status <> 'cancelled' or coalesce(cb.quotaForfeited, false) = true)
            """)
    /**
     * Đếm số buổi đã dùng hạn mức trong khoảng ngày theo phương thức thanh toán; buổi hủy nhưng bị mất lượt vẫn
     * được tính.
     */
    long countMonthlyQuotaUsage(
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("paymentMethod") String paymentMethod
    );

    @Query("""
            select count(cb) from CoachBooking cb left join cb.subscription s
            where cb.member.userId = :memberId
              and cb.bookingDate between :startDate and :endDate
              and cb.paymentMethod = :paymentMethod
              and (cb.status <> 'cancelled' or coalesce(cb.quotaForfeited, false) = true)
              and (s.id in :subscriptionIds
                   or (s.id is null and cb.createdAt >= :subCreatedAt))
            """)
    /**
     * Như countMonthlyQuotaUsage nhưng chỉ tính buổi thuộc các subscription truyền vào (hoặc buổi cũ chưa gắn
     * subscription tạo sau subCreatedAt).
     */
    long countSubscriptionQuotaUsage(
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("paymentMethod") String paymentMethod,
            @Param("subscriptionIds") java.util.Collection<Long> subscriptionIds,
            @Param("subCreatedAt") LocalDateTime subCreatedAt
    );
    /** Buổi 1:1 chưa hủy của mọi HLV trong khoảng ngày, mới nhất trước (màn điểm danh của lễ tân). */
    @Query("""
            select cb from CoachBooking cb
            where cb.status <> 'cancelled' and cb.bookingDate between :fromDate and :toDate
            order by cb.bookingDate desc, cb.startTime desc
            """)
    List<CoachBooking> findForAttendance(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    /** Buổi 1:1 chưa hủy của một HLV trong khoảng ngày, mới nhất trước. */
    @Query("""
            select cb from CoachBooking cb
            where cb.status <> 'cancelled' and cb.coach.userId = :coachId
              and cb.bookingDate between :fromDate and :toDate
            order by cb.bookingDate desc, cb.startTime desc
            """)
    List<CoachBooking> findForAttendanceByCoach(@Param("coachId") Long coachId,
                                                @Param("fromDate") LocalDate fromDate,
                                                @Param("toDate") LocalDate toDate);


    /** Buổi PT confirmed trong khoảng ngày kèm HLV; trigger lịch dùng để đối chiếu trùng với buổi lớp. */
    @Query("""
            select cb from CoachBooking cb join fetch cb.coach
            where cb.bookingDate between :fromDate and :toDate and cb.status = 'confirmed'
            """)
    List<CoachBooking> findConfirmedBetween(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    @Query("""
            select cb from CoachBooking cb
            where cb.member.userId = :memberId
              and cb.bookingDate >= :today
              and cb.status = 'confirmed'
            """)
    /** Buổi confirmed của hội viên từ hôm nay trở đi. */
    List<CoachBooking> findFutureConfirmedByMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    /**
     * Đếm buổi 1:1 trả theo giờ của hội viên còn chờ thanh toán (đã qua hoặc sắp tới, trạng thái confirmed/completed);
     * chỉ hủy hoặc thanh toán mới xóa được.
     */
    @Query("""
            select count(cb) from CoachBooking cb
            where cb.member.userId = :memberId
              and cb.paymentStatus = 'pending'
              and cb.status in ('confirmed', 'completed')
            """)
    long countUnpaid(@Param("memberId") Long memberId);

    @Query("""
            select cb from CoachBooking cb
            join fetch cb.member m join fetch m.user mu
            join fetch cb.coach c join fetch c.user cu
            left join fetch cb.discipline d
            where cb.paymentStatus = 'pending' and cb.status in ('confirmed', 'completed')
            order by cb.bookingDate asc, cb.startTime asc, cb.id asc
            """)
    /**
     * Danh sách buổi 1:1 chờ thanh toán kèm hội viên, HLV, bộ môn, sắp theo ngày giờ tăng dần (màn thu tiền của
     * lễ tân).
     */
    List<CoachBooking> findUnpaid();

    /** Buổi PT confirmed sắp tới của một hội viên với một HLV, khóa dòng để điều chuyển cả nhóm một lần. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select b from CoachBooking b
            where b.coach.userId = :coachId and b.member.userId = :memberId and b.status = 'confirmed'
              and (b.bookingDate > :today or (b.bookingDate = :today and b.startTime > :now))
            order by b.bookingDate, b.startTime
            """)
    List<CoachBooking> findUpcomingForMemberAndCoachForUpdate(@Param("coachId") Long coachId, @Param("memberId") Long memberId,
            @Param("today") LocalDate today, @Param("now") LocalTime now);

    /** Lấy booking theo id và khóa dòng (PESSIMISTIC_WRITE) để tránh hai request cùng sửa một booking. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select cb from CoachBooking cb where cb.id = :id")
    java.util.Optional<CoachBooking> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select (count(cb) > 0) from CoachBooking cb
            where cb.coach.userId = :coachId and cb.member.userId = :memberId and cb.status <> 'cancelled'
            """)
    /** Kiểm tra HLV và hội viên có từng có buổi 1:1 chưa hủy với nhau không. */
    boolean existsForCoachAndMember(@Param("coachId") Long coachId, @Param("memberId") Long memberId);

    /** Id các hội viên còn buổi PT confirmed từ hôm nay trở đi (không trùng lặp). */
    @Query("select distinct cb.member.userId from CoachBooking cb where cb.status = 'confirmed' and cb.bookingDate >= :today")
    List<Long> findMemberIdsWithUpcomingSessions(@Param("today") LocalDate today);

    @Query("""
            select (count(cb) > 0) from CoachBooking cb
            where cb.member.userId = :memberId and cb.status = 'confirmed' and cb.bookingDate >= :today
            """)
    /** Kiểm tra hội viên còn buổi PT confirmed sắp tới không. */
    boolean existsUpcomingForMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    @Query("""
            select (count(cb) > 0) from CoachBooking cb
            where cb.coach.userId = :coachId and cb.status = 'confirmed' and cb.bookingDate >= :today
            """)
    /** Kiểm tra HLV còn buổi PT confirmed sắp tới không. */
    boolean existsUpcomingForCoach(@Param("coachId") Long coachId, @Param("today") LocalDate today);

    @Query("""
            select count(cb) from CoachBooking cb
            where cb.coach.userId = :coachId and cb.status = 'confirmed'
              and cb.bookingDate between :startDate and :endDate
            """)
    /** Đếm buổi PT confirmed của HLV trong khoảng ngày. */
    long countConfirmedForCoachBetween(@Param("coachId") Long coachId, @Param("startDate") LocalDate startDate,
                                       @Param("endDate") LocalDate endDate);

    /**
     * Chuyển các buổi 1:1 confirmed diễn ra trước ngày {@code cutoff} sang completed; trả về số dòng cập nhật.
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("update CoachBooking cb set cb.status = 'completed' where cb.status = 'confirmed' and cb.bookingDate < :cutoff")
    int completeHeldBefore(@Param("cutoff") LocalDate cutoff);

    /**
     * Buổi 1:1 trả theo giờ ở trạng thái confirmed còn chưa thanh toán quá thời gian giữ chỗ, hoặc đã giữ tối thiểu
     * mà quá sát giờ bắt đầu; job hết hạn sẽ nhả các buổi này.
     */
    @Query("""
            select cb from CoachBooking cb
            where cb.status = 'confirmed'
              and cb.paymentStatus = 'pending'
              and cb.paymentMethod <> 'package_quota'
              and (
                    cb.createdAt < :createdCutoff
                 or (cb.createdAt < :minHoldCutoff
                     and (cb.bookingDate < :dueDate or (cb.bookingDate = :dueDate and cb.startTime <= :dueTime)))
              )
            """)
    List<CoachBooking> findUnpaidStale(
            @Param("createdCutoff") LocalDateTime createdCutoff,
            @Param("minHoldCutoff") LocalDateTime minHoldCutoff,
            @Param("dueDate") LocalDate dueDate,
            @Param("dueTime") LocalTime dueTime);
}
