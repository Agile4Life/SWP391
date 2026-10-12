package com.swp391.scms.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/** Reject unsafe cloud configuration before Hibernate or the pool opens a connection. */
@Configuration(proxyBeanMethods = false)
@Profile("supabase")
public class SupabaseConfiguration {
    @Bean
    static BeanFactoryPostProcessor validateSupabaseConnection(Environment environment) {
        return beanFactory -> {
            if (Arrays.stream(environment.getActiveProfiles()).anyMatch(p -> p.equals("local") || p.equals("sqlserver"))) {
                throw new IllegalStateException("Supabase cannot be combined with local or sqlserver profiles");
            }
            for (String property : new String[]{"spring.datasource.url", "spring.datasource.username",
                    "spring.datasource.password", "app.jwt.secret"}) {
                if (environment.getRequiredProperty(property).isBlank()) {
                    throw new IllegalStateException("Missing required Supabase configuration: " + property);
                }
            }
            String url = environment.getRequiredProperty("spring.datasource.url");
            if (!url.startsWith("jdbc:postgresql:") || url.matches("(?is).*[?&](?:user|password|ssl|sslmode|sslfactory)=.*")) {
                throw new IllegalStateException("Use a PostgreSQL JDBC URL; configure credentials and TLS separately");
            }
            String sslMode = environment.getProperty("DB_SSL_MODE", "require").toLowerCase(Locale.ROOT);
            if (!Set.of("require", "verify-ca", "verify-full").contains(sslMode)) {
                throw new IllegalStateException("Supabase requires encrypted SSL connections");
            }
        };
    }
}
