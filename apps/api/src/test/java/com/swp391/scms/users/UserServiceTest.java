package com.swp391.scms.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.users.dto.UserCreateDto;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.users.mapper.UserMapper;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock UserMapper userMapper;
    @Mock ReceptionistRepository receptionistRepository;
    @Mock com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository;
    @InjectMocks UserService service;

    @Test
    void createUserRejectsDuplicateEmail() {
        UserCreateDto dto = new UserCreateDto();
        dto.setEmail("a@b.com");
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class, () -> service.createUser(dto));
        verify(userRepository, never()).save(any());
    }

    @Test
    void createUserRejectsDuplicatePhone() {
        UserCreateDto dto = new UserCreateDto();
        dto.setEmail("a@b.com");
        dto.setPhone("0900000000");
        when(userRepository.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(userRepository.findByPhone("0900000000")).thenReturn(Optional.of(new User()));

        assertThrows(ConflictException.class, () -> service.createUser(dto));
    }

    @Test
    void setStatusLocksAccount() {
        User user = new User();
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        service.setStatus(1L, "locked");

        assertEquals("locked", user.getStatus());
    }

    @Test
    void setStatusRejectsUnknownStatus() {
        assertThrows(BadRequestException.class, () -> service.setStatus(1L, "banned"));
    }

    @Test
    void deleteUserIsSoftDelete() {
        User user = new User();
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(user));

        service.deleteUser(1L);

        assertNotNull(user.getDeletedAt());
        verify(userRepository, never()).delete(any());
    }

    @Test
    void getUserByIdHidesDeletedUsers() {
        when(userRepository.findByIdAndDeletedAtIsNull(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getUserById(9L));
    }

    @Test
    void updateReceptionistShiftSavesShiftForReceptionist() {
        User user = new User();
        user.setId(5L);
        com.swp391.scms.users.entity.Role role = new com.swp391.scms.users.entity.Role();
        role.setCode("RECEPTIONIST");
        user.setRole(role);
        when(userRepository.findByIdAndDeletedAtIsNull(5L)).thenReturn(Optional.of(user));
        when(receptionistRepository.findById(5L)).thenReturn(Optional.empty());

        service.updateReceptionistShift(5L, new com.swp391.scms.users.dto.ReceptionistProfileUpdateDto("Morning"));

        verify(receptionistRepository).save(any());
    }

    @Test
    void updateReceptionistShiftRejectsNonReceptionistRole() {
        User user = new User();
        user.setId(5L);
        com.swp391.scms.users.entity.Role role = new com.swp391.scms.users.entity.Role();
        role.setCode("MEMBER");
        user.setRole(role);
        when(userRepository.findByIdAndDeletedAtIsNull(5L)).thenReturn(Optional.of(user));

        assertThrows(BadRequestException.class, () ->
                service.updateReceptionistShift(5L, new com.swp391.scms.users.dto.ReceptionistProfileUpdateDto("Morning")));
    }

    @Test
    void cleanupInactiveUsersDeletesInactiveUsersExceptFrozenSubscriptions() {
        // User 1: Inactive > 6 months, not frozen -> SHOULD BE DELETED
        User user1 = new User();
        user1.setId(10L);
        com.swp391.scms.users.entity.Role roleMember = new com.swp391.scms.users.entity.Role();
        roleMember.setCode("MEMBER");
        user1.setRole(roleMember);
        user1.setLastLoginAt(java.time.LocalDateTime.now().minusMonths(7));

        // User 2: Inactive > 6 months, but has FROZEN subscription -> MUST BE PRESERVED
        User user2 = new User();
        user2.setId(20L);
        user2.setRole(roleMember);
        user2.setLastLoginAt(java.time.LocalDateTime.now().minusMonths(8));

        // User 3: CENTER_MANAGER inactive > 6 months -> MUST BE PRESERVED
        User user3 = new User();
        user3.setId(30L);
        com.swp391.scms.users.entity.Role roleAdmin = new com.swp391.scms.users.entity.Role();
        roleAdmin.setCode("CENTER_MANAGER");
        user3.setRole(roleAdmin);
        user3.setLastLoginAt(java.time.LocalDateTime.now().minusMonths(9));

        when(userRepository.findAllByDeletedAtIsNullOrderByIdAsc()).thenReturn(java.util.List.of(user1, user2, user3));
        when(subscriptionRepository.existsByMemberUserIdAndStatus(10L, "frozen")).thenReturn(false);
        when(subscriptionRepository.existsByMemberUserIdAndStatus(20L, "frozen")).thenReturn(true);

        int deletedCount = service.cleanupInactiveUsers();

        assertEquals(1, deletedCount);
        assertNotNull(user1.getDeletedAt());
        org.junit.jupiter.api.Assertions.assertNull(user2.getDeletedAt());
        org.junit.jupiter.api.Assertions.assertNull(user3.getDeletedAt());
        verify(userRepository).save(user1);
        verify(userRepository, never()).save(user2);
        verify(userRepository, never()).save(user3);
    }
}
