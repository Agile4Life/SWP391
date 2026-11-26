package com.swp391.scms.config;

import com.swp391.scms.support.SupportInboxService;
import com.swp391.scms.support.SupportRequestService;
import com.swp391.scms.support.dto.CreateSupportMessageDto;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.UUID;

import static com.swp391.scms.config.SupabaseTestDatabase.credential;
import static org.assertj.core.api.Assertions.assertThat;

/** Chỉ chạy khi có DB test riêng; Hibernate tạo bảng trong schema ngẫu nhiên, không dùng public. */
@SpringBootTest
@ActiveProfiles("supabase")
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class SupportInboxPostgreSqlTest {
    static final String SCHEMA = "support_inbox_test_" + UUID.randomUUID().toString().replace("-", "");
    @Autowired JdbcTemplate jdbc;
    @Autowired SupportRequestService support;
    @Autowired SupportInboxService inbox;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) throws Exception {
        try (var connection = SupabaseTestDatabase.connect(); var statement = connection.createStatement()) {
            statement.execute("create schema \"" + SCHEMA + "\"");
        }
        properties.add("spring.datasource.url", () -> credential("SCMS_POSTGRES_TEST_URL"));
        properties.add("spring.datasource.username", () -> credential("SCMS_POSTGRES_TEST_USERNAME"));
        properties.add("spring.datasource.password", () -> credential("SCMS_POSTGRES_TEST_PASSWORD"));
        properties.add("spring.datasource.hikari.schema", () -> SCHEMA);
        properties.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        properties.add("app.jwt.secret", () -> "support-inbox-integration-private-key-at-least-32-bytes");
        properties.add("app.bootstrap.manager.email", () -> "");
        properties.add("app.bootstrap.manager.password", () -> "");
        properties.add("app.supabase.chat-jwt-secret", () -> "");
    }

    @AfterAll
    static void cleanup() throws Exception {
        assertThat(SCHEMA).matches("support_inbox_test_[a-f0-9]{32}");
        try (var connection = SupabaseTestDatabase.connect(); var statement = connection.createStatement()) {
            statement.execute("drop schema if exists \"" + SCHEMA + "\" cascade");
        }
    }

    @Test
    void readCursorsPersistPerUserAndFiltersAndActivityOrderPrecedePagination() {
        long member = user("MEMBER"), first = user("RECEPTIONIST"), second = user("RECEPTIONIST");
        jdbc.update("insert into members(user_id,membership_code,join_date,fitness_level) values (?,?,current_date,'beginner')",
                member, "SUP-" + member);
        long oldTicket = ticket(member, "Older ticket");
        long newTicket = ticket(member, "Newer ticket");
        long readTicket = ticket(member, "Already read");
        long closedTicket = ticket(member, "Closed unread ticket");
        jdbc.update("update support_requests set created_at = timestamp '2026-01-01 00:00:00' where id = ?", oldTicket);
        jdbc.update("update support_requests set created_at = timestamp '2026-02-01 00:00:00' where id = ?", newTicket);
        jdbc.update("update support_requests set status = 'in_progress' where id in (?, ?)", newTicket, readTicket);
        jdbc.update("update support_requests set status = 'closed' where id = ?", closedTicket);

        assertThat(row(first, oldTicket).unreadCount()).isEqualTo(1);
        long incoming = support.sendMessage(oldTicket, member, "MEMBER", new CreateSupportMessageDto("Member question")).id();
        assertThat(row(first, oldTicket).unreadCount()).isEqualTo(2);
        assertThat(inbox.markRead(oldTicket, first, "RECEPTIONIST", 0L).unreadCount()).isEqualTo(1);
        assertThat(inbox.markRead(oldTicket, first, "RECEPTIONIST", incoming).unreadCount()).isZero();
        assertThat(jdbc.queryForObject("select status from support_requests where id = ?", String.class, oldTicket))
                .isEqualTo("open");
        support.sendMessage(oldTicket, first, "RECEPTIONIST", new CreateSupportMessageDto("Staff reply"));
        assertThat(row(first, oldTicket).unreadCount()).isZero();
        assertThat(row(second, oldTicket).unreadCount()).isEqualTo(2);

        long later = support.sendMessage(oldTicket, member, "MEMBER", new CreateSupportMessageDto("New incoming question")).id();
        jdbc.update("update support_request_messages set created_at = timestamp '2026-03-01 00:00:00' where support_request_id = ?", oldTicket);
        assertThat(inbox.markRead(oldTicket, first, "RECEPTIONIST", incoming).unreadCount()).isEqualTo(1);
        assertThat(row(second, oldTicket).unreadCount()).isEqualTo(3);
        assertThat(jdbc.queryForObject("select last_message_id from support_request_reads where support_request_id = ? and user_id = ?",
                Long.class, oldTicket, first)).isEqualTo(incoming);
        inbox.markRead(readTicket, first, "RECEPTIONIST", 0L);

        var page = inbox.inbox(first, "RECEPTIONIST", "in_progress", true, PageRequest.of(0, 1));
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(SupportRequestDto::id).containsExactly(oldTicket);
        assertThat(page.getContent().getFirst().lastMessage()).isEqualTo("New incoming question");
        assertThat(inbox.inbox(first, "RECEPTIONIST", "in_progress", true, PageRequest.of(1, 1)).getContent())
                .extracting(SupportRequestDto::id).containsExactly(newTicket);
        assertThat(inbox.markRead(oldTicket, first, "RECEPTIONIST", later).unreadCount()).isZero();
        assertThat(jdbc.queryForObject("select status from support_requests where id = ?", String.class, oldTicket))
                .isEqualTo("in_progress");
    }

    private SupportRequestDto row(long receptionist, long ticketId) {
        return inbox.inbox(receptionist, "RECEPTIONIST", null, false, PageRequest.of(0, 100)).stream()
                .filter(ticket -> ticket.id() == ticketId).findFirst().orElseThrow();
    }

    private long ticket(long member, String subject) {
        return support.createRequest(member, new CreateSupportRequestDto(subject, "Initial member description")).id();
    }

    private long user(String role) {
        return jdbc.queryForObject("insert into users(role_id,full_name,email,username,password_hash,status,created_at,updated_at) "
                        + "select id,'Support inbox fixture',?,?,'unused','active',now(),now() from roles where code = ? returning id",
                Long.class, UUID.randomUUID() + "@example.invalid", UUID.randomUUID().toString(), role);
    }
}
