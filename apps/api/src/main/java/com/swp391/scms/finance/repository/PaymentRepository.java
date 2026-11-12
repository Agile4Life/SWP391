package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.Payment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    @EntityGraph(attributePaths = {"invoice", "member", "member.user", "receivedBy"})
    List<Payment> findByMemberUserId(Long memberId);

    @Override
    @EntityGraph(attributePaths = {"invoice", "member", "member.user", "receivedBy"})
    Optional<Payment> findById(Long id);

    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByStatus(String status);

    @EntityGraph(attributePaths = {"invoice"})
    Optional<Payment> findBySubscriptionId(Long subscriptionId);

    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findAllBySubscriptionId(Long subscriptionId);

    /** Membership payments settled since a moment, newest first: the desk's history of processed requests. */
    List<Payment> findBySubscriptionIdIsNotNullAndStatusInAndPaidAtGreaterThanEqualOrderByPaidAtDesc(
            java.util.Collection<String> statuses, java.time.LocalDateTime since);

    /** Wallet top-ups taken at the front desk since a moment, newest first. */
    @EntityGraph(attributePaths = {"member", "member.user", "receivedBy"})
    List<Payment> findByNoteAndStatusAndPaidAtGreaterThanEqualOrderByPaidAtDesc(
            String note, String status, java.time.LocalDateTime since);

    List<Payment> findAllByCoachBookingId(Long coachBookingId);
    List<Payment> findAllByCourtBookingId(Long courtBookingId);
    List<Payment> findAllByProductOrderId(Long productOrderId);

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
    boolean hasUnsettledUpcomingEnrollmentPayment(@Param("memberId") Long memberId,
            @Param("today") java.time.LocalDate today, @Param("nowTime") java.time.LocalTime nowTime);

    @EntityGraph(attributePaths = {"invoice"})
    Optional<Payment> findByClassEnrollmentId(Long classEnrollmentId);

    /** Unpaid course fees (pending, tied to a class enrollment) created before the cutoff. */
    @org.springframework.data.jpa.repository.Query("select p from Payment p where p.status = 'pending' and p.classEnrollmentId is not null and p.createdAt < :before")
    java.util.List<Payment> findPendingCourseFeesCreatedBefore(@org.springframework.data.repository.query.Param("before") java.time.LocalDateTime before);

    boolean existsByClassEnrollmentGymClassId(Long classId);

    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByStatusAndPaidAtBetween(String status, java.time.LocalDateTime start, java.time.LocalDateTime end);

    @EntityGraph(attributePaths = {"invoice"})
    List<Payment> findByPaidAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);

    boolean existsByMemberUserIdAndPaidAtGreaterThanEqual(Long memberId, java.time.LocalDateTime since);
}
