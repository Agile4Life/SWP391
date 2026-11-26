package com.swp391.scms.common;

import com.swp391.scms.common.exception.BadRequestException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Nguồn chuẩn duy nhất cho 5 khung giờ cố định (07:00 – 20:30, mỗi slot 2h30) dùng chung cho lớp học nhóm định kỳ và buổi PT 1:1.
 */
public enum ScheduleSlot {
    SLOT_1(1, LocalTime.of(7, 0), LocalTime.of(9, 30)),
    SLOT_2(2, LocalTime.of(9, 45), LocalTime.of(12, 15)),
    SLOT_3(3, LocalTime.of(12, 30), LocalTime.of(15, 0)),
    SLOT_4(4, LocalTime.of(15, 15), LocalTime.of(17, 45)),
    SLOT_5(5, LocalTime.of(18, 0), LocalTime.of(20, 30));

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    public static final String INVALID_SLOT_FALLBACK_MESSAGE =
            "Choose one of the 5 fixed slots (07:00–09:30, 09:45–12:15, 12:30–15:00, 15:15–17:45, 18:00–20:30).";

    private final int slotNumber;
    private final LocalTime startTime;
    private final LocalTime endTime;

    ScheduleSlot(int slotNumber, LocalTime startTime, LocalTime endTime) {
        this.slotNumber = slotNumber;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public int slotNumber() {
        return slotNumber;
    }

    public LocalTime startTime() {
        return startTime;
    }

    public LocalTime endTime() {
        return endTime;
    }

    public String label() {
        return "Slot " + slotNumber;
    }

    public String timeRange() {
        return startTime.format(HH_MM) + " – " + endTime.format(HH_MM);
    }

    /**
     * Tra cứu slot khớp chính xác giờ/phút (không có giây hoặc nano giây).
     */
    public static Optional<ScheduleSlot> fromRange(LocalTime start, LocalTime end) {
        if (start == null || end == null) {
            return Optional.empty();
        }
        if (start.getSecond() != 0 || start.getNano() != 0 || end.getSecond() != 0 || end.getNano() != 0) {
            return Optional.empty();
        }
        for (ScheduleSlot slot : values()) {
            if (slot.startTime.equals(start) && slot.endTime.equals(end)) {
                return Optional.of(slot);
            }
        }
        return Optional.empty();
    }

    /** Kiểm tra cặp giờ có thuộc 1 trong 5 slot cố định hay không. */
    public static boolean isValid(LocalTime start, LocalTime end) {
        return fromRange(start, end).isPresent();
    }

    /** Yêu cầu cặp giờ thuộc 1 trong 5 slot cố định; sai ném 400 {@code SCHEDULING_INVALID_SLOT}. */
    public static ScheduleSlot requireValid(LocalTime start, LocalTime end) {
        return requireValid(start, end, "SCHEDULING_INVALID_SLOT", "error.scheduling.invalid_slot");
    }

    /** Yêu cầu cặp giờ thuộc 1 trong 5 slot cố định với mã lỗi và message key tùy chỉnh. */
    public static ScheduleSlot requireValid(LocalTime start, LocalTime end, String errorCode, String messageKey) {
        return fromRange(start, end).orElseThrow(() -> new BadRequestException(
                errorCode,
                messageKey,
                null,
                INVALID_SLOT_FALLBACK_MESSAGE));
    }
}
