package com.swp391.scms.config.trigger;

import com.swp391.scms.audit.AuditLog;
import jakarta.persistence.Table;
import java.sql.Connection;
import java.sql.SQLException;
import org.hibernate.annotations.Check;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Nâng cấp ràng buộc CHECK của bảng audit_logs một cách an toàn và chạy lại được nhiều lần, vì Hibernate không
 * tự cập nhật CHECK đã có. Mục đích: cho phép ghi audit với entity_type = 'coach_bookings' (điểm danh PT 1:1).
 *
 * Migration CHECK tường minh và idempotent; Hibernate schema update không đối soát các CHECK hiện có.
 */
final class AuditEntityTypeSchemaUpgrade {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(AuditEntityTypeSchemaUpgrade.class);
    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private AuditEntityTypeSchemaUpgrade() { }

    /**
     * Nếu CHECK hiện tại chưa cho phép 'coach_bookings' thì khóa bảng, đọc lại CHECK và thay bằng CHECK mới =
     * (điều kiện cũ) OR entity_type = 'coach_bookings'. Giữ nguyên toàn bộ điều kiện cũ để không làm hỏng dữ
     * liệu audit cũ. Mọi thứ chạy trong một transaction, lỗi thì rollback.
     */
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
            // Kiểm tra nhẹ trước, không khóa: sau lần nâng cấp đầu, mọi lần khởi động dừng ở đây.
            String current = predicate(connection, schema, table.name(), mapping.name());
            if (current == null || permits(connection, current)) return null;
            // Tự mở transaction nếu kết nối đang ở chế độ autocommit, để bước khóa bảng và thay CHECK là một khối.
            boolean ownTransaction = connection.getAutoCommit();
            if (ownTransaction) connection.setAutoCommit(false);
            try {
                String qualified = quoted(schema) + "." + quoted(table.name());
                // Tuần tự hóa việc kiểm tra/thay thế và giới hạn thời gian chờ; không commit khoảng thời gian
                // nào thiếu CHECK.
                try (var statement = connection.createStatement()) {
                    statement.execute("set local lock_timeout = '10s'");
                    statement.execute("lock table " + qualified + " in access exclusive mode");
                }
                String predicate = predicate(connection, schema, table.name(), mapping.name());
                if (predicate != null && !permits(connection, predicate)) {
                    // Giữ nguyên toàn bộ vị từ cũ, gồm các loại legacy hợp lệ không còn trong Entity hiện nay.
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

    /**
     * Chạy thử điều kiện CHECK với giá trị 'coach_bookings' để biết ràng buộc hiện tại đã cho phép giá trị này
     * chưa.
     */
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

    /**
     * Đọc biểu thức của ràng buộc CHECK trên cột entity_type từ catalog của PostgreSQL; trả null nếu bảng không
     * có ràng buộc này (khi đó mọi loại entity đều đã được phép).
     *
     * Vị từ CHECK của loại entity, hoặc null khi bảng không có (khi đó mọi loại đã được cho phép).
     */
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

    /** Đặt tên trong dấu ngoặc kép an toàn cho SQL. */
    private static String quoted(String name) { return "\"" + name.replace("\"", "\"\"") + "\""; }
}
