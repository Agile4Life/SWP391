package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachLeaderboardItemDto;
import com.swp391.scms.coaching.service.CoachLeaderboardService;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Coach Leaderboard", description = "Bảng xếp hạng Huấn luyện viên theo số buổi huấn luyện trong tháng")
@RestController
@RequestMapping("/api/v1/coaching")
public class CoachLeaderboardController {

    private final CoachLeaderboardService leaderboardService;
    private final MessageService messageService;

    public CoachLeaderboardController(CoachLeaderboardService leaderboardService) {
        this(leaderboardService, null);
    }

    @Autowired
    public CoachLeaderboardController(CoachLeaderboardService leaderboardService, MessageService messageService) {
        this.leaderboardService = leaderboardService;
        this.messageService = messageService;
    }

    private String msg(String key) {
        return messageService != null ? messageService.getMessage(key) : key;
    }

    @Operation(summary = "Xem Bảng xếp hạng Huấn luyện viên tháng", description = "Lấy danh sách Top Rank Huấn luyện viên trong tháng theo số buổi huấn luyện")
    @GetMapping("/leaderboard")
    public ApiResponse<List<CoachLeaderboardItemDto>> getLeaderboard(
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "month", required = false) Integer month) {
        List<CoachLeaderboardItemDto> leaderboard = leaderboardService.getLeaderboard(year, month);
        return ApiResponse.ok(msg("coaching.leaderboard.success"), leaderboard);
    }
}

