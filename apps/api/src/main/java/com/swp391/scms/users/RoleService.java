package com.swp391.scms.users;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.ForbiddenException;
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
import java.util.Locale;
import java.util.Set;

/** Nghiệp vụ vai trò và quyền: liệt kê, cấp và thu hồi quyền (có ghi audit). */
@Service
public class RoleService {

    private static final Set<String> ADMIN_ONLY_PERMISSIONS = Set.of("USER_MANAGE", "ROLE_MANAGE");

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
        if (role.getPermissions() == null) {
            return List.of();
        }
        return role.getPermissions().stream().map(roleMapper::toDto).toList();
    }

    /** Cấp quyền cho vai trò (thêm vào tập quyền; Hibernate tự lưu khi transaction kết thúc). */
    @Transactional
    @Audited(action = "ROLE_PERMISSION_GRANT", entity = "role_permissions")
    public PermissionDto grantPermission(Long roleId, Long permissionId) {
        Role role = findRole(roleId);
        Permission permission = findPermission(permissionId);
        String roleCode = normalizeRoleCode(role.getCode());
        String permissionCode = normalizePermissionCode(permission.getCode());
        if (("CENTER_MANAGER".equals(roleCode) || "MANAGER".equals(roleCode))
                && ADMIN_ONLY_PERMISSIONS.contains(permissionCode)) {
            throw new ForbiddenException("ROLE_PERMISSION_FORBIDDEN", "error.forbidden", null,
                    "Cannot grant " + permissionCode + " to " + roleCode);
        }
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
        String roleCode = normalizeRoleCode(role.getCode());
        String permissionCode = normalizePermissionCode(permission.getCode());
        if ("ADMIN".equals(roleCode) && ADMIN_ONLY_PERMISSIONS.contains(permissionCode)) {
            throw new ForbiddenException("ROLE_PERMISSION_FORBIDDEN", "error.forbidden", null,
                    "Cannot revoke " + permissionCode + " from ADMIN");
        }
        if (role.getPermissions() != null) {
            role.getPermissions().remove(permission);
        }
        return roleMapper.toDto(permission);
    }

    /** Chuẩn hóa mã vai trò (bỏ tiền tố ROLE_ nếu có, chuyển chữ hoa). */
    private static String normalizeRoleCode(String code) {
        if (code == null) {
            return "";
        }
        String upper = code.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("ROLE_") ? upper.substring("ROLE_".length()) : upper;
    }

    /** Chuẩn hóa mã quyền (trim + chữ hoa; giữ nguyên tiền tố như ROLE_MANAGE). */
    private static String normalizePermissionCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
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