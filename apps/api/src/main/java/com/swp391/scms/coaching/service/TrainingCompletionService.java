package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.entity.TrainingPlanItem;
import com.swp391.scms.coaching.entity.TrainingItemCompletion;
import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import com.swp391.scms.coaching.repository.TrainingItemCompletionRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

@Service
public class TrainingCompletionService {
    private final TrainingPlanItemRepository itemRepository;
    private final TrainingItemCompletionRepository completionRepository;

    public TrainingCompletionService(TrainingPlanItemRepository itemRepository,
                                     TrainingItemCompletionRepository completionRepository) {
        this.itemRepository = itemRepository;
        this.completionRepository = completionRepository;
    }

    @Transactional(readOnly = true)
    public List<Long> getCompletedItemIds(Long memberUserId, LocalDate exerciseDate, LocalDate today) {
        if (exerciseDate == null || exerciseDate.isAfter(today)) {
            throw new BadRequestException("INVALID_EXERCISE_DATE", "coaching.completion.invalid_date", null,
                    "Exercise date is required and must not be in the future.");
        }
        return completionRepository.findByMemberUserIdAndExerciseDate(memberUserId, exerciseDate).stream()
                .map(completion -> completion.getTrainingPlanItem().getId()).toList();
    }

    @Transactional
    public boolean setCompleted(Long memberUserId, Long itemId, LocalDate exerciseDate, boolean completed, LocalDate today) {
        TrainingPlanItem item = itemRepository.findLockedById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.training_plan", itemId));
        if (item.getTrainingPlan() == null || item.getTrainingPlan().getMember() == null
                || !Objects.equals(item.getTrainingPlan().getMember().getUserId(), memberUserId)) {
            throw new ResourceNotFoundException("resource.training_plan", itemId);
        }
        if (exerciseDate == null || !exerciseDate.equals(today)
                || !"active".equalsIgnoreCase(item.getTrainingPlan().getStatus())
                || exerciseDate.isBefore(item.getTrainingPlan().getStartDate())
                || exerciseDate.isAfter(item.getTrainingPlan().getEndDate())
                || item.getDayOfWeek() == null
                || item.getDayOfWeek() != exerciseDate.getDayOfWeek().getValue()) {
            throw new BadRequestException("INVALID_EXERCISE_DATE", "coaching.completion.invalid_date", null,
                    "Exercise must be scheduled for today in an active training plan within its date range.");
        }
        boolean exists = completionRepository.existsByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(
                memberUserId, itemId, exerciseDate);
        if (completed && !exists) {
            TrainingItemCompletion completion = new TrainingItemCompletion();
            completion.setMember(item.getTrainingPlan().getMember());
            completion.setTrainingPlanItem(item);
            completion.setExerciseDate(exerciseDate);
            completionRepository.save(completion);
        } else if (!completed && exists) {
            completionRepository.deleteByMemberUserIdAndTrainingPlanItemIdAndExerciseDate(memberUserId, itemId, exerciseDate);
        }
        return completed;
    }
}
