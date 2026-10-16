package com.swp391.scms.scheduling;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.service.ClassService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * SCRUM-72: class and schedule endpoints.
 * Writes are restricted to CENTER_MANAGER; schedule reads are open to every authenticated role.
 */
@Tag(name = "Classes & Sessions", description = "Class management and class schedule (SCRUM-72)")
@RestController
@RequestMapping("/api/v1/classes")
public class ClassController {

    private final ClassService service;
    private final MessageService messageService;

    public ClassController(ClassService service) {
        this(service, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ClassController(ClassService service, MessageService messageService) {
        this.service = service;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Create a class (CENTER_MANAGER only)")
    @PostMapping
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ResponseEntity<ApiResponse<GymClassDto>> createClass(@Valid @RequestBody CreateClassRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.class.created"), service.createClass(request)));
    }
    @Operation(summary = "List classes")
    @GetMapping
    public ApiResponse<List<GymClassDto>> listClasses() {
        return ApiResponse.ok(msg("scheduling.class.list"), service.listClasses());
    }

    @Operation(summary = "Schedule a session for a class (CENTER_MANAGER only)")
    @PostMapping("/{id}/sessions")
    @PreAuthorize("hasRole('CENTER_MANAGER')")
    public ResponseEntity<ApiResponse<ClassSessionDto>> createSession(@PathVariable Long id,
                                                                     @Valid @RequestBody CreateSessionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("scheduling.session.created"), service.createSession(id, request)));
    }

    @Operation(summary = "List class sessions with optional filters (date range, discipline, coach)")
    @GetMapping("/sessions")
    public ApiResponse<List<ClassSessionDto>> listSessions(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) Long disciplineId,
            @RequestParam(required = false) Long coachId) {
        return ApiResponse.ok(msg("scheduling.session.list"),
                service.searchSessions(fromDate, toDate, disciplineId, coachId));
    }
}
