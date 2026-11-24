package com.swp391.scms.notifications;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.mockito.Mockito.*;
class ReceptionRequestNotificationTest {
    @Test void storesSafeUnreadRequestsForActiveReceptionistsOnly() {
        var repository = mock(NotificationRepository.class); var users = mock(UserRepository.class);
        var service = new NotificationService(repository, users, mock(NotificationMapper.class));
        User active = new User(); active.setId(1L); active.setStatus("active");
        User locked = new User(); locked.setId(2L); locked.setStatus("locked");
        when(users.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(List.of("RECEPTIONIST", "ROLE_RECEPTIONIST"))).thenReturn(List.of(active, locked));
        when(users.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(active));
        service.notifyReceptionists("kyc", 10L);
        verify(repository).save(argThat(n -> "/staff/kyc".equals(n.getActionPath()) && !n.isRead() && !n.getMessage().contains("012345678901")));
        verify(users, never()).findByIdAndDeletedAtIsNull(2L);
    }
}
