package com.swp391.scms.attendance.entity;

/**
 * Trạng thái điểm danh, khớp ràng buộc CHECK của database: present, absent, late, excused.
 *
 * Enum trạng thái điểm danh khớp ràng buộc CHECK của database: ck_attendance_status: status IN
 * ('present','absent','late','excused').
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

    /** Lấy giá trị trường value. */
    public String getValue() {
        return value;
    }

    /**
     * Đổi chuỗi (giá trị thường hoặc tên enum, không phân biệt hoa thường) thành trạng thái; không khớp thì
     * null.
     */
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
