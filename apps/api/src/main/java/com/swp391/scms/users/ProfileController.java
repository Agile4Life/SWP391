package com.swp391.scms.users;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.dto.ProfileDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * API hồ sơ cá nhân (/api/v1/profile) cho người dùng đang đăng nhập: xem/sửa hồ sơ, đổi ảnh đại diện, đổi mật
 * khẩu, nộp giấy tờ tùy thân, cập nhật hồ sơ HLV/lễ tân.
 */
@Tag(name = "Profile", description = "Hồ sơ cá nhân của người dùng")
@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    /** Body đổi ảnh đại diện: data URL hoặc đường dẫn ảnh (giới hạn kích thước chuỗi). */
    public record AvatarUploadRequest(@Size(max = 2800000) String avatarUrl) {}

    /** Body đổi mật khẩu: mật khẩu hiện tại và mật khẩu mới (theo PasswordPolicy). */
    public record ChangePasswordRequest(
            @NotBlank(message = "{validation.auth.password.not_blank}")
            String currentPassword,
            @NotBlank(message = "{validation.auth.password.not_blank}")
            @jakarta.validation.constraints.Pattern(regexp = com.swp391.scms.auth.PasswordPolicy.REGEX, message = "{validation.auth.password.policy}")
            String newPassword
    ) {}

    private final ProfileService profileService;
    private final MessageService messageService;

    /** Constructor cho test, không có MessageService. */
    public ProfileController(ProfileService profileService) {
        this(profileService, null);
    }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public ProfileController(ProfileService profileService, MessageService messageService) {
        this.profileService = profileService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo; không có MessageService thì trả lại chính mã. */
    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    /** GET /me: hồ sơ của người đang đăng nhập (thông tin chung và phần riêng theo vai trò). */
    @Operation(summary = "Xem hồ sơ cá nhân", description = "Lấy thông tin cá nhân của người dùng hiện tại từ JWT")
    @GetMapping
    public ApiResponse<ProfileDto> getMyProfile(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("users.profile.get.success"), profileService.getProfile(principal.id()));
    }

    /** PUT /me: cập nhật hồ sơ của chính mình. */
    @Operation(summary = "Cập nhật hồ sơ cá nhân", description = "Chỉnh sửa thông tin cá nhân, mục tiêu tập luyện của người dùng")
    @PutMapping
    public ApiResponse<ProfileDto> updateMyProfile(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                   @Valid @RequestBody ProfileDto request) {
        return ApiResponse.ok(msg("users.profile.update.success"), profileService.updateProfile(principal.id(), request));
    }

    /** POST /avatar: đổi ảnh đại diện. */
    @Operation(summary = "Cập nhật ảnh đại diện", description = "Tải lên hoặc xóa ảnh đại diện (hỗ trợ JPG, PNG, WebP tối đa 2MB)")
    @PostMapping("/avatar")
    public ApiResponse<ProfileDto> updateMyAvatar(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                  @Valid @RequestBody AvatarUploadRequest request) {
        return ApiResponse.ok(msg("users.profile.update.success"), profileService.updateAvatar(principal.id(), request.avatarUrl()));
    }

    /** PUT /me/password: đổi mật khẩu; trả JWT mới vì các token cũ bị vô hiệu sau khi đổi. */
    @Operation(summary = "Đổi mật khẩu cá nhân", description = "Xác minh mật khẩu hiện tại, cập nhật mật khẩu mới và gửi email thông báo")
    @PostMapping("/password")
    public ApiResponse<com.swp391.scms.auth.dto.AuthTokenResponse> changeMyPassword(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                              @Valid @RequestBody ChangePasswordRequest request) {
        return ApiResponse.ok(msg("users.profile.password.success"),
                profileService.changePassword(principal.id(), request.currentPassword(), request.newPassword()));
    }

    /** POST /me/kyc: hội viên nộp CCCD/hộ chiếu kèm ảnh để chờ quầy duyệt. */
    @Operation(summary = "Xác minh danh tính CCCD/Hộ chiếu", description = "Cập nhật thông tin định danh (CCCD/Hộ chiếu) và đồng bộ họ tên tài khoản trước khi đăng ký gói tập đầu tiên")
    @PostMapping("/kyc")
    @PreAuthorize("hasRole('MEMBER')")
    public ApiResponse<ProfileDto> submitMyKyc(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                               @Valid @RequestBody com.swp391.scms.users.dto.MemberKycRequest request) {
        return ApiResponse.ok(msg("users.profile.kyc.success"), profileService.submitMemberKyc(principal.id(), request));
    }

    /** PUT /coach: HLV cập nhật chuyên môn, giới thiệu và chứng chỉ. */
    @Operation(summary = "Cập nhật hồ sơ Coach", description = "Dành riêng cho HLV cập nhật chuyên môn")
    @PutMapping("/coach")
    @PreAuthorize("hasRole('COACH')")
    public ApiResponse<Void> updateCoachProfile(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                @Valid @RequestBody com.swp391.scms.users.dto.CoachProfileUpdateDto request) {
        profileService.updateCoachProfile(principal.id(), principal.role(), request);
        return ApiResponse.ok(msg("users.profile.coach.update.success"), null);
    }

    /** PUT /receptionist: lễ tân cập nhật ca làm việc. */
    @Operation(summary = "Cập nhật hồ sơ Lễ tân", description = "Dành cho Lễ tân tự cập nhật ca làm việc của mình. Quản lý dùng endpoint ở UserController.")
    @PutMapping("/receptionist")
    @PreAuthorize("hasRole('RECEPTIONIST')")
    public ApiResponse<Void> updateReceptionistProfile(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                                       @Valid @RequestBody com.swp391.scms.users.dto.ReceptionistProfileUpdateDto request) {
        profileService.updateReceptionistProfile(principal.id(), principal.role(), request);
        return ApiResponse.ok(msg("users.profile.receptionist.update.success"), null);
    }
}
