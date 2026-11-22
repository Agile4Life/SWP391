package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachLeaderboardItemDto;
import com.swp391.scms.coaching.service.CoachLeaderboardService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CoachLeaderboardControllerTest {

    @Mock
    private CoachLeaderboardService leaderboardService;

    @Mock
    private MessageService messageService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        lenient().when(messageService.getMessage(any())).thenAnswer(inv -> inv.getArgument(0));
        CoachLeaderboardController controller = new CoachLeaderboardController(leaderboardService, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
    }

    @Test
    void getLeaderboard_returns200WithoutReviewDependency() throws Exception {
        CoachLeaderboardItemDto item = new CoachLeaderboardItemDto(
                1, 21L, "Coach One", "Gym", null,
                null, 0, 12, "Top 1: HLV Năng Suất 🏆", null, null
        );
        when(leaderboardService.getLeaderboard(2026, 11)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/coaching/leaderboard")
                        .param("year", "2026")
                        .param("month", "11"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].coachId").value(21))
                .andExpect(jsonPath("$.data[0].totalSessions").value(12))
                .andExpect(jsonPath("$.data[0].totalReviews").value(0));
    }

    @Test
    void monthlyReviewEndpointsAreRemovedFromLeaderboardController() throws Exception {
        MockMvc rawMockMvc = MockMvcBuilders.standaloneSetup(new CoachLeaderboardController(leaderboardService, messageService))
                .build();
        rawMockMvc.perform(get("/api/v1/coaching/monthly-reviews"))
                .andExpect(status().isNotFound());
        rawMockMvc.perform(post("/api/v1/coaching/monthly-reviews/generate").param("year", "2026").param("month", "11"))
                .andExpect(status().isNotFound());
        rawMockMvc.perform(get("/api/v1/coaching/monthly-reviews/my"))
                .andExpect(status().isNotFound());
    }

    @Test
    void reviewAndEvaluationControllersAreDisabledByDefault() {
        ConditionalOnProperty reviewCondition = CoachReviewController.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(reviewCondition).isNotNull();
        assertThat(reviewCondition.havingValue()).isEqualTo("true");
        assertThat(reviewCondition.matchIfMissing()).isFalse();

        ConditionalOnProperty evalCondition = SessionEvaluationController.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(evalCondition).isNotNull();
        assertThat(evalCondition.havingValue()).isEqualTo("true");
        assertThat(evalCondition.matchIfMissing()).isFalse();
    }
}
