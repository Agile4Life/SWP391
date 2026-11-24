package com.swp391.scms.scheduling.entity;

import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.hibernate.Length;

/** Entity mapping table classes (schema is generated code-first by Hibernate). */
@Entity
@org.hibernate.annotations.Check(name = "ck_classes_level", constraints = "level IN ('beginner','intermediate','advanced','all')")
@org.hibernate.annotations.Check(name = "ck_classes_status", constraints = "status IN ('active','inactive','archived')")
@Table(name = "classes", indexes = {@Index(name = "ix_classes_coach", columnList = "coach_id")})
public class GymClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "discipline_id", nullable = false)
    private Discipline discipline;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "capacity", nullable = false)
    private int capacity;

    @Column(name = "level", nullable = false, length = 20)
    private String level = "all";

    @Column(name = "description", length = Length.LONG32)
    private String description;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "active";

    @Column(name = "price", precision = 12, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "recurring_days", length = 100)
    private String recurringDays;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }
    /** Lấy giá trị trường discipline. */
    public Discipline getDiscipline() { return discipline; }
    /** Gán giá trị mới cho trường discipline. */
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }
    /** Lấy giá trị trường coach. */
    public Coach getCoach() { return coach; }
    /** Gán giá trị mới cho trường coach. */
    public void setCoach(Coach coach) { this.coach = coach; }
    /** Lấy giá trị trường room. */
    public Room getRoom() { return room; }
    /** Gán giá trị mới cho trường room. */
    public void setRoom(Room room) { this.room = room; }
    /** Lấy giá trị trường capacity. */
    public int getCapacity() { return capacity; }
    /** Gán giá trị mới cho trường capacity. */
    public void setCapacity(int capacity) { this.capacity = capacity; }
    /** Lấy giá trị trường level. */
    public String getLevel() { return level; }
    /** Gán giá trị mới cho trường level. */
    public void setLevel(String level) { this.level = level; }
    /** Lấy giá trị trường description. */
    public String getDescription() { return description; }
    /** Gán giá trị mới cho trường description. */
    public void setDescription(String description) { this.description = description; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường price. */
    public BigDecimal getPrice() { return price; }
    /** Gán giá trị mới cho trường price. */
    public void setPrice(BigDecimal price) { this.price = price; }
    /** Lấy giá trị trường startDate. */
    public LocalDate getStartDate() { return startDate; }
    /** Gán giá trị mới cho trường startDate. */
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    /** Lấy giá trị trường endDate. */
    public LocalDate getEndDate() { return endDate; }
    /** Gán giá trị mới cho trường endDate. */
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    /** Lấy giá trị trường recurringDays. */
    public String getRecurringDays() { return recurringDays; }
    /** Gán giá trị mới cho trường recurringDays. */
    public void setRecurringDays(String recurringDays) { this.recurringDays = recurringDays; }
    /** Lấy giá trị trường startTime. */
    public LocalTime getStartTime() { return startTime; }
    /** Gán giá trị mới cho trường startTime. */
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    /** Lấy giá trị trường endTime. */
    public LocalTime getEndTime() { return endTime; }
    /** Gán giá trị mới cho trường endTime. */
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    /** Lấy giá trị trường createdBy. */
    public User getCreatedBy() { return createdBy; }
    /** Gán giá trị mới cho trường createdBy. */
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    /** Lấy giá trị trường createdAt. */
    public LocalDateTime getCreatedAt() { return createdAt; }
    /** Gán giá trị mới cho trường createdAt. */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    /** Lấy giá trị trường updatedAt. */
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    /** Gán giá trị mới cho trường updatedAt. */
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
