package com.swp391.scms.chat;

import com.swp391.scms.chat.service.*;
import com.swp391.scms.chat.controller.ChatRealtimeController;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.common.exception.ForbiddenException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatRealtimeServiceTest {
    final ChatService chat = mock(ChatService.class);
    final AuthenticatedPrincipal p = new AuthenticatedPrincipal(42L, "private-name", "MEMBER");
    final String secret = "unit-supabase-chat-key-with-at-least-32-bytes";
    final String url = "https://test.supabase.co";

    @Test void tokenIsSignedScopedShortLivedAndContainsNoPersonalData() {
        var result = new ChatRealtimeService(chat, url, "sb_publishable_unit", secret).open(p);
        var token = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(result.token());
        var claims = token.getPayload();
        assertThat(token.getHeader().getAlgorithm()).isEqualTo("HS256");
        assertThat(claims.get("role")).isEqualTo("authenticated");
        assertThat(claims.get("scms_chat_user_id")).isEqualTo("42");
        assertThat(claims.get("scms_chat_scope")).isEqualTo("receive");
        assertThat(UUID.fromString(claims.getSubject())).isNotNull();
        assertThat(claims.getExpiration().toInstant()).isBetween(Instant.now().plusSeconds(290), Instant.now().plusSeconds(301));
        assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime()).isEqualTo(300_000);
        assertThat(claims).doesNotContainKeys("username", "email", "user_metadata");
        assertThat(result.topic()).isEqualTo("scms:chat:42");
        assertThat(result.enabled()).isTrue();
        verify(chat).requireActor(p);
    }

    @Test void missingConfigurationDisablesRealtimeWithoutExposingASecret() {
        var result = new ChatRealtimeService(chat, url, "sb_publishable_unit", "").open(p);
        assertThat(result.enabled()).isFalse(); assertThat(result.userId()).isEqualTo(42);
        assertThat(result.token()).isNull(); assertThat(result.topic()).isNull();
    }

    @Test void rejectsSecretAsPublicKeyAndWeakSigningKey() {
        assertThatThrownBy(() -> new ChatRealtimeService(chat, url, "sb_secret_bad", secret)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ChatRealtimeService(chat, url, "sb_publishable_unit", "weak")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ChatRealtimeService(chat, "http://unsafe.test", "sb_publishable_unit", secret)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void rejectedActorNeverReceivesConnectionMetadata() {
        when(chat.requireActor(p)).thenThrow(new ForbiddenException("CHAT_FORBIDDEN", "chat.forbidden", null, null));
        assertThatThrownBy(() -> new ChatRealtimeService(chat, url, "sb_publishable_unit", secret).open(p)).isInstanceOf(ForbiddenException.class);
    }

    @Test void sessionResponseCannotBeCached() {
        var service = new ChatRealtimeService(chat, "", "", "");
        var response = new ChatRealtimeController(service).session(p);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getBody().getData().enabled()).isFalse();
    }
}
