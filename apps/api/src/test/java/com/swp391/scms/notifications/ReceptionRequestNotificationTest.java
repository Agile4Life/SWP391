package com.swp391.scms.notifications;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

    /** Kiểm thử: lỗi gửi tới một lễ tân không làm hỏng giao dịch chính và vẫn tiếp tục gửi cho lễ tân khác. */
    @Test void continuesNotifyingRemainingReceptionistsWhenOneRecipientFails() {
        var repository = mock(NotificationRepository.class); var users = mock(UserRepository.class);
        var service = new NotificationService(repository, users, mock(NotificationMapper.class));
        User first = new User(); first.setId(1L); first.setStatus("active");
        User second = new User(); second.setId(2L); second.setStatus("active");
        when(users.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(List.of("RECEPTIONIST", "ROLE_RECEPTIONIST"))).thenReturn(List.of(first, second));
        when(users.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.empty());
        when(users.findByIdAndDeletedAtIsNull(2L)).thenReturn(Optional.of(second));

        service.notifyReceptionists("hold", 99L);

        verify(repository, times(1)).save(argThat(n -> n.getUser().getId().equals(2L) && "/staff/holds".equals(n.getActionPath())));
    }

    /** Kiểm thử: từ chối loại yêu cầu không hợp lệ thay vì ghi thông báo sai đường dẫn. */
    @Test void rejectsUnsupportedReceptionRequestKind() {
        var service = new NotificationService(mock(NotificationRepository.class), mock(UserRepository.class), mock(NotificationMapper.class));
        assertThrows(IllegalArgumentException.class, () -> service.notifyReceptionists("unknown", 1L));
    }
}
