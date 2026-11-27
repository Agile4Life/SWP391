package com.swp391.scms.support;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.support.entity.SupportRequestRead;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SupportInboxServiceTest {
    SupportRequestService access = mock(SupportRequestService.class);
    SupportRequestRepository tickets = mock(SupportRequestRepository.class);
    SupportRequestReadRepository reads = mock(SupportRequestReadRepository.class);
    SupportRequestMessageRepository messages = mock(SupportRequestMessageRepository.class);
    SupportInboxService service = new SupportInboxService(access, tickets, reads, messages, new SupportRequestMapper());
    SupportRequest ticket = new SupportRequest();
    User user = new User();

    @BeforeEach
    void setup() {
        ticket.setId(1L);
        ticket.setStatus("open");
    }

    void allow() {
        when(access.requireActor(2L, "RECEPTIONIST")).thenReturn(user);
        when(tickets.findByIdForUpdate(1L)).thenReturn(Optional.of(ticket));
    }

    @Test
    void olderCursorNeverRegressesAndReturnsMessagesArrivingLater() {
        allow();
        var read = new SupportRequestRead(ticket, user, 9);
        when(reads.findBySupportRequestIdAndUserId(1L, 2L)).thenReturn(Optional.of(read));
        when(messages.existsByIdAndSupportRequestId(5L, 1L)).thenReturn(true);
        when(messages.countIncomingAfter(1L, 9L)).thenReturn(2L);
        assertEquals(2, service.markRead(1L, 2L, "RECEPTIONIST", 5L).unreadCount());
        assertEquals(9, read.getLastMessageId());
        assertEquals("open", ticket.getStatus());
        verify(tickets, never()).save(any());
    }

    @Test
    void initialDescriptionCanBeReadWithoutReadingLaterMessages() {
        allow();
        var saved = new SupportRequestRead(ticket, user, 0);
        when(reads.findBySupportRequestIdAndUserId(1L, 2L)).thenReturn(Optional.empty(), Optional.of(saved));
        when(messages.countIncomingAfter(1L, 0L)).thenReturn(3L);
        assertEquals(3, service.markRead(1L, 2L, "RECEPTIONIST", 0L).unreadCount());
        verify(messages, never()).existsByIdAndSupportRequestId(any(), any());
    }

    @Test
    void rejectsForeignMessage() {
        allow();
        assertThrows(BadRequestException.class, () -> service.markRead(1L, 2L, "RECEPTIONIST", 99L));
        verifyNoInteractions(reads);
    }

    @Test
    void rejectsNonInboxRoles() {
        assertThrows(ForbiddenException.class, () -> service.markRead(1L, 2L, "MEMBER", 0L));
        assertThrows(ForbiddenException.class, () -> service.markRead(1L, 2L, "COACH", 0L));
        verifyNoInteractions(access, tickets, reads, messages);
    }

    @Test
    void managerInboxFiltersEscalatedTicketsOnly() {
        when(access.requireActor(5L, "CENTER_MANAGER")).thenReturn(user);
        when(tickets.findInbox("open", true, true, 5L, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(ticket), PageRequest.of(0, 20), 1));
        when(messages.countIncomingAfter(1L, 0L)).thenReturn(1L);
        var result = service.inbox(5L, "CENTER_MANAGER", "open", true, PageRequest.of(0, 20));
        assertEquals(2, result.getContent().getFirst().unreadCount());
        verify(tickets).findInbox("open", true, true, 5L, PageRequest.of(0, 20));
    }

    @Test
    void rejectsInactiveActorBeforeTicketLookup() {
        when(access.requireActor(2L, "RECEPTIONIST"))
                .thenThrow(new ForbiddenException("FORBIDDEN", "support.message.forbidden", null, null));
        assertThrows(ForbiddenException.class, () -> service.markRead(1L, 2L, "RECEPTIONIST", 0L));
        verifyNoInteractions(tickets, reads, messages);
    }

    @Test
    void absentReceiptCountsDescriptionAndUsesOnlyCurrentUser() {
        when(access.requireActor(2L, "RECEPTIONIST")).thenReturn(user);
        when(tickets.findReceptionistInbox("open", true, 2L, PageRequest.of(1, 5)))
                .thenReturn(new PageImpl<>(List.of(ticket), PageRequest.of(1, 5), 6));
        when(messages.countIncomingAfter(1L, 0L)).thenReturn(2L);
        var result = service.inbox(2L, "RECEPTIONIST", " OPEN ", true, PageRequest.of(1, 5, Sort.by("id")));
        assertEquals(3, result.getContent().getFirst().unreadCount());
        assertEquals(6, result.getTotalElements());
        verify(reads).findBySupportRequestIdAndUserId(1L, 2L);
        verify(reads, never()).save(any());
    }

    @Test
    void readingOneReceptionistsInboxDoesNotUseAnotherReceipt() {
        when(access.requireActor(3L, "RECEPTIONIST")).thenReturn(user);
        when(tickets.findReceptionistInbox(null, false, 3L, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(ticket)));
        when(reads.findBySupportRequestIdAndUserId(1L, 3L))
                .thenReturn(Optional.of(new SupportRequestRead(ticket, user, 10)));
        when(messages.countIncomingAfter(1L, 10L)).thenReturn(0L);
        assertEquals(0, service.inbox(3L, "RECEPTIONIST", null, false, PageRequest.of(0, 20))
                .getContent().getFirst().unreadCount());
        verify(reads, never()).findBySupportRequestIdAndUserId(1L, 2L);
    }

    @Test
    void invalidStatusIsRejected() {
        assertThrows(BadRequestException.class,
                () -> service.inbox(2L, "RECEPTIONIST", "invalid", false, PageRequest.of(0, 20)));
        verifyNoInteractions(tickets);
    }
}
