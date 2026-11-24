package com.swp391.scms.users;

import com.swp391.scms.users.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    /** Tìm các bản ghi có code = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Permission> findByCode(String code);
}
