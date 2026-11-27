package com.swp391.scms.attendance.repository;

import com.swp391.scms.attendance.entity.CenterCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Truy cập bảng center_checkins (lượt ra vào cổng). */
@Repository
public interface CenterCheckinRepository extends JpaRepository<CenterCheckin, Long> {


    /**
     * Lượt vào cổng hợp lệ đã ở trong trung tâm trong lúc buổi học diễn ra: bắt đầu không sớm hơn {@code
     * earliest} (một mốc chặn để lượt quên check-out từ buổi sáng không phủ lớp buổi tối), không muộn hơn giờ
     * kết thúc buổi, và còn mở hoặc kết thúc sau giờ bắt đầu buổi. Trả về thời điểm check-in sớm nhất thỏa
     * điều kiện.
     */
    @Query("select min(c.checkInTime) from CenterCheckin c where c.member.userId = :memberId and c.status = 'GRANTED' "
            + "and c.checkInTime >= :earliest and c.checkInTime <= :end "
            + "and (c.checkOutTime is null or c.checkOutTime >= :start)")
    /**
     * Giờ vào sớm nhất của lượt check-in được cho vào mà hội viên còn ở trong trung tâm lúc buổi tập diễn ra
     * (bắt đầu không sớm hơn mốc earliest, không muộn hơn giờ kết thúc buổi, và chưa ra hoặc ra sau giờ bắt
     * đầu).
     */
    LocalDateTime findCoveringVisitStart(@Param("memberId") Long memberId, @Param("earliest") LocalDateTime earliest,
                                         @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** Lấy lượt ra vào và khóa dòng để ghi. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CenterCheckin c where c.id = :id")
    Optional<CenterCheckin> findByIdForUpdate(@Param("id") Long id);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status = tham số và checkOutTime đang trống
     * (null) (Spring Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(Long memberId, String status);

    /** Hội viên có đang ở trong trung tâm không (có lượt GRANTED chưa check-out). */
    default boolean existsByMemberUserIdAndCheckOutTimeIsNull(Long memberId) {
        return existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(memberId, "GRANTED");
    }

    /** Lượt check-in theo trạng thái chưa check-out gần nhất của hội viên. */
    Optional<CenterCheckin> findFirstByMemberUserIdAndStatusAndCheckOutTimeIsNullOrderByCheckInTimeDesc(
            Long memberId, String status);

    /** Lượt check-in được cho vào (GRANTED) chưa check-out gần nhất của hội viên. */
    default Optional<CenterCheckin> findFirstByMemberUserIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(Long memberId) {
        return findFirstByMemberUserIdAndStatusAndCheckOutTimeIsNullOrderByCheckInTimeDesc(memberId, "GRANTED");
    }

    /**
     * Tìm các bản ghi có checkInTime ≥ tham số và checkInTime < tham số, sắp xếp theo checkInTime giảm dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<CenterCheckin> findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
            LocalDateTime start, LocalDateTime end);

    /**
     * Tìm các bản ghi có memberUserId = tham số và checkInTime ≥ tham số và checkInTime < tham số, sắp xếp theo
     * checkInTime giảm dần (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<CenterCheckin> findByMemberUserIdAndCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
            Long memberId, LocalDateTime start, LocalDateTime end);

    /** Chỉ lấy ID để lần đọc dưới khóa không dùng entity cũ trong persistence context; bao gồm đúng 8 giờ. */
    @Query("select c.id from CenterCheckin c where c.member.userId = :memberId and c.status = 'GRANTED' "
            + "and c.checkOutTime is null and c.checkInTime <= :cutoff order by c.id")
    List<Long> findStaleVisitIdsForMember(@Param("memberId") Long memberId, @Param("cutoff") LocalDateTime cutoff);

    /** Lấy phiên quá hạn từ mọi ngày, nên lần chạy sau vẫn xử lý được tồn đọng sau gián đoạn/restart. */
    @Query("select c.id from CenterCheckin c where c.status = 'GRANTED' "
            + "and c.checkOutTime is null and c.checkInTime <= :cutoff order by c.id")
    List<Long> findStaleVisitIds(@Param("cutoff") LocalDateTime cutoff);

    /** Self-checkout cũng đọc ID trước khi khóa để không nạp entity cũ trong lúc auto-close đang xử lý. */
    @Query("select c.id from CenterCheckin c where c.member.userId = :memberId and c.status = 'GRANTED' "
            + "and c.checkOutTime is null order by c.checkInTime desc, c.id desc")
    List<Long> findOpenVisitIdsForMember(@Param("memberId") Long memberId);

    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và checkInTime ≥ tham số (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsByMemberUserIdAndCheckInTimeGreaterThanEqual(Long memberId, LocalDateTime since);
}
