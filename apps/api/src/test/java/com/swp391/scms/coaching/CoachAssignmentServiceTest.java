package com.swp391.scms.coaching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.AuditLog;
import com.swp391.scms.audit.AuditLogRepository;
import com.swp391.scms.coaching.dto.*;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.coaching.service.CoachAssignmentService;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.*;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service CoachAssignmentService (coach assignment service). */
@ExtendWith(MockitoExtension.class)
class CoachAssignmentServiceTest {
    @Mock CoachRepository coaches;
    @Mock TrainingPlanRepository plans;
    @Mock CoachBookingRepository bookings;
    @Mock ClassEnrollmentRepository enrollments;
    @Mock SessionBookingRepository sessionBookings;
    @Mock ClassSessionRepository sessions;
    @Mock MembershipSubscriptionRepository subscriptions;
    @Mock MessageService messages;
    final Clock clock = Clock.fixed(Instant.parse("2026-11-04T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    final LocalDate today = LocalDate.of(2026, 11, 4);
    CoachAssignmentService service;
    Coach from, to;
    Member member;

    /** Chuẩn bị trước mỗi test: tạo CoachAssignmentService với repository giả lập. */
    @BeforeEach
    void setup() {
        service = new CoachAssignmentService(coaches, plans, bookings, enrollments, sessionBookings,
                sessions, subscriptions, messages, clock);
        from = coach(10L, "Coach Alpha"); to = coach(20L, "Coach Beta");
        member = new Member(); member.setUserId(100L); member.setMembershipCode("SOL100");
        member.setUser(user(100L, "Member One"));
        lenient().when(messages.getMessage(anyString(), any(Object[].class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }
    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (user). */
    private User user(Long id, String name) { User u = new User(); u.setId(id); u.setFullName(name); u.setStatus("active"); return u; }
    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (coach). */
    private Coach coach(Long id, String name) { Coach c = new Coach(); c.setUserId(id); c.setUser(user(id, name)); c.setEmploymentStatus("active"); return c; }
    /** Hàm trợ giúp của test: tạo kế hoạch tập mẫu. */
    private TrainingPlan plan(Long id, String status) {
        TrainingPlan p = new TrainingPlan(); p.setId(id); p.setMember(member); p.setCoach(from); p.setStatus(status);
        p.setStartDate(today.minusDays(3)); p.setEndDate(today.plusDays(30)); p.setGoal("Gain strength"); return p;
    }
    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (booking). */
    private CoachBooking booking(Long id) {
        CoachBooking b = new CoachBooking(); b.setId(id); b.setMember(member); b.setCoach(from); b.setStatus("confirmed");
        b.setBookingDate(today.plusDays(1));
        b.setStartTime(ScheduleSlot.SLOT_2.startTime());
        b.setEndTime(ScheduleSlot.SLOT_2.endTime());
        return b;
    }

    @Test void overviewSearchPrioritizesMatchingCoachAndKeepsMemberSearch() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from, to));
        when(plans.findCurrentAssignments(anyLong(), eq(today))).thenAnswer(inv ->
                inv.getArgument(0).equals(10L) ? List.of(plan(501L, "active")) : List.of());

        @SuppressWarnings("unchecked") var coachMatches = (List<CoachAssignmentOverviewDto>) service.getOverview(null, " beta ", null).get("coaches");
        assertThat(coachMatches).extracting(CoachAssignmentOverviewDto::coachName).containsExactly("Coach Beta");
        assertThat(coachMatches.getFirst().students()).isEmpty();

        @SuppressWarnings("unchecked") var memberMatches = (List<CoachAssignmentOverviewDto>) service.getOverview(null, "Member One", null).get("coaches");
        assertThat(memberMatches).extracting(CoachAssignmentOverviewDto::coachName).containsExactly("Coach Alpha");
        assertThat(memberMatches.getFirst().students()).hasSize(1);

        @SuppressWarnings("unchecked") var none = (List<CoachAssignmentOverviewDto>) service.getOverview(null, "no match", null).get("coaches");
        assertThat(none).isEmpty();
    }

    @Test void overviewShowsOneRowPerMemberForUpcomingPtSessions() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from));
        when(subscriptions.hasActiveMembership(100L, today)).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(100L, today, today.plusDays(8))).thenReturn(true);
        CoachBooking first = booking(601L), second = booking(602L);
        second.setBookingDate(today.plusDays(8));
        when(bookings.findCurrentAssignments(eq(10L), eq(today), any())).thenReturn(List.of(first, second));
        @SuppressWarnings("unchecked") List<CoachAssignmentOverviewDto> rows =
                (List<CoachAssignmentOverviewDto>) service.getOverview(10L, null, null).get("coaches");
        var students = rows.getFirst().students();
        assertThat(students).hasSize(1);
        assertThat(students.getFirst().referenceId()).isEqualTo(601L);
        assertThat(students.getFirst().sessionCount()).isEqualTo(2);
        assertThat(students.getFirst().endDate()).isEqualTo(today.plusDays(8));
        assertThat(students.getFirst().membershipIssue()).isNull();
        assertThat(rows.getFirst().ptStudentsCount()).isEqualTo(1);
    }

    @Test void overviewListsInactiveCoachOnlyWhileTheyStillHaveStudents() {
        Coach left = coach(40L, "HLV Đã nghỉ"); left.setEmploymentStatus("terminated");
        Coach idle = coach(50L, "HLV Nghỉ không học viên"); idle.setEmploymentStatus("on_leave");
        when(coaches.findActiveWithUser()).thenReturn(List.of(from));
        when(coaches.findAll()).thenReturn(List.of(from, left, idle));
        TrainingPlan held = plan(901L, "active"); held.setCoach(left);
        lenient().when(plans.findCurrentAssignments(anyLong(), eq(today))).thenReturn(List.of());
        when(plans.findCurrentAssignments(40L, today)).thenReturn(List.of(held));
        var overview = service.getOverview(null, null, null);
        @SuppressWarnings("unchecked") var rows = (List<CoachAssignmentOverviewDto>) overview.get("coaches");
        assertThat(rows).extracting(CoachAssignmentOverviewDto::coachId).containsExactly(10L, 40L);
        assertThat(rows.get(1).employmentStatus()).isEqualTo("terminated");
        assertThat((List<?>) overview.get("availableCoaches")).hasSize(1);
    }

    @Test void overviewUsesCurrentQueriesIncludesSessionMembersAndCountsDistinctStudents() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from, to));
        when(coaches.count()).thenReturn(5L);
        when(plans.findCurrentAssignments(10L, today)).thenReturn(List.of(plan(501L, "active"), plan(502L, "active")));
        GymClass group = new GymClass(); group.setId(701L); group.setName("Yoga");
        ClassSession session = new ClassSession(); session.setGymClass(group); session.setSessionDate(today.plusDays(1)); session.setStartTime(LocalTime.of(10, 0));
        SessionBooking seat = new SessionBooking(); seat.setId(801L); seat.setSession(session); seat.setMember(member); seat.setStatus("booked");
        when(sessionBookings.findCurrentCoachAssignments(eq(10L), eq(today), any())).thenReturn(List.of(seat));
        var overview = service.getOverview(10L, null, null);
        @SuppressWarnings("unchecked") List<CoachAssignmentOverviewDto> rows = (List<CoachAssignmentOverviewDto>) overview.get("coaches");
        assertThat(rows).hasSize(1); assertThat(rows.getFirst().students()).hasSize(3); assertThat(rows.getFirst().totalStudentsCount()).isEqualTo(1);
        assertThat(rows.getFirst().planStudentsCount()).isEqualTo(1); assertThat(rows.getFirst().classStudentsCount()).isEqualTo(1);
        var stats = (CoachAssignmentSummaryStatsDto) overview.get("stats");
        assertThat(stats.totalCoaches()).isEqualTo(5);
        assertThat(stats.activeCoaches()).isEqualTo(2);
        assertThat(stats.totalAssignedStudents()).isEqualTo(1); assertThat(stats.totalPlanStudents()).isEqualTo(1);
        assertThat((List<?>) overview.get("availableCoaches")).hasSize(2);
        verify(plans, never()).findByCoachUserIdOrderByCreatedAtDesc(anyLong()); verify(bookings, never()).findByCoachId(anyLong());
        verify(bookings).findCurrentAssignments(10L, today, LocalTime.of(15, 0));
    }

    @Test void overviewFlagsOnlyStudentsWhosePlanBlocksCoaching() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from));
        when(plans.findCurrentAssignments(10L, today)).thenReturn(List.of(plan(501L, "active")));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "frozen"))
                .thenReturn(List.of(new com.swp391.scms.membership.entity.MembershipSubscription()));
        @SuppressWarnings("unchecked") List<CoachAssignmentOverviewDto> rows =
                (List<CoachAssignmentOverviewDto>) service.getOverview(10L, null, null).get("coaches");
        assertThat(rows.getFirst().students().getFirst().membershipIssue()).isEqualTo("FROZEN");

        when(subscriptions.findByMemberUserIdAndStatus(100L, "frozen")).thenReturn(List.of());
        when(subscriptions.hasActiveMembership(100L, today)).thenReturn(true);
        @SuppressWarnings("unchecked") List<CoachAssignmentOverviewDto> fine =
                (List<CoachAssignmentOverviewDto>) service.getOverview(10L, null, null).get("coaches");
        assertThat(fine.getFirst().students().getFirst().membershipIssue()).isNull();
    }

    @Test void overviewCollapsesClassEnrollmentAndSessionSeatForSameMember() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from));
        GymClass group = new GymClass(); group.setId(701L); group.setName("Yoga");
        ClassEnrollment enrollment = new ClassEnrollment(); enrollment.setId(901L); enrollment.setGymClass(group); enrollment.setMember(member); enrollment.setStatus("booked");
        ClassSession session = new ClassSession(); session.setGymClass(group);
        SessionBooking seat = new SessionBooking(); seat.setSession(session); seat.setMember(member);
        when(enrollments.findCurrentCoachAssignments(eq(10L), eq(today), any())).thenReturn(List.of(enrollment));
        when(sessionBookings.findCurrentCoachAssignments(eq(10L), eq(today), any())).thenReturn(List.of(seat));
        var overview = service.getOverview(null, null, "CLASS");
        @SuppressWarnings("unchecked") var rows = (List<CoachAssignmentOverviewDto>) overview.get("coaches");
        assertThat(rows.getFirst().students()).hasSize(1); assertThat(rows.getFirst().classStudentsCount()).isEqualTo(1);
    }

    @Test void overviewSortsCoachesByNameStudentsSpecializationAndStatus() {
        Coach coachC = coach(30L, "HLV Cường");
        coachC.setSpecialization("Boxing");
        coachC.setEmploymentStatus("on_leave");

        from.getUser().setFullName("HLV Bảo");
        from.setSpecialization("Yoga");
        from.setEmploymentStatus("active");

        to.getUser().setFullName("HLV An");
        to.setSpecialization("Gym");
        to.setEmploymentStatus("active");

        when(coaches.findActiveWithUser()).thenReturn(List.of(from, coachC, to));
        // coach 10L (HLV Bảo): 2 distinct students; coach 20L (HLV An): 1 distinct student; coach 30L (HLV Cường): 0
        Member m2 = new Member();
        User u2 = new User(); u2.setId(101L); u2.setFullName("Member Hai"); u2.setStatus("active");
        m2.setUserId(101L); m2.setUser(u2); m2.setMembershipCode("SCMS-101");
        TrainingPlan p1 = plan(501L, "active");
        TrainingPlan p2 = plan(502L, "active"); p2.setMember(m2);
        when(plans.findCurrentAssignments(10L, today)).thenReturn(List.of(p1, p2));
        when(plans.findCurrentAssignments(20L, today)).thenReturn(List.of(plan(503L, "active")));
        when(plans.findCurrentAssignments(30L, today)).thenReturn(List.of());

        @SuppressWarnings("unchecked") var byNameAsc = (List<CoachAssignmentOverviewDto>) service.getOverview(null, null, null, "name", "asc").get("coaches");
        assertThat(byNameAsc).extracting(CoachAssignmentOverviewDto::coachId).containsExactly(20L, 10L, 30L);

        @SuppressWarnings("unchecked") var byNameDesc = (List<CoachAssignmentOverviewDto>) service.getOverview(null, null, null, "name", "desc").get("coaches");
        assertThat(byNameDesc).extracting(CoachAssignmentOverviewDto::coachId).containsExactly(30L, 10L, 20L);

        @SuppressWarnings("unchecked") var byStudentsDesc = (List<CoachAssignmentOverviewDto>) service.getOverview(null, null, null, "totalStudentsCount", "desc").get("coaches");
        assertThat(byStudentsDesc).extracting(CoachAssignmentOverviewDto::coachId).containsExactly(10L, 20L, 30L);

        @SuppressWarnings("unchecked") var bySpecAsc = (List<CoachAssignmentOverviewDto>) service.getOverview(null, null, null, "specialization", "asc").get("coaches");
        assertThat(bySpecAsc).extracting(CoachAssignmentOverviewDto::specialization).containsExactly("Boxing", "Gym", "Yoga");

        @SuppressWarnings("unchecked") var byStatusDesc = (List<CoachAssignmentOverviewDto>) service.getOverview(null, null, null, "employmentStatus", "desc").get("coaches");
        assertThat(byStatusDesc).extracting(CoachAssignmentOverviewDto::employmentStatus).containsExactly("on_leave", "active", "active");
    }

    @Test void overviewRejectsInvalidSortFieldOrDirection() {
        when(coaches.findActiveWithUser()).thenReturn(List.of(from));
        assertThatThrownBy(() -> service.getOverview(null, null, null, "unknownField", "asc"))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "INVALID_SORT_FIELD");
        assertThatThrownBy(() -> service.getOverview(null, null, null, "name", "up"))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "INVALID_SORT_DIRECTION");
    }
}
