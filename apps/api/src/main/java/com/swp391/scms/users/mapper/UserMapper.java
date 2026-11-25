package com.swp391.scms.users.mapper;

import com.swp391.scms.users.dto.UserDto;
import com.swp391.scms.users.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Mapper (MapStruct tự sinh code) chuyển User sang UserDto. */
@Mapper(componentModel = "spring")
public interface UserMapper {

    /** Chuyển người dùng sang UserDto. */
    @Mapping(target = "roleCode", source = "role.code")
    @Mapping(target = "subscriptionFrozen", ignore = true)
    UserDto toDto(User user);
}
