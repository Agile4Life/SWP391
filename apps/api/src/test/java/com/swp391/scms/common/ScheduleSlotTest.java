package com.swp391.scms.common;

import com.swp391.scms.common.exception.BadRequestException;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bộ kiểm thử đơn vị cho enum 5 slot cố định {@link ScheduleSlot}. */
class ScheduleSlotTest {

    @Test
    void definesExactlyFiveCanonicalSlotsWithExpectedRangesAndLabels() {
        assertThat(ScheduleSlot.values()).containsExactly(
                ScheduleSlot.SLOT_1,
                ScheduleSlot.SLOT_2,
                ScheduleSlot.SLOT_3,
                ScheduleSlot.SLOT_4,
                ScheduleSlot.SLOT_5
        );

        assertThat(ScheduleSlot.SLOT_1.slotNumber()).isEqualTo(1);
        assertThat(ScheduleSlot.SLOT_1.label()).isEqualTo("Slot 1");
        assertThat(ScheduleSlot.SLOT_1.timeRange()).isEqualTo("07:00 – 09:30");

        assertThat(ScheduleSlot.SLOT_2.slotNumber()).isEqualTo(2);
        assertThat(ScheduleSlot.SLOT_2.label()).isEqualTo("Slot 2");
        assertThat(ScheduleSlot.SLOT_2.timeRange()).isEqualTo("09:45 – 11:15");

        assertThat(ScheduleSlot.SLOT_3.slotNumber()).isEqualTo(3);
        assertThat(ScheduleSlot.SLOT_3.label()).isEqualTo("Slot 3");
        assertThat(ScheduleSlot.SLOT_3.timeRange()).isEqualTo("11:30 – 14:00");

        assertThat(ScheduleSlot.SLOT_4.slotNumber()).isEqualTo(4);
        assertThat(ScheduleSlot.SLOT_4.label()).isEqualTo("Slot 4");
        assertThat(ScheduleSlot.SLOT_4.timeRange()).isEqualTo("14:15 – 16:45");

        assertThat(ScheduleSlot.SLOT_5.slotNumber()).isEqualTo(5);
        assertThat(ScheduleSlot.SLOT_5.label()).isEqualTo("Slot 5");
        assertThat(ScheduleSlot.SLOT_5.timeRange()).isEqualTo("17:00 – 19:30");
    }

    @Test
    void acceptsAllFiveCanonicalRanges() {
        for (ScheduleSlot slot : ScheduleSlot.values()) {
            assertThat(ScheduleSlot.fromRange(slot.startTime(), slot.endTime())).contains(slot);
            assertThat(ScheduleSlot.isValid(slot.startTime(), slot.endTime())).isTrue();
            assertThat(ScheduleSlot.requireValid(slot.startTime(), slot.endTime())).isEqualTo(slot);
        }
    }

    @Test
    void rejectsNullNonCanonicalOrSubMinuteRanges() {
        assertThat(ScheduleSlot.isValid(null, LocalTime.of(9, 30))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(7, 0), null)).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(8, 0), LocalTime.of(9, 0))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(7, 0), LocalTime.of(9, 0))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(19, 30), LocalTime.of(20, 30))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(7, 0, 1), LocalTime.of(9, 30, 0))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(7, 0, 0, 1), LocalTime.of(9, 30))).isFalse();
        assertThat(ScheduleSlot.isValid(LocalTime.of(7, 0), LocalTime.of(11, 15))).isFalse();
    }

    @Test
    void requireValidThrowsBadRequestWithExpectedCodeAndKey() {
        assertThatThrownBy(() -> ScheduleSlot.requireValid(LocalTime.of(8, 0), LocalTime.of(9, 0)))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "SCHEDULING_INVALID_SLOT")
                .hasFieldOrPropertyWithValue("messageKey", "error.scheduling.invalid_slot");

        assertThatThrownBy(() -> ScheduleSlot.requireValid(
                LocalTime.of(10, 0),
                LocalTime.of(11, 0),
                "INVALID_COACH_BOOKING_SLOT",
                "error.coach_booking.invalid_slot"))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "INVALID_COACH_BOOKING_SLOT")
                .hasFieldOrPropertyWithValue("messageKey", "error.coach_booking.invalid_slot");
    }
}
