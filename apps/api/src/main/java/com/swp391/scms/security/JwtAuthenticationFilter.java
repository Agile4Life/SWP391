package com.swp391.scms.security;

import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.dto.AuthenticationUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Bộ lọc chạy một lần cho mỗi request: đọc header "Authorization: Bearer <token>", kiểm tra JWT và gắn người
 * dùng vào SecurityContext để các kiểm tra quyền phía sau hoạt động.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    /** Nhận JwtService để giải mã token và UserRepository để đọc trạng thái tài khoản mới nhất. */
    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    /**
     * Nếu có Bearer token và request chưa được xác thực thì xác thực bằng token; dù thành công hay không vẫn
     * cho request đi tiếp (endpoint cần đăng nhập sẽ tự trả 401).
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticate(authorization.substring(7), request);
        }
        chain.doFilter(request, response);
    }

    /**
     * Giải mã token, lấy userId, đọc tài khoản từ database. Bỏ qua (coi như chưa đăng nhập) nếu tài khoản không
     * tồn tại, không ở trạng thái active, hoặc token được cấp trước lần đổi mật khẩu gần nhất. Hợp lệ thì tạo
     * principal với quyền ROLE_<vai trò>. Token sai hoặc hết hạn thì xóa context.
     */
    private void authenticate(String token, HttpServletRequest request) {
        try {
            Claims claims = jwtService.parseClaims(token);
            Object rawUserId = claims.get("userId");
            if (!(rawUserId instanceof Number userId)) return;

            AuthenticationUser user = userRepository.findAuthenticationById(userId.longValue()).orElse(null);
            if (user == null || !"active".equalsIgnoreCase(user.status())) return;
            if (issuedBeforePasswordChange(claims.getIssuedAt(), user.passwordChangedAt())) return;

            String role = user.roleCode();
            AuthenticatedPrincipal principal = new AuthenticatedPrincipal(user.id(), user.username(), role);
            var authentication = new UsernamePasswordAuthenticationToken(
                    principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException ex) {
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * Token có được cấp trước thời điểm đổi mật khẩu không (token cũ phải mất hiệu lực sau khi đổi mật khẩu).
     * Trường iat của JWT chỉ chính xác tới giây, nên token cấp trong cùng giây đổi mật khẩu vẫn được chấp nhận.
     *
     * JWT {@code iat} has second precision, so a token issued in the same second as the change is still accepted.
     */
    static boolean issuedBeforePasswordChange(java.util.Date issuedAt, java.time.LocalDateTime changedAt) {
        if (changedAt == null) return false;
        if (issuedAt == null) return true;
        return issuedAt.toInstant().isBefore(changedAt.atZone(java.time.ZoneId.systemDefault()).toInstant());
    }
}
