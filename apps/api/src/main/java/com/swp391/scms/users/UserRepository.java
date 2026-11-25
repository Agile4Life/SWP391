package com.swp391.scms.users;

import com.swp391.scms.users.entity.User;
import com.swp391.scms.users.dto.AuthenticationUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Truy cập bảng users (tài khoản đăng nhập của mọi vai trò). */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    /**
     * Đếm số bản ghi có role_Code = tham số và deletedAt đang trống (null) và status = tham số (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    long countByRole_CodeAndDeletedAtIsNullAndStatus(String code, String status);
    /**
     * Tìm các bản ghi có deletedAt đang trống (null) và role_Code thuộc danh sách tham số, sắp xếp theo id tăng
     * dần (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<User> findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(List<String> roleCodes);
    /**
     * Tìm các bản ghi có deletedAt đang trống (null), sắp xếp theo id tăng dần (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    List<User> findAllByDeletedAtIsNullOrderByIdAsc();
    /**
     * Tìm các bản ghi có deletedAt đã có giá trị, sắp xếp theo id giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<User> findAllByDeletedAtIsNotNullOrderByIdDesc();
    /** Tìm các bản ghi có id = tham số và deletedAt đang trống (null) (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<User> findByIdAndDeletedAtIsNull(Long id);
    // Tài khoản cấp phát nội bộ (admin bootstrap, nhân sự, demo) chỉ có email: dùng email làm tên đăng nhập hiển thị,
    // khớp với phản hồi đăng nhập, để /auth/me không trả null khiến frontend tự đăng xuất.
    @Query("select new com.swp391.scms.users.dto.AuthenticationUser(u.id, coalesce(nullif(u.username, ''), u.email), u.status, r.code, u.passwordChangedAt) "
            + "from User u join u.role r where u.id = :id and u.deletedAt is null")
    /**
     * Thông tin tối thiểu để xác thực một request (id, tên hiển thị, trạng thái, vai trò, lần đổi mật khẩu
     * cuối) của tài khoản chưa xóa. Tài khoản chỉ có email thì dùng email làm tên đăng nhập.
     */
    Optional<AuthenticationUser> findAuthenticationById(@Param("id") Long id);
    /**
     * Tìm các bản ghi có username bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    Optional<User> findByUsernameIgnoreCase(String username);
    /**
     * Tìm các bản ghi có username bằng tham số (không phân biệt hoa thường) và deletedAt đang trống (null)
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    Optional<User> findByUsernameIgnoreCaseAndDeletedAtIsNull(String username);
    /** Tìm tài khoản chưa xóa theo tên đăng nhập hoặc email (không phân biệt hoa thường); dùng khi đăng nhập. */
    @Query("select u from User u where u.deletedAt is null and (lower(u.username) = lower(:identifier) or lower(u.email) = lower(:identifier))")
    Optional<User> findActiveByIdentifier(@Param("identifier") String identifier);
    /**
     * Tìm các bản ghi có email bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<User> findByEmailIgnoreCase(String email);
    /**
     * Tìm các bản ghi có email bằng tham số (không phân biệt hoa thường) và deletedAt đang trống (null) (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    Optional<User> findByEmailIgnoreCaseAndDeletedAtIsNull(String email);
    /** Có tài khoản nào trùng email sau khi bỏ khoảng trắng và chuyển chữ thường không (kể cả tài khoản đã xóa). */
    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = lower(trim(:email))")
    boolean existsByNormalizedEmail(@Param("email") String email);
    /** Tìm các bản ghi có phone = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<User> findByPhone(String phone);
    /**
     * Tìm các bản ghi có phone = tham số và deletedAt đang trống (null) (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<User> findByPhoneAndDeletedAtIsNull(String phone);
    /**
     * Tìm tài khoản có SĐT (sau khi bỏ khoảng trắng, dấu gạch, dấu chấm) nằm trong danh sách cho trước; dùng để
     * phát hiện SĐT trùng dù lưu khác định dạng.
     */
    @Query("select u from User u where u.phone is not null and replace(replace(replace(u.phone, ' ', ''), '-', ''), '.', '') in :phones")
    List<User> findAllByCompactPhoneIn(@Param("phones") java.util.Collection<String> phones);
    /** Tìm các bản ghi có googleSub = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<User> findByGoogleSub(String googleSub);

    /** Tài khoản nhân viên vận hành đang active và chưa xóa (quản lý, lễ tân...) kèm vai trò; dùng để gửi thông báo nội bộ. */
    @Query("select u from User u join fetch u.role r where u.deletedAt is null and u.status = 'active' and upper(r.code) in ('CENTER_MANAGER', 'MANAGER', 'RECEPTIONIST', 'STAFF', 'ROLE_CENTER_MANAGER', 'ROLE_MANAGER', 'ROLE_RECEPTIONIST', 'ROLE_STAFF') order by u.id asc")
    List<User> findActiveStaffUsers();
    /** Tài khoản quản lý đang active và chưa xóa; dùng để gửi thông báo cần quản lý xử lý. */
    @Query("select u from User u join fetch u.role r where u.deletedAt is null and u.status = 'active' and upper(r.code) in ('MANAGER', 'CENTER_MANAGER', 'ROLE_MANAGER', 'ROLE_CENTER_MANAGER') order by u.id asc")
    List<User> findActiveManagers();
    /** Tập userId các hội viên hiện có gói tập đang bảo lưu (frozen); dùng nạp hàng loạt thay cho N+1 trong getAllUsers. */
    @Query("select distinct s.member.userId from MembershipSubscription s where s.status = 'frozen'")
    List<Long> findMemberUserIdsWithFrozenSubscription();
}
