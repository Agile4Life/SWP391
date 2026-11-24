package com.swp391.scms.attendance.repository;

import com.swp391.scms.attendance.entity.SessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionAttendanceRepository extends JpaRepository<SessionAttendance, Long> {

    /** Rows per (session, status) for the given sessions: [sessionId, status, count]. */
    @Query("select a.session.id, a.status, count(a) from SessionAttendance a where a.session.id in :ids group by a.session.id, a.status")
    List<Object[]> countByStatusForSessions(@Param("ids") java.util.Collection<Long> ids);

    /** Tìm các bản ghi có sessionId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<SessionAttendance> findBySessionId(Long sessionId);

    @Query("""
            select a from SessionAttendance a
            join fetch a.member m
            join fetch a.recordedBy r
            where a.session.id = :sessionId
            """)
    List<SessionAttendance> findBySessionIdWithDetails(@Param("sessionId") Long sessionId);

    /**
     * Tìm các bản ghi có sessionId = tham số và memberUserId = tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<SessionAttendance> findBySessionIdAndMemberUserId(Long sessionId, Long memberId);

    /**
     * Kiểm tra có tồn tại bản ghi có sessionId = tham số và memberUserId = tham số (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsBySessionIdAndMemberUserId(Long sessionId, Long memberId);

    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<SessionAttendance> findByMemberUserId(Long memberId);

    /** Đếm số bản ghi có sessionId = tham số và status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countBySessionIdAndStatus(Long sessionId, String status);

    /** Sessions excused automatically by a membership hold, from {@code fromDate} on. */
    @Query("""
            select a from SessionAttendance a
            where a.member.userId = :memberId and a.status = 'excused' and a.notes = 'auto: membership hold'
              and a.session.sessionDate >= :fromDate
            """)
    List<SessionAttendance> findHoldExcuses(@Param("memberId") Long memberId, @Param("fromDate") java.time.LocalDate fromDate);

    /** Sessions of a course the member actually came to (present or late). */
    @Query("""
            select count(a) from SessionAttendance a
            where a.member.userId = :memberId and a.session.gymClass.id = :classId and a.status in ('present', 'late')
            """)
    long countAttended(@Param("memberId") Long memberId, @Param("classId") Long classId);

    /** Sessions of a course whose outcome is known: attended, missed or excused. */
    @Query("""
            select count(a) from SessionAttendance a
            where a.member.userId = :memberId and a.session.gymClass.id = :classId
            """)
    long countRecorded(@Param("memberId") Long memberId, @Param("classId") Long classId);

    @Query("""
            select count(a) from SessionAttendance a
            where a.member.userId = :memberId and a.session.gymClass.id = :classId and a.status = 'absent'
            """)
    long countAbsences(@Param("memberId") Long memberId, @Param("classId") Long classId);
}
