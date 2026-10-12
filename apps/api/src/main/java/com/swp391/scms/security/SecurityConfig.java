package com.swp391.scms.security;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

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
                    .requestMatchers("/api/v1/users/**", "/api/v1/roles/**").hasRole("CENTER_MANAGER")

                    // Payments & Invoices: Strict control for refunds & manual status updates
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments/*/refund", "/api/v1/payments/{id}/refund").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/payments/*/status", "/api/v1/payments/{id}/status").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/my/**").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments", "/api/v1/payments/process").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/payments/*", "/api/v1/payments/member/**").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers("/api/v1/payments/**", "/api/v1/invoices/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")

                    // Class Enrollments
                    .requestMatchers("/api/v1/classes/enrollments/my").hasRole("MEMBER")

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