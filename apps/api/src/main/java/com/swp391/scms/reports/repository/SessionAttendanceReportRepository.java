package com.swp391.scms.reports.repository;

import com.swp391.scms.attendance.entity.SessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Truy vấn báo cáo trên dữ liệu điểm danh lớp nhóm (tính năng cũ). */
@Repository
public interface SessionAttendanceReportRepository extends JpaRepository<SessionAttendance, Long> {

    /** Tìm các bản ghi có sessionGymClassId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<SessionAttendance> findBySessionGymClassId(Long classId);

    /** Một dòng kết quả mức sử dụng lớp do câu truy vấn trả về (Spring Data tự ánh xạ theo tên getter). */
    interface ClassUtilizationRow {
        Long getClassId();
        String getClassName();
        Long getDisciplineId();
        String getDisciplineName();
        String getRoomName();
        Integer getCapacity();
        Long getEnrolledCount();
        Long getPresentCount();
    }

    @Query("""
            SELECT c.id AS classId,
                   c.name AS className,
                   d.id AS disciplineId,
                   d.name AS disciplineName,
                   r.name AS roomName,
                   c.capacity AS capacity,
                   (SELECT COUNT(m) FROM Member m
                    WHERE EXISTS (SELECT 1 FROM ClassEnrollment e
                                  WHERE e.member = m AND e.gymClass.id = c.id
                                    AND LOWER(e.status) IN ('booked', 'completed')
                                    AND (e.enrolledAt IS NULL OR (e.enrolledAt >= :startTs AND e.enrolledAt < :endTs)))
                       OR EXISTS (SELECT 1 FROM SessionBooking b
                                  WHERE b.member = m AND b.session.gymClass.id = c.id
                                    AND LOWER(b.status) IN ('booked', 'completed')
                                    AND b.bookedAt >= :startTs AND b.bookedAt < :endTs)) AS enrolledCount,
                   (SELECT COUNT(DISTINCT a.member.userId) FROM SessionAttendance a JOIN a.session s
                    WHERE s.gymClass.id = c.id
                      AND LOWER(a.status) IN ('present', 'late')
                      AND s.sessionDate >= :start AND s.sessionDate <= :end) AS presentCount
            FROM GymClass c
            LEFT JOIN c.discipline d
            LEFT JOIN c.room r
            WHERE LOWER(c.status) <> 'archived'
            ORDER BY c.id
            """)
    /** Mức sử dụng mọi lớp trong khoảng ngày: sức chứa, số hội viên đã đăng ký và số lượt có mặt. */
    List<ClassUtilizationRow> classUtilizationAll(@Param("start") LocalDate start,
                                                  @Param("end") LocalDate end,
                                                  @Param("startTs") LocalDateTime startTs,
                                                  @Param("endTs") LocalDateTime endTs);

    @Query("""
            SELECT c.id AS classId,
                   c.name AS className,
                   d.id AS disciplineId,
                   d.name AS disciplineName,
                   r.name AS roomName,
                   c.capacity AS capacity,
                   (SELECT COUNT(m) FROM Member m
                    WHERE EXISTS (SELECT 1 FROM ClassEnrollment e
                                  WHERE e.member = m AND e.gymClass.id = c.id
                                    AND LOWER(e.status) IN ('booked', 'completed')
                                    AND (e.enrolledAt IS NULL OR (e.enrolledAt >= :startTs AND e.enrolledAt < :endTs)))
                       OR EXISTS (SELECT 1 FROM SessionBooking b
                                  WHERE b.member = m AND b.session.gymClass.id = c.id
                                    AND LOWER(b.status) IN ('booked', 'completed')
                                    AND b.bookedAt >= :startTs AND b.bookedAt < :endTs)) AS enrolledCount,
                   (SELECT COUNT(DISTINCT a.member.userId) FROM SessionAttendance a JOIN a.session s
                    WHERE s.gymClass.id = c.id
                      AND LOWER(a.status) IN ('present', 'late')
                      AND s.sessionDate >= :start AND s.sessionDate <= :end) AS presentCount
            FROM GymClass c
            LEFT JOIN c.discipline d
            LEFT JOIN c.room r
            WHERE LOWER(c.status) <> 'archived'
              AND d.id = :disciplineId
            ORDER BY c.id
            """)
    /** Mức sử dụng các lớp của một bộ môn trong khoảng ngày. */
    List<ClassUtilizationRow> classUtilizationByDiscipline(@Param("start") LocalDate start,
                                                           @Param("end") LocalDate end,
                                                           @Param("startTs") LocalDateTime startTs,
                                                           @Param("endTs") LocalDateTime endTs,
                                                           @Param("disciplineId") Long disciplineId);
}
