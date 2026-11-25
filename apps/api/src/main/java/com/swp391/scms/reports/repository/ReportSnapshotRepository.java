package com.swp391.scms.reports.repository;

import com.swp391.scms.reports.entity.ReportSnapshot;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Truy cập bảng report_snapshots (ảnh chụp số liệu báo cáo). */
@Repository
public interface ReportSnapshotRepository extends JpaRepository<ReportSnapshot, Long> {

    /** Tìm các bản ghi có reportType = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ReportSnapshot> findByReportType(String reportType);

    /** Tìm các bản ghi có periodStart nằm trong khoảng hai tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<ReportSnapshot> findByPeriodStartBetween(LocalDate start, LocalDate end);

    /** Lấy các bản ghi mới nhất kèm người tạo, có giới hạn số lượng theo trang. */
    @EntityGraph(attributePaths = "generatedBy")
    List<ReportSnapshot> findAllByOrderByGeneratedAtDesc(Pageable pageable);

    /**
     * Lấy mọi bản ghi kèm người tạo, sắp xếp theo generatedAt giảm dần (giữ tương thích cho caller cũ).
     */
    @EntityGraph(attributePaths = "generatedBy")
    List<ReportSnapshot> findAllByOrderByGeneratedAtDesc();

    /** Lấy chi tiết một ảnh chụp báo cáo kèm người tạo. */
    @Override
    @EntityGraph(attributePaths = "generatedBy")
    Optional<ReportSnapshot> findById(Long id);
}
