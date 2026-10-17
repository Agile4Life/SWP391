package com.swp391.scms.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/** Dedicated Supabase test credentials; callers isolate changes in generated schemas. */
final class SupabaseTestDatabase {
    private SupabaseTestDatabase() { }

    static String credential(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Set " + name + " for Supabase integration tests");
        }
        return value;
    }

    static Connection connect() throws SQLException {
        Properties properties = new Properties();
        properties.setProperty("user", credential("SCMS_POSTGRES_TEST_USERNAME"));
        properties.setProperty("password", credential("SCMS_POSTGRES_TEST_PASSWORD"));
        properties.setProperty("sslmode", System.getenv().getOrDefault("DB_SSL_MODE", "require"));
        String certificate = System.getenv("DB_SSL_ROOT_CERT");
        if (certificate != null && !certificate.isBlank()) properties.setProperty("sslrootcert", certificate);
        return connect(credential("SCMS_POSTGRES_TEST_URL"), properties);
    }

    static Connection connect(String url, Properties properties) throws SQLException {
        SupabaseConfiguration.validateConnection(url, properties.getProperty("sslmode", "require"));
        return DriverManager.getConnection(url, properties);
    }
}
