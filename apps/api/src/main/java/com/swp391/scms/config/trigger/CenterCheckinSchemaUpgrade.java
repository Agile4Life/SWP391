package com.swp391.scms.config.trigger;

import com.swp391.scms.attendance.entity.CenterCheckin;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.sql.DatabaseMetaData;
import java.sql.Types;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Sửa ràng buộc NOT NULL cũ của cột member trong bảng check-in (Hibernate 6 không tự bỏ NOT NULL khi Entity đổi
 * thành cho phép null).
 *
 * Repairs legacy PostgreSQL nullability that Hibernate 6's table migrator does not apply.
 */
final class CenterCheckinSchemaUpgrade {

    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private CenterCheckinSchemaUpgrade() { }

    /**
     * Nếu Entity CenterCheckin cho phép member rỗng mà cột trong database vẫn NOT NULL thì chạy "ALTER COLUMN
     * ... DROP NOT NULL". Chỉ thay đổi khi đúng tên schema/bảng/cột và kiểu BIGINT, để không sửa nhầm.
     */
    static void relaxMemberNullability(JdbcTemplate jdbc) {
        Table table = CenterCheckin.class.getAnnotation(Table.class);
        JoinColumn member;
        boolean optional;
        try {
            var field = CenterCheckin.class.getDeclaredField("member");
            member = field.getAnnotation(JoinColumn.class);
            optional = field.getAnnotation(ManyToOne.class).optional();
        } catch (NoSuchFieldException e) {
            throw new IllegalStateException("Cannot inspect check-in member mapping", e);
        }
        // The entity remains authoritative if its mapping changes again.
        if (!member.nullable() || !optional) {
            return;
        }
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            String schema = table.schema().isBlank() ? connection.getSchema() : table.schema();
            if (schema == null || schema.isBlank()) {
                throw new IllegalStateException("Cannot resolve schema for check-in nullability upgrade");
            }
            DatabaseMetaData metadata = connection.getMetaData();
            try (var columns = metadata.getColumns(connection.getCatalog(), schema, table.name(), member.name())) {
                while (columns.next()) {
                    // JDBC metadata arguments are patterns: match exact names before changing anything.
                    if (!schema.equals(columns.getString("TABLE_SCHEM"))
                            || !table.name().equals(columns.getString("TABLE_NAME"))
                            || !member.name().equals(columns.getString("COLUMN_NAME"))
                            || columns.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls) {
                        continue;
                    }
                    if (columns.getInt("DATA_TYPE") != Types.BIGINT) {
                        throw new IllegalStateException("Unexpected check-in member column type; nullability upgrade refused");
                    }
                    String qualifiedTable = quoted(schema) + "." + quoted(table.name());
                    try (var statement = connection.createStatement()) {
                        statement.execute("alter table " + qualifiedTable + " alter column "
                                + quoted(member.name()) + " drop not null");
                    }
                }
            }
            return null;
        });
    }

    /** Đặt tên trong dấu ngoặc kép an toàn cho SQL. */
    private static String quoted(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
