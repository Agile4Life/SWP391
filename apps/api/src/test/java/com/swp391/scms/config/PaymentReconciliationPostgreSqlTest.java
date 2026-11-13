package com.swp391.scms.config;

import com.swp391.scms.finance.entity.VnpayIpnEvent;
import com.swp391.scms.finance.service.PaymentReconciliationService;
import com.swp391.scms.finance.service.VnpayIpnEventRecorder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

import static com.swp391.scms.config.SupabaseTestDatabase.credential;
import static org.assertj.core.api.Assertions.assertThat;

/** Runs the reconciliation JPQL on real PostgreSQL in a disposable schema created by Hibernate. */
@SpringBootTest
@ActiveProfiles("supabase")
@EnabledIfEnvironmentVariable(named = "SCMS_POSTGRES_TEST_URL", matches = "jdbc:postgresql:.+")
class PaymentReconciliationPostgreSqlTest {
    static final String SCHEMA = "recon_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired JdbcTemplate jdbc;
    @Autowired PaymentReconciliationService service;
    @Autowired VnpayIpnEventRecorder recorder;
    /** Catalog data is not needed here; its seeder is kept out so this test depends only on payment tables. */
    @org.springframework.boot.test.mock.mockito.MockBean com.swp391.scms.facilities.CatalogSeeder catalogSeeder;

    @DynamicPropertySource static void database(DynamicPropertyRegistry p) throws Exception {
        try (var c = SupabaseTestDatabase.connect(); var s = c.createStatement()) { s.execute("create schema \"" + SCHEMA + "\""); }
        p.add("spring.datasource.url", () -> credential("SCMS_POSTGRES_TEST_URL"));
        p.add("spring.datasource.username", () -> credential("SCMS_POSTGRES_TEST_USERNAME"));
        p.add("spring.datasource.password", () -> credential("SCMS_POSTGRES_TEST_PASSWORD"));
        p.add("spring.datasource.hikari.schema", () -> SCHEMA);
        p.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        p.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        p.add("app.jwt.secret", () -> "reconciliation-integration-test-key-at-least-32-bytes");
        p.add("app.bootstrap.manager.email", () -> "");
        p.add("app.bootstrap.manager.password", () -> "");
        p.add("app.supabase.chat-jwt-secret", () -> "");
    }

    @AfterAll static void cleanup() throws Exception {
        assertThat(SCHEMA).matches("recon_test_[a-f0-9]{32}");
        try (var c = SupabaseTestDatabase.connect(); var s = c.createStatement()) { s.execute("drop schema if exists \"" + SCHEMA + "\" cascade"); }
    }

    @Test void queriesRunAndDetectEveryCase() {
        LocalDateTime now = LocalDateTime.now(ZONE);
        long user = jdbc.queryForObject("insert into users(role_id,full_name,email,username,password_hash,status,created_at,updated_at) "
                + "select id,'Recon fixture',?,?,'unused','active',now(),now() from roles where code = 'MEMBER' returning id", Long.class,
                UUID.randomUUID() + "@example.invalid", UUID.randomUUID().toString());
        jdbc.update("insert into members(user_id,membership_code,join_date,fitness_level) values (?,?,current_date,'beginner')",
                user, "RC" + user);
        long paid = payment(user, "success", now);
        long unpaid = payment(user, "pending", now);
        long orphan = payment(user, "success", now); // online, paid, no attempt and no wallet debit
        attempt("RECONSTALE1", paid, "failed", now.minusHours(2), now.minusHours(2).plusMinutes(15));
        attempt("RECONOK1", paid, "success", now.minusHours(1), now.minusMinutes(45));
        attempt("RECONBAD1", unpaid, "success", now.minusMinutes(30), now.minusMinutes(15));
        attempt("RECONHANG1", unpaid, "pending", now.minusHours(3), now.minusHours(3).plusMinutes(15));
        long walletId = jdbc.queryForObject("insert into wallets(user_id,balance,updated_at) values (?,150000,now()) returning id", Long.class, user);
        jdbc.update("insert into wallet_transactions(wallet_id,type,amount,balance_after,reference_type,reference_id,created_at) "
                + "values (?,'REFUND_CREDIT',150000,150000,'VNPAY_LATE_REFUND','RECONSTALE1:LATE_REFUND',now())", walletId);
        recorder.record(VnpayIpnEvent.SOURCE_IPN, Map.of("vnp_TxnRef", "RECONOK1", "vnp_ResponseCode", "00",
                "vnp_Amount", "15000000", "vnp_SecureHash", "secret"), "00");
        recorder.record(VnpayIpnEvent.SOURCE_RETURN, Map.of("vnp_TxnRef", "RECONOK1"), "99");

        var summary = service.summary(null, null);
        assertThat(summary.staleAttempts()).isEqualTo(1);
        assertThat(summary.lateRefundCount()).isEqualTo(1);
        assertThat(summary.lateRefundAmount()).isEqualByComparingTo("150000");
        assertThat(summary.ipnRetryable()).isEqualTo(1);
        assertThat(summary.multiAttemptPayments()).isEqualTo(2);
        assertThat(summary.anomalies().successAttemptUnpaid()).isEqualTo(1);
        assertThat(summary.anomalies().walletPaymentWithoutSource()).isEqualTo(1);
        assertThat(orphan).isPositive();

        assertThat(service.attempts(null, true, null, null, null, 0, 20).getContent())
                .extracting(r -> r.reference()).containsExactly("RECONHANG1");
        var search = service.attempts(null, null, "example.invalid", null, null, 0, 20);
        assertThat(search.getTotalElements()).isEqualTo(4);
        assertThat(search.getContent().getFirst().member().fullName()).isEqualTo("Recon fixture");
        assertThat(search.getContent().getFirst().attemptCount()).isEqualTo(2);

        var refunds = service.lateRefunds(null, null, 0, 20).getContent();
        assertThat(refunds).hasSize(1);
        assertThat(refunds.getFirst().paymentId()).isEqualTo(paid);

        assertThat(service.ipnEvents("99", "RETURN", "RECONOK1", null, null, 0, 20).getTotalElements()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from vnpay_ipn_events", Long.class)).isEqualTo(2);

        var timeline = service.timeline(paid);
        assertThat(timeline.attempts()).hasSize(2);
        assertThat(timeline.callbacks()).hasSize(2);
        assertThat(timeline.walletTransactions()).hasSize(1);
        assertThat(service.summary(LocalDate.now(ZONE).minusDays(91), LocalDate.now(ZONE)).staleAttempts()).isEqualTo(1);
    }

    private long payment(long user, String status, LocalDateTime now) {
        return jdbc.queryForObject("insert into payments(member_id,amount,method,status,paid_at,created_at) "
                + "values (?,150000,'online_wallet',?,?,?) returning id", Long.class,
                user, status, "success".equals(status) ? now : null, now.minusHours(4));
    }

    private void attempt(String ref, long payment, String status, LocalDateTime created, LocalDateTime expires) {
        jdbc.update("insert into vnpay_transactions(reference,payment_id,amount,created_at,expires_at,ip_address,status) "
                + "values (?,?,150000,?,?,'127.0.0.1',?)", ref, payment, created, expires, status);
    }
}
