package com.swp391.scms.users.mapper;

import com.swp391.scms.users.dto.PermissionDto;
import com.swp391.scms.users.dto.RoleDto;
import com.swp391.scms.users.entity.Permission;
import com.swp391.scms.users.entity.Role;
import org.mapstruct.Mapper;

/** Mapper (MapStruct tự sinh code) chuyển Role/Permission sang DTO. */
@Mapper(componentModel = "spring")
public interface RoleMapper {
    /** Chuyển vai trò sang RoleDto. */
    RoleDto toDto(Role role);
    /** Chuyển quyền sang PermissionDto. */
    PermissionDto toDto(Permission permission);
}
