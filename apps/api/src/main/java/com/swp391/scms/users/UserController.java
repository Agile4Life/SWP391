package com.swp391.scms.users;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.users.dto.UserCreateDto;
import com.swp391.scms.users.dto.UserDto;
import com.swp391.scms.users.dto.UserUpdateDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

/**
 * API quản trị người dùng (/api/v1/users) cho Admin: xem, tạo, sửa, xóa mềm, khôi phục, khóa/mở khóa và dọn tài
 * khoản không hoạt động.
 */
@Tag(name = "Users & RBAC", description = "Quản trị người dùng, trạng thái khóa/mở khóa và phân quyền vai trò")
@PreAuthorize("hasRole('ADMIN')")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public UserController(UserService userService) {
        this(userService, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public UserController(UserService userService, MessageService messageService) {
        this.userService = userService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET: danh sách người dùng chưa bị xóa. */
    @Operation(summary = "Lấy danh sách người dùng", description = "Trả về danh sách tất cả người dùng chưa bị xóa mềm")
    @GetMapping
    public ApiResponse<List<UserDto>> getAllUsers() {
        return ApiResponse.ok(msg("users.list.success"), userService.getAllUsers());
    }

    /** GET /{id}: chi tiết một người dùng. */
    @Operation(summary = "Xem chi tiết người dùng", description = "Lấy thông tin người dùng theo User ID")
    @GetMapping("/{id}")
    public ApiResponse<UserDto> getUserById(@PathVariable Long id) {
        return ApiResponse.ok(msg("users.detail.success"), userService.getUserById(id));
    }

    /** POST: tạo người dùng mới, trả HTTP 201. */
    @Operation(summary = "Tạo mới người dùng", description = "Tạo tài khoản người dùng mới kèm vai trò")
    @PostMapping
    public ResponseEntity<ApiResponse<UserDto>> createUser(@Valid @RequestBody UserCreateDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("users.created.success"), userService.createUser(dto)));
    }

    /** PUT /{id}: sửa thông tin hoặc đổi vai trò người dùng. */
    @Operation(summary = "Cập nhật người dùng", description = "Cập nhật thông tin tài khoản người dùng theo ID")
    @PutMapping("/{id}")
    public ApiResponse<UserDto> updateUser(@PathVariable Long id, @Valid @RequestBody UserUpdateDto dto) {
        return ApiResponse.ok(msg("users.updated.success"), userService.updateUser(id, dto));
    }

    /** DELETE /{id}: xóa mềm người dùng (đặt deletedAt, không xóa khỏi database). */
    @Operation(summary = "Xóa mềm người dùng", description = "Đánh dấu xóa mềm người dùng (deleted_at)")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ApiResponse.ok(msg("users.deleted.success"), null);
    }

    /** GET /deleted: danh sách người dùng đã bị xóa mềm. */
    @Operation(summary = "Lấy danh sách người dùng đã bị xóa mềm", description = "Trả về danh sách tài khoản có deleted_at khác null")
    @GetMapping("/deleted")
    public ApiResponse<List<UserDto>> getDeletedUsers() {
        return ApiResponse.ok(msg("users.list.success"), userService.getDeletedUsers());
    }

    /** PATCH /{id}/restore: khôi phục người dùng đã xóa mềm. */
    @Operation(summary = "Khôi phục tài khoản", description = "Khôi phục tài khoản đã bị xóa mềm (đặt lại deleted_at = null)")
    @PatchMapping("/{id}/restore")
    public ApiResponse<UserDto> restoreUser(@PathVariable Long id) {
        return ApiResponse.ok(msg("users.restored.success"), userService.restoreUser(id));
    }

    /** PATCH /{id}/lock: khóa tài khoản. */
    @Operation(summary = "Khóa tài khoản", description = "Chuyển trạng thái người dùng sang 'locked'")
    @PatchMapping("/{id}/lock")
    public ApiResponse<UserDto> lockUser(@PathVariable Long id) {
        return ApiResponse.ok(msg("users.locked.success"), userService.setStatus(id, "locked"));
    }

    /** PATCH /{id}/unlock: mở khóa tài khoản. */
    @Operation(summary = "Mở khóa tài khoản", description = "Chuyển trạng thái người dùng sang 'active'")
    @PatchMapping("/{id}/unlock")
    public ApiResponse<UserDto> unlockUser(@PathVariable Long id) {
        return ApiResponse.ok(msg("users.unlocked.success"), userService.setStatus(id, "active"));
    }

    /** PUT /{id}/receptionist: cập nhật ca làm việc của lễ tân. */
    @Operation(summary = "Cập nhật hồ sơ Lễ tân", description = "Quản lý cập nhật ca làm việc cho Lễ tân")
    @PutMapping("/{id}/receptionist")
    public ApiResponse<Void> updateReceptionistProfile(
            @PathVariable Long id,
            @Valid @RequestBody com.swp391.scms.users.dto.ReceptionistProfileUpdateDto request) {
        userService.updateReceptionistShift(id, request);
        return ApiResponse.ok(msg("users.profile.receptionist.update.success"), null);
    }

    @Operation(summary = "Tự động dọn dẹp tài khoản không hoạt động > 6 tháng",
               description = "Xóa mềm các tài khoản không đăng nhập quá 6 tháng (ngoại trừ hội viên đang bảo lưu tập)")
    /**
     * POST /cleanup-inactive: chạy ngay việc xóa mềm tài khoản hội viên không hoạt động quá 6 tháng, trả số tài
     * khoản đã xóa.
     */
    @PostMapping("/cleanup-inactive")
    public ApiResponse<java.util.Map<String, Object>> cleanupInactiveUsers() {
        int count = userService.cleanupInactiveUsers();
        return ApiResponse.ok(msg("users.cleanup.success"), java.util.Map.of("deletedCount", count));
    }
}

