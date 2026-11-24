package com.swp391.scms.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Bộ kiểm thử cho SupabaseTestDatabase (supabase test database).
 *
 * Dedicated Supabase test credentials; callers isolate changes in generated schemas.
 */
final class SupabaseTestDatabase {
    /** Constructor riêng tư: lớp tiện ích không cho khởi tạo. */
    private SupabaseTestDatabase() { }

    /** Hàm trợ giúp: đọc thông tin đăng nhập database test từ môi trường. */
    static String credential(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Set " + name + " for Supabase integration tests");
        }
        return value;
    }

    /** Hàm trợ giúp: mở kết nối tới database test. */
    static Connection connect() throws SQLException {
        Properties properties = new Properties();
        properties.setProperty("user", credential("SCMS_POSTGRES_TEST_USERNAME"));
        properties.setProperty("password", credential("SCMS_POSTGRES_TEST_PASSWORD"));
        properties.setProperty("sslmode", System.getenv().getOrDefault("DB_SSL_MODE", "require"));
        String certificate = System.getenv("DB_SSL_ROOT_CERT");
        if (certificate != null && !certificate.isBlank()) properties.setProperty("sslrootcert", certificate);
        return connect(credential("SCMS_POSTGRES_TEST_URL"), properties);
    }

    /** Hàm trợ giúp: mở kết nối tới database test với URL/credential cho trước. */
    static Connection connect(String url, Properties properties) throws SQLException {
        SupabaseConfiguration.validateConnection(url, properties.getProperty("sslmode", "require"));
        return DriverManager.getConnection(url, properties);
    }
}
