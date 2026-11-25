package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.TrainingCompletionDto;
import com.swp391.scms.coaching.service.TrainingCompletionService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * API cho hội viên đánh dấu bài tập trong giáo án đã hoàn thành — tắt mặc định vì các endpoint lịch sử hoàn thành
 * bài tập của hội viên đã được gỡ khỏi phạm vi hoạt động; chỉ bật qua {@code app.coaching.completions.enabled}.
 */
@ConditionalOnProperty(name = "app.coaching.completions.enabled", havingValue = "true")
@Tag(name = "Member Training Completions")
@RestController
@RequestMapping("/api/v1/coaching/training-completions/my")
@PreAuthorize("hasRole('MEMBER')")
public class TrainingCompletionController {
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final TrainingCompletionService service;
    private final MessageService messageService;
    private final Clock clock;

    /** Constructor cho test: chỉ có service. */
    public TrainingCompletionController(TrainingCompletionService service) {
        this(service, null, Clock.system(CENTER_ZONE));
    }

    /** Constructor cho test: thêm MessageService. */
    public TrainingCompletionController(TrainingCompletionService service, MessageService messageService) {
        this(service, messageService, Clock.system(CENTER_ZONE));
    }

    /** Constructor chính: thêm Clock để xác định ngày hôm nay. */
    @Autowired
    public TrainingCompletionController(TrainingCompletionService service,
                                        MessageService messageService,
                                        @Autowired(required = false) Clock clock) {
        this.service = service;
        this.messageService = messageService;
        this.clock = clock != null ? clock : Clock.system(CENTER_ZONE);
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) { return messageService != null ? messageService.getMessage(key) : key; }

    /** Ngày hôm nay theo Clock đã cấu hình. */
    private LocalDate today() {
        return LocalDate.now(clock);
    }

    /** GET: id các bài tập hội viên đã hoàn thành trong ngày được chọn. */
    @Operation(summary = "Đọc bài tập đã hoàn thành của MEMBER trong ngày")
    @GetMapping
    public ApiResponse<List<Long>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        LocalDate currentToday = today();
        LocalDate targetDate = exerciseDate != null ? exerciseDate : currentToday;
        return ApiResponse.ok(msg("coaching.completion.list.success"),
                service.getCompletedItemIds(principal.id(), targetDate, currentToday));
    }

    /** PUT /{itemId}: đánh dấu bài tập hôm nay là đã hoàn thành. */
    @Operation(summary = "Đánh dấu hoàn thành bài tập trong ngày")
    @PutMapping("/{itemId}")
    public ApiResponse<TrainingCompletionDto> mark(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long itemId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        LocalDate currentToday = today();
        LocalDate targetDate = exerciseDate != null ? exerciseDate : currentToday;
        service.setCompleted(principal.id(), itemId, targetDate, true, currentToday);
        return ApiResponse.ok(msg("coaching.completion.saved"), new TrainingCompletionDto(itemId, targetDate, true));
    }

    /** DELETE /{itemId}: bỏ đánh dấu hoàn thành bài tập hôm nay. */
    @Operation(summary = "Bỏ đánh dấu hoàn thành bài tập trong ngày")
    @DeleteMapping("/{itemId}")
    public ApiResponse<TrainingCompletionDto> unmark(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long itemId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        LocalDate currentToday = today();
        LocalDate targetDate = exerciseDate != null ? exerciseDate : currentToday;
        service.setCompleted(principal.id(), itemId, targetDate, false, currentToday);
        return ApiResponse.ok(msg("coaching.completion.saved"), new TrainingCompletionDto(itemId, targetDate, false));
    }
}
