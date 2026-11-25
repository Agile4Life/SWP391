package com.swp391.scms.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.coaching.CoachBookingController;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.users.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Kiểm thử HTTP/Security cho toàn bộ 12 endpoint của CoachBookingController (/api/v1/coach-bookings/**):
 * xác nhận đồng bộ giữa SecurityConfig và @PreAuthorize trên từng nhóm vai trò.
 */
@WebMvcTest(controllers = CoachBookingController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class CoachBookingControllerSecurityTest {

    private static final String CREATE_BOOKING_BODY = """
            {
              "coachId": 5,
              "disciplineId": 1,
              "bookingDate": "2026-12-01",
              "startTime": "07:00:00",
              "endTime": "09:30:00",
              "paymentMethod": "package_quota"
            }
            """;

    @Autowired MockMvc mvc;
    @MockitoBean CoachBookingService coachBookingService;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Người chưa đăng nhập bị chặn 401 ở mọi endpoint đặt lịch PT 1:1. */
    @Test
    void anonymousCannotAccessAnyCoachBookingEndpoint() throws Exception {
        mvc.perform(get("/api/v1/coach-bookings/coaches")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/available-slots")
                        .param("coachId", "5").param("date", "2026-12-01"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/quota-status")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/coach-bookings")
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BOOKING_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/my")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/coach-schedule")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/attendance")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/coach-bookings/7/mark-attended")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/coach-bookings/7/unmark-attended")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/coach-bookings/unpaid")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/coach-bookings/7/confirm-payment")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/coach-bookings/7")).andExpect(status().isUnauthorized());
        verifyNoInteractions(coachBookingService);
    }

    /** Danh sách HLV và slot trống cho phép mọi tài khoản đã đăng nhập truy cập. */
    @Test
    void authenticatedUsersCanReadCoachesAndAvailableSlots() throws Exception {
        List<String> roles = List.of("MEMBER", "COACH", "RECEPTIONIST", "CENTER_MANAGER", "ADMIN");
        for (String role : roles) {
            mvc.perform(get("/api/v1/coach-bookings/coaches").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/v1/coach-bookings/available-slots")
                            .param("coachId", "5").param("date", "2026-12-01")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(coachBookingService, times(roles.size())).getPublicCoaches();
        verify(coachBookingService, times(roles.size())).getAvailableSlots(5L, LocalDate.of(2026, 12, 1), 10L);
    }

    /** Hạn mức PT, tạo booking mới và danh sách lịch cá nhân chỉ dành cho MEMBER. */
    @Test
    void memberOnlyEndpointsForbidStaffCoachAndAdmin() throws Exception {
        for (String role : List.of("COACH", "RECEPTIONIST", "STAFF", "CENTER_MANAGER", "ADMIN")) {
            mvc.perform(get("/api/v1/coach-bookings/quota-status").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/coach-bookings").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(CREATE_BOOKING_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/coach-bookings/my").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(coachBookingService);

        mvc.perform(get("/api/v1/coach-bookings/quota-status").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/coach-bookings").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BOOKING_BODY))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/coach-bookings/my").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());

        verify(coachBookingService).getMemberQuotaStatus(10L);
        verify(coachBookingService).createBooking(any(), any());
        verify(coachBookingService).getMemberBookings(10L);
    }

    /** Lịch dạy kèm 1:1 chỉ mở cho COACH và CENTER_MANAGER. */
    @Test
    void coachScheduleAllowsOnlyCoachAndCenterManager() throws Exception {
        for (String role : List.of("MEMBER", "RECEPTIONIST", "STAFF", "ADMIN")) {
            mvc.perform(get("/api/v1/coach-bookings/coach-schedule").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(coachBookingService);

        mvc.perform(get("/api/v1/coach-bookings/coach-schedule").with(authentication(actor("COACH"))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/coach-bookings/coach-schedule").param("coachId", "8")
                        .with(authentication(actor("CENTER_MANAGER"))))
                .andExpect(status().isOk());
        verify(coachBookingService).getCoachSchedule(10L);
        verify(coachBookingService).getCoachSchedule(8L);
    }

    /** Điểm danh buổi 1:1 cho phép COACH, RECEPTIONIST, CENTER_MANAGER và chặn MEMBER/STAFF/ADMIN. */
    @Test
    void attendanceEndpointsAllowCoachReceptionistAndCenterManagerOnly() throws Exception {
        for (String role : List.of("MEMBER", "STAFF", "ADMIN")) {
            mvc.perform(get("/api/v1/coach-bookings/attendance").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/coach-bookings/7/mark-attended").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/coach-bookings/7/unmark-attended").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(coachBookingService);

        List<String> allowed = List.of("COACH", "RECEPTIONIST", "CENTER_MANAGER");
        for (String role : allowed) {
            mvc.perform(get("/api/v1/coach-bookings/attendance").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/coach-bookings/7/mark-attended").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/coach-bookings/7/unmark-attended").with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(coachBookingService, times(allowed.size())).getAttendance(any(), isNull(), isNull(), isNull());
        verify(coachBookingService, times(allowed.size())).markAttended(any(), eq(7L));
        verify(coachBookingService, times(allowed.size())).unmarkAttended(any(), eq(7L));
    }

    /** Thu tiền buổi 1:1 chưa thanh toán chỉ mở cho RECEPTIONIST và CENTER_MANAGER. */
    @Test
    void unpaidAndConfirmPaymentAllowOnlyReceptionistAndCenterManager() throws Exception {
        for (String role : List.of("MEMBER", "COACH", "STAFF", "ADMIN")) {
            mvc.perform(get("/api/v1/coach-bookings/unpaid").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/coach-bookings/7/confirm-payment").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(coachBookingService);

        for (String role : List.of("RECEPTIONIST", "CENTER_MANAGER")) {
            mvc.perform(get("/api/v1/coach-bookings/unpaid").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/coach-bookings/7/confirm-payment").param("method", "cash")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(coachBookingService, times(2)).getUnpaidBookings(any());
        verify(coachBookingService, times(2)).confirmHourlyPayment(any(), eq(7L), eq("cash"));
    }

    /** Hủy booking 1:1 chỉ mở cho MEMBER, COACH và CENTER_MANAGER; chặn RECEPTIONIST/STAFF/ADMIN. */
    @Test
    void cancelBookingAllowsMemberCoachAndCenterManagerOnly() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "ADMIN")) {
            mvc.perform(delete("/api/v1/coach-bookings/7").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(coachBookingService);

        for (String role : List.of("MEMBER", "COACH", "CENTER_MANAGER")) {
            mvc.perform(delete("/api/v1/coach-bookings/7").param("reason", "Ban dot xuat")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(coachBookingService, times(3)).cancelBooking(any(), eq(7L), eq("Ban dot xuat"));
    }
}
