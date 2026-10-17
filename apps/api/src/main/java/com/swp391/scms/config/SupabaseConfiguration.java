package com.swp391.scms.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/** Reject unsafe cloud configuration before Hibernate or the pool opens a connection. */
@Configuration(proxyBeanMethods = false)
public class SupabaseConfiguration {
    @Bean
    static BeanFactoryPostProcessor validateSupabaseConnection(Environment environment) {
        return beanFactory -> {
            if (!environment.matchesProfiles("supabase")) {
                throw new IllegalStateException("The Supabase profile is required for every database connection");
            }
            if (Arrays.stream(environment.getActiveProfiles()).anyMatch(p -> !p.equals("supabase"))) {
                throw new IllegalStateException("Use the Supabase profile without alternative database profiles");
            }
            for (String property : new String[]{"spring.datasource.url", "spring.datasource.username",
                    "spring.datasource.password", "app.jwt.secret"}) {
                if (environment.getRequiredProperty(property).isBlank()) {
                    throw new IllegalStateException("Missing required Supabase configuration: " + property);
                }
            }
            validateConnection(environment.getRequiredProperty("spring.datasource.url"),
                    environment.getProperty("DB_SSL_MODE", "require"));
        };
    }

    static void validateConnection(String url, String sslMode) {
        if (!url.startsWith("jdbc:postgresql:") || url.matches("(?is).*[?&](?:user|password|ssl|sslmode|sslfactory)=.*")) {
            throw new IllegalStateException("Use a PostgreSQL JDBC URL; configure credentials and TLS separately");
        }
        if (!Set.of("require", "verify-ca", "verify-full").contains(sslMode.toLowerCase(Locale.ROOT))) {
            throw new IllegalStateException("Supabase requires encrypted SSL connections");
        }
    }
}
