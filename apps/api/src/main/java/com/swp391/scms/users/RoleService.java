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

/** Nghiệp vụ vai trò và quyền: liệt kê, cấp và thu hồi quyền (có ghi audit). */
@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RoleMapper roleMapper;

    /** Nhận repository vai trò/quyền và mapper chuyển sang DTO. */
    public RoleService(RoleRepository roleRepository, PermissionRepository permissionRepository, RoleMapper roleMapper) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.roleMapper = roleMapper;
    }

    /** Danh sách mọi vai trò. */
    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream().map(roleMapper::toDto).toList();
    }

    /** Danh sách mọi quyền. */
    @Transactional(readOnly = true)
    public List<PermissionDto> getAllPermissions() {
        return permissionRepository.findAll().stream().map(roleMapper::toDto).toList();
    }

    /** Các quyền của một vai trò; không có vai trò thì báo 404. */
    @Transactional(readOnly = true)
    public List<PermissionDto> getPermissionsByRoleId(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
        return role.getPermissions().stream().map(roleMapper::toDto).toList();
    }

    /** Cấp quyền cho vai trò (thêm vào tập quyền; Hibernate tự lưu khi transaction kết thúc). */
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

    /** Thu hồi quyền khỏi vai trò. */
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

    /** Lấy vai trò theo id; không thấy thì báo 404. */
    private Role findRole(Long roleId) {
        return roleRepository.findById(roleId).orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
    }

    /** Lấy quyền theo id; không thấy thì báo 404. */
    private Permission findPermission(Long permissionId) {
        return permissionRepository.findById(permissionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.permission", permissionId));
    }
}