package com.swp391.scms.config;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Table;
import jakarta.persistence.JoinTable;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.SmartLifecycle;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Bật Row Level Security (RLS) cho mọi bảng của ứng dụng khi chạy trên Supabase (trong pha SmartLifecycle
 * ngay sau cài trigger và trước khi web server mở cổng), để Supabase Data API (REST công khai) không
 * đọc/ghi được dữ liệu; chỉ backend (đã kiểm tra JWT riêng) truy cập database.
 *
 * Supabase Data API không được lộ các bảng do backend bảo vệ bằng JWT quản lý.
 */
@Component
@Profile("supabase")
public class PostgreSqlDataSecurityInitializer implements SmartLifecycle {
    private final EntityManagerFactory entityManagerFactory;
    private final JdbcTemplate jdbc;
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** Nhận EntityManagerFactory để liệt kê các bảng do Entity định nghĩa và JdbcTemplate để chạy SQL. */
    public PostgreSqlDataSecurityInitializer(EntityManagerFactory entityManagerFactory, JdbcTemplate jdbc) {
        this.entityManagerFactory = entityManagerFactory;
        this.jdbc = jdbc;
    }

    /** Bật RLS sau DatabaseTriggerInitializer và trước khi Tomcat mở cổng HTTP. */
    @Override
    public void start() {
        if (running.compareAndSet(false, true)) {
            try {
                enableRowLevelSecurity();
            } catch (RuntimeException ex) {
                running.set(false);
                throw ex;
            }
        }
    }

    @Override
    public void stop() {
        running.set(false);
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public int getPhase() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    /**
     * Gom tên mọi bảng (bảng của Entity, bảng nối @JoinTable, bảng @CollectionTable), kiểm tra tài khoản
     * database có quyền sở hữu hoặc bỏ qua RLS trên tất cả các bảng, rồi mới bật RLS cho từng bảng. Kiểm tra
     * trước để không bật RLS dở dang làm chính backend mất quyền truy cập.
     */
    public void run(ApplicationArguments args) {
        enableRowLevelSecurity();
    }

    private void enableRowLevelSecurity() {
        String currentSchema = jdbc.queryForObject("select current_schema()", String.class);
        if (currentSchema == null || currentSchema.isBlank()) {
            throw new IllegalStateException("Cannot determine application database schema");
        }
        var tables = new TreeSet<Target>(Comparator.comparing(Target::schema).thenComparing(Target::name));
        // Bước 1: gom danh sách bảng từ metamodel của Hibernate.
        for (var entity : entityManagerFactory.getMetamodel().getEntities()) {
            Class<?> type = entity.getJavaType();
            Table table = type.getAnnotation(Table.class);
            if (table != null && !table.name().isBlank()) {
                tables.add(new Target(table.schema().isBlank() ? currentSchema : table.schema(), table.name()));
            }
            // Các bảng nối (role_permissions) cũng thuộc schema ứng dụng.
            for (var field : type.getDeclaredFields()) {
                JoinTable join = field.getAnnotation(JoinTable.class);
                if (join != null && !join.name().isBlank()) {
                    tables.add(new Target(join.schema().isBlank() ? currentSchema : join.schema(), join.name()));
                }
                CollectionTable collection = field.getAnnotation(CollectionTable.class);
                if (collection != null && !collection.name().isBlank()) {
                    tables.add(new Target(collection.schema().isBlank() ? currentSchema : collection.schema(), collection.name()));
                }
            }
        }

        // Kiểm tra mọi chủ sở hữu trước: JWT hiện tại của ta không phải JWT của Supabase Auth.
        for (Target table : tables) {
            Boolean accessible = jdbc.queryForObject("""
                    select exists (
                        select 1 from pg_class c
                        join pg_namespace n on n.oid = c.relnamespace
                        join pg_roles r on r.rolname = current_user
                        where n.nspname = ? and c.relname = ?
                          and (r.rolsuper or r.rolbypassrls or pg_has_role(c.relowner, 'USAGE'))
                    )
                    """, Boolean.class, table.schema(), table.name());
            if (!Boolean.TRUE.equals(accessible)) {
                throw new IllegalStateException("Supabase JDBC role must own application tables or bypass RLS");
            }
        }
        // Bước 3: mọi bảng đều hợp lệ thì mới bật RLS (lệnh này idempotent, chạy lại không sao).
        for (Target table : tables) {
            jdbc.execute("alter table " + quote(table.schema()) + "." + quote(table.name()) + " enable row level security");
        }
    }

    /**
     * Đặt tên schema/bảng trong dấu ngoặc kép và nhân đôi dấu ngoặc kép bên trong, tránh lỗi cú pháp và SQL
     * injection qua tên.
     */
    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    /** Cặp (schema, tên bảng) cần bật RLS. */
    private record Target(String schema, String name) {}
}
