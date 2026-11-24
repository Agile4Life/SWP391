package com.swp391.scms.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Tạo và đọc JWT (ký HMAC-SHA bằng app.jwt.secret). Token chứa tên đăng nhập, userId, vai trò, thời điểm cấp và
 * hạn dùng.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    /** Tạo khóa ký từ secret và đọc thời hạn token (mặc định 24 giờ). */
    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /** Tạo JWT cho người dùng sau khi đăng nhập thành công. */
    public String generateToken(Long userId, String username, String role) {
        return Jwts.builder()
                .subject(username)
                .claim("userId", userId)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    /**
     * Kiểm tra chữ ký và hạn dùng rồi trả về nội dung (claims) của token; token sai hoặc hết hạn sẽ ném
     * JwtException.
     */
    public Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    /** Lấy userId trong token dưới dạng Integer (ném lỗi nếu vượt giới hạn int). */
    public Integer extractUserId(String token) {
        Long userId = extractUserIdAsLong(token);
        return userId == null ? null : Math.toIntExact(userId);
    }

    /** Lấy userId trong token dưới dạng Long; trả null nếu token không có userId dạng số. */
    public Long extractUserIdAsLong(String token) {
        Object userId = parseClaims(token).get("userId");
        return userId instanceof Number number ? number.longValue() : null;
    }

    /** Lấy mã vai trò lưu trong token. */
    public String extractRole(String token) {
        return parseClaims(token).get("role", String.class);
    }
}