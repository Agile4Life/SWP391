package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.TrainingCompletionDto;
import com.swp391.scms.coaching.service.TrainingCompletionService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Tag(name = "Member Training Completions")
@RestController
@RequestMapping("/api/v1/coaching/training-completions/my")
@PreAuthorize("hasRole('MEMBER')")
public class TrainingCompletionController {
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final TrainingCompletionService service;
    private final MessageService messageService;
    private final Clock clock;

    public TrainingCompletionController(TrainingCompletionService service) {
        this(service, null, Clock.system(CENTER_ZONE));
    }

    public TrainingCompletionController(TrainingCompletionService service, MessageService messageService) {
        this(service, messageService, Clock.system(CENTER_ZONE));
    }

    @Autowired
    public TrainingCompletionController(TrainingCompletionService service,
                                        MessageService messageService,
                                        @Autowired(required = false) Clock clock) {
        this.service = service;
        this.messageService = messageService;
        this.clock = clock != null ? clock : Clock.system(CENTER_ZONE);
    }

    private String msg(String key) { return messageService != null ? messageService.getMessage(key) : key; }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(CENTER_ZONE));
    }

    @Operation(summary = "Đọc bài tập đã hoàn thành của MEMBER trong ngày")
    @GetMapping
    public ApiResponse<List<Long>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        LocalDate currentToday = today();
        LocalDate targetDate = exerciseDate != null ? exerciseDate : currentToday;
        return ApiResponse.ok(msg("coaching.completion.list.success"),
                service.getCompletedItemIds(principal.id(), targetDate, currentToday));
    }

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
