package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/** Truy cập dữ liệu buổi học (bảng class_sessions). */
@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c join fetch c.discipline join fetch c.room r
            join fetch c.coach co join fetch co.user u
            where s.status = 'scheduled' and c.status = 'active' and r.status = 'available'
              and co.employmentStatus = 'active' and u.status = 'active' and u.deletedAt is null
              and s.sessionDate between :fromDate and :toDate
              and (s.sessionDate > :fromDate or s.startTime > :now)
            order by s.sessionDate, s.startTime, s.id
            """)
    /**
     * Buổi học công khai sắp diễn ra trong khoảng ngày: lớp active, phòng sẵn sàng, HLV còn làm việc; bỏ buổi
     * đã qua giờ trong ngày đầu.
     */
    List<ClassSession> findPublicSessions(@Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate, @Param("now") java.time.LocalTime now);

    /**
     * Tìm các bản ghi có gymClassId = tham số, sắp xếp theo sessionDate tăng dần, startTime tăng dần (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    List<ClassSession> findByGymClassIdOrderBySessionDateAscStartTimeAsc(Long classId);

    /**
     * Tải danh sách buổi học của nhiều lớp trong một truy vấn, sắp theo ngày và giờ bắt đầu.
     */
    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            where c.id in :classIds
            order by s.sessionDate asc, s.startTime asc
            """)
    List<ClassSession> findByGymClassIdInOrderBySessionDateAscStartTimeAsc(@Param("classIds") java.util.Collection<Long> classIds);

    /**
     * Lấy mọi buổi kèm thông tin lớp, bộ môn, HLV (và tài khoản HLV) và phòng, sắp theo ngày và giờ.
     */
    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            join fetch c.discipline d
            join fetch c.coach co
            join fetch co.user u
            join fetch c.room r
            order by s.sessionDate asc, s.startTime asc
            """)
    /** Mọi buổi học kèm lớp, bộ môn, HLV và phòng, sắp theo ngày giờ. */
    List<ClassSession> findAllWithDetails();

    /**
     * Truy vấn buổi học có lọc trực tiếp tại database theo khoảng ngày, bộ môn và HLV. Dùng ngày mốc xa và giá
     * trị âm (-1L) làm sentinel thay cho tham số null để tránh lỗi PostgreSQL "could not determine data type".
     */
    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            join fetch c.discipline d
            join fetch c.coach co
            join fetch co.user u
            join fetch c.room r
            where s.sessionDate >= :fromDate
              and s.sessionDate <= :toDate
              and (:disciplineId < 0 or d.id = :disciplineId)
              and (:coachId < 0 or co.userId = :coachId)
            order by s.sessionDate asc, s.startTime asc
            """)
    List<ClassSession> findFilteredWithDetails(@Param("fromDate") LocalDate fromDate,
                                               @Param("toDate") LocalDate toDate,
                                               @Param("disciplineId") long disciplineId,
                                               @Param("coachId") long coachId);

    /**
     * Tra cứu lịch với bộ lọc tùy chọn theo khoảng ngày, bộ môn và HLV, đẩy toàn bộ điều kiện xuống JPQL.
     */
    default List<ClassSession> searchSessions(LocalDate fromDate,
                                              LocalDate toDate,
                                              Long disciplineId,
                                              Long coachId) {
        return findFilteredWithDetails(
                fromDate != null ? fromDate : LocalDate.of(1900, 1, 1),
                toDate != null ? toDate : LocalDate.of(9999, 12, 31),
                disciplineId != null ? disciplineId : -1L,
                coachId != null ? coachId : -1L);
    }

    /** Đếm số bản ghi có gymClassId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByGymClassIdAndStatus(Long classId, String status);

    /** Đếm số bản ghi có gymClassId = tham số và status khác tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByGymClassIdAndStatusNot(Long classId, String status);

    @Query("""
            select s from ClassSession s join fetch s.gymClass
            where s.status <> 'cancelled' and s.sessionDate between :fromDate and :toDate
            """)
    /** Buổi chưa hủy trong khoảng ngày kèm lớp; trigger lịch dùng để đối chiếu trùng giờ. */
    List<ClassSession> findNotCancelledBetween(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);

    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            left join fetch c.discipline
            left join fetch c.room
            left join fetch c.coach co
            left join fetch co.user
            where s.status = 'scheduled'
              and s.sessionDate >= :startDate
              and s.sessionDate <= :endDate
            """)
    /** Buổi đã xếp (scheduled) trong khoảng ngày kèm lớp, bộ môn, phòng và HLV. */
    List<ClassSession> findScheduledSessionsBetweenDates(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
            select new com.swp391.scms.scheduling.dto.CoachCourseRange(
                co.userId, c.id, c.name, min(s.sessionDate), max(s.sessionDate))
            from ClassSession s join s.gymClass c join c.coach co
            where c.status = 'active' and s.status = 'scheduled'
            group by co.userId, c.id, c.name
            """)
    /** Khoảng ngày còn lịch của mọi khóa đang hoạt động theo HLV, dùng cho giới hạn số khóa dạy đồng thời. */
    List<com.swp391.scms.scheduling.dto.CoachCourseRange> findActiveCourseRanges();

    @Query("""
            select s from ClassSession s
            where s.gymClass.coach.userId = :coachId
              and s.sessionDate = :date
              and s.status = 'scheduled'
            """)
    /** Buổi đã xếp của HLV trong một ngày, dùng để kiểm tra HLV bận. */
    List<ClassSession> findActiveByCoachAndDate(@Param("coachId") Long coachId, @Param("date") LocalDate date);

    @Query("""
            select s from ClassSession s
            where s.gymClass.coach.userId = :coachId
            """)
    /** Mọi buổi học của các lớp do HLV dạy. */
    List<ClassSession> findByCoachId(@Param("coachId") Long coachId);

    /** Xóa các bản ghi có gymClassId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    void deleteByGymClassId(Long classId);
    @Query("select s from ClassSession s join fetch s.gymClass c where s.status = 'scheduled' and s.sessionDate = :date " +
            "and (exists (select e.id from ClassEnrollment e where e.gymClass = s.gymClass " +
            "and e.member.userId = :memberId and e.status = 'booked') " +
            "or exists (select b.id from SessionBooking b where b.session = s " +
            "and b.member.userId = :memberId and b.status = 'booked'))")
    /** Buổi đã xếp trong ngày mà hội viên đã ghi danh lớp hoặc đặt chỗ, dùng để chặn trùng lịch. */
    List<ClassSession> findActiveByMemberAndDate(@Param("memberId") Long memberId, @Param("date") LocalDate date);

    @Query("""
            select s from ClassSession s
            join fetch s.gymClass c
            where s.status = 'scheduled'
              and s.sessionDate between :fromDate and :toDate
              and (exists (select e.id from ClassEnrollment e where e.gymClass = s.gymClass
                           and e.member.userId = :memberId and e.status = 'booked')
                   or exists (select b.id from SessionBooking b where b.session = s
                           and b.member.userId = :memberId and b.status = 'booked'))
            """)
    /** Buổi đã xếp trong khoảng ngày mà hội viên đã ghi danh lớp hoặc đặt chỗ, dùng để chặn trùng lịch theo khóa. */
    List<ClassSession> findActiveByMemberBetween(@Param("memberId") Long memberId,
                                                 @Param("fromDate") LocalDate fromDate,
                                                 @Param("toDate") LocalDate toDate);

    /**
     * Các buổi đã xếp của lớp khác vào {@code date} chồng lên {@code [start, end)} mà một thành viên của buổi
     * này cũng tham gia. Thành viên của buổi là người ghi danh vào {@code classId} hoặc giữ chỗ trong
     * {@code sessionId} (dùng -1 cho buổi học chưa tồn tại).
     */
    @Query("""
            select s from ClassSession s
            where s.status = 'scheduled' and s.sessionDate = :date and s.id <> :sessionId
              and s.gymClass.id <> :classId
              and s.startTime < :endTime and s.endTime > :startTime
              and exists (
                  select m.userId from Member m
                  where (exists (select e.id from ClassEnrollment e where e.member = m
                                 and e.gymClass.id = :classId and e.status = 'booked')
                         or exists (select b.id from SessionBooking b where b.member = m
                                 and b.session.id = :sessionId and b.status = 'booked'))
                    and (exists (select e2.id from ClassEnrollment e2 where e2.member = m
                                 and e2.gymClass = s.gymClass and e2.status = 'booked')
                         or exists (select b2.id from SessionBooking b2 where b2.member = m
                                 and b2.session = s and b2.status = 'booked')))
            order by s.startTime
            """)
    /**
     * Buổi khác trong ngày trùng giờ với buổi đang xếp mà có chung học viên với lớp/buổi này; dùng để báo xung
     * đột lịch học viên khi xếp/dời buổi.
     */
    List<ClassSession> findMemberOverlaps(@Param("classId") Long classId, @Param("sessionId") Long sessionId,
                                          @Param("date") LocalDate date,
                                          @Param("startTime") java.time.LocalTime startTime,
                                          @Param("endTime") java.time.LocalTime endTime);

    @Query("""
            select (count(s) > 0) from ClassSession s
            where s.gymClass.coach.userId = :coachId and s.status = 'scheduled' and s.sessionDate >= :today
            """)
    /** Kiểm tra HLV còn buổi đã xếp từ hôm nay trở đi không. */
    boolean existsScheduledForCoachFrom(@Param("coachId") Long coachId, @Param("today") java.time.LocalDate today);

    @Query("""
            select count(s) from ClassSession s
            where s.gymClass.coach.userId = :coachId and s.status = 'scheduled'
              and s.sessionDate between :startDate and :endDate
            """)
    /** Đếm buổi đã xếp của HLV trong khoảng ngày. */
    long countScheduledForCoachBetween(@Param("coachId") Long coachId,
                                       @Param("startDate") java.time.LocalDate startDate,
                                       @Param("endDate") java.time.LocalDate endDate);

    /** Các buổi đã diễn ra trước {@code cutoff} chuyển thành completed (máy trạng thái 4). */
    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            update ClassSession s set s.status = 'completed', s.updatedAt = :now
            where s.status = 'scheduled' and s.sessionDate < :cutoff
            """)
    /**
     * Chuyển buổi scheduled diễn ra trước ngày cutoff sang completed và cập nhật updatedAt; trả về số dòng cập
     * nhật.
     */
    int completeHeldBefore(@Param("cutoff") LocalDate cutoff, @Param("now") java.time.LocalDateTime now);
}
