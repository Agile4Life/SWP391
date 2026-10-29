package com.swp391.scms.chat;

import com.swp391.scms.chat.dto.*;
import com.swp391.scms.chat.entity.*;
import com.swp391.scms.chat.repository.*;
import com.swp391.scms.chat.service.ChatService;
import com.swp391.scms.common.exception.*;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.PageImpl;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChatServiceTest {
    final ChatConversationRepository conversations = mock(ChatConversationRepository.class);
    final ChatMessageRepository messages = mock(ChatMessageRepository.class);
    final ChatContactRepository contacts = mock(ChatContactRepository.class);
    final ChatService service = new ChatService(conversations, messages, contacts);
    final AuthenticatedPrincipal member = new AuthenticatedPrincipal(10L, "member", "MEMBER");
    User memberUser, coach;
    ChatConversation conversation;

    @BeforeEach void setup() {
        memberUser = user(10L, "MEMBER"); coach = user(20L, "COACH");
        conversation = new ChatConversation(memberUser, coach, Instant.parse("2026-10-29T00:00:00Z"));
        conversation.setId(7L);
        when(contacts.findUser(10L)).thenReturn(Optional.of(memberUser));
        when(contacts.findUser(20L)).thenReturn(Optional.of(coach));
        when(contacts.lockUser(10L)).thenReturn(Optional.of(memberUser));
        when(conversations.findById(7L)).thenReturn(Optional.of(conversation));
        when(conversations.lockById(7L)).thenReturn(Optional.of(conversation));
        when(messages.save(any())).thenAnswer(inv -> { ChatMessage m = inv.getArgument(0); m.setId(100L); return m; });
    }

    static User user(long id, String code) {
        var role = new Role(); role.setCode(code);
        var u = new User(); u.setId(id); u.setFullName("User " + id); u.setRole(role); u.setStatus("active"); return u;
    }

    @Test void memberOpensOneConversationAndReusesIt() {
        when(conversations.findByMemberIdAndStaffId(10L, 20L)).thenReturn(Optional.of(conversation));
        assertThat(service.open(member, 20L).id()).isEqualTo(7L);
        verify(contacts).lockUser(10L);
        verify(conversations, never()).save(any());
    }

    @ParameterizedTest @ValueSource(strings = {"RECEPTIONIST", "COACH"})
    void memberCanStartWithEitherStaffRole(String role) {
        coach.setRole(user(20, role).getRole());
        when(conversations.save(any())).thenAnswer(inv -> { ChatConversation c = inv.getArgument(0); c.setId(8L); return c; });
        var result = service.open(member, 20L);
        assertThat(result.peer().id()).isEqualTo(20L);
        assertThat(result.peer().role()).isEqualTo(role);
    }

    @ParameterizedTest @ValueSource(strings = {"MEMBER", "CENTER_MANAGER", "GUEST"})
    void rejectsOtherContactRoles(String role) {
        coach.setRole(user(20, role).getRole());
        assertThatThrownBy(() -> service.open(member, 20L)).isInstanceOf(BadRequestException.class);
        verify(conversations, never()).save(any());
    }

    @Test void staffCannotOpenConversationsOrSearchMemberDirectory() {
        var principal = new AuthenticatedPrincipal(20L, "coach", "COACH");
        assertThatThrownBy(() -> service.open(principal, 10L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.contacts(principal, "", 0)).isInstanceOf(ForbiddenException.class);
    }

    @Test void rejectsSelfConversation() {
        assertThatThrownBy(() -> service.open(member, 10L)).isInstanceOf(BadRequestException.class);
    }

    @Test void rejectsInactiveOrDeletedContact() {
        coach.setStatus("locked");
        assertThatThrownBy(() -> service.open(member, 20L)).isInstanceOf(ResourceNotFoundException.class);
        coach.setStatus("active"); coach.setDeletedAt(java.time.LocalDateTime.now());
        assertThatThrownBy(() -> service.open(member, 20L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test void rejectsOutsiderEvenIfAnotherCoach() {
        when(contacts.findUser(30L)).thenReturn(Optional.of(user(30, "COACH")));
        var stranger = new AuthenticatedPrincipal(30L, "outsider", "COACH");
        assertThatThrownBy(() -> service.history(stranger, 7L, null, null)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.send(stranger, 7L, new SendChatMessage(UUID.randomUUID(), "Secret"))).isInstanceOf(ForbiddenException.class);
        verify(messages, never()).save(any());
    }

    @Test void managerHasNoChatAccess() {
        when(contacts.findUser(30L)).thenReturn(Optional.of(user(30, "CENTER_MANAGER")));
        var manager = new AuthenticatedPrincipal(30L, "manager", "CENTER_MANAGER");
        assertThatThrownBy(() -> service.list(manager, 0)).isInstanceOf(ForbiddenException.class);
    }

    @Test void deletedInactiveAndChangedRoleActorsAreRejected() {
        memberUser.setDeletedAt(java.time.LocalDateTime.now());
        assertThatThrownBy(() -> service.requireActor(member)).isInstanceOf(ForbiddenException.class);
        memberUser.setDeletedAt(null); memberUser.setStatus("locked");
        assertThatThrownBy(() -> service.requireActor(member)).isInstanceOf(ForbiddenException.class);
        memberUser.setStatus("active"); memberUser.setRole(user(10, "COACH").getRole());
        assertThatThrownBy(() -> service.requireActor(member)).isInstanceOf(ForbiddenException.class);
    }

    @Test void sendsTrimmedTextAndRetryReturnsOriginalWithoutUpdatingActivity() {
        UUID key = UUID.randomUUID();
        var result = service.send(member, 7L, new SendChatMessage(key, "  Hello\ncoach  "));
        assertThat(result.message()).isEqualTo("Hello\ncoach");
        assertThat(result.mine()).isTrue();
        assertThat(result.conversationId()).isEqualTo(7L);
        var original = new ChatMessage(conversation, memberUser, key, "Hello\ncoach", Instant.now()); original.setId(100L);
        when(messages.findByConversationIdAndSenderIdAndClientMessageId(7L, 10L, key)).thenReturn(Optional.of(original));
        assertThat(service.send(member, 7L, new SendChatMessage(key, "Hello\ncoach")).id()).isEqualTo(100L);
        verify(messages, times(1)).save(any());
    }

    @Test void uuidReuseWithDifferentTextConflicts() {
        UUID key = UUID.randomUUID();
        when(messages.findByConversationIdAndSenderIdAndClientMessageId(7L, 10L, key))
                .thenReturn(Optional.of(new ChatMessage(conversation, memberUser, key, "Original", Instant.now())));
        assertThatThrownBy(() -> service.send(member, 7L, new SendChatMessage(key, "Changed"))).isInstanceOf(ConflictException.class);
    }

    @Test void coachCanReplyButCannotSendToInactiveMember() {
        var actor = new AuthenticatedPrincipal(20L, "coach", "COACH");
        assertThat(service.send(actor, 7L, new SendChatMessage(UUID.randomUUID(), "Hi")).mine()).isTrue();
        memberUser.setStatus("inactive");
        assertThatThrownBy(() -> service.send(actor, 7L, new SendChatMessage(UUID.randomUUID(), "Hi again"))).isInstanceOf(ConflictException.class);
    }

    @Test void historyRemainsReadableWithUnavailablePeer() {
        coach.setDeletedAt(java.time.LocalDateTime.now());
        when(messages.older(eq(7L), isNull(), any())).thenReturn(List.of());
        assertThat(service.history(member, 7L, null, null).items()).isEmpty();
        when(conversations.forUser(eq(10L), any())).thenReturn(new PageImpl<>(List.of(conversation)));
        assertThat(service.list(member, 0).getContent().getFirst().peer().available()).isFalse();
        assertThatThrownBy(() -> service.send(member, 7L, new SendChatMessage(UUID.randomUUID(), "Hi"))).isInstanceOf(ConflictException.class);
    }

    @ParameterizedTest @ValueSource(strings = {"", "  \n  "})
    void rejectsBlankText(String text) {
        assertThatThrownBy(() -> service.send(member, 7L, new SendChatMessage(UUID.randomUUID(), text))).isInstanceOf(BadRequestException.class);
    }

    @Test void boundsInputAndCursors() {
        assertThatThrownBy(() -> service.send(member, 7L, new SendChatMessage(UUID.randomUUID(), "a".repeat(2001)))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.history(member, 7L, 5L, 6L)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.history(member, 7L, 0L, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(member, -1)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.contacts(member, "x".repeat(81), 0)).isInstanceOf(BadRequestException.class);
    }

    @Test void pagesOlderAndNewerWithoutDroppingThe51stMessage() {
        var descending = new ArrayList<ChatMessage>();
        for (long id = 60; id >= 10; id--) {
            var m = new ChatMessage(conversation, coach, UUID.randomUUID(), "Message " + id, Instant.now()); m.setId(id); descending.add(m);
        }
        when(messages.older(eq(7L), eq(61L), any())).thenReturn(descending);
        var older = service.history(member, 7L, 61L, null);
        assertThat(older.hasMore()).isTrue();
        assertThat(older.items()).hasSize(50);
        assertThat(older.items().getFirst().id()).isEqualTo(11L);
        assertThat(older.items().getLast().id()).isEqualTo(60L);
        Collections.reverse(descending);
        when(messages.newer(eq(7L), eq(9L), any())).thenReturn(descending);
        var newer = service.history(member, 7L, null, 9L);
        assertThat(newer.items().getFirst().id()).isEqualTo(10L);
        assertThat(newer.items().getLast().id()).isEqualTo(59L);
        assertThat(newer.items().getFirst().mine()).isFalse();
        assertThat(newer.hasMore()).isTrue();
    }
}
