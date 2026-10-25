package com.swp391.scms.coaching;

import com.swp391.scms.coaching.repository.TrainingPlanItemRepository;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import static org.assertj.core.api.Assertions.assertThat;

class TrainingPlanItemRepositoryTest {
    // Contract check only; PostgreSQL SQL execution/locking requires an isolated database.
    @Test void completionLookupFetchesOwnershipGraphAndKeepsWriteLock() throws Exception {
        var method = TrainingPlanItemRepository.class.getMethod("findLockedById", Long.class);
        assertThat(method.getAnnotation(Lock.class).value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
        assertThat(method.getAnnotation(Query.class).value().replaceAll("\\s+", " ").trim())
                .isEqualTo("select item from TrainingPlanItem item join fetch item.trainingPlan plan join fetch plan.member where item.id = :id");
        assertThat(method.getParameters()[0].getAnnotation(Param.class).value()).isEqualTo("id");
    }
}
