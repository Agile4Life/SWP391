package com.swp391.scms.coaching;
import com.swp391.scms.coaching.service.CurrentCoachMembers;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
/** API trả danh sách hội viên HLV hiện đang phụ trách (dùng cho ô chọn hội viên). */
@RestController
@RequestMapping("/api/v1/coaching/members")
public class CurrentCoachMembersController {
 private final CurrentCoachMembers members; private final MessageService messages;
 /** Khởi tạo controller với service CurrentCoachMembers và MessageService. */
 public CurrentCoachMembersController(CurrentCoachMembers members,MessageService messages){this.members=members;this.messages=messages;}
 /** GET: COACH thấy hội viên mình phụ trách, CENTER_MANAGER thấy tất cả. */
 @GetMapping @PreAuthorize("hasAnyRole('COACH','CENTER_MANAGER')")
 public ApiResponse<List<CurrentCoachMembers.MemberOption>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal){
  return ApiResponse.ok(messages.getMessage("coaching.members.current.loaded"),members.list(principal.id(),principal.role()));
 }
}
