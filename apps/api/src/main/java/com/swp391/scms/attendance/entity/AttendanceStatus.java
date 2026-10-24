package com.swp391.scms.attendance.entity;

/**
 * Attendance status enum matching database check constraint:
 * ck_attendance_status: status IN ('present','absent','late','excused')
 */
public enum AttendanceStatus {
    PRESENT("present"),
    ABSENT("absent"),
    LATE("late"),
    EXCUSED("excused");

    private final String value;

    AttendanceStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static AttendanceStatus fromString(String text) {
        if (text == null) {
            return null;
        }
        for (AttendanceStatus status : AttendanceStatus.values()) {
            if (status.value.equalsIgnoreCase(text.trim()) || status.name().equalsIgnoreCase(text.trim())) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown attendance status: " + text);
    }
}
