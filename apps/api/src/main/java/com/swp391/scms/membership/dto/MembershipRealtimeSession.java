package com.swp391.scms.membership.dto;

/** Only a public API key and an opaque, data-free invalidation channel. */
public record MembershipRealtimeSession(boolean enabled, String url, String publishableKey, String topic) {}
