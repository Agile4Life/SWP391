package com.swp391.scms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.util.List;
import java.util.Locale;

/**
 * Cấu hình đa ngôn ngữ: đọc ngôn ngữ từ header Accept-Language, mặc định tiếng Việt, hỗ trợ thêm tiếng Anh.
 *
 * Internationalization (i18n) configuration for SCMS API.
 * Resolves request locale using HTTP 'Accept-Language' header.
 * Default locale is Vietnamese ('vi'), with full English ('en') support.
 */
@Configuration
public class I18nConfig {

    public static final Locale LOCALE_VI = Locale.forLanguageTag("vi");
    public static final Locale LOCALE_EN = Locale.ENGLISH;

    /** Bộ chọn ngôn ngữ theo header Accept-Language; ngôn ngữ không hỗ trợ sẽ rơi về tiếng Việt. */
    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(LOCALE_VI);
        resolver.setSupportedLocales(List.of(LOCALE_VI, LOCALE_EN));
        return resolver;
    }
}
