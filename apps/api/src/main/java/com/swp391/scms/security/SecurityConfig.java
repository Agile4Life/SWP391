package com.swp391.scms.security;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Cấu hình Spring Security: API không trạng thái (stateless) dùng JWT, tắt CSRF, bật CORS, trả lỗi 401/403 dạng
 * JSON và khai báo quyền truy cập cho từng nhóm đường dẫn. Lưu ý: nhiều kiểm tra quyền chi tiết vẫn nằm trong
 * service (backend luôn kiểm tra vai trò).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;
    private final RateLimitingFilter rateLimitingFilter;

    /** Constructor cho test: tự tạo RateLimitingFilter mặc định. */
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
            JsonAuthenticationEntryPoint authenticationEntryPoint,
            JsonAccessDeniedHandler accessDeniedHandler) {
        this(jwtAuthenticationFilter, authenticationEntryPoint, accessDeniedHandler, new RateLimitingFilter());
    }

    /**
     * Constructor Spring dùng: nhận các bộ lọc và bộ xử lý lỗi; nếu không có RateLimitingFilter thì tạo bản mặc
     * định.
     */
    @org.springframework.beans.factory.annotation.Autowired
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
            JsonAuthenticationEntryPoint authenticationEntryPoint,
            JsonAccessDeniedHandler accessDeniedHandler,
            @org.springframework.beans.factory.annotation.Autowired(required = false) RateLimitingFilter rateLimitingFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
        this.rateLimitingFilter = rateLimitingFilter != null ? rateLimitingFilter : new RateLimitingFilter();
    }

    /**
     * Chuỗi bộ lọc bảo mật: không dùng session, quy tắc quyền theo đường dẫn và phương thức HTTP (đặt quy tắc
     * cụ thể trước quy tắc chung), mọi đường dẫn còn lại phải đăng nhập. Bộ lọc giới hạn tần suất và bộ lọc JWT
     * chạy trước bộ lọc đăng nhập mặc định.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(org.springframework.security.config.Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(errors -> errors
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler))
            // Quy tắc phân quyền: Spring áp dụng quy tắc khớp đầu tiên, nên các đường dẫn công khai và quy tắc hẹp phải đứng trước.
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers(HttpMethod.GET, "/api/v1/public/catalog").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/vnpay/ipn").permitAll()
                    .requestMatchers("/api/v1/payments/vnpay/**").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/auth/me").authenticated()
                    .requestMatchers("/api/v1/auth/**", "/api/v1/health", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                    // Mở rộng hồ sơ (SCRUM-66)
                    .requestMatchers(HttpMethod.POST, "/api/v1/profile/avatar").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/v1/profile/coach").hasRole("COACH")
                    .requestMatchers("/api/v1/wallet/members/**", "/api/v1/wallet/counter-topups").hasAnyRole("RECEPTIONIST", "STAFF", "CENTER_MANAGER", "MANAGER")
                    .requestMatchers("/api/v1/wallet/**").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/v1/profile/receptionist").hasRole("RECEPTIONIST")
                    .requestMatchers(HttpMethod.PUT, "/api/v1/users/*/receptionist").hasRole("ADMIN")

                    // Thông báo & Yêu cầu hỗ trợ (SCRUM-67, SCRUM-68)
                    .requestMatchers("/api/v1/notifications/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/support/requests").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/support/requests/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/support/requests").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/support/requests/*/status").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST, "/api/v1/support/requests/*/escalate").hasRole("RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST, "/api/v1/support/requests/*/messages").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/support/requests/*/messages").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")

                    // Điểm danh & Check-in (SCRUM-75)
                    .requestMatchers(HttpMethod.POST, "/api/v1/check-in/scan").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/check-in/*/checkout", "/api/v1/check-in/checkout").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/check-in/history").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER", "MEMBER")
                    .requestMatchers("/api/v1/attendance/sessions/**").hasAnyRole("COACH", "CENTER_MANAGER", "RECEPTIONIST", "STAFF")

                    // Thanh toán & Hóa đơn (SCRUM-76, 77, 78)
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments/*/refund").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/payments/*/status").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/my/**").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/invoices/my/by-payment/*").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/invoices/my/by-payment/*/download").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments/process").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/*", "/api/v1/payments/member/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers("/api/v1/payments/**", "/api/v1/invoices/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers("/api/v1/wallet/members/**", "/api/v1/wallet/counter-topups").hasAnyRole("RECEPTIONIST", "STAFF", "CENTER_MANAGER", "MANAGER")

                    // Báo cáo (SCRUM-79)
                    .requestMatchers(HttpMethod.GET, "/api/v1/reports/class-utilization").hasAnyRole("ADMIN", "CENTER_MANAGER", "MANAGER")
                    .requestMatchers("/api/v1/reports/**").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .requestMatchers("/api/v1/admin/audit-logs/**", "/api/v1/admin/audit-logs").hasRole("ADMIN")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coaching/training-plans/my", "/api/v1/training-plans/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coaching/training-plans/*", "/api/v1/training-plans/*").hasAnyRole("COACH", "CENTER_MANAGER", "MEMBER")
                    .requestMatchers("/api/v1/coaching/training-plans/**", "/api/v1/coaching/training-plans",
                            "/api/v1/training-plans/**", "/api/v1/training-plans").hasAnyRole("COACH", "CENTER_MANAGER")
                    .requestMatchers("/api/v1/ai/generate-workout-plan", "/api/v1/ai/recommend",
                            "/api/v1/ai/recommendations/**").hasAnyRole("COACH", "CENTER_MANAGER")
                    .requestMatchers("/api/v1/ai/chat/**").hasAnyRole("MEMBER", "COACH", "CENTER_MANAGER", "RECEPTIONIST")

                    // Quầy lễ tân duyệt giấy tờ định danh: quầy sở hữu việc này, cổng quản lý không còn làm.
                    .requestMatchers("/api/v1/members/kyc/**").hasRole("RECEPTIONIST")

                    // Yêu cầu nội bộ của nhân viên (SCRUM-135)
                    .requestMatchers(HttpMethod.POST, "/api/v1/operations/requests").hasAnyRole("STAFF", "COACH", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/operations/requests/my").hasAnyRole("STAFF", "COACH", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.PUT, "/api/v1/operations/requests/*/cancel").hasAnyRole("STAFF", "COACH", "RECEPTIONIST")
                    .requestMatchers("/api/v1/operations/requests/**").hasAnyRole("CENTER_MANAGER", "MANAGER")

                    // Subscription membership (SCRUM-71)
                    .requestMatchers(HttpMethod.GET,
                            "/api/v1/memberships/subscriptions/pending", "/api/v1/subscriptions/pending",
                            "/api/v1/memberships/subscriptions/requests/history", "/api/v1/subscriptions/requests/history")
                            .hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    // Tạm hoãn membership chỉ do quầy lễ tân duyệt.
                    .requestMatchers(HttpMethod.GET,
                            "/api/v1/memberships/subscriptions/holds/pending", "/api/v1/subscriptions/holds/pending",
                            "/api/v1/memberships/subscriptions/holds", "/api/v1/subscriptions/holds")
                            .hasRole("RECEPTIONIST")
                    // Chủ sở hữu và quầy lễ tân đọc được yêu cầu tạm hoãn và giấy tờ y tế; service kiểm tra lại
                    // quyền sở hữu.
                    .requestMatchers(HttpMethod.GET,
                            "/api/v1/memberships/subscriptions/*/hold", "/api/v1/subscriptions/*/hold",
                            "/api/v1/memberships/subscriptions/*/hold/documents/*", "/api/v1/subscriptions/*/hold/documents/*")
                            .hasAnyRole("MEMBER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST,
                            "/api/v1/memberships/subscriptions/*/hold/withdraw", "/api/v1/subscriptions/*/hold/withdraw",
                            "/api/v1/memberships/subscriptions/*/hold/approve", "/api/v1/subscriptions/*/hold/approve",
                            "/api/v1/memberships/subscriptions/*/hold/reject", "/api/v1/subscriptions/*/hold/reject")
                            .hasRole("RECEPTIONIST")
                    // POS: nhân viên mua mới/gia hạn thay hội viên; phải đứng trước matcher MEMBER bên dưới
                    .requestMatchers(HttpMethod.GET,
                            "/api/v1/memberships/subscriptions/members/*/renewal-candidates",
                            "/api/v1/subscriptions/members/*/renewal-candidates")
                            .hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST,
                            "/api/v1/memberships/subscriptions/members/*/renew/*",
                            "/api/v1/subscriptions/members/*/renew/*")
                            .hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST,
                            "/api/v1/memberships/subscriptions/*/cancel", "/api/v1/subscriptions/*/cancel")
                            .hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/memberships/cancellations/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/memberships/cancellations/staff-request").hasAnyRole("RECEPTIONIST", "STAFF", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/memberships/cancellations").hasAnyRole("RECEPTIONIST", "STAFF", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/memberships/cancellations/*/approve", "/api/v1/memberships/cancellations/*/reject").hasRole("CENTER_MANAGER")
                    .requestMatchers("/api/v1/memberships/trial/**").hasRole("MEMBER")
                    .requestMatchers("/api/v1/memberships/subscriptions/**", "/api/v1/memberships/subscriptions",
                            "/api/v1/subscriptions/**", "/api/v1/subscriptions").hasRole("MEMBER")

                    // Xếp lịch & Ghi danh (SCRUM-72, 73, 131)
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/enrollments/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/enroll").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/enrollments/*").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    // Ghi danh / thanh toán / hủy khóa học định kỳ là thao tác của hội viên; chúng phải đứng
                    // trước các matcher ghi "/api/v1/classes/**" của CENTER_MANAGER bên dưới (khớp đầu tiên
                    // thắng).
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/*/enroll", "/api/v1/classes/*/checkout").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/*/enroll").hasRole("MEMBER")
                    // Đặt chỗ theo buổi phải đứng trước các matcher ghi "/api/v1/classes/**" của CENTER_MANAGER
                    // bên dưới.
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/bookings", "/api/v1/classes/session-bookings/bulk").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/session-bookings/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/session-bookings/cancel").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/session-bookings/*").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/cancel").hasAnyRole("COACH", "CENTER_MANAGER", "RECEPTIONIST", "STAFF")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/*/sessions", "/api/v1/classes", "/api/v1/classes/**").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .requestMatchers(HttpMethod.PUT, "/api/v1/classes/*/sessions/*", "/api/v1/classes/*", "/api/v1/classes/**").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/*", "/api/v1/classes/**").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/sessions/**", "/api/v1/classes/sessions", "/api/v1/classes", "/api/v1/classes/**").authenticated()

                    // Đặt lịch HLV 1:1 & Bộ môn yêu thích (SCRUM-133)
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/coaches").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/available-slots").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/quota-status").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/coach-schedule").hasAnyRole("COACH", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/coach-bookings/*/unmark-attended").hasAnyRole("COACH", "RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/coach-bookings/*/mark-attended").hasAnyRole("COACH", "RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/attendance").hasAnyRole("COACH", "RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/unpaid").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/coach-bookings/*/confirm-payment").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/coach-bookings").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/coach-bookings/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/coach-bookings/*").hasAnyRole("MEMBER", "COACH", "CENTER_MANAGER")
                    .requestMatchers("/api/v1/members/me/favorite-disciplines/**", "/api/v1/members/me/favorite-disciplines").hasRole("MEMBER")

                    // Người dùng, Vai trò, Tra cứu hội viên & Danh mục cơ sở vật chất
                    .requestMatchers("/api/v1/staff-accounts", "/api/v1/staff-accounts/**").hasAnyRole("CENTER_MANAGER", "ADMIN")
                    .requestMatchers("/api/v1/users", "/api/v1/users/**", "/api/v1/roles", "/api/v1/roles/**").hasRole("ADMIN")
                    .requestMatchers(HttpMethod.GET, "/api/v1/members/lookup").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/equipment/*/status").hasAnyRole("CENTER_MANAGER", "MANAGER", "STAFF", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**", "/api/v1/equipment/**").authenticated()
                    .requestMatchers("/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**", "/api/v1/equipment/**").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .requestMatchers("/api/v1/manager/coach-assignments/**", "/api/v1/manager/coach-assignments").hasAnyRole("CENTER_MANAGER", "MANAGER")
                    .anyRequest().authenticated())
            // Giới hạn tần suất chạy trước, rồi mới giải mã JWT.
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** Mã hóa mật khẩu bằng BCrypt (có salt ngẫu nhiên, không giải ngược được). */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
