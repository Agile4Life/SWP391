package com.swp391.scms.scheduling.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Schema(description = "Thông tin đăng ký buổi học/lớp học của hội viên")
public class ClassEnrollmentDto {

    @Schema(description = "Mã lượt đăng ký", example = "10")
    private Long id;

    @Schema(description = "Mã lớp học", example = "5")
    private Long classId;

    @Schema(description = "Tên lớp học", example = "Yoga Vinyasa Nâng Cao")
    private String className;

    @Schema(description = "Tên huấn luyện viên", example = "Nguyễn Văn HLV")
    private String coachName;

    @Schema(description = "Tên phòng tập", example = "Studio A")
    private String roomName;

    @Schema(description = "Ngày diễn ra buổi học", example = "2026-10-15")
    private LocalDate sessionDate;

    @Schema(description = "Giờ bắt đầu buổi học", example = "08:00:00")
    private LocalTime startTime;

    @Schema(description = "Giờ kết thúc buổi học", example = "09:30:00")
    private LocalTime endTime;

    @Schema(description = "Trạng thái đặt chỗ (booked, cancelled, completed)", example = "booked")
    private String status;

    @Schema(description = "Thời điểm đăng ký")
    private LocalDateTime createdAt;

    @Schema(description = "Thời điểm hủy đặt chỗ (nếu có)")
    private LocalDateTime cancelledAt;

    @Schema(description = "Lý do hủy đặt chỗ (nếu có)")
    private String cancelReason;

    public ClassEnrollmentDto() {
    }

    public ClassEnrollmentDto(Long id, Long classId, String className, String coachName,
                              String roomName, LocalDate sessionDate, LocalTime startTime,
                              LocalTime endTime, String status, LocalDateTime createdAt,
                              LocalDateTime cancelledAt, String cancelReason) {
        this.id = id;
        this.classId = classId;
        this.className = className;
        this.coachName = coachName;
        this.roomName = roomName;
        this.sessionDate = sessionDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.status = status;
        this.createdAt = createdAt;
        this.cancelledAt = cancelledAt;
        this.cancelReason = cancelReason;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClassId() {
        return classId;
    }

    public void setClassId(Long classId) {
        this.classId = classId;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getCoachName() {
        return coachName;
    }

    public void setCoachName(String coachName) {
        this.coachName = coachName;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public LocalDate getSessionDate() {
        return sessionDate;
    }

    public void setSessionDate(LocalDate sessionDate) {
        this.sessionDate = sessionDate;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(LocalDateTime cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }
}
