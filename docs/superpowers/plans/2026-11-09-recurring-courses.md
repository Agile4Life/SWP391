# Recurring Courses & Membership Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the class scheduling and registration system from one-off, single-session bookings into full recurring courses (e.g. 2-3 sessions/week for 1 month, schedulable 2-3 weeks in advance), with quota enforcement tied to membership package tiers (1 credit = 1 course; Silver = 2, Gold = 5, Platinum = unlimited; payment required when quota exceeded).

**Architecture:** Extend JPA entity `GymClass` with course duration, recurring days, time slots, and extra fee price. Backend automatically generates all `ClassSession`s atomically while validating coach/room conflicts across all dates. Members enroll in the entire course via `ClassEnrollment`, deducting 1 credit from their subscription quota or initiating course fee payment if exceeding quota. Remove single-session booking UI.

**Tech Stack:** Java 21, Spring Boot 3, Hibernate Code-First, Supabase PostgreSQL, React 19, TypeScript, Tailwind CSS / SÖL Fitness charcoal-salmon styles.

**Spec:** [docs/superpowers/specs/2026-11-09-recurring-courses-design.md](file:///c:/Users/gkgam/OneDrive/Tài%20liệu/GitHub/SWP391_GROUP1/docs/superpowers/specs/2026-11-09-recurring-courses-design.md)

## Global Constraints

- Backend uses Java 21, Spring Boot 3, package-by-feature, DTOs, Hibernate Code-First (`ddl-auto: update`), no manual DDL migrations.
- Multilingual i18n required for all user-facing messages: both `messages_vi.properties` and `messages_en.properties` must be updated concurrently.
- Trigger P2 (capacity) and Trigger P4 (membership active) remain invariant.
- Frontend uses React + TypeScript, Plus Jakarta Sans, charcoal-salmon design tokens, native vertical scrolling.
- Single-session booking flow is completely eliminated; classes are exclusively recurring courses.

## Review Focus

- Advance scheduling date range: A course created 2 to 3 weeks in the future generates all sessions in that future date window correctly without off-by-one or timezone day drift (`Asia/Ho_Chi_Minh`).
- Atomic conflict rollback: If even 1 of the 12 generated sessions conflicts with an existing coach booking or room schedule, no `GymClass` or sessions are persisted.
- Strict quota enforcement: A Silver member with 2 used courses must be blocked from free enrollment and redirected to payment.
- Quota refund on cancellation: Cancelling an enrolled course prior to the course start date increments the member's remaining credit back by 1.
- Double-booking prevention: A member cannot enroll in the same course twice or enroll in two overlapping courses.

---

### Task 1: Backend Domain Model & DTOs for Recurring Courses

**Files:**
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/entity/GymClass.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/dto/SchedulingRequests.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/dto/SchedulingResponses.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/mapper/SchedulingMapper.java`
- Test: `apps/api/src/test/java/com/swp391/scms/scheduling/GymClassDomainTest.java`

**Interfaces:**
- Consumes: Existing `GymClass` entity, `Discipline`, `Coach`, `Room`.
- Produces: `GymClass` with `price`, `startDate`, `endDate`, `recurringDays`, `startTime`, `endTime`. `CreateRecurringClassRequest` and updated `GymClassDto`.

- [ ] **Step 1: Write the failing domain test**

Create `apps/api/src/test/java/com/swp391/scms/scheduling/GymClassDomainTest.java`:
```java
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`mvn test -Dtest=GymClassDomainTest` in `apps/api`.
Expected: FAIL with compilation errors (methods `getPrice`, `setStartDate`, etc. not found).

- [ ] **Step 3: Implement domain fields & DTOs**

Add fields to `GymClass.java`:
```java
    @Column(name = "price", precision = 12, scale = 2)
    private java.math.BigDecimal price = java.math.BigDecimal.ZERO;

    @Column(name = "start_date")
    private java.time.LocalDate startDate;

    @Column(name = "end_date")
    private java.time.LocalDate endDate;

    @Column(name = "recurring_days", length = 100)
    private String recurringDays;

    @Column(name = "start_time")
    private java.time.LocalTime startTime;

    @Column(name = "end_time")
    private java.time.LocalTime endTime;
```
Add getters and setters.

In `SchedulingRequests.java`, add:
```java
    public record CreateRecurringClassRequest(
            @NotBlank(message = "{validation.class.name.required}")
            @Size(max = 150, message = "{validation.class.name.max}")
            String name,
            @NotNull(message = "{validation.class.discipline.required}")
            Long disciplineId,
            @NotNull(message = "{validation.class.coach.required}")
            Long coachId,
            @NotNull(message = "{validation.class.room.required}")
            Long roomId,
            @NotNull(message = "{validation.class.capacity.required}")
            @Min(value = 1, message = "{validation.class.capacity.min}")
            Integer capacity,
            @Pattern(regexp = "beginner|intermediate|advanced|all", message = "{validation.class.level.invalid}")
            String level,
            String description,
            BigDecimal price,
            @NotNull(message = "{validation.class.start_date.required}")
            LocalDate startDate,
            @NotNull(message = "{validation.class.end_date.required}")
            LocalDate endDate,
            @NotEmpty(message = "{validation.class.recurring_days.required}")
            List<String> recurringDays,
            @NotNull(message = "{validation.class.start_time.required}")
            LocalTime startTime,
            @NotNull(message = "{validation.class.end_time.required}")
            LocalTime endTime
    ) {}
```

Update `SchedulingResponses.GymClassDto` and `SchedulingMapper.java` to map `price`, `startDate`, `endDate`, `recurringDays`, `startTime`, `endTime`.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=GymClassDomainTest` in `apps/api`.
Expected: PASS.

---

### Task 2: Backend Recurring Class Creation & Atomic Conflict Validation Service

**Files:**
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/service/ClassService.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/ClassController.java`
- Modify: `apps/api/src/main/resources/i18n/messages_vi.properties`
- Modify: `apps/api/src/main/resources/i18n/messages_en.properties`
- Test: `apps/api/src/test/java/com/swp391/scms/scheduling/ClassServiceRecurringTest.java`

**Interfaces:**
- Consumes: `CreateRecurringClassRequest`, `GymClassRepository`, `ClassSessionRepository`, `RoomRepository`, `CoachRepository`.
- Produces: `GymClassDto createRecurringClass(CreateRecurringClassRequest request)` with full `ClassSession` generation.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/test/java/com/swp391/scms/scheduling/ClassServiceRecurringTest.java`:
```java
package com.swp391.scms.scheduling;

import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.ClassService;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClassServiceRecurringTest {

    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private ClassSessionRepository sessions = mock(ClassSessionRepository.class);
    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private DisciplineRepository disciplines = mock(DisciplineRepository.class);
    private CoachRepository coaches = mock(CoachRepository.class);
    private RoomRepository rooms = mock(RoomRepository.class);
    private SchedulingMapper mapper = new SchedulingMapper();
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private ClassService classService;

    @BeforeEach
    void setUp() {
        classService = new ClassService(gymClasses, sessions, enrollments, disciplines, coaches, rooms, mapper, clock);
    }

    @Test
    void testCreateRecurringClassSuccess() {
        Discipline discipline = new Discipline();
        discipline.setId(1L);
        when(disciplines.findById(1L)).thenReturn(Optional.of(discipline));

        Coach coach = new Coach();
        coach.setUserId(2L);
        coach.setEmploymentStatus("active");
        when(coaches.findById(2L)).thenReturn(Optional.of(coach));

        Room room = new Room();
        room.setId(3L);
        room.setStatus("available");
        when(rooms.findById(3L)).thenReturn(Optional.of(room));

        when(gymClasses.save(any(GymClass.class))).thenAnswer(invocation -> {
            GymClass c = invocation.getArgument(0);
            c.setId(10L);
            return c;
        });

        // Advance schedule: 3 weeks later (2026-11-30 to 2026-12-11), Mon & Wed = 4 sessions
        CreateRecurringClassRequest req = new CreateRecurringClassRequest(
                "Yoga Advance", 1L, 2L, 3L, 20, "beginner", "Description",
                new BigDecimal("500000"),
                LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 11),
                List.of("MONDAY", "WEDNESDAY"),
                LocalTime.of(7, 0), LocalTime.of(8, 30)
        );

        GymClassDto result = classService.createRecurringClass(req);

        assertNotNull(result);
        assertEquals(10L, result.id());
        verify(sessions, atLeast(4)).saveAndFlush(any(ClassSession.class));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -Dtest=ClassServiceRecurringTest` in `apps/api`.
Expected: FAIL with method not found `createRecurringClass`.

- [ ] **Step 3: Implement `createRecurringClass` in `ClassService.java`**

Implement:
1. Validate inputs (`endDate >= startDate`, `endTime > startTime`, `startDate` in the future).
2. Calculate date list:
```java
List<LocalDate> sessionDates = new ArrayList<>();
Set<DayOfWeek> days = request.recurringDays().stream().map(String::toUpperCase).map(DayOfWeek::valueOf).collect(Collectors.toSet());
for (LocalDate date = request.startDate(); !date.isAfter(request.endDate()); date = date.plusDays(1)) {
    if (days.contains(date.getDayOfWeek())) {
        sessionDates.add(date);
    }
}
if (sessionDates.isEmpty()) {
    throw new BadRequestException("SCHEDULING_NO_SESSIONS_MATCHED", "error.scheduling.no_sessions_matched", null, "Không có buổi học nào phù hợp với các thứ trong tuần đã chọn");
}
```
3. Loop through all `sessionDates` and verify no conflict with `ensureNoSessionConflict` for room and coach.
4. Save `GymClass` and batch save `ClassSession`s.
5. In `ClassController.java`, add `POST /api/classes/recurring` and support `POST /api/classes` with `CreateRecurringClassRequest`.

Add i18n keys to `messages_vi.properties` and `messages_en.properties`.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=ClassServiceRecurringTest` in `apps/api`.
Expected: PASS.

---

### Task 3: Backend Quota Calculation & Course Enrollment Service

**Files:**
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/service/EnrollmentService.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/EnrollmentController.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/dto/EnrollmentResponses.java`
- Test: `apps/api/src/test/java/com/swp391/scms/scheduling/CourseQuotaEnrollmentTest.java`

**Interfaces:**
- Consumes: `AuthenticatedPrincipal`, `classId`, `MembershipSubscriptionRepository`, `ClassEnrollmentRepository`.
- Produces:
  - `QuotaDto getMemberCourseQuota(AuthenticatedPrincipal principal)`
  - `EnrollmentDto enrollCourse(AuthenticatedPrincipal principal, Long classId)`
  - `EnrollmentDto cancelCourseEnrollment(AuthenticatedPrincipal principal, Long classId)`

- [ ] **Step 1: Write the failing quota and course enrollment test**

Create `apps/api/src/test/java/com/swp391/scms/scheduling/CourseQuotaEnrollmentTest.java`:
```java
package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.QuotaDto;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CourseQuotaEnrollmentTest {

    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private MemberRepository members = mock(MemberRepository.class);
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private EnrollmentService enrollmentService;

    @BeforeEach
    void setUp() {
        enrollmentService = new EnrollmentService(enrollments, null, gymClasses, subscriptions, members, null, null, clock);
    }

    @Test
    void testSilverQuotaCalculation() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER", List.of());
        Member member = new Member();
        member.setUserId(100L);
        when(members.findById(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setName("SILVER");
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(100L, "booked", sub.getStartDate(), sub.getEndDate())).thenReturn(1L);

        QuotaDto quota = enrollmentService.getMemberCourseQuota(principal);
        assertEquals("SILVER", quota.tier());
        assertEquals(2, quota.totalCredits());
        assertEquals(1, quota.usedCredits());
        assertEquals(1, quota.remainingCredits());
        assertFalse(quota.unlimited());
    }

    @Test
    void testEnrollFailsWhenQuotaExceeded() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER", List.of());
        Member member = new Member();
        member.setUserId(100L);
        when(members.findById(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        // Already used 2 credits
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(100L, "booked", sub.getStartDate(), sub.getEndDate())).thenReturn(2L);

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 11, 30));
        gymClass.setCapacity(20);
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));

        assertThrows(ForbiddenException.class, () -> enrollmentService.enrollCourse(principal, 50L));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -Dtest=CourseQuotaEnrollmentTest` in `apps/api`.
Expected: FAIL with compilation errors.

- [ ] **Step 3: Implement Quota and Course Enrollment in `EnrollmentService.java`**

1. Create `QuotaDto(String tier, Integer totalCredits, int usedCredits, int remainingCredits, boolean unlimited)`.
2. Implement `getMemberCourseQuota(AuthenticatedPrincipal principal)`:
   - Find active subscription covering today.
   - If no active subscription, return 0 credits.
   - Check `package.getClassCreditLimit()`. If null, `unlimited = true`.
   - Query count of active course enrollments within subscription duration.
   - Calculate remaining credits.
3. Implement `enrollCourse(AuthenticatedPrincipal principal, Long classId)`:
   - Check quota: if remaining credits <= 0 and not unlimited, throw `ForbiddenException("SCHEDULING_COURSE_QUOTA_EXCEEDED", "error.scheduling.course_quota_exceeded", null, "Bạn đã sử dụng hết lượt đăng ký khóa học của gói tập.")`.
   - Check capacity, check existing enrollment for this member & class.
   - Create and persist `ClassEnrollment(gymClass, member, "booked", LocalDateTime.now(clock))`.
4. Implement `cancelCourseEnrollment(AuthenticatedPrincipal principal, Long classId)`:
   - Only allow cancellation if `gymClass.getStartDate().isAfter(today)`.
   - Set status to `"cancelled"`.
5. Expose endpoints in `EnrollmentController.java`:
   - `GET /api/classes/my-quota`
   - `POST /api/classes/{id}/enroll`
   - `DELETE /api/classes/{id}/enroll`
   - `GET /api/classes/my-enrollments`

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=CourseQuotaEnrollmentTest` in `apps/api`.
Expected: PASS.

---

### Task 4: Backend Payment & Checkout for Extra Courses

**Files:**
- Modify: `apps/api/src/main/java/com/swp391/scms/scheduling/service/EnrollmentService.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java`
- Modify: `apps/api/src/main/java/com/swp391/scms/finance/PaymentController.java`
- Test: `apps/api/src/test/java/com/swp391/scms/scheduling/CoursePaymentTest.java`

**Interfaces:**
- Consumes: `PaymentRepository`, `ClassEnrollmentRepository`, `VnpayGateway`.
- Produces: `PaymentDto checkoutCourse(AuthenticatedPrincipal principal, Long classId, String method)` and payment activation handler.

- [ ] **Step 1: Write failing course payment test**

Create `apps/api/src/test/java/com/swp391/scms/scheduling/CoursePaymentTest.java`:
Verify that when a member enrolls in a course with fee, a `Payment` record is created linking `classEnrollmentId`, and once payment is successful, `ClassEnrollment` status is set to `booked`.

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -Dtest=CoursePaymentTest` in `apps/api`.
Expected: FAIL.

- [ ] **Step 3: Implement Course Checkout & Activation logic**

1. In `EnrollmentService.java`:
   - Add `checkoutCourse(AuthenticatedPrincipal principal, Long classId, String method)`:
     - Check course `price > 0`.
     - Create `ClassEnrollment` with initial record.
     - Call `PaymentService.createPaymentForEnrollment(member, enrollment, gymClass.getPrice(), method)`.
     - If VNPAY: return payment URL.
     - If cash: mark pending receipt for receptionist verification.
2. In `PaymentService.java`:
   - On successful payment (e.g. VNPAY IPN/Return), if `payment.getClassEnrollmentId() != null`, activate enrollment to `booked`.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -Dtest=CoursePaymentTest` in `apps/api`.
Expected: PASS.

---

### Task 5: Frontend Manager UI - Recurring Course Creator

**Files:**
- Modify: `apps/web/src/features/classes/classesApi.ts`
- Modify: `apps/web/src/features/classes/StaffClassesPage.tsx`
- Test: `apps/web/src/features/classes/StaffClassesPage.test.tsx`

**Interfaces:**
- Consumes: `classesApi.createRecurringClass`.
- Produces: Form for creating recurring courses (advance start date, days of week, time range, price). Eliminates single-session creation form.

- [ ] **Step 1: Write failing frontend test for recurring course creation**

In `apps/web/src/features/classes/StaffClassesPage.test.tsx`:
Add test verifying that the modal contains fields for "Ngày bắt đầu", "Ngày kết thúc", checkbox selection for days of the week (`T2`, `T3`, `T4`, `T5`, `T6`, `T7`, `CN`), start/end time, and "Học phí ngoài gói".

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test StaffClassesPage.test.tsx` in `apps/web`.
Expected: FAIL.

- [ ] **Step 3: Implement Recurring Course UI in `StaffClassesPage.tsx`**

1. Update `classesApi.ts` with `createRecurringClass(payload)`.
2. In `StaffClassesPage.tsx`:
   - Remove single-session creation flow.
   - Refactor the Create Class Modal:
     - Input `name`, `disciplineId`, `coachId`, `roomId`, `capacity`, `level`, `price`, `description`.
     - DatePicker for `startDate` (allowing selection 2-3 weeks in advance).
     - Quick duration selector: "4 tuần (1 tháng)" auto-calculates `endDate = startDate + 27 days`.
     - Days of week selector buttons: `['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']` with badges T2, T3, T4, T5, T6, T7, CN.
     - TimePicker for `startTime` and `endTime`.
     - On submit: call `classesApi.createRecurringClass(...)`.
     - Refresh timetable and class list upon success.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test StaffClassesPage.test.tsx` in `apps/web`.
Expected: PASS.

---

### Task 6: Frontend Member UI - Recurring Course Catalog, Quota & Enrollment

**Files:**
- Modify: `apps/web/src/features/member/memberClassesApi.ts`
- Modify: `apps/web/src/features/member/MemberClassesPage.tsx`
- Modify: `apps/web/src/features/member/member-classes.css`
- Test: `apps/web/src/features/member/MemberClassesPage.test.tsx`

**Interfaces:**
- Consumes: `memberClassesApi.getMyQuota`, `memberClassesApi.getAvailableCourses`, `memberClassesApi.enrollCourse`, `memberClassesApi.cancelCourse`.
- Produces: Clean Member course catalog with Quota Banner, Advance Course badge, 1-click enroll, payment checkout, and "Khóa học của tôi" tab.

- [ ] **Step 1: Write failing frontend test for member course enrollment & quota**

In `apps/web/src/features/member/MemberClassesPage.test.tsx`:
Add tests:
- Verifies Quota Banner displays `Gói Bạc (Silver) • Còn 1/2 khóa miễn phí`.
- Verifies clicking "Đăng ký khóa học" triggers enrollment modal with 1 credit deduction.
- Verifies when credits = 0, course displays price and checkout button.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test MemberClassesPage.test.tsx` in `apps/web`.
Expected: FAIL.

- [ ] **Step 3: Implement Member Course Catalog in `MemberClassesPage.tsx`**

1. Update `memberClassesApi.ts` with quota, course list, enroll, cancel endpoints.
2. In `MemberClassesPage.tsx`:
   - Remove individual session booking buttons and bulk session picker.
   - Add Quota Banner at the top of the page using SÖL charcoal-salmon styling.
   - Render Course Cards:
     - Badge for advance courses (e.g. "Khai giảng: 30/11/2026 - Còn 2 tuần").
     - Schedule info: "Thứ 2, 4, 6 • 07:00 - 08:30 (12 buổi)".
     - Capacity indicator: "Còn X/Y chỗ".
     - Button:
       - If `remainingCredits > 0`: `[Đăng ký khóa học (Miễn phí theo gói)]`
       - If `remainingCredits == 0`: `[Thanh toán học phí: 500.000đ]`
   - Add confirmation modal with credit balance update.
   - Add "Khóa học của tôi" tab showing enrolled courses, session calendar, and cancel button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test MemberClassesPage.test.tsx` in `apps/web`.
Expected: PASS.

---

### Task 7: Full System Verification & End-to-End Flow Check

**Files:**
- Test: `apps/api/src/test/java/com/swp391/scms/scheduling/RecurringCourseEndToEndTest.java`

- [ ] **Step 1: Write E2E test covering the complete user journey**

Verify the full scenario:
1. Manager creates a Yoga course starting in 3 weeks (Mon, Wed, Fri for 4 weeks = 12 sessions).
2. All 12 sessions appear in `class_sessions`.
3. Silver member (2 credits) enrolls in course 1 -> credits left = 1.
4. Silver member enrolls in course 2 -> credits left = 0.
5. Silver member attempts course 3 -> prompted for 500,000 VND payment.
6. Silver member cancels course 1 -> credits left restored to 1.

- [ ] **Step 2: Run all backend and frontend test suites**

Run:
- Backend: `mvn test` in `apps/api`
- Frontend: `npm test -- --run` in `apps/web`
- Frontend typecheck: `npm run build` in `apps/web`
Expected: ALL PASS.
