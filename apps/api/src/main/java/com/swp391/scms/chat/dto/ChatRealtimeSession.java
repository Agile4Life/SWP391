package com.swp391.scms.chat.dto;
import java.time.Instant;
public record ChatRealtimeSession(boolean enabled, Long userId, String url, String publishableKey, String topic, String token, Instant expiresAt) { }
