package com.swp391.scms.coaching;

import com.swp391.scms.coaching.service.TrainingCompletionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TrainingCompletionControllerTest {
    private final TrainingCompletionService service = mock(TrainingCompletionService.class);
    private final TrainingCompletionController controller = new TrainingCompletionController(service);
    private final AuthenticatedPrincipal member = new AuthenticatedPrincipal(10L, "member", "MEMBER");
    private final LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    @Test void readsOnlyAuthenticatedMemberCompletions() {
        when(service.getCompletedItemIds(eq(10L), eq(today), any())).thenReturn(List.of(5L));
        assertThat(controller.list(member, today).getData()).containsExactly(5L);
        verify(service).getCompletedItemIds(eq(10L), eq(today), any());
    }

    @Test void updatesOnlyAuthenticatedMemberItem() {
        assertThat(controller.mark(member, 5L, today).getData().completed()).isTrue();
        assertThat(controller.unmark(member, 5L, today).getData().completed()).isFalse();
        verify(service).setCompleted(eq(10L), eq(5L), eq(today), eq(true), any());
        verify(service).setCompleted(eq(10L), eq(5L), eq(today), eq(false), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-28T17:00:00Z", "2026-10-28T20:30:00Z", "2026-10-28T23:59:59Z", "2026-10-29T00:00:00Z"})
    void usesVietnamThursdayForReadMarkAndUnmarkEvenWithUtcClock(String instant) {
        var current = new TrainingCompletionController(service, null,
                Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
        LocalDate thursday = LocalDate.of(2026, 10, 29);
        assertThat(thursday.getDayOfWeek().getValue()).isEqualTo(4);
        current.list(member, null);
        current.mark(member, 5L, thursday);
        current.unmark(member, 5L, thursday);
        verify(service).getCompletedItemIds(10L, thursday, thursday);
        verify(service).setCompleted(10L, 5L, thursday, true, thursday);
        verify(service).setCompleted(10L, 5L, thursday, false, thursday);
    }

    @Test void changesDateExactlyAtVietnamMidnight() {
        var before = new TrainingCompletionController(service, null,
                Clock.fixed(Instant.parse("2026-10-28T16:59:59Z"), ZoneOffset.UTC));
        before.list(member, null);
        verify(service).getCompletedItemIds(10L, LocalDate.of(2026, 10, 28), LocalDate.of(2026, 10, 28));
    }
}
