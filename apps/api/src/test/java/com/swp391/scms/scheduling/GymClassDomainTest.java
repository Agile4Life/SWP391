package com.swp391.scms.scheduling;

import com.swp391.scms.scheduling.entity.GymClass;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import static org.junit.jupiter.api.Assertions.*;

class GymClassDomainTest {

    @Test
    void testRecurringCourseFields() {
        GymClass gymClass = new GymClass();
        gymClass.setName("Yoga 101");
        gymClass.setPrice(new BigDecimal("500000.00"));
        gymClass.setStartDate(LocalDate.of(2026, 11, 30));
        gymClass.setEndDate(LocalDate.of(2026, 12, 25));
        gymClass.setRecurringDays("MONDAY,WEDNESDAY,FRIDAY");
        gymClass.setStartTime(LocalTime.of(7, 0));
        gymClass.setEndTime(LocalTime.of(8, 30));

        assertEquals(new BigDecimal("500000.00"), gymClass.getPrice());
        assertEquals(LocalDate.of(2026, 11, 30), gymClass.getStartDate());
        assertEquals(LocalDate.of(2026, 12, 25), gymClass.getEndDate());
        assertEquals("MONDAY,WEDNESDAY,FRIDAY", gymClass.getRecurringDays());
        assertEquals(LocalTime.of(7, 0), gymClass.getStartTime());
        assertEquals(LocalTime.of(8, 30), gymClass.getEndTime());
    }
}
