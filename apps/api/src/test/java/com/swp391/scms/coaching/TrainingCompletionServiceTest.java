package com.swp391.scms.coaching;

import com.swp391.scms.coaching.entity.TrainingPlan;
import com.swp391.scms.coaching.entity.TrainingPlanItem;
import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import com.swp391.scms.coaching.repository.TrainingItemCompletionRepository;
import com.swp391.scms.coaching.service.TrainingCompletionService;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TrainingCompletionServiceTest {
    @Mock TrainingPlanItemRepository itemRepository;
    @Mock TrainingItemCompletionRepository completionRepository;
    private TrainingCompletionService service;
    private TrainingPlanItem item;
    private final LocalDate date = LocalDate.of(2026, 10, 26);

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        service = new TrainingCompletionService(itemRepository, completionRepository);
        Member member = new Member(); member.setUserId(10L);
        TrainingPlan plan = new TrainingPlan(); plan.setMember(member); plan.setStatus("active");
        plan.setStartDate(date.minusDays(1)); plan.setEndDate(date.plusDays(1));
        item = new TrainingPlanItem(); item.setTrainingPlan(plan); item.setDayOfWeek(1);
        when(itemRepository.findLockedById(5L)).thenReturn(Optional.of(item));
        when(itemRepository.findById(5L)).thenReturn(Optional.of(item));
    }

    @Test void markAndUnmarkAreIdempotent() {
        when(completionRepository.existsByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(10L, 5L, date))
                .thenReturn(false, true, true, false);
        service.setCompleted(10L, 5L, date, true, date);
        verify(completionRepository).save(any());
        service.setCompleted(10L, 5L, date, true, date);
        verify(completionRepository, times(1)).save(any());
        service.setCompleted(10L, 5L, date, false, date);
        service.setCompleted(10L, 5L, date, false, date);
        verify(completionRepository).deleteByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(10L, 5L, date);
    }

    @Test void rejectsOtherMembersItemWithoutWriting() {
        assertThatThrownBy(() -> service.setCompleted(99L, 5L, date, true, date)).isInstanceOf(ResourceNotFoundException.class);
        verify(completionRepository, never()).save(any());
    }

    @Test void rejectsWrongDayAndFutureDate() {
        assertThatThrownBy(() -> service.setCompleted(10L, 5L, date.plusDays(1), true, date.plusDays(1)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setCompleted(10L, 5L, date.plusDays(1), true, date))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void rejectsInactivePlansAndUnscheduledItems() {
        item.getTrainingPlan().setStatus("draft");
        assertThatThrownBy(() -> service.setCompleted(10L, 5L, date, true, date))
                .isInstanceOf(BadRequestException.class);
        item.getTrainingPlan().setStatus("active");
        item.setDayOfWeek(null);
        assertThatThrownBy(() -> service.setCompleted(10L, 5L, date, true, date))
                .isInstanceOf(BadRequestException.class);
        verify(completionRepository, never()).save(any());
    }

    @Test void listsOnlyOwnCompletionsForRequestedDate() {
        when(completionRepository.findByMemberUserIdAndExerciseDate(10L, date)).thenReturn(List.of());
        assertThat(service.getCompletedItemIds(10L, date, date)).isEmpty();
        verify(completionRepository).findByMemberUserIdAndExerciseDate(10L, date);
    }
}
