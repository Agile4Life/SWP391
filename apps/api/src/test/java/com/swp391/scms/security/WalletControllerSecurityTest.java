package com.swp391.scms.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.service.VnpayPaymentService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.wallet.CounterTopupService;
import com.swp391.scms.wallet.WalletController;
import com.swp391.scms.wallet.WalletService;
import java.math.BigDecimal;
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
 * Kiểm thử HTTP/Security cho WalletController (/api/v1/wallet/**): xác nhận chuỗi filter SecurityConfig và
 * @PreAuthorize khớp hoàn toàn cho các vai trò hội viên và nhân sự quầy.
 */
@WebMvcTest(controllers = WalletController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class})
class WalletControllerSecurityTest {

    private static final String TOPUP_BODY = "{\"amount\":100000}";
    private static final String PAY_BODY = "{\"subscriptionId\":10}";
    private static final String COUNTER_TOPUP_BODY = """
            {
              "amount": 200000,
              "paymentMethod": "cash",
              "note": "Nap tai quay",
              "clientRequestId": "req-12345678"
            }
            """;

    @Autowired MockMvc mvc;
    @MockitoBean WalletService walletService;
    @MockitoBean VnpayPaymentService vnpayPaymentService;
    @MockitoBean CounterTopupService counterTopupService;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "actor-" + role.toLowerCase(), role),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Người chưa đăng nhập bị chặn 401 ở mọi endpoint ví. */
    @Test
    void anonymousCannotAccessAnyWalletEndpoint() throws Exception {
        mvc.perform(get("/api/v1/wallet/my")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/wallet/topup/vnpay")
                        .contentType(MediaType.APPLICATION_JSON).content(TOPUP_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/wallet/pay")
                        .contentType(MediaType.APPLICATION_JSON).content(PAY_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/wallet/members/20")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/wallet/members/20/topup")
                        .contentType(MediaType.APPLICATION_JSON).content(COUNTER_TOPUP_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/wallet/counter-topups")).andExpect(status().isUnauthorized());
        verifyNoInteractions(walletService, vnpayPaymentService, counterTopupService);
    }

    /** Nạp VNPay và thanh toán bằng ví chỉ dành cho MEMBER; mọi vai trò khác nhận 403. */
    @Test
    void memberTopupAndPayForbidNonMemberRoles() throws Exception {
        for (String role : List.of("RECEPTIONIST", "STAFF", "COACH", "CENTER_MANAGER", "MANAGER", "ADMIN")) {
            mvc.perform(post("/api/v1/wallet/topup/vnpay").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(TOPUP_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/wallet/pay").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(PAY_BODY))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(vnpayPaymentService);
    }

    /** Hội viên xem ví, tạo liên kết nạp VNPay và thanh toán bằng ví thành công; /my mở cho mọi tài khoản đã đăng nhập. */
    @Test
    void memberCanUseMyWalletTopupAndPay() throws Exception {
        mvc.perform(get("/api/v1/wallet/my").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/wallet/my").with(authentication(actor("RECEPTIONIST"))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/wallet/topup/vnpay").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(TOPUP_BODY))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/wallet/pay").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content(PAY_BODY))
                .andExpect(status().isOk());

        verify(walletService, times(2)).getMyWallet(10L);
        verify(vnpayPaymentService).topupWallet(any(), eq(new BigDecimal("100000")), any(), isNull());
        verify(vnpayPaymentService).payWithWallet(any(), any());
    }

    /** Hội viên, HLV và Admin không thể xem ví hội viên khác, nạp tiền tại quầy hay xem lịch sử nạp tại quầy. */
    @Test
    void nonCounterRolesCannotAccessCounterWalletEndpoints() throws Exception {
        for (String role : List.of("MEMBER", "COACH", "ADMIN")) {
            mvc.perform(get("/api/v1/wallet/members/20").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/wallet/members/20/topup").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(COUNTER_TOPUP_BODY))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/wallet/counter-topups").with(authentication(actor(role))))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(walletService, counterTopupService);
    }

    /** Lễ tân, nhân viên quầy và quản lý truy cập được toàn bộ endpoint ví tại quầy. */
    @Test
    void counterRolesCanManageMemberWalletsAndReadTopupHistory() throws Exception {
        List<String> allowed = List.of("RECEPTIONIST", "STAFF", "CENTER_MANAGER", "MANAGER");
        for (String role : allowed) {
            mvc.perform(get("/api/v1/wallet/members/20").with(authentication(actor(role))))
                    .andExpect(status().isOk());
            mvc.perform(post("/api/v1/wallet/members/20/topup").with(authentication(actor(role)))
                            .contentType(MediaType.APPLICATION_JSON).content(COUNTER_TOPUP_BODY))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/v1/wallet/counter-topups").param("days", "7")
                            .with(authentication(actor(role))))
                    .andExpect(status().isOk());
        }
        verify(walletService, times(allowed.size())).getMemberWallet(20L);
        verify(walletService, times(allowed.size())).creditByReceptionist(
                eq(20L), eq(new BigDecimal("200000")), eq("cash"), eq("Nap tai quay"), eq(10L), eq("req-12345678"));
        verify(counterTopupService, times(allowed.size())).history(7);
    }
}
