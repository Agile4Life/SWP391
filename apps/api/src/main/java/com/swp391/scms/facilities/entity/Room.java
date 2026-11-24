package com.swp391.scms.facilities.entity;

import jakarta.persistence.*;
import java.time.LocalTime;

/** Entity mapping table rooms (Module B: Master Facilities). */
@Entity
@org.hibernate.annotations.Check(name = "ck_rooms_status", constraints = "status IN ('available','maintenance','closed')")
@Table(name = "rooms")
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 150)
    private String location;

    @Column(nullable = false)
    private int capacity;

    @Column(nullable = false, length = 20)
    private String status = "available"; // available, maintenance, closed

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "discipline_id")
    private Discipline discipline;

    @Column(name = "open_time")
    private LocalTime openTime;

    @Column(name = "close_time")
    private LocalTime closeTime;

    @Column(length = 30)
    private String tier = "STANDARD"; // STANDARD, PLATINUM

    /** Lấy giá trị trường id. */
    public Long getId() { return id; }
    /** Gán giá trị mới cho trường id. */
    public void setId(Long id) { this.id = id; }
    /** Lấy giá trị trường discipline. */
    public Discipline getDiscipline() { return discipline; }
    /** Gán giá trị mới cho trường discipline. */
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }
    /** Lấy giá trị trường openTime. */
    public LocalTime getOpenTime() { return openTime; }
    /** Gán giá trị mới cho trường openTime. */
    public void setOpenTime(LocalTime openTime) { this.openTime = openTime; }
    /** Lấy giá trị trường closeTime. */
    public LocalTime getCloseTime() { return closeTime; }
    /** Gán giá trị mới cho trường closeTime. */
    public void setCloseTime(LocalTime closeTime) { this.closeTime = closeTime; }
    /** Lấy giá trị trường name. */
    public String getName() { return name; }
    /** Gán giá trị mới cho trường name. */
    public void setName(String name) { this.name = name; }
    /** Lấy giá trị trường location. */
    public String getLocation() { return location; }
    /** Gán giá trị mới cho trường location. */
    public void setLocation(String location) { this.location = location; }
    /** Lấy giá trị trường capacity. */
    public int getCapacity() { return capacity; }
    /** Gán giá trị mới cho trường capacity. */
    public void setCapacity(int capacity) { this.capacity = capacity; }
    /** Lấy giá trị trường status. */
    public String getStatus() { return status; }
    /** Gán giá trị mới cho trường status. */
    public void setStatus(String status) { this.status = status; }
    /** Lấy giá trị trường tier. */
    public String getTier() { return tier; }
    /** Gán giá trị mới cho trường tier. */
    public void setTier(String tier) { this.tier = tier; }
}
