package com.swp391.scms.users;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberKycReviewService.KycReviewDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * API duyệt giấy tờ tùy thân của hội viên (/api/v1/members/kyc) cho lễ tân và quản lý.
 *
 * Quầy duyệt giấy tờ định danh của hội viên (lễ tân và quản lý).
 */
@Tag(name = "Member KYC review", description = "Approve or reject identity documents before a first package")
@RestController
@RequestMapping("/api/v1/members/kyc")
@PreAuthorize("hasRole('RECEPTIONIST')")
public class MemberKycController {
    /** Body khi từ chối: lý do từ chối. */
    public record RejectRequest(String reason) {}

    private final MemberKycReviewService service;
    private final MessageService messages;

    /** Nhận service duyệt KYC và MessageService. */
    public MemberKycController(MemberKycReviewService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    /** GET /pending: danh sách hồ sơ đang chờ duyệt, kèm số giấy tờ đã giải mã để đối chiếu với ảnh. */
    @Operation(summary = "Identity submissions waiting for review, oldest first")
    @GetMapping("/pending")
    public ApiResponse<List<KycReviewDto>> pending() {
        return ApiResponse.ok(messages.getMessage("users.kyc.pending_list"), service.listPending());
    }

    /** POST /{memberId}/approve: duyệt hồ sơ, hội viên được coi là đã xác minh danh tính. */
    @Operation(summary = "Approve a submission: the member may now buy a package")
    @PostMapping("/{memberId}/approve")
    public ApiResponse<Void> approve(@AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long memberId) {
        service.approve(principal, memberId);
        return ApiResponse.ok(messages.getMessage("users.kyc.approved"), null);
    }

    /** POST /{memberId}/reject: từ chối hồ sơ kèm lý do bắt buộc; hội viên nhận thông báo và có thể nộp lại. */
    @Operation(summary = "Reject a submission with a reason: the member submits again")
    @PostMapping("/{memberId}/reject")
    public ApiResponse<Void> reject(@AuthenticationPrincipal AuthenticatedPrincipal principal, @PathVariable Long memberId,
                                    @RequestBody RejectRequest request) {
        service.reject(principal, memberId, request == null ? null : request.reason());
        return ApiResponse.ok(messages.getMessage("users.kyc.rejected"), null);
    }
}
