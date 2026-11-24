package com.swp391.scms.users;

import com.swp391.scms.users.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/** Truy cập bảng roles (vai trò). */
public interface RoleRepository extends JpaRepository<Role, Long> {
    /**
     * Lấy vai trò theo mã và khóa dòng để ghi; dùng để xếp hàng các thao tác gỡ Admin song song (tránh mất
     * Admin cuối cùng).
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from Role r where r.code = :code")
    Optional<Role> lockByCode(@org.springframework.data.repository.query.Param("code") String code);
    /** Tìm các bản ghi có code = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Role> findByCode(String code);
    /**
     * Tìm các bản ghi có code bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<Role> findByCodeIgnoreCase(String code);
}
