package com.swp391.scms.courts.repository;

import com.swp391.scms.courts.entity.CourtBooking;
import com.swp391.scms.scheduling.entity.ClassSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.*;
import java.util.*;

/** Truy cập dữ liệu đặt sân (bảng court_bookings). */
public interface CourtBookingRepository extends JpaRepository<CourtBooking, Long> {
    /** Kiểm tra có tồn tại bản ghi có roomId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByRoomId(Long roomId);

    /** Lấy lượt đặt sân theo id và khóa dòng (PESSIMISTIC_WRITE) để hủy/xác nhận thanh toán an toàn. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from CourtBooking b where b.id = :id")
    Optional<CourtBooking> findByIdForUpdate(@Param("id") Long id);

    @Query("select (count(b) > 0) from CourtBooking b where b.room.id = :roomId and b.bookingDate = :date "
            + "and b.status = 'booked' and b.startTime < :end and b.endTime > :start")
    /** Kiểm tra sân đã có lượt booked trùng khung giờ trong ngày chưa. */
    boolean existsRoomOverlap(@Param("roomId") Long roomId, @Param("date") LocalDate date,
                             @Param("start") LocalTime start, @Param("end") LocalTime end);

    @Query("select (count(b) > 0) from CourtBooking b where b.member.id = :memberId and b.bookingDate = :date "
            + "and b.status = 'booked' and b.startTime < :end and b.endTime > :start")
    /** Kiểm tra hội viên đã có lượt đặt sân booked trùng khung giờ trong ngày chưa. */
    boolean existsMemberOverlap(@Param("memberId") Long memberId, @Param("date") LocalDate date,
                               @Param("start") LocalTime start, @Param("end") LocalTime end);

    @Query("select (count(s) > 0) from ClassSession s where s.gymClass.room.id = :roomId and s.sessionDate = :date "
            + "and s.status <> 'cancelled' and s.startTime < :end and s.endTime > :start")
    /** Kiểm tra sân có buổi lớp học chưa hủy trùng khung giờ trong ngày không. */
    boolean existsClassOverlap(@Param("roomId") Long roomId, @Param("date") LocalDate date,
                              @Param("start") LocalTime start, @Param("end") LocalTime end);

    /** Các buổi lớp học chưa hủy diễn ra ở sân trong ngày. */
    @Query("select s from ClassSession s where s.gymClass.room.id = :roomId and s.sessionDate = :date and s.status <> 'cancelled'")
    List<ClassSession> findRoomClasses(@Param("roomId") Long roomId, @Param("date") LocalDate date);

    /** Các lượt đặt booked của sân trong ngày. */
    @Query("select b from CourtBooking b where b.room.id = :roomId and b.bookingDate = :date and b.status = 'booked'")
    List<CourtBooking> findRoomBookings(@Param("roomId") Long roomId, @Param("date") LocalDate date);

    @Query("select b from CourtBooking b where b.status = 'booked' and b.paymentStatus = 'pending' "
            + "and b.paymentMethod = 'vnpay' and b.createdAt < :cutoff")
    /** Lượt đặt sân VNPay còn chờ thanh toán được tạo trước mốc cutoff (quá thời gian chờ cổng thanh toán). */
    List<CourtBooking> findUnpaidOnlineBefore(@Param("cutoff") LocalDateTime cutoff);

    /**
     * Các lượt đặt tại quầy (tiền mặt) chưa trả mà khung giờ bắt đầu tại hoặc trước thời điểm cho trước, và
     * đã được giữ đủ lâu để hội viên có cơ hội hợp lý đến quầy.
     */
    @Query("select b from CourtBooking b where b.status = 'booked' and b.paymentStatus = 'pending' "
            + "and b.paymentMethod = 'cash' and b.createdAt < :createdBefore "
            + "and (b.bookingDate < :date or (b.bookingDate = :date and b.startTime <= :time))")
    /** Lượt đặt sân tiền mặt còn chưa trả mà giờ bắt đầu đã tới mốc cho trước và đã được giữ đủ lâu. */
    List<CourtBooking> findUnpaidCashDue(@Param("date") LocalDate date, @Param("time") LocalTime time,
                                         @Param("createdBefore") LocalDateTime createdBefore);

    /** Các lượt đặt chưa kết thúc (đã trả hay chưa): các ngày sau, hoặc hôm nay với khung giờ còn ở phía trước. */
    @Query("select count(b) from CourtBooking b where b.member.id = :memberId and b.status = 'booked' "
            + "and (b.bookingDate > :today or (b.bookingDate = :today and b.endTime > :time))")
    /** Đếm lượt đặt sân booked chưa kết thúc của hội viên. */
    long countUpcomingBooked(@Param("memberId") Long memberId, @Param("today") LocalDate today, @Param("time") LocalTime time);

    /** Các khung hội viên đang giữ mà chưa trả (quầy hoặc VNPay), từ {@code today} trở đi. */
    @Query("select count(b) from CourtBooking b where b.member.id = :memberId and b.status = 'booked' "
            + "and b.paymentStatus = 'pending' and b.bookingDate >= :today")
    /** Đếm lượt đặt sân booked còn chờ thanh toán từ hôm nay của hội viên. */
    long countUnpaidHolds(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    /**
     * Đếm số bản ghi có memberId = tham số và bookingDate = tham số và status = tham số (Spring Data tự sinh
     * truy vấn từ tên hàm).
     */
    long countByMemberIdAndBookingDateAndStatus(Long memberId, LocalDate bookingDate, String status);

    @Query("select count(b) from CourtBooking b where b.member.id = :memberId "
            + "and (b.status = 'booked' or coalesce(b.quotaForfeited, false) = true) "
            + "and b.paymentMethod = :method and b.bookingDate between :from and :to")
    /** Đếm lượt đã dùng hạn mức theo phương thức trong khoảng ngày; lượt hủy nhưng bị mất lượt vẫn được tính. */
    long countQuotaUsage(@Param("memberId") Long memberId, @Param("from") LocalDate from, @Param("to") LocalDate to,
                         @Param("method") String method);

    /**
     * Tìm các bản ghi có memberId = tham số, sắp xếp theo bookingDate giảm dần, startTime giảm dần, id giảm dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    @EntityGraph(attributePaths = {"room", "room.discipline", "member"})
    Page<CourtBooking> findByMemberIdOrderByBookingDateDescStartTimeDescIdDesc(Long memberId, Pageable pageable);

    @EntityGraph(attributePaths = {"room", "room.discipline", "member"})
    @Query("select b from CourtBooking b where b.bookingDate = :date and b.member.deletedAt is null "
            + "order by b.startTime, b.room.name, b.id")
    /** Lượt đặt sân trong ngày (của người dùng chưa bị xóa), phân trang, sắp theo giờ, tên sân. */
    Page<CourtBooking> findDaily(@Param("date") LocalDate date, Pageable pageable);

    @EntityGraph(attributePaths = {"room", "room.discipline", "member"})
    @Query("select b from CourtBooking b where b.bookingDate = :date and b.room.id = :roomId "
            + "and b.member.deletedAt is null order by b.startTime, b.room.name, b.id")
    /** Như findDaily nhưng chỉ cho một sân. */
    Page<CourtBooking> findDailyByRoom(@Param("date") LocalDate date, @Param("roomId") Long roomId, Pageable pageable);

    @Query("""
            select b from CourtBooking b
            where b.member.id = :memberId and b.status = 'booked' and b.bookingDate >= :today
            """)
    /** Lượt đặt sân booked từ hôm nay trở đi của hội viên. */
    List<CourtBooking> findUpcomingBookedByMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);

    /** Id các hội viên còn lượt đặt sân booked từ hôm nay trở đi. */
    @Query("select distinct b.member.id from CourtBooking b where b.status = 'booked' and b.bookingDate >= :today")
    List<Long> findMemberIdsWithUpcomingBookings(@Param("today") LocalDate today);

    @Query("""
            select (count(b) > 0) from CourtBooking b
            where b.member.id = :memberId and b.status = 'booked' and b.bookingDate >= :today
            """)
    /** Kiểm tra hội viên còn lượt đặt sân sắp tới không. */
    boolean existsUpcomingForMember(@Param("memberId") Long memberId, @Param("today") LocalDate today);
}
