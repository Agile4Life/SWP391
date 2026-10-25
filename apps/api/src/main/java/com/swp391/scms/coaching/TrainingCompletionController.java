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

    public TrainingCompletionController(TrainingCompletionService service) { this(service, null); }

    @Autowired
    public TrainingCompletionController(TrainingCompletionService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) { return messageService != null ? messageService.getMessage(key) : key; }

    @Operation(summary = "Đọc bài tập đã hoàn thành của MEMBER trong ngày")
    @GetMapping
    public ApiResponse<List<Long>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        return ApiResponse.ok(msg("coaching.completion.list.success"),
                service.getCompletedItemIds(principal.id(), exerciseDate, LocalDate.now(CENTER_ZONE)));
    }

    @Operation(summary = "Đánh dấu hoàn thành bài tập trong ngày")
    @PutMapping("/{itemId}")
    public ApiResponse<TrainingCompletionDto> mark(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long itemId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        service.setCompleted(principal.id(), itemId, exerciseDate, true, LocalDate.now(CENTER_ZONE));
        return ApiResponse.ok(msg("coaching.completion.saved"), new TrainingCompletionDto(itemId, exerciseDate, true));
    }

    @Operation(summary = "Bỏ đánh dấu hoàn thành bài tập trong ngày")
    @DeleteMapping("/{itemId}")
    public ApiResponse<TrainingCompletionDto> unmark(@AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long itemId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate exerciseDate) {
        service.setCompleted(principal.id(), itemId, exerciseDate, false, LocalDate.now(CENTER_ZONE));
        return ApiResponse.ok(msg("coaching.completion.saved"), new TrainingCompletionDto(itemId, exerciseDate, false));
    }
}
