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
                    // Specific Scheduling endpoints
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/enroll").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/enrollments/*").hasAnyRole("MEMBER", "CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/enrollments/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/sessions/*/waitlist").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/classes/waitlists/*").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/waitlists/my").hasRole("MEMBER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes/*/sessions").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.POST, "/api/v1/classes", "/api/v1/classes/**").hasRole("CENTER_MANAGER")
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes/sessions/**", "/api/v1/classes/sessions").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/classes", "/api/v1/classes/**").authenticated()
                    // Specific Payment endpoints
                    .requestMatchers("/api/v1/payments/my/**").hasRole("MEMBER")
                    .requestMatchers("/api/v1/payments/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST", "MEMBER")
                    .requestMatchers("/api/v1/invoices/**").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    // Catalogs, Members Lookup & Users
                    .requestMatchers(HttpMethod.GET, "/api/v1/members/lookup").hasAnyRole("CENTER_MANAGER", "RECEPTIONIST")
                    .requestMatchers(HttpMethod.GET, "/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**").authenticated()
                    .requestMatchers("/api/v1/disciplines/**", "/api/v1/rooms/**", "/api/v1/packages/**").hasRole("CENTER_MANAGER")
                    .requestMatchers("/api/v1/users/**", "/api/v1/roles/**").hasRole("CENTER_MANAGER")
                    .anyRequest().authenticated())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}