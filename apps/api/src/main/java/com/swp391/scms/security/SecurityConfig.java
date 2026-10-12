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

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          JsonAuthenticationEntryPoint authenticationEntryPoint,
                          JsonAccessDeniedHandler accessDeniedHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(errors -> errors
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/api/v1/auth/**", "/api/v1/health", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                    // Attendance & Check-in (SCRUM-75)
                    .requestMatchers(HttpMethod.POST, "/api/v1/check-in/scan").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/check-in/*/checkout", "/api/v1/check-in/checkout").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/check-in/history").hasAnyRole("RECEPTIONIST", "CENTER_MANAGER", "MEMBER")

                    // Payments (SCRUM-71 & Finance)
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments/*/refund").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/payments/*/status").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/my/**").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments", "/api/v1/payments/process").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/*", "/api/v1/payments/member/**").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers("/api/v1/payments/**", "/api/v1/invoices/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")

                    // Membership Subscriptions (SCRUM-71)
                    .requestMatchers(HttpMethod.GET, "/api/v1/memberships/subscriptions/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/memberships/subscriptions/**").hasAnyRole("MEMBER", "RECEPTIONIST", "CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/memberships/subscriptions/**").hasAnyRole("MEMBER", "RECEPTIONIST", "CENTER_MANAGER")

                    // Scheduling & Enrollments & Waitlist (SCRUM-72, 73, 74)
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/enrollments/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/enroll").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/enrollments/*").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/waitlist").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/waitlists/*").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/waitlists/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/*/sessions", "/api/v1/classes/**").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/sessions/**", "/api/v1/classes/**").authenticated()

                    // Users, Roles, Member Lookup & Facilities Catalog
                    .requestMatchers("/api/v1/users/**", "/api/v1/roles/**").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/members/lookup").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**").authenticated()
                    .requestMatchers("/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**").hasRole("CENTER_MANAGER")

                    .anyRequest().authenticated())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}