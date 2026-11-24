package com.swp391.scms.users;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.users.dto.PermissionDto;
import com.swp391.scms.users.dto.RoleDto;
import com.swp391.scms.users.entity.Permission;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.mapper.RoleMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RoleMapper roleMapper;

    public RoleService(RoleRepository roleRepository, PermissionRepository permissionRepository, RoleMapper roleMapper) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.roleMapper = roleMapper;
    }

    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream().map(roleMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getAllPermissions() {
        return permissionRepository.findAll().stream().map(roleMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> getPermissionsByRoleId(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
        return role.getPermissions().stream().map(roleMapper::toDto).toList();
    }

    @Transactional
    @Audited(action = "ROLE_PERMISSION_GRANT", entity = "role_permissions")
    public PermissionDto grantPermission(Long roleId, Long permissionId) {
        Role role = findRole(roleId);
        Permission permission = findPermission(permissionId);
        if (role.getPermissions() == null) {
            role.setPermissions(new HashSet<>());
        }
        role.getPermissions().add(permission);
        return roleMapper.toDto(permission);
    }

    @Transactional
    @Audited(action = "ROLE_PERMISSION_REVOKE", entity = "role_permissions")
    public PermissionDto revokePermission(Long roleId, Long permissionId) {
        Role role = findRole(roleId);
        Permission permission = findPermission(permissionId);
        if (role.getPermissions() != null) {
            role.getPermissions().remove(permission);
        }
        return roleMapper.toDto(permission);
    }

    private Role findRole(Long roleId) {
        return roleRepository.findById(roleId).orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
    }

    private Permission findPermission(Long permissionId) {
        return permissionRepository.findById(permissionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.permission", permissionId));
    }
}