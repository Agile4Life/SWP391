package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.dto.SessionBookingCount;
import com.swp391.scms.scheduling.entity.SessionBooking;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Truy cập dữ liệu đặt chỗ buổi học (bảng session_bookings). */
@Repository
public interface SessionBookingRepository extends JpaRepository<SessionBooking, Long> {
    @EntityGraph(attributePaths = {"member", "member.user", "session", "session.gymClass"})
    @Query("""
            select b from SessionBooking b
            where b.session.gymClass.coach.userId = :coachId and b.session.gymClass.status = 'active'
              and b.status = 'booked' and b.session.status = 'scheduled'
              and b.member.user.deletedAt is null and b.member.user.status = 'active'
              and (b.session.sessionDate > :today or (b.session.sessionDate = :today and b.session.startTime > :now))
            order by b.session.sessionDate, b.session.startTime, b.id
            """)
    /** Lượt đặt chỗ còn hiệu lực ở buổi sắp tới của các lớp active do HLV dạy, kèm hội viên còn hoạt động. */
    List<SessionBooking> findCurrentCoachAssignments(@Param("coachId") Long coachId,
            @Param("today") LocalDate today, @Param("now") java.time.LocalTime now);

    /** Lấy lượt đặt chỗ theo id và khóa dòng (PESSIMISTIC_WRITE) để hủy an toàn. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SessionBooking b where b.id = :id")
    Optional<SessionBooking> findByIdForUpdate(@Param("id") Long id);

    /** Lấy id lớp của một lượt đặt chỗ. */
    @Query("select b.session.gymClass.id from SessionBooking b where b.id = :id")
    Optional<Long> findClassIdById(@Param("id") Long id);

    /** Đếm số bản ghi có sessionId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countBySessionIdAndStatus(Long sessionId, String status);

    @Query("select new com.swp391.scms.scheduling.dto.SessionBookingCount(b.session.id, count(b)) "
            + "from SessionBooking b where b.session.gymClass.id = :classId and b.status = 'booked' group by b.session.id")
    /** Đếm lượt đặt chỗ booked của từng buổi trong một lớp. */
    List<SessionBookingCount> countBookedGroupedBySession(@Param("classId") Long classId);

    /**
     * Kiểm tra có tồn tại bản ghi có sessionId = tham số và memberUserId = tham số và status khác tham số
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsBySessionIdAndMemberUserIdAndStatusNot(Long sessionId, Long memberId, String status);

    /**
     * Kiểm tra có tồn tại bản ghi có sessionId = tham số và memberUserId = tham số và status = tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsBySessionIdAndMemberUserIdAndStatus(Long sessionId, Long memberId, String status);

    @Query("select new com.swp391.scms.scheduling.dto.SessionBookingCount(b.session.id, count(b)) "
            + "from SessionBooking b where b.session.id in :sessionIds and b.status = 'booked' group by b.session.id")
    /** Đếm lượt đặt chỗ booked cho nhiều buổi cùng lúc, nhóm theo buổi. */
    List<SessionBookingCount> countBookedBySessionIds(@Param("sessionIds") Collection<Long> sessionIds);

    /** Tìm các bản ghi có sessionId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @EntityGraph(attributePaths = {"member", "member.user"})
    List<SessionBooking> findBySessionIdAndStatus(Long sessionId, String status);

    /**
     * Mọi lượt đặt chỗ booked của một lớp kèm hội viên và buổi.
     *
     * Members holding a booked seat in any session of the class (class-level rosters).
     */
    @EntityGraph(attributePaths = {"member", "member.user", "session"})
    @Query("select b from SessionBooking b where b.session.gymClass.id = :classId and b.status = 'booked'")
    List<SessionBooking> findBookedByClassId(@Param("classId") Long classId);

    @EntityGraph(attributePaths = {"session", "session.gymClass", "session.gymClass.room",
            "session.gymClass.coach", "session.gymClass.coach.user"})
    @Query("""
            select b from SessionBooking b
            where b.member.userId = :memberId
              and (:status is null or b.status = :status)
              and b.session.sessionDate >= :fromDate
              and b.session.sessionDate <= :toDate
            order by b.session.sessionDate, b.session.startTime, b.id
            """)
    /** Lượt đặt chỗ của hội viên trong khoảng ngày, lọc trạng thái nếu có, kèm buổi/lớp/phòng/HLV. */
    List<SessionBooking> findForMemberBetween(@Param("memberId") Long memberId, @Param("status") String status,
                                              @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    /**
     * Như findForMemberBetween nhưng cho phép bỏ trống ngày đầu/cuối (thay bằng mốc rất xa).
     *
     * A null bound means "unbounded". PostgreSQL cannot infer the type of a bare {@code ? is null} date parameter
     * ("could not determine data type of parameter"), so open bounds are replaced by sentinel dates instead.
     */
    default List<SessionBooking> findForMember(Long memberId, String status, LocalDate fromDate, LocalDate toDate) {
        return findForMemberBetween(memberId, status, fromDate != null ? fromDate : LocalDate.of(1900, 1, 1),
                toDate != null ? toDate : LocalDate.of(9999, 12, 31));
    }

    /** Booked seats of a member in sessions that have not started yet, for hold / cancellation / expiry clean-up. */
    @EntityGraph(attributePaths = {"session", "session.gymClass"})
    @Query("""
            select b from SessionBooking b
            where b.member.userId = :memberId and b.status = 'booked' and b.session.status = 'scheduled'
              and b.session.sessionDate >= :today
            order by b.session.sessionDate, b.session.startTime
            """)
    /** Lượt đặt chỗ booked ở buổi đã xếp từ hôm nay trở đi của hội viên, sắp theo ngày giờ. */
    List<SessionBooking> findUpcomingBookedForMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    @Query("""
            select (count(b) > 0) from SessionBooking b
            where b.member.userId = :memberId and b.status = 'booked' and b.session.status = 'scheduled'
              and b.session.sessionDate >= :today
            """)
    /** Kiểm tra hội viên còn lượt đặt chỗ ở buổi sắp tới không. */
    boolean existsUpcomingBookedForMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    @Query("""
            select (count(b) > 0) from SessionBooking b
            where b.member.userId = :memberId and b.session.gymClass.coach.userId = :coachId
              and b.status in ('booked', 'completed')
            """)
    /** Kiểm tra hội viên có từng đặt (booked/completed) buổi của lớp do HLV này dạy không. */
    boolean existsForCoachAndMember(@Param("coachId") Long coachId, @Param("memberId") Long memberId);

    /** Id các lớp mà hội viên đang có lượt đặt chỗ booked. */
    @Query("select distinct b.session.gymClass.id from SessionBooking b where b.member.userId = :memberId and b.status = 'booked'")
    List<Long> findBookedClassIdsByMemberId(@Param("memberId") Long memberId);

    /** Id các hội viên đang có ít nhất một lượt đặt chỗ booked. */
    @Query("select distinct b.member.userId from SessionBooking b where b.status = 'booked'")
    List<Long> findMemberIdsWithBooked();

    /**
     * Kiểm tra có tồn tại bản ghi có sessionGymClassId = tham số và memberUserId = tham số và status = tham số
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsBySessionGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);

    /** Bookings of sessions held before {@code cutoff} are settled as completed (state machine 12). */
    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            update SessionBooking b set b.status = 'completed'
            where b.status = 'booked'
              and b.session in (select s from ClassSession s where s.status <> 'cancelled' and s.sessionDate < :cutoff)
            """)
    /** Chuyển lượt đặt chỗ booked ở buổi chưa hủy diễn ra trước cutoff sang completed; trả về số dòng cập nhật. */
    int completeHeldBefore(@Param("cutoff") LocalDate cutoff);
}
