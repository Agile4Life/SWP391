package com.swp391.scms.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.users.entity.Permission;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.mapper.RoleMapper;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Bộ kiểm thử cho service RoleService (role service). */
@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock RoleRepository roleRepository;
    @Mock PermissionRepository permissionRepository;
    @Mock RoleMapper roleMapper;
    @InjectMocks RoleService service;

    @Test
    void grantAddsPermissionEvenWhenRoleHasNone() {
        Role role = new Role();
        Permission permission = new Permission();
        when(roleRepository.findById(1L)).thenReturn(Optional.of(role));
        when(permissionRepository.findById(2L)).thenReturn(Optional.of(permission));

        service.grantPermission(1L, 2L);

        assertTrue(role.getPermissions().contains(permission));
    }

    @Test
    void revokeRemovesPermission() {
        Role role = new Role();
        Permission permission = new Permission();
        role.setPermissions(new java.util.HashSet<>(java.util.Set.of(permission)));
        when(roleRepository.findById(1L)).thenReturn(Optional.of(role));
        when(permissionRepository.findById(2L)).thenReturn(Optional.of(permission));

        service.revokePermission(1L, 2L);

        assertFalse(role.getPermissions().contains(permission));
    }

    @Test
    void grantUnknownRoleThrowsNotFound() {
        when(roleRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.grantPermission(9L, 2L));
    }

    @Test
    void grantUnknownPermissionThrowsNotFound() {
        when(roleRepository.findById(1L)).thenReturn(Optional.of(new Role()));
        when(permissionRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.grantPermission(1L, 9L));
    }
}