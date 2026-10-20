package com.swp391.scms.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate Limiting Filter tại Gateway API để ngăn chặn hành vi quét cạn (brute-force scan)
 * hoặc spam sinh mã Dynamic QR trên hệ thống.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int SCAN_LIMIT_PER_MINUTE = 60;
    private static final int DYNAMIC_QR_LIMIT_PER_MINUTE = 30;

    private static final String SCAN_PATH = "/api/v1/check-in/scan";
    private static final String DYNAMIC_QR_PATH = "/api/v1/memberships/subscriptions/my/dynamic-qr";

    private final Map<String, WindowCounter> requestCounts = new ConcurrentHashMap<>();

    private static class WindowCounter {
        long windowStartMinute;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long minute) {
            this.windowStartMinute = minute;
            this.count.set(1);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        int limit = getRateLimitForUri(uri);

        if (limit > 0) {
            String clientIp = getClientIp(request);
            String key = uri + ":" + clientIp;
            long currentMinute = System.currentTimeMillis() / 60000L;

            WindowCounter counter = requestCounts.compute(key, (k, existing) -> {
                if (existing == null || existing.windowStartMinute != currentMinute) {
                    return new WindowCounter(currentMinute);
                }
                existing.count.incrementAndGet();
                return existing;
            });

            if (counter.count.get() > limit) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader("Retry-After", "60");
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("""
                        {
                          "status": "error",
                          "code": "RATE_LIMIT_EXCEEDED",
                          "message": "Too many requests. Please slow down and try again later."
                        }
                        """);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private int getRateLimitForUri(String uri) {
        if (uri.endsWith(SCAN_PATH)) {
            return SCAN_LIMIT_PER_MINUTE;
        }
        if (uri.endsWith(DYNAMIC_QR_PATH)) {
            return DYNAMIC_QR_LIMIT_PER_MINUTE;
        }
        return 0; // Not rate limited
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isBlank()) {
            return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
        }
        return xfHeader.split(",")[0].trim();
    }
}
