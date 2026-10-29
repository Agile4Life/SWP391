package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.membership.dto.MembershipRealtimeSession;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MembershipRealtimeService {
    private final MemberRepository members;
    private final String url;
    private final String publishableKey;

    public MembershipRealtimeService(MemberRepository members,
            @Value("${app.supabase.url:}") String url,
            @Value("${app.supabase.publishable-key:}") String publishableKey) {
        this.members = members;
        this.url = url;
        this.publishableKey = publishableKey;
        if (!publishableKey.isBlank() && !publishableKey.startsWith("sb_publishable_")) {
            throw new IllegalArgumentException("SUPABASE_PUBLISHABLE_KEY must be a publishable key, never a secret key");
        }
    }

    @Transactional
    public MembershipRealtimeSession open(AuthenticatedPrincipal principal) {
        if (principal == null || !"MEMBER".equals(principal.role())) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, null);
        }
        if (url.isBlank() || publishableKey.isBlank()) {
            return new MembershipRealtimeSession(false, null, null, null);
        }
        var member = members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (member.getPaymentRealtimeTopic() == null) {
            member.setPaymentRealtimeTopic(UUID.randomUUID());
        }
        return new MembershipRealtimeSession(true, url, publishableKey, "membership:" + member.getPaymentRealtimeTopic());
    }
}
