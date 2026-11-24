package com.swp391.scms.security;

import com.swp391.scms.audit.AuditController;
import com.swp391.scms.audit.AuditService;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.reports.ReportController;
import com.swp391.scms.reports.service.RevenueReportService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({AuditController.class, ReportController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
/** Bộ kiểm thử cho AuditOccupancySecurity (audit occupancy security). */
class AuditOccupancySecurityTest {
    @Autowired MockMvc mvc;
    @Autowired AuditController auditController;
    @Autowired ReportController reportController;
    @MockitoBean AuditService audit;
    @MockitoBean RevenueReportService reports;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    /** Kiểm thử: admin đọc được audit và công suất nhưng không đọc được doanh thu. */
    @Test
    void adminCanReadAuditAndOccupancyButNotRevenue() throws Exception {
        mvc.perform(get("/api/v1/admin/audit-logs").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/reports/class-utilization").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk());
        for (String path : new String[]{"revenue/daily", "revenue/by-package", "transactions/recent", "renewal-rate", "snapshots"}) {
            mvc.perform(get("/api/v1/reports/" + path).with(user("admin").roles("ADMIN")))
                    .andExpect(status().isForbidden());
        }
    }

    /** Kiểm thử: quản lý vẫn xem được báo cáo nhưng không đọc được audit. */
    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CENTER_MANAGER"})
    void managerKeepsReportsButCannotReadAudit(String role) throws Exception {
        mvc.perform(get("/api/v1/admin/audit-logs").with(user("manager").roles(role)))
                .andExpect(status().isForbidden());
        for (String path : new String[]{"class-utilization", "revenue/daily", "revenue/by-package", "transactions/recent", "renewal-rate", "snapshots"}) {
            mvc.perform(get("/api/v1/reports/" + path).with(user("manager").roles(role)))
                    .andExpect(status().isOk());
        }
    }

    /** Kiểm thử: các vai trò khác không đọc được audit hoặc công suất. */
    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COACH", "STAFF", "RECEPTIONIST"})
    void otherRolesCannotReadAuditOrOccupancy(String role) throws Exception {
        for (String path : new String[]{"/api/v1/admin/audit-logs", "/api/v1/reports/class-utilization"}) {
            mvc.perform(get(path).with(user("other").roles(role))).andExpect(status().isForbidden());
        }
    }

    /** Kiểm thử: người chưa đăng nhập không đọc được audit hoặc công suất. */
    @Test
    void anonymousCannotReadAuditOrOccupancy() throws Exception {
        mvc.perform(get("/api/v1/admin/audit-logs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/reports/class-utilization")).andExpect(status().isUnauthorized());
    }

    /** Kiểm thử: method security độc lập từ chối quản lý đọc audit. */
    @Test
    @WithMockUser(roles = "MANAGER")
    void methodSecurityIndependentlyRejectsManagerAudit() {
        assertThrows(AccessDeniedException.class,
                () -> auditController.getAuditLogs(null, null, null, null, null, 0, 8));
    }

    /** Kiểm thử: method security vẫn từ chối admin đọc doanh thu. */
    @Test
    @WithMockUser(roles = "ADMIN")
    void methodSecurityStillRejectsAdminRevenue() {
        assertThrows(AccessDeniedException.class, () -> reportController.getDailyRevenue(null, null));
    }
}
