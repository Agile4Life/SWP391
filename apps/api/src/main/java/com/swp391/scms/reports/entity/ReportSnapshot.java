package com.swp391.scms.reports.entity;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Entity mapping table report_snapshots (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_report_type", constraints = "report_type IN ('revenue','membership','class_utilization')")
@Table(name = "report_snapshots")
public class ReportSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_type", nullable = false, length = 30)
    private String reportType;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", nullable = false)
    private String data;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by")
    private User generatedBy;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường reportType. */
    public String getReportType() { return reportType; }
    /** Gán giá trị mới cho trường reportType. */
    public void setReportType(String reportType) { this.reportType = reportType; }
    /** Lấy giá trị trường periodStart. */
    public LocalDate getPeriodStart() { return periodStart; }
    /** Gán giá trị mới cho trường periodStart. */
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    /** Lấy giá trị trường periodEnd. */
    public LocalDate getPeriodEnd() { return periodEnd; }
    /** Gán giá trị mới cho trường periodEnd. */
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    /** Lấy giá trị trường data. */
    public String getData() { return data; }
    /** Gán giá trị mới cho trường data. */
    public void setData(String data) { this.data = data; }
    /** Lấy giá trị trường generatedBy. */
    public User getGeneratedBy() { return generatedBy; }
    /** Gán giá trị mới cho trường generatedBy. */
    public void setGeneratedBy(User generatedBy) { this.generatedBy = generatedBy; }
    /** Lấy giá trị trường generatedAt. */
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    /** Gán giá trị mới cho trường generatedAt. */
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
}
