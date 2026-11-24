package com.swp391.scms.reports.repository;

import com.swp391.scms.reports.entity.ReportSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReportSnapshotRepository extends JpaRepository<ReportSnapshot, Long> {

    /** Tìm các bản ghi có reportType = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ReportSnapshot> findByReportType(String reportType);

    /** Tìm các bản ghi có periodStart nằm trong khoảng hai tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ReportSnapshot> findByPeriodStartBetween(LocalDate start, LocalDate end);

    /**
     * Tìm các bản ghi có  = tham số, sắp xếp theo generatedAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<ReportSnapshot> findAllByOrderByGeneratedAtDesc();
}
