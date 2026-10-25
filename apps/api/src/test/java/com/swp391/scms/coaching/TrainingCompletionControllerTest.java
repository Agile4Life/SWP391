package com.swp391.scms.coaching;

import com.swp391.scms.coaching.service.TrainingCompletionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.Test;
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
}
