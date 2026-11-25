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
        Long getSessionCount();
    }

    @Query("""
            SELECT c.id AS classId,
                   c.name AS className,
                   d.id AS disciplineId,
                   d.name AS disciplineName,
                   r.name AS roomName,
                   c.capacity AS capacity,
                   (SELECT COUNT(DISTINCT m.userId) FROM Member m
                    JOIN m.user mu
                    WHERE mu.deletedAt IS NULL
                      AND (
                          (EXISTS (SELECT 1 FROM ClassSession s0
                                   WHERE s0.gymClass.id = c.id
                                     AND LOWER(s0.status) <> 'cancelled'
                                     AND s0.sessionDate >= :start AND s0.sessionDate <= :end)
                           AND EXISTS (SELECT 1 FROM ClassEnrollment e
                                       WHERE e.member = m AND e.gymClass.id = c.id
                                         AND LOWER(e.status) IN ('booked', 'completed')
                                         AND (e.enrolledAt IS NULL OR e.enrolledAt < :endTs)
                                         AND (e.cancelledAt IS NULL OR e.cancelledAt >= :startTs)))
                          OR EXISTS (SELECT 1 FROM SessionBooking b
                                     WHERE b.member = m AND b.session.gymClass.id = c.id
                                       AND LOWER(b.status) IN ('booked', 'completed')
                                       AND LOWER(b.session.status) <> 'cancelled'
                                       AND b.session.sessionDate >= :start AND b.session.sessionDate <= :end)
                      )) AS enrolledCount,
                   (SELECT COUNT(a.id) FROM SessionAttendance a
                    JOIN a.session s
                    JOIN a.member am
                    JOIN am.user au
                    WHERE s.gymClass.id = c.id
                      AND LOWER(s.status) <> 'cancelled'
                      AND au.deletedAt IS NULL
                      AND LOWER(a.status) IN ('present', 'late')
                      AND s.sessionDate >= :start AND s.sessionDate <= :end) AS presentCount,
                   (SELECT COUNT(s2.id) FROM ClassSession s2
                    WHERE s2.gymClass.id = c.id
                      AND LOWER(s2.status) <> 'cancelled'
                      AND s2.sessionDate >= :start AND s2.sessionDate <= :end) AS sessionCount
            FROM GymClass c
            LEFT JOIN c.discipline d
            LEFT JOIN c.room r
            WHERE LOWER(c.status) <> 'archived'
            ORDER BY c.id
            """)
    /** Mức sử dụng mọi lớp trong khoảng ngày: sức chứa, học viên đang ghi danh, lượt có mặt và số buổi không bị hủy. */
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
                   (SELECT COUNT(DISTINCT m.userId) FROM Member m
                    JOIN m.user mu
                    WHERE mu.deletedAt IS NULL
                      AND (
                          (EXISTS (SELECT 1 FROM ClassSession s0
                                   WHERE s0.gymClass.id = c.id
                                     AND LOWER(s0.status) <> 'cancelled'
                                     AND s0.sessionDate >= :start AND s0.sessionDate <= :end)
                           AND EXISTS (SELECT 1 FROM ClassEnrollment e
                                       WHERE e.member = m AND e.gymClass.id = c.id
                                         AND LOWER(e.status) IN ('booked', 'completed')
                                         AND (e.enrolledAt IS NULL OR e.enrolledAt < :endTs)
                                         AND (e.cancelledAt IS NULL OR e.cancelledAt >= :startTs)))
                          OR EXISTS (SELECT 1 FROM SessionBooking b
                                     WHERE b.member = m AND b.session.gymClass.id = c.id
                                       AND LOWER(b.status) IN ('booked', 'completed')
                                       AND LOWER(b.session.status) <> 'cancelled'
                                       AND b.session.sessionDate >= :start AND b.session.sessionDate <= :end)
                      )) AS enrolledCount,
                   (SELECT COUNT(a.id) FROM SessionAttendance a
                    JOIN a.session s
                    JOIN a.member am
                    JOIN am.user au
                    WHERE s.gymClass.id = c.id
                      AND LOWER(s.status) <> 'cancelled'
                      AND au.deletedAt IS NULL
                      AND LOWER(a.status) IN ('present', 'late')
                      AND s.sessionDate >= :start AND s.sessionDate <= :end) AS presentCount,
                   (SELECT COUNT(s2.id) FROM ClassSession s2
                    WHERE s2.gymClass.id = c.id
                      AND LOWER(s2.status) <> 'cancelled'
                      AND s2.sessionDate >= :start AND s2.sessionDate <= :end) AS sessionCount
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
