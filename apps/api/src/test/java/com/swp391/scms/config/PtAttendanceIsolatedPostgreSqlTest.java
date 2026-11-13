package com.swp391.scms.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.audit.*;
import com.swp391.scms.coaching.CoachBookingController;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.config.trigger.PostgreSqlTriggerProvider;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManagerFactory;
import java.sql.DriverManager;
import java.time.*;
import java.util.*;
import org.hibernate.annotations.Check;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Opt-in, real PostgreSQL. Never reads environment credentials or starts the application. */
@EnabledIfSystemProperty(named = "scms.pt.isolated.port", matches = "[0-9]{1,5}")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PtAttendanceIsolatedPostgreSqlTest {
    private final String schema = "pt_attendance_" + UUID.randomUUID().toString().replace("-", "");
    private StandardServiceRegistry registry;
    private EntityManagerFactory factory;
    private JdbcTemplate jdbc;
    private DriverManagerDataSource source;
    private CoachBookingService service;
    private AuthenticatedPrincipal receptionist;
    private long memberId, coachId, bookingId;
    private MockMvc mvc;

    @BeforeAll void createIsolatedSchemaFromEntities() throws Exception {
        int port = Integer.parseInt(System.getProperty("scms.pt.isolated.port"));
        assertTrue(port > 0 && port <= 65535);
        String url = "jdbc:postgresql://127.0.0.1:" + port + "/postgres?sslmode=disable";
        try (var connection = DriverManager.getConnection(url, "pt_test", ""); var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("select current_setting('cluster_name'), host(inet_server_addr())")) {
                assertTrue(result.next());
                assertEquals("scms_pt_isolated", result.getString(1), "Refuse writes to an unlabelled/shared cluster");
                assertEquals("127.0.0.1", result.getString(2));
            }
            statement.execute("create schema \"" + schema + "\"");
        }
        source = new DriverManagerDataSource(url + "&currentSchema=" + schema, "pt_test", "");
        jdbc = new JdbcTemplate(source);
        registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.connection.datasource", source)
                .applySetting("hibernate.default_schema", schema)
                .applySetting("hibernate.hbm2ddl.auto", "create") // Bootstrap only. Migration never calls update.
                .applySetting("hibernate.hbm2ddl.halt_on_error", true).build();
        var mappings = new MetadataSources(registry);
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (var entity : scanner.findCandidateComponents("com.swp391.scms")) {
            mappings.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
        }
        factory = mappings.buildMetadata().buildSessionFactory();
        var em = SharedEntityManagerCreator.createSharedEntityManager(factory);
        var repositories = new JpaRepositoryFactory(em);
        var bookings = repositories.getRepository(CoachBookingRepository.class);
        var audit = repositories.getRepository(AuditLogRepository.class);
        var manager = new JpaTransactionManager(factory);
        manager.setDataSource(source);
        manager.afterPropertiesSet();
        var target = new CoachBookingService(bookings, null, null, null, null, null, null,
                Clock.system(com.swp391.scms.common.CenterTime.ZONE), null);
        var proxy = new AspectJProxyFactory(target);
        proxy.addAspect(new AuditAspect(audit, new ObjectMapper().findAndRegisterModules(), em));
        proxy.addAdvice(0, new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        service = proxy.getProxy();
        mvc = MockMvcBuilders.standaloneSetup(new CoachBookingController(service, null))
                .setCustomArgumentResolvers(new org.springframework.web.method.support.HandlerMethodArgumentResolver() {
                    public boolean supportsParameter(org.springframework.core.MethodParameter p) { return p.getParameterType() == AuthenticatedPrincipal.class; }
                    public Object resolveArgument(org.springframework.core.MethodParameter p,
                            org.springframework.web.method.support.ModelAndViewContainer c,
                            org.springframework.web.context.request.NativeWebRequest r,
                            org.springframework.web.bind.support.WebDataBinderFactory b) { return receptionist; }
                }).setControllerAdvice(new GlobalExceptionHandler()).build();
        memberId = user("MEMBER"); coachId = user("COACH");
        receptionist = new AuthenticatedPrincipal(user("RECEPTIONIST"), "isolated-desk", "RECEPTIONIST");
        jdbc.update("insert into members(user_id,membership_code,join_date,fitness_level) values (?, 'PT-TEST', current_date, 'beginner')", memberId);
        jdbc.update("insert into coaches(user_id,employment_status) values (?, 'active')", coachId);
        jdbc.update("insert into membership_packages(name,price,duration_days,status,tier,created_at,updated_at) values ('PT test',100,90,'active','GOLD',now(),now())");
    }

    private long user(String role) {
        long roleId = jdbc.queryForObject("insert into roles(code,name,created_at) values (?,?,now()) returning id", Long.class, role, role);
        return jdbc.queryForObject("insert into users(role_id,full_name,email,password_hash,status,created_at,updated_at) values (?,?,?,'unused','active',now(),now()) returning id",
                Long.class, roleId, role, role.toLowerCase() + "@pt.example.invalid");
    }

    @BeforeEach void legacyFixture() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(receptionist, null));
        jdbc.update("delete from audit_logs");
        jdbc.update("delete from coach_bookings");
        jdbc.update("delete from membership_subscriptions");
        String legacy = AuditLog.class.getAnnotation(Check.class).constraints().replace(",'coach_bookings'", "");
        jdbc.execute("alter table audit_logs drop constraint ck_audit_entity_type, add constraint ck_audit_entity_type check ((" + legacy + ") OR entity_type = 'legacy_external')");
        jdbc.update("insert into audit_logs(action,entity_type,entity_id,old_value,new_value,created_at) values ('HISTORY','legacy_external',99,'{\"before\":1}','{\"after\":2}',now())");
        jdbc.update("insert into membership_subscriptions(member_id,package_id,start_date,end_date,status,created_at,updated_at) values (?,(select id from membership_packages limit 1),current_date-30,current_date+30,'active',now(),now())", memberId);
        bookingId = jdbc.queryForObject("insert into coach_bookings(member_id,coach_id,booking_date,start_time,end_time,hourly_rate,payment_method,payment_status,status,created_at,attended_at,attendance_locked) values (?,?,current_date-1,'09:00','10:00',100,'package_quota','used_quota','confirmed',now(),now()-interval '1 day',false) returning id", Long.class, memberId, coachId);
    }

    @AfterEach void clearActor() { SecurityContextHolder.clearContext(); }
    @AfterAll void closeIsolatedSchema() {
        if (factory != null) factory.close();
        if (registry != null) StandardServiceRegistryBuilder.destroy(registry);
        if (jdbc != null) {
            assertTrue(schema.matches("pt_attendance_[a-f0-9]{32}"));
            jdbc.execute("drop schema \"" + schema + "\" cascade");
        }
    }

    private List<String> history() {
        return jdbc.queryForList("select row_to_json(a)::text from audit_logs a where action='HISTORY' order by id", String.class);
    }
    private Map<String, Object> booking() {
        return jdbc.queryForMap("select attended_at, attendance_locked, status from coach_bookings where id=?", bookingId);
    }
    private void migrate() { new PostgreSqlTriggerProvider(true).applyTriggers(jdbc); }

    @Test void ordinaryStartupDoesNotMigrateTheAuditCheck() {
        var oldHistory = history();
        String definition = jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", String.class);
        new PostgreSqlTriggerProvider().applyTriggers(jdbc);
        assertEquals(definition, jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", String.class));
        assertEquals(oldHistory, history());
        var rejected = assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("insert into audit_logs(action,entity_type,created_at) values ('DEFAULT-OFF','coach_bookings',now())"));
        assertEquals("23514", assertInstanceOf(java.sql.SQLException.class, rejected.getMostSpecificCause()).getSQLState());
    }

    @Test void legacyConstraintReallyReturns500AndRollsBackThenMigrationCommitsUnmark() throws Exception {
        var before = booking(); var oldHistory = history();
        var rejected = assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("insert into audit_logs(action,entity_type,created_at) values ('REPRO','coach_bookings',now())"));
        assertEquals("23514", assertInstanceOf(java.sql.SQLException.class, rejected.getMostSpecificCause()).getSQLState());
        mvc.perform(post("/api/v1/coach-bookings/" + bookingId + "/unmark-attended"))
                .andExpect(status().isInternalServerError());
        assertEquals(before, booking());
        assertEquals(oldHistory, history());
        migrate();
        mvc.perform(post("/api/v1/coach-bookings/" + bookingId + "/unmark-attended"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.attendanceLocked").value(true));
        assertNull(booking().get("attended_at"));
        assertEquals(true, booking().get("attendance_locked"));
        assertEquals("confirmed", booking().get("status"));
        assertEquals(oldHistory, history());
        assertEquals(1, jdbc.queryForObject("select count(*) from audit_logs where entity_type='coach_bookings' and action='PT_ATTENDANCE_UNMARK' and entity_id=? and user_id=?", Integer.class, bookingId, receptionist.id()));
        assertNull(service.getAttendance(receptionist, null, null, "MISSED").getFirst().attendedAt());
        assertTrue(service.getAttendance(receptionist, null, null, "ATTENDED").isEmpty());
    }

    @Test void migrationIsIdempotentPreservesAllHistoryAndSupportedTypes() {
        var oldHistory = history();
        migrate();
        long constraintId = jdbc.queryForObject("select oid from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", Long.class);
        migrate();
        assertEquals(constraintId, jdbc.queryForObject("select oid from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", Long.class));
        assertEquals(oldHistory, history());
        var types = new LinkedHashSet<String>();
        java.util.regex.Pattern.compile("'([^']+)'").matcher(AuditLog.class.getAnnotation(Check.class).constraints())
                .results().forEach(match -> types.add(match.group(1)));
        types.add("legacy_external");
        for (String type : types) {
            jdbc.update("insert into audit_logs(action,entity_type,created_at) values ('NEW',?,now())", type);
        }
        assertEquals(types.size() + 1, jdbc.queryForObject("select count(*) from audit_logs", Integer.class));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("insert into audit_logs(action,entity_type,created_at) values ('INVALID','not_supported',now())"));
    }

    @Test void receptionistCanMarkThenUnmarkWithOneAuditEntryPerRequestAndFreshReads() {
        migrate();
        jdbc.update("update coach_bookings set attended_at=null, attendance_locked=true where id=?", bookingId);
        var marked = service.markAttended(receptionist, bookingId);
        assertNotNull(marked.attendedAt()); assertFalse(marked.attendanceLocked());
        assertEquals("confirmed", marked.status());
        assertEquals(1, service.getAttendance(receptionist, null, null, "ATTENDED").size());
        var removed = service.unmarkAttended(receptionist, bookingId);
        assertNull(removed.attendedAt()); assertTrue(removed.attendanceLocked());
        assertEquals("confirmed", removed.status());
        assertEquals(2, jdbc.queryForObject("select count(*) from audit_logs where entity_type='coach_bookings'", Integer.class));
        assertEquals(1, service.getAttendance(receptionist, null, null, "MISSED").size());
        assertTrue(service.getAttendance(receptionist, null, null, "UPCOMING").isEmpty());
        assertNull(booking().get("attended_at"));
    }

    @Test void realAuditForeignKeyFailureStillRollsBackAfterMigration() throws Exception {
        migrate();
        var before = booking(); var oldHistory = history();
        var invalidActor = assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("insert into audit_logs(action,entity_type,user_id,created_at) values ('FK-REPRO','coach_bookings',999999999,now())"));
        assertEquals("23503", assertInstanceOf(java.sql.SQLException.class, invalidActor.getMostSpecificCause()).getSQLState());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(999999999L, "invalid-fixture-actor", "RECEPTIONIST"), null));
        mvc.perform(post("/api/v1/coach-bookings/" + bookingId + "/unmark-attended"))
                .andExpect(status().isInternalServerError());
        assertEquals(before, booking()); assertEquals(oldHistory, history());
        assertEquals(0, jdbc.queryForObject("select count(*) from audit_logs where entity_type='coach_bookings'", Integer.class));
    }

    @Test void failedConstraintValidationRollsBackTheMigrationAndPreservesHistory() {
        jdbc.execute("alter table audit_logs drop constraint ck_audit_entity_type");
        jdbc.update("insert into audit_logs(action,entity_type,created_at) values ('HISTORY','invalid_legacy_row',now())");
        jdbc.execute("alter table audit_logs add constraint ck_audit_entity_type check (entity_type in ('users','legacy_external')) not valid");
        var oldHistory = history();
        String oldDefinition = jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", String.class);
        assertThrows(org.springframework.dao.DataAccessException.class, this::migrate);
        assertEquals(oldHistory, history());
        assertEquals(oldDefinition, jdbc.queryForObject("select pg_get_constraintdef(oid) from pg_constraint where conrelid='audit_logs'::regclass and conname='ck_audit_entity_type'", String.class));
    }

    @Test void historicalConfirmedBookingStillChecksMembershipAndCompletedHistoryCanBeCorrected() {
        migrate();
        jdbc.update("update membership_subscriptions set status='expired', end_date=current_date-1");
        var before = booking();
        var guard = assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("update coach_bookings set attended_at=null, attendance_locked=true where id=?", bookingId));
        var sqlError = assertInstanceOf(java.sql.SQLException.class, guard.getMostSpecificCause());
        assertEquals("23514", sqlError.getSQLState());
        assertTrue(sqlError.getMessage().contains("trg_enrollments_check_membership"));
        assertThrows(RuntimeException.class, () -> service.unmarkAttended(receptionist, bookingId));
        assertEquals(before, booking());
        // Current guard explicitly excludes completed bookings; do not weaken confirmed-booking validation here.
        jdbc.update("update coach_bookings set status='completed' where id=?", bookingId);
        var removed = service.unmarkAttended(receptionist, bookingId);
        assertNull(removed.attendedAt()); assertEquals("completed", removed.status());
    }
}
