package com.swp391.scms.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.ForbiddenException;
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

    /** Kiểm thử: cấp quyền được kể cả khi vai trò chưa có quyền nào. */
    @Test
    void grantAddsPermissionEvenWhenRoleHasNone() {
        Role role = new Role();
        Permission permission = new Permission();
        when(roleRepository.findById(1L)).thenReturn(Optional.of(role));
        when(permissionRepository.findById(2L)).thenReturn(Optional.of(permission));

        service.grantPermission(1L, 2L);

        assertTrue(role.getPermissions().contains(permission));
    }

    /** Kiểm thử: thu hồi quyền gỡ quyền khỏi vai trò. */
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

    /** Kiểm thử: cấp quyền cho vai trò không tồn tại ném not found. */
    @Test
    void grantUnknownRoleThrowsNotFound() {
        when(roleRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.grantPermission(9L, 2L));
    }

    /** Kiểm thử: cấp quyền không tồn tại ném not found. */
    @Test
    void grantUnknownPermissionThrowsNotFound() {
        when(roleRepository.findById(1L)).thenReturn(Optional.of(new Role()));
        when(permissionRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.grantPermission(1L, 9L));
    }

    /** Kiểm thử P3-BE-04: Role khởi tạo sẵn permissions không gây NPE; chặn cấp USER_MANAGE/ROLE_MANAGE cho CENTER_MANAGER và chặn thu hồi khỏi ADMIN. */
    @Test
    void roleInitializesPermissionsAndProtectsAdminIdentityPermissions() {
        Role emptyRole = new Role();
        when(roleRepository.findById(3L)).thenReturn(Optional.of(emptyRole));
        assertTrue(service.getPermissionsByRoleId(3L).isEmpty());

        Role centerManager = new Role();
        centerManager.setCode("CENTER_MANAGER");
        Role admin = new Role();
        admin.setCode("ADMIN");

        Permission userManage = new Permission();
        userManage.setCode("USER_MANAGE");
        Permission roleManage = new Permission();
        roleManage.setCode("ROLE_MANAGE");

        admin.getPermissions().add(userManage);
        admin.getPermissions().add(roleManage);

        when(roleRepository.findById(10L)).thenReturn(Optional.of(centerManager));
        when(roleRepository.findById(11L)).thenReturn(Optional.of(admin));
        when(permissionRepository.findById(20L)).thenReturn(Optional.of(userManage));
        when(permissionRepository.findById(21L)).thenReturn(Optional.of(roleManage));

        assertThrows(ForbiddenException.class, () -> service.grantPermission(10L, 20L));
        assertThrows(ForbiddenException.class, () -> service.grantPermission(10L, 21L));
        assertTrue(centerManager.getPermissions().isEmpty());

        assertThrows(ForbiddenException.class, () -> service.revokePermission(11L, 20L));
        assertThrows(ForbiddenException.class, () -> service.revokePermission(11L, 21L));
        assertEquals(2, admin.getPermissions().size());
    }

    /** Kiểm thử P3-BE-05: KycCrypto từ chối chuỗi secret null hoặc rỗng/khoảng trắng. */
    @Test
    void kycCryptoRejectsBlankOrNullSecret() {
        assertThrows(IllegalArgumentException.class, () -> new KycCrypto(null));
        assertThrows(IllegalArgumentException.class, () -> new KycCrypto(""));
        assertThrows(IllegalArgumentException.class, () -> new KycCrypto("   "));
        KycCrypto valid = new KycCrypto("strong-test-secret");
        assertEquals("012345678901", valid.decrypt(valid.encrypt("012345678901")));
    }
}