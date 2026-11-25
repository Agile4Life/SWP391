package com.swp391.scms.health.entity;

import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Bảng member_progress_logs: một số đo cơ thể của hội viên (tên chỉ số, giá trị, đơn vị, người ghi, thời điểm). */
@Entity
@Table(name = "member_progress_logs")
public class MemberProgressLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    @Column(name = "metric_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal metricValue;

    @Column(length = 20)
    private String unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by", nullable = false)
    private User recordedBy;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt = LocalDateTime.now();

    // Getter và Setter.
    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }

    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }

    /** Lấy giá trị trường metricName. */
    public String getMetricName() { return metricName; }
    /** Gán giá trị mới cho trường metricName. */
    public void setMetricName(String metricName) { this.metricName = metricName; }

    /** Lấy giá trị trường metricValue. */
    public BigDecimal getMetricValue() { return metricValue; }
    /** Gán giá trị mới cho trường metricValue. */
    public void setMetricValue(BigDecimal metricValue) { this.metricValue = metricValue; }

    /** Lấy giá trị trường unit. */
    public String getUnit() { return unit; }
    /** Gán giá trị mới cho trường unit. */
    public void setUnit(String unit) { this.unit = unit; }

    /** Lấy giá trị trường recordedBy. */
    public User getRecordedBy() { return recordedBy; }
    /** Gán giá trị mới cho trường recordedBy. */
    public void setRecordedBy(User recordedBy) { this.recordedBy = recordedBy; }

    /** Lấy giá trị trường recordedAt. */
    public LocalDateTime getRecordedAt() { return recordedAt; }
    /** Gán giá trị mới cho trường recordedAt. */
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }
}
