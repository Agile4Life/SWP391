package com.swp391.scms.reports.repository;

import com.swp391.scms.attendance.entity.SessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionAttendanceReportRepository extends JpaRepository<SessionAttendance, Long> {

    List<SessionAttendance> findBySessionGymClassId(Long classId);
}
