package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.dto.ClassBookingCount;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

/** Truy cập dữ liệu ghi danh khóa học (bảng class_enrollments). */
@Repository
public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, Long> {
    @Query("""
            select e from ClassEnrollment e join fetch e.member m join fetch m.user u join fetch e.gymClass c
            where c.coach.userId = :coachId and c.status = 'active' and e.status = 'booked'
              and u.deletedAt is null and u.status = 'active'
              and exists (select s.id from ClassSession s where s.gymClass = c and s.status = 'scheduled'
                and (s.sessionDate > :today or (s.sessionDate = :today and s.startTime > :now)))
            order by c.id, e.id
            """)
    /**
     * Lượt ghi danh còn hiệu lực ở các lớp active của một HLV mà lớp còn buổi sắp tới, kèm hội viên còn hoạt
     * động.
     */
    List<ClassEnrollment> findCurrentCoachAssignments(@Param("coachId") Long coachId,
            @Param("today") java.time.LocalDate today, @Param("now") java.time.LocalTime now);

    /** Lấy id lớp của một lượt ghi danh (không tải cả entity). */
    @Query("select e.gymClass.id from ClassEnrollment e where e.id = :id")
    Optional<Long> findClassIdById(@Param("id") Long id);

    /** Lấy lượt ghi danh theo id và khóa dòng (PESSIMISTIC_WRITE) để hủy/sửa an toàn. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ClassEnrollment e where e.id = :id")
    Optional<ClassEnrollment> findByIdForUpdate(@Param("id") Long id);

    /** Id các lớp mà hội viên đang ghi danh (trạng thái booked), không trùng lặp. */
    @Query("select distinct e.gymClass.id from ClassEnrollment e where e.member.userId = :memberId and e.status = 'booked'")
    List<Long> findBookedClassIdsByMemberId(@Param("memberId") Long memberId);

    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ClassEnrollment> findByMemberUserId(Long memberId);

    /** Tìm các bản ghi có gymClassId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ClassEnrollment> findByGymClassId(Long classId);

    /**
     * Tìm các bản ghi có gymClassId = tham số và memberUserId = tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<ClassEnrollment> findByGymClassIdAndMemberUserId(Long classId, Long memberId);

    /** Đếm số bản ghi có gymClassId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByGymClassIdAndStatus(Long classId, String status);

    @Query("select new com.swp391.scms.scheduling.dto.ClassBookingCount(e.gymClass.id, count(e)) "
            + "from ClassEnrollment e where e.gymClass.id in :classIds and e.status = :status group by e.gymClass.id")
    /** Đếm số lượt ghi danh theo trạng thái cho nhiều lớp cùng lúc, nhóm theo lớp. */
    List<ClassBookingCount> countByClassIdsAndStatus(@Param("classIds") List<Long> classIds, @Param("status") String status);

    /**
     * Tìm các bản ghi có gymClassId = tham số và memberUserId = tham số và status = tham số (Spring Data tự
     * sinh truy vấn từ tên hàm).
     *
     * SCRUM-73 BR-03: hội viên chỉ được giữ một lượt đặt đang hoạt động cho mỗi lớp.
     */
    Optional<ClassEnrollment> findByGymClassIdAndMemberUserIdAndStatus(Long classId, Long memberId, String status);

    /** Tìm các bản ghi có gymClassId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"member", "member.user"})
    List<ClassEnrollment> findByGymClassIdAndStatus(Long classId, String status);

    /** Xóa các bản ghi có gymClassId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    void deleteByGymClassId(Long classId);

    @org.springframework.data.jpa.repository.Query("""
            select (count(e) > 0) from ClassEnrollment e
            where e.member.userId = :memberId and e.gymClass.coach.userId = :coachId
              and e.status in ('booked', 'completed')
            """)
    /** Kiểm tra hội viên có từng học (booked/completed) lớp do HLV này dạy không. */
    boolean existsForCoachAndMember(@org.springframework.data.repository.query.Param("coachId") Long coachId,
                                    @org.springframework.data.repository.query.Param("memberId") Long memberId);

    /** Id các hội viên đang có ít nhất một lượt ghi danh booked. */
    @org.springframework.data.jpa.repository.Query("select distinct e.member.userId from ClassEnrollment e where e.status = 'booked'")
    List<Long> findMemberIdsWithBookedEnrollments();

    @org.springframework.data.jpa.repository.Query("""
            select (count(e) > 0) from ClassEnrollment e
            where e.member.userId = :memberId and e.status = 'booked'
              and exists (select s.id from ClassSession s
                          where s.gymClass = e.gymClass and s.status = 'scheduled' and s.sessionDate >= :today)
            """)
    /** Kiểm tra hội viên còn ghi danh lớp có buổi đã xếp từ hôm nay trở đi không. */
    boolean existsUpcomingBookedForMember(@org.springframework.data.repository.query.Param("memberId") Long memberId,
                                          @org.springframework.data.repository.query.Param("today") java.time.LocalDate today);

    @org.springframework.data.jpa.repository.Query("""
            select count(e) from ClassEnrollment e
            where e.member.userId = :memberId and e.status = :status
              and coalesce(e.gymClass.startDate, cast(e.enrolledAt as date)) between :startDate and :endDate
              and not exists (
                select 1 from Payment p
                where p.classEnrollmentId = e.id and p.status in ('pending', 'success')
              )
            """)
    /**
     * Đếm số credit miễn phí đã dùng: lượt ghi danh theo trạng thái có ngày bắt đầu khóa trong khoảng, không
     * tính lượt đã trả tiền hoặc đang chờ thanh toán.
     */
    long countByMemberUserIdAndStatusAndGymClassStartDateBetween(
            @org.springframework.data.repository.query.Param("memberId") Long memberId,
            @org.springframework.data.repository.query.Param("status") String status,
            @org.springframework.data.repository.query.Param("startDate") java.time.LocalDate startDate,
            @org.springframework.data.repository.query.Param("endDate") java.time.LocalDate endDate);

    /** Các lượt miễn phí bị mất hẳn (hủy do tạm hoãn membership muộn) trong khoảng hạn mức. */
    @org.springframework.data.jpa.repository.Query("""
            select count(e) from ClassEnrollment e
            where e.member.userId = :memberId and e.status = 'cancelled' and e.creditForfeited = true
              and coalesce(e.gymClass.startDate, cast(e.enrolledAt as date)) between :startDate and :endDate
              and not exists (
                select 1 from Payment p
                where p.classEnrollmentId = e.id and p.status in ('pending', 'success')
              )
            """)
    /** Đếm số credit bị mất do hủy muộn trong khoảng ngày (không tính lượt trả tiền). */
    long countForfeitedCreditsBetween(
            @org.springframework.data.repository.query.Param("memberId") Long memberId,
            @org.springframework.data.repository.query.Param("startDate") java.time.LocalDate startDate,
            @org.springframework.data.repository.query.Param("endDate") java.time.LocalDate endDate);

    /**
     * Đếm tổng số credit miễn phí đã dùng trong khoảng hạn mức: gồm các lượt đang {@code booked}, đã hoàn thành
     * {@code completed}, và các lượt {@code cancelled} bị mất lượt ({@code creditForfeited = true}); loại trừ
     * các lượt đã trả học phí hoặc đang chờ thanh toán.
     */
    @org.springframework.data.jpa.repository.Query("""
            select count(e) from ClassEnrollment e
            where e.member.userId = :memberId
              and (e.status in ('booked', 'completed')
                   or (e.status = 'cancelled' and e.creditForfeited = true))
              and coalesce(e.gymClass.startDate, cast(e.enrolledAt as date)) between :startDate and :endDate
              and not exists (
                select 1 from Payment p
                where p.classEnrollmentId = e.id and p.status in ('pending', 'success')
              )
            """)
    long countUsedFreeCreditsBetween(
            @org.springframework.data.repository.query.Param("memberId") Long memberId,
            @org.springframework.data.repository.query.Param("startDate") java.time.LocalDate startDate,
            @org.springframework.data.repository.query.Param("endDate") java.time.LocalDate endDate);

    /** Ghi danh khóa học hoàn thành khi mọi buổi chưa hủy của lớp đã diễn ra trước {@code cutoff}. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            update ClassEnrollment e set e.status = 'completed'
            where e.status = 'booked'
              and exists (select s.id from ClassSession s where s.gymClass = e.gymClass and s.status <> 'cancelled')
              and not exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                              and s.status <> 'cancelled' and s.sessionDate >= :cutoff)
            """)
    /**
     * Chuyển lượt ghi danh booked sang completed khi lớp không còn buổi chưa hủy nào từ ngày cutoff trở đi; trả
     * về số dòng cập nhật.
     */
    int completeFinishedBefore(@Param("cutoff") java.time.LocalDate cutoff);

    /** Bản ghi phẳng cho hàng đợi thu học phí khóa học tại quầy lễ tân (tiền mặt / chuyển khoản). */
    interface UnpaidCourseEnrollmentRow {
        Long getEnrollmentId();
        Long getPaymentId();
        Long getClassId();
        String getClassName();
        String getDisciplineName();
        java.time.LocalDate getStartDate();
        java.time.LocalDate getEndDate();
        Long getMemberId();
        String getMemberName();
        String getMemberPhone();
        String getMembershipCode();
        java.math.BigDecimal getAmount();
        String getMethod();
        java.time.LocalDateTime getCreatedAt();
    }

    /**
     * Các lượt ghi danh khóa học đang giữ chỗ ({@code booked}) có khoản học phí đang chờ thanh toán tại quầy
     * ({@code cash} hoặc {@code bank_transfer}) của hội viên chưa bị xóa mềm, mới nhất trước.
     */
    @Query("""
            select e.id as enrollmentId,
                   p.id as paymentId,
                   c.id as classId,
                   c.name as className,
                   d.name as disciplineName,
                   c.startDate as startDate,
                   c.endDate as endDate,
                   m.userId as memberId,
                   u.fullName as memberName,
                   u.phone as memberPhone,
                   m.membershipCode as membershipCode,
                   p.amount as amount,
                   p.method as method,
                   p.createdAt as createdAt
            from Payment p
            join p.classEnrollment e
            join e.gymClass c
            left join c.discipline d
            join e.member m
            join m.user u
            where e.status = 'booked'
              and p.status = 'pending'
              and p.method in ('cash', 'bank_transfer')
              and u.deletedAt is null
            order by p.createdAt desc, e.id desc
            """)
    List<UnpaidCourseEnrollmentRow> findUnpaidCourseEnrollments();
}
