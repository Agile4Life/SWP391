package com.swp391.scms.membership;

import com.swp391.scms.membership.service.MembershipRealtimeService;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MembershipRealtimeServiceTest {
    @Test
    void returnsOnlyOwnersOpaqueChannelAndRejectsOtherRoles() {
        var members = mock(MemberRepository.class);
        var member = new Member(); member.setUserId(42L);
        when(members.findByUserIdForUpdate(42L)).thenReturn(Optional.of(member));
        var service = new MembershipRealtimeService(members, "https://project.supabase.co", "sb_publishable_test");
        var principal = new AuthenticatedPrincipal(42L, "member", "MEMBER");
        var first = service.open(principal);
        assertThat(first.enabled()).isTrue();
        assertThat(first.topic()).matches("membership:[a-f0-9-]{36}");
        assertThat(service.open(principal).topic()).isEqualTo(first.topic());
        assertThatThrownBy(() -> service.open(new AuthenticatedPrincipal(1L, "staff", "RECEPTIONIST")))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.open(null)).isInstanceOf(ForbiddenException.class);
        verify(members, times(2)).findByUserIdForUpdate(42L);
        verifyNoMoreInteractions(members);
    }

    @Test
    void neverReturnsBackendSecretsAndDoesNotPretendMissingConfigIsRealtime() {
        var members = mock(MemberRepository.class);
        assertThatThrownBy(() -> new MembershipRealtimeService(members, "https://project.supabase.co", "sb_secret_forbidden"))
                .isInstanceOf(IllegalArgumentException.class);
        var disabled = new MembershipRealtimeService(members, "", "")
                .open(new AuthenticatedPrincipal(42L, "member", "MEMBER"));
        assertThat(disabled.enabled()).isFalse();
        assertThat(disabled.topic()).isNull();
        verifyNoInteractions(members);
    }
}
