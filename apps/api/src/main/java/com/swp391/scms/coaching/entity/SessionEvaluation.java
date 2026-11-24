package com.swp391.scms.coaching.entity;

import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.hibernate.Length;

/** Entity mapping table session_evaluations (schema is generated code-first by Hibernate). */
@Entity
@Table(name = "session_evaluations")
public class SessionEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private ClassSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @Column(name = "performance_notes", length = Length.LONG32)
    private String performanceNotes;

    @Column(name = "progress_score", precision = 4, scale = 1)
    private BigDecimal progressScore;

    @Column(name = "feedback", length = Length.LONG32)
    private String feedback;

    @Column(name = "evaluated_at", nullable = false)
    private LocalDateTime evaluatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Lấy giá trị trường session. */
    public ClassSession getSession() { return session; }
    /** Gán giá trị mới cho trường session. */
    public void setSession(ClassSession session) { this.session = session; }
    /** Lấy giá trị trường member. */
    public Member getMember() { return member; }
    /** Gán giá trị mới cho trường member. */
    public void setMember(Member member) { this.member = member; }
    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }
    /** Lấy giá trị trường performanceNotes. */
    public String getPerformanceNotes() { return performanceNotes; }
    /** Gán giá trị mới cho trường performanceNotes. */
    public void setPerformanceNotes(String performanceNotes) { this.performanceNotes = performanceNotes; }
    /** Lấy giá trị trường progressScore. */
    public BigDecimal getProgressScore() { return progressScore; }
    /** Gán giá trị mới cho trường progressScore. */
    public void setProgressScore(BigDecimal progressScore) { this.progressScore = progressScore; }
    /** Lấy giá trị trường feedback. */
    public String getFeedback() { return feedback; }
    /** Gán giá trị mới cho trường feedback. */
    public void setFeedback(String feedback) { this.feedback = feedback; }
    /** Lấy giá trị trường evaluatedAt. */
    public LocalDateTime getEvaluatedAt() { return evaluatedAt; }
    /** Gán giá trị mới cho trường evaluatedAt. */
    public void setEvaluatedAt(LocalDateTime evaluatedAt) { this.evaluatedAt = evaluatedAt; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
