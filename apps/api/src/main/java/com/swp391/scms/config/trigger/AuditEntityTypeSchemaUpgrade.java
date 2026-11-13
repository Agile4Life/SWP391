package com.swp391.scms.config.trigger;

import com.swp391.scms.audit.AuditLog;
import jakarta.persistence.Table;
import java.sql.Connection;
import java.sql.SQLException;
import org.hibernate.annotations.Check;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/** Explicit, idempotent CHECK migration; Hibernate schema update does not reconcile existing CHECKs. */
final class AuditEntityTypeSchemaUpgrade {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(AuditEntityTypeSchemaUpgrade.class);
    private AuditEntityTypeSchemaUpgrade() { }

    static void allowCoachBookings(JdbcTemplate jdbc) {
        Table table = AuditLog.class.getAnnotation(Table.class);
        Check mapping = AuditLog.class.getAnnotation(Check.class);
        if (!mapping.constraints().contains("'coach_bookings'")) {
            throw new IllegalStateException("Audit entity mapping must permit coach_bookings before migration");
        }
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            String schema = table.schema().isBlank() ? connection.getSchema() : table.schema();
            if (schema == null || schema.isBlank()) throw new IllegalStateException("Cannot resolve audit migration schema");
            boolean exists = false;
            try (var tables = connection.getMetaData().getTables(connection.getCatalog(), schema, table.name(), new String[]{"TABLE"})) {
                while (tables.next()) {
                    if (schema.equals(tables.getString("TABLE_SCHEM")) && table.name().equals(tables.getString("TABLE_NAME"))) exists = true;
                }
            }
            if (!exists) return null;
            // Cheap check first, without a lock: after the first upgrade every startup stops here.
            String current = predicate(connection, schema, table.name(), mapping.name());
            if (current == null || permits(connection, current)) return null;
            boolean ownTransaction = connection.getAutoCommit();
            if (ownTransaction) connection.setAutoCommit(false);
            try {
                String qualified = quoted(schema) + "." + quoted(table.name());
                // Serialize inspection/replacement and bound the wait; no interval without the CHECK is committed.
                try (var statement = connection.createStatement()) {
                    statement.execute("set local lock_timeout = '10s'");
                    statement.execute("lock table " + qualified + " in access exclusive mode");
                }
                String predicate = predicate(connection, schema, table.name(), mapping.name());
                if (predicate != null && !permits(connection, predicate)) {
                    // Retain the entire old predicate, including valid legacy types absent from today's Entity.
                    try (var statement = connection.createStatement()) {
                        statement.execute("alter table " + qualified + " drop constraint " + quoted(mapping.name())
                                + ", add constraint " + quoted(mapping.name()) + " check ((" + predicate
                                + ") OR entity_type = 'coach_bookings')");
                    }
                    LOG.info("Audit entity-type CHECK now permits coach_bookings.");
                }
                if (ownTransaction) connection.commit();
            } catch (SQLException | RuntimeException failure) {
                if (ownTransaction) {
                    try { connection.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
                }
                throw failure;
            } finally {
                if (ownTransaction) connection.setAutoCommit(true);
            }
            return null;
        });
    }

    private static boolean permits(Connection connection, String predicate) throws SQLException {
        try (var statement = connection.prepareStatement("select coalesce((" + predicate
                + "), false) from (select cast(? as varchar) as entity_type) as candidate")) {
            statement.setString(1, "coach_bookings");
            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Cannot evaluate audit CHECK");
                return result.getBoolean(1);
            }
        }
    }

    /** The entity-type CHECK predicate, or null when the table has none (then every type is already allowed). */
    private static String predicate(Connection connection, String schema, String table, String name) throws SQLException {
        try (var statement = connection.prepareStatement("""
                select pg_get_expr(c.conbin, c.conrelid)
                from pg_constraint c join pg_class t on t.oid=c.conrelid
                join pg_namespace n on n.oid=t.relnamespace
                join pg_attribute a on a.attrelid=t.oid and a.attname='entity_type'
                where n.nspname=? and t.relname=? and c.conname=? and c.contype='c'
                  and c.conkey = array[a.attnum]::smallint[]
                """)) {
            statement.setString(1, schema); statement.setString(2, table); statement.setString(3, name);
            try (var result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : null;
            }
        }
    }

    private static String quoted(String name) { return "\"" + name.replace("\"", "\"\"") + "\""; }
}
