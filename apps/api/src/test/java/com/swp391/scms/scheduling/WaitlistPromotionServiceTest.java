package com.swp391.scms.scheduling;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassWaitlist;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.event.WaitlistPromotedEvent;
import com.swp391.scms.scheduling.repository.ClassWaitlistRepository;
import com.swp391.scms.scheduling.scheduler.WaitlistPromotionScheduler;
import com.swp391.scms.scheduling.service.WaitlistPromotionService;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WaitlistPromotionServiceTest {

    @Mock private ClassWaitlistRepository waitlistRepository;
    @Mock private NotificationService notificationService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private MessageService messageService;
    @Mock private Clock clock;

    @InjectMocks
    private WaitlistPromotionService promotionService;

    private GymClass gymClass;
    private Member member1;
    private Member member2;
    private ClassWaitlist overdueWaitlist;
    private ClassWaitlist waitingWaitlist;

    @BeforeEach
    void setUp() {
        lenient().when(clock.instant()).thenReturn(Instant.parse("2026-10-25T12:00:00Z"));
        lenient().when(clock.getZone()).thenReturn(ZoneOffset.UTC);

        gymClass = new GymClass();
        ReflectionTestUtils.setField(gymClass, "id", 1L);
        gymClass.setName("Yoga Intermediate");

        User user1 = new User();
        ReflectionTestUtils.setField(user1, "id", 101L);
        member1 = new Member();
        member1.setUserId(101L);
        member1.setUser(user1);

        User user2 = new User();
        ReflectionTestUtils.setField(user2, "id", 102L);
        member2 = new Member();
        member2.setUserId(102L);
        member2.setUser(user2);

        overdueWaitlist = new ClassWaitlist();
        ReflectionTestUtils.setField(overdueWaitlist, "id", 50L);
        overdueWaitlist.setGymClass(gymClass);
        overdueWaitlist.setMember(member1);
        overdueWaitlist.setStatus("notified");
        overdueWaitlist.setNotifiedAt(LocalDateTime.of(2026, 10, 24, 10, 0)); // > 24 hours ago
        overdueWaitlist.setReservationExpiresAt(LocalDateTime.of(2026, 10, 25, 10, 0));

        waitingWaitlist = new ClassWaitlist();
        ReflectionTestUtils.setField(waitingWaitlist, "id", 51L);
        waitingWaitlist.setGymClass(gymClass);
        waitingWaitlist.setMember(member2);
        waitingWaitlist.setStatus("waiting");
        waitingWaitlist.setRequestedAt(LocalDateTime.of(2026, 10, 24, 15, 0));
    }

    @Test
    void processExpiredWaitlists_withOverdueEntries_expiresAndPromotesNext() {
        Page<ClassWaitlist> page = new PageImpl<>(List.of(overdueWaitlist));
        when(waitlistRepository.findByStatusAndNotifiedAtBefore(eq("notified"), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(page);
        when(waitlistRepository.findFirstByGymClassIdAndStatusOrderByRequestedAtAsc(1L, "waiting"))
                .thenReturn(Optional.of(waitingWaitlist));
        when(waitlistRepository.saveAndFlush(any(ClassWaitlist.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int expired = promotionService.processExpiredWaitlists();

        assertEquals(1, expired);
        assertEquals("expired", overdueWaitlist.getStatus());
        assertEquals("notified", waitingWaitlist.getStatus());
        assertNotNull(waitingWaitlist.getNotifiedAt());
        assertNotNull(waitingWaitlist.getReservationExpiresAt());

        // Verifies event publication
        ArgumentCaptor<WaitlistPromotedEvent> eventCaptor = ArgumentCaptor.forClass(WaitlistPromotedEvent.class);
        verify(eventPublisher, times(1)).publishEvent(eventCaptor.capture());
        assertEquals(51L, eventCaptor.getValue().waitlistId());
        assertEquals(102L, eventCaptor.getValue().memberUserId());

        // Verifies notifications sent for both expiry and promotion
        verify(notificationService, times(1)).send(eq(101L), any(), any(), eq("schedule_change"), eq("class_session"), eq(50L));
        verify(notificationService, times(1)).send(eq(102L), any(), any(), eq("schedule_change"), eq("class_session"), eq(51L));
    }

    @Test
    void processExpiredWaitlists_empty_doesNothing() {
        when(waitlistRepository.findByStatusAndNotifiedAtBefore(eq("notified"), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(Page.empty());
        when(waitlistRepository.findByStatusAndReservationExpiresAtLessThan(eq("notified"), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(Page.empty());

        int expired = promotionService.processExpiredWaitlists();

        assertEquals(0, expired);
        verify(waitlistRepository, never()).findFirstByGymClassIdAndStatusOrderByRequestedAtAsc(any(), any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void waitlistPromotionScheduler_runsJob() {
        WaitlistPromotionScheduler scheduler = new WaitlistPromotionScheduler(promotionService);
        when(waitlistRepository.findByStatusAndNotifiedAtBefore(any(), any(), any()))
                .thenReturn(Page.empty());
        when(waitlistRepository.findByStatusAndReservationExpiresAtLessThan(any(), any(), any()))
                .thenReturn(Page.empty());

        scheduler.scheduleWaitlistPromotion();

        verify(waitlistRepository, atLeastOnce()).findByStatusAndNotifiedAtBefore(any(), any(), any());
    }
}
